'use server';

// Real API only when explicitly disabled. Default = mock (no real API calls).
const isMock = () => process.env.GREEN_INVOICE_MOCK !== 'false';

let mockCounter = 10000;

async function fetchWithTimeout(url, options, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function getToken() {
  if (isMock()) {
    return 'mock-jwt-token-for-testing';
  }
  const apiUrl = process.env.GREEN_INVOICE_API_URL;
  const res = await fetchWithTimeout(`${apiUrl}account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: process.env.GREEN_INVOICE_KEY,
      secret: process.env.GREEN_INVOICE_SECRET,
    }),
  }, 15000);

  const data = await res.json();
  if (data.errorCode && data.errorCode !== 0) {
    throw new Error(`Auth failed: ${data.errorMessage || 'Unknown error'}`);
  }
  if (!data.token) {
    throw new Error('Auth failed: no token in response');
  }
  return data.token;
}

function buildReceiptPayload(record) {
  const client = {
    id: '',
    name: record.name,
    emails: record.email ? [record.email] : [],
    taxId: '',
    address: '',
    city: '',
    zip: '',
    country: 'IL',
    phone: '',
    fax: '',
    mobile: '',
    add: true,
    self: false,
  };

  const payment = {
    date: record.date,
    type: record.payType,
    price: record.amount,
    currency: 'ILS',
    currencyRate: 1,
    bankName: '',
    bankBranch: '',
    bankAccount: '',
    chequeNum: '',
    accountId: '',
    transactionId: '',
    appType: record.appType || 2,
    subType: 2,
    cardType: 0,
    cardNum: record.card || '',
    dealType: 1,
    numPayments: 1,
    firstPayment: 0,
  };

  return {
    description: record.description || '',
    remarks: record.remarks || '',
    footer: '',
    emailContent: '',
    type: 400,
    date: record.date,
    dueDate: record.date,
    lang: 'he',
    currency: 'ILS',
    vatType: 0,
    rounding: false,
    signed: true,
    attachment: false,
    maxPayments: 1,
    client,
    payment: [payment],
    linkedPaymentId: '',
    linkType: '',
  };
}

async function createReceipt(token, record) {
  if (isMock()) {
    mockCounter++;
    return {
      id: record.id,
      receiptStatus: 'done',
      receiptNumber: mockCounter,
      errorCode: null,
      errorMessage: null,
    };
  }

  const apiUrl = process.env.GREEN_INVOICE_API_URL;
  const payload = buildReceiptPayload(record);

  const res = await fetchWithTimeout(`${apiUrl}documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }, 15000);

  const data = await res.json();

  if (data.errorCode && data.errorCode !== 0) {
    return {
      id: record.id,
      receiptStatus: 'error',
      receiptNumber: null,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage || 'Unknown error',
    };
  }

  return {
    id: record.id,
    receiptStatus: 'done',
    receiptNumber: data.number,
    errorCode: null,
    errorMessage: null,
  };
}

/**
 * Server Action: processes a single record and returns the result.
 * Called sequentially from the client to enable progress tracking.
 */
export async function processOneReceipt(token, record) {
  try {
    return await createReceipt(token, record);
  } catch (err) {
    return {
      id: record.id,
      receiptStatus: 'error',
      receiptNumber: null,
      errorCode: -1,
      errorMessage: err.message,
    };
  }
}

/**
 * Server Action: search Green Invoice for existing receipts (type 400)
 * within a date range. Returns flat array of { clientName, amount, receiptNumber, documentDate }.
 */
export async function searchExistingReceipts(token, fromDate, toDate) {
  if (isMock()) return [];

  const apiUrl = process.env.GREEN_INVOICE_API_URL;
  const all = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const url = `${apiUrl}documents/search`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: [400],
        fromDate,
        toDate,
        page,
        pageSize,
        sort: 'documentDate',
      }),
    }, 20000);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error(`Search API returned non-JSON (${res.status}):`, text.slice(0, 200));
      throw new Error(`Search API returned status ${res.status} (non-JSON response)`);
    }

    const data = await res.json();

    if (data.errorCode && data.errorCode !== 0) {
      throw new Error(`Search failed: ${data.errorMessage || 'Unknown error'}`);
    }

    for (const doc of (data.items || [])) {
      all.push({
        clientName: doc.client?.name || '',
        amount: doc.amount ?? 0,
        receiptNumber: doc.number,
        documentDate: doc.documentDate || '',
        description: doc.description || '',
      });
    }

    if (page >= (data.pages || 1)) break;
    page++;
  }

  return all;
}

/**
 * Server Action: authenticates and returns a JWT token.
 */
export async function authenticate() {
  return await getToken();
}
