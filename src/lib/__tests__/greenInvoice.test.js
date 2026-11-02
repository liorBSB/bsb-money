import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

vi.stubEnv('GREEN_INVOICE_MOCK', 'false');
vi.stubEnv('GREEN_INVOICE_API_URL', 'https://api.test.com/');
vi.stubEnv('GREEN_INVOICE_KEY', 'test-key');
vi.stubEnv('GREEN_INVOICE_SECRET', 'test-secret');

const { authenticate, processOneReceipt, fetchAccountantReceipts } = await import('../greenInvoice');
const { isSoldierPaymentReceipt } = await import('../soldierPaymentFilter');

function makeRecord(overrides = {}) {
  return {
    id: 'rec-1',
    name: 'יוסי כהן',
    email: 'yossi@test.com',
    date: '2025-01-15',
    amount: 500,
    payType: 4,
    appType: 2,
    card: '1234',
    description: 'תשלום',
    remarks: 'הערה',
    ...overrides,
  };
}

function mockFetchResponse(data, ok = true, status = ok ? 200 : 500) {
  fetch.mockResolvedValueOnce({
    ok,
    status,
    headers: { get: (name) => (name === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockEmptyFetchResponse(status = 401) {
  fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === 'content-type' ? 'application/json' : null) },
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    text: () => Promise.resolve(''),
  });
}

describe('authenticate', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('requests a token from the Morning OAuth endpoint and returns it', async () => {
    mockFetchResponse({ accessToken: 'jwt-abc-123', expiresAt: 1772966873 });

    const { token } = await authenticate();

    expect(token).toBe('jwt-abc-123');
    expect(fetch).toHaveBeenCalledWith('https://api.morning.co/idp/v1/oauth/token', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: 'test-key', client_secret: 'test-secret' }),
    }));
  });

  it('accepts snake_case access_token responses', async () => {
    mockFetchResponse({ access_token: 'jwt-snake', expires_in: 3600 });

    const { token } = await authenticate();
    expect(token).toBe('jwt-snake');
  });

  it('returns OAuth error descriptions', async () => {
    mockFetchResponse({ error: 'invalid_client', error_description: 'Bad credentials' }, false, 401);

    await expect(authenticate()).resolves.toEqual({ error: 'Auth failed: Bad credentials' });
  });

  it('also works when response includes errorCode 0', async () => {
    mockFetchResponse({ errorCode: 0, token: 'jwt-abc-123' });

    const { token } = await authenticate();
    expect(token).toBe('jwt-abc-123');
  });

  it('returns error on auth failure', async () => {
    mockFetchResponse({ errorCode: 1, errorMessage: 'Invalid credentials' });

    await expect(authenticate()).resolves.toEqual({ error: 'Auth failed: Invalid credentials' });
  });

  it('returns default message when no error message provided', async () => {
    mockFetchResponse({ errorCode: 1 });

    await expect(authenticate()).resolves.toEqual({ error: 'Auth failed: Unknown error' });
  });

  it('returns error when response has no token', async () => {
    mockFetchResponse({});

    await expect(authenticate()).resolves.toEqual({ error: 'Auth failed: no token in response (HTTP 200)' });
  });

  it('returns a clear error when the token endpoint body is empty', async () => {
    mockEmptyFetchResponse(401);

    await expect(authenticate()).resolves.toEqual({ error: 'Auth: empty response (HTTP 401)' });
  });
});

describe('processOneReceipt', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('sends correct receipt payload and returns success', async () => {
    mockFetchResponse({ errorCode: 0, number: 55001 });

    const result = await processOneReceipt('jwt-token', makeRecord());

    expect(result).toEqual({
      id: 'rec-1',
      receiptStatus: 'done',
      receiptNumber: 55001,
      errorCode: null,
      errorMessage: null,
    });

    const call = fetch.mock.calls[0];
    expect(call[0]).toBe('https://api.test.com/documents');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Authorization']).toBe('Bearer jwt-token');

    const body = JSON.parse(call[1].body);
    expect(body.type).toBe(400);
    expect(body.client.name).toBe('יוסי כהן');
    expect(body.client.emails).toEqual(['yossi@test.com']);
    expect(body.client.country).toBe('IL');
    expect(body.client.add).toBe(true);
    expect(body.payment).toHaveLength(1);
    expect(body.payment[0].price).toBe(500);
    expect(body.payment[0].type).toBe(4);
    expect(body.payment[0].currency).toBe('ILS');
    expect(body.payment[0].cardNum).toBe('1234');
    expect(body.lang).toBe('he');
    expect(body.currency).toBe('ILS');
    expect(body.vatType).toBe(0);
    expect(body.signed).toBe(true);
    expect(body.description).toBe('תשלום');
    expect(body.remarks).toBe('הערה');
  });

  it('handles API error response', async () => {
    mockFetchResponse({ errorCode: 3012, errorMessage: 'Missing field' });

    const result = await processOneReceipt('jwt-token', makeRecord());

    expect(result).toEqual({
      id: 'rec-1',
      receiptStatus: 'error',
      receiptNumber: null,
      errorCode: 3012,
      errorMessage: 'Missing field',
    });
  });

  it('handles API error with no message', async () => {
    mockFetchResponse({ errorCode: 5000 });

    const result = await processOneReceipt('jwt-token', makeRecord());

    expect(result).toEqual({
      id: 'rec-1',
      receiptStatus: 'error',
      receiptNumber: null,
      errorCode: 5000,
      errorMessage: 'Unknown error',
    });
  });

  it('handles network/fetch exceptions', async () => {
    fetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await processOneReceipt('jwt-token', makeRecord());

    expect(result).toEqual({
      id: 'rec-1',
      receiptStatus: 'error',
      receiptNumber: null,
      errorCode: -1,
      errorMessage: 'Network timeout',
    });
  });

  it('sends empty emails array when no email provided', async () => {
    mockFetchResponse({ errorCode: 0, number: 55002 });

    await processOneReceipt('jwt-token', makeRecord({ email: '' }));

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.client.emails).toEqual([]);
  });

  it('uses default appType (Bit) when not provided', async () => {
    mockFetchResponse({ errorCode: 0, number: 55003 });

    await processOneReceipt('jwt-token', makeRecord({ appType: undefined }));

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.payment[0].appType).toBe(1);
  });

  it('handles empty description and remarks', async () => {
    mockFetchResponse({ errorCode: 0, number: 55004 });

    await processOneReceipt('jwt-token', makeRecord({ description: '', remarks: '' }));

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.description).toBe('');
    expect(body.remarks).toBe('');
  });

  it('handles undefined description and remarks', async () => {
    mockFetchResponse({ errorCode: 0, number: 55005 });

    await processOneReceipt('jwt-token', makeRecord({ description: undefined, remarks: undefined }));

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.description).toBe('');
    expect(body.remarks).toBe('');
  });

  it('handles zero amount', async () => {
    mockFetchResponse({ errorCode: 0, number: 55006 });

    await processOneReceipt('jwt-token', makeRecord({ amount: 0 }));

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.payment[0].price).toBe(0);
  });

  it('handles errorCode of 0 as success (not an error)', async () => {
    mockFetchResponse({ errorCode: 0, number: 99999 });

    const result = await processOneReceipt('jwt-token', makeRecord());
    expect(result.receiptStatus).toBe('done');
    expect(result.receiptNumber).toBe(99999);
  });
});

describe('isSoldierPaymentReceipt', () => {
  it('accepts valid soldier payments by amount', () => {
    expect(isSoldierPaymentReceipt({
      amount: 500,
      documentDate: '2025-06-01',
    })).toBe(true);

    expect(isSoldierPaymentReceipt({
      amount: 5000,
      documentDate: '2025-06-25',
    })).toBe(true);
  });

  it('rejects amounts outside 0–5000', () => {
    expect(isSoldierPaymentReceipt({ amount: 0, documentDate: '2025-06-05' })).toBe(false);
    expect(isSoldierPaymentReceipt({ amount: -100, documentDate: '2025-06-05' })).toBe(false);
    expect(isSoldierPaymentReceipt({ amount: 5001, documentDate: '2025-06-05' })).toBe(false);
  });
});

describe('fetchAccountantReceipts', () => {
  beforeEach(() => {
    fetch.mockReset();
    vi.stubEnv('GREEN_INVOICE_MOCK', 'false');
  });

  it('searches type 400 for the full selected month and maps payment from search', async () => {
    mockFetchResponse({
      errorCode: 0,
      pages: 1,
      items: [{
        id: 'doc-1',
        number: 123,
        amount: 500,
        documentDate: '2025-06-01',
        description: 'תשלום שכר דירה',
        client: { name: 'יוסי כהן' },
        payment: [{ type: 1, price: 500 }],
      }],
    });

    const result = await fetchAccountantReceipts('token', { month: 5, year: 2025 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'doc-1',
      clientName: 'יוסי כהן',
      amount: 500,
      receiptNumber: 123,
      documentDate: '2025-06-01',
      payType: 1,
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.type).toEqual([400]);
    expect(body.fromDate).toBe('2025-06-01');
    expect(body.toDate).toBe('2025-09-30');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports catch-up receipts under the month in their remarks, not their issue date', async () => {
    mockFetchResponse({
      errorCode: 0,
      pages: 1,
      items: [
        {
          id: 'june-late', number: 201, amount: 500, documentDate: '2025-08-02',
          remarks: 'תשלום שכר דירה חייל/ת בבית- יוני 2025',
          client: { name: 'מאוחר' }, payment: [{ type: 4, price: 500 }],
        },
        {
          id: 'may-late', number: 202, amount: 500, documentDate: '2025-06-02',
          remarks: 'תשלום שכר דירה חייל/ת בבית- מאי 2025',
          client: { name: 'של מאי' }, payment: [{ type: 4, price: 500 }],
        },
        {
          id: 'july', number: 203, amount: 500, documentDate: '2025-07-02',
          remarks: 'תשלום שכר דירה חייל/ת בבית- יולי 2025',
          client: { name: 'של יולי' }, payment: [{ type: 4, price: 500 }],
        },
      ],
    });

    const result = await fetchAccountantReceipts('token', { month: 5, year: 2025 });

    expect(result.map(r => r.clientName)).toEqual(['מאוחר']);
    expect(result[0].documentDate).toBe('2025-08-02');
  });

  it('fetches document detail when payment type is missing from search', async () => {
    mockFetchResponse({
      errorCode: 0,
      pages: 1,
      items: [{
        id: 'doc-2',
        number: 124,
        amount: 600,
        documentDate: '2025-06-01',
        client: { name: 'דני לוי' },
      }],
    });

    mockFetchResponse({
      errorCode: 0,
      id: 'doc-2',
      number: 124,
      amount: 600,
      documentDate: '2025-06-01',
      client: { name: 'דני לוי' },
      payment: [{ type: 4, price: 600 }],
    });

    const result = await fetchAccountantReceipts('token', { month: 5, year: 2025 });

    expect(result[0].payType).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe('https://api.test.com/documents/doc-2');
    expect(fetch.mock.calls[1][1].method).toBe('GET');
  });

  it('excludes receipts above 5,000 even when returned by search', async () => {
    mockFetchResponse({
      errorCode: 0,
      pages: 1,
      items: [
        {
          id: 'doc-ok',
          number: 125,
          amount: 500,
          documentDate: '2025-06-05',
          remarks: '',
          client: { name: 'תקין' },
          payment: [{ type: 4, price: 500 }],
        },
        {
          id: 'doc-high',
          number: 126,
          amount: 6000,
          documentDate: '2025-06-05',
          remarks: '',
          client: { name: 'גבוה מדי' },
          payment: [{ type: 4, price: 6000 }],
        },
      ],
    });

    const result = await fetchAccountantReceipts('token', { month: 5, year: 2025 });

    expect(result).toHaveLength(1);
    expect(result[0].clientName).toBe('תקין');
  });

  it('paginates through multiple search pages', async () => {
    mockFetchResponse({
      errorCode: 0,
      pages: 2,
      items: [{
        id: 'doc-a',
        number: 1,
        amount: 100,
        documentDate: '2025-01-01',
        remarks: '',
        client: { name: 'א' },
        payment: [{ type: 4, price: 100 }],
      }],
    });

    mockFetchResponse({
      errorCode: 0,
      pages: 2,
      items: [{
        id: 'doc-b',
        number: 2,
        amount: 200,
        documentDate: '2025-01-01',
        remarks: '',
        client: { name: 'ב' },
        payment: [{ type: 1, price: 200 }],
      }],
    });

    const result = await fetchAccountantReceipts('token', { month: 0, year: 2025 });

    expect(result).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).page).toBe(2);
  });
});

describe('fetchAccountantReceipts mock mode', () => {
  it('returns fixture data when mock mode is enabled', async () => {
    vi.stubEnv('GREEN_INVOICE_MOCK', 'true');
    vi.resetModules();
    fetch.mockReset();
    const { fetchAccountantReceipts: fetchMock } = await import('../greenInvoice');

    const result = await fetchMock('token', { month: 5, year: 2025 });

    expect(result).toHaveLength(2);
    expect(result.map(r => r.clientName).sort()).toEqual(['דני לוי', 'שרה כהן']);
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv('GREEN_INVOICE_MOCK', 'false');
    vi.resetModules();
    await import('../greenInvoice');
  });
});
