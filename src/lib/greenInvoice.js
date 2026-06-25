'use server';

import {
  accountantReportDateRange,
  filterSoldierPaymentReceipts,
  isSoldierPaymentReceipt,
} from '@/lib/soldierPaymentFilter';

// Real API only when explicitly disabled. Default = mock (no real API calls).
const isMock = () => process.env.GREEN_INVOICE_MOCK !== 'false';

let mockCounter = 10000;

function getRequiredEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} in environment (.env.local recommended)`);
  }
  return value;
}

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

function buildApiUrl(path) {
  const base = getRequiredEnv('GREEN_INVOICE_API_URL');
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function getToken() {
  if (isMock()) {
    return 'mock-jwt-token-for-testing';
  }
  const res = await fetchWithTimeout(buildApiUrl('account/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: getRequiredEnv('GREEN_INVOICE_KEY'),
      secret: getRequiredEnv('GREEN_INVOICE_SECRET'),
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

  const payload = buildReceiptPayload(record);

  const res = await fetchWithTimeout(buildApiUrl('documents'), {
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

  const all = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const url = buildApiUrl('documents/search');
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

function monthDateRange(selectedMonth) {
  const { month, year } = selectedMonth;
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function mapDocToAccountantReceipt(doc) {
  const payment = Array.isArray(doc.payment) ? doc.payment[0] : null;
  return {
    id: doc.id || '',
    clientName: doc.client?.name || '',
    amount: doc.amount ?? payment?.price ?? 0,
    receiptNumber: doc.number,
    documentDate: doc.documentDate || '',
    description: doc.description || doc.remarks || '',
    remarks: doc.remarks || '',
    payType: payment?.type ?? null,
  };
}

const MOCK_ACCOUNTANT_RECEIPTS = [
  {
    id: 'mock-1',
    clientName: 'דני לוי',
    amount: 500,
    receiptNumber: 10001,
    documentDate: '2025-06-05',
    description: 'תשלום שכר דירה חייל/ת בבית- יוני 2025',
    remarks: '',
    payType: 1,
  },
  {
    id: 'mock-2',
    clientName: 'שרה כהן',
    amount: 600,
    receiptNumber: 10002,
    documentDate: '2025-06-01',
    description: 'תשלום שכר דירה חייל/ת בבית- יוני 2025',
    remarks: '',
    payType: 4,
  },
  {
    id: 'mock-4',
    clientName: 'משה גדול',
    amount: 6000,
    receiptNumber: 10004,
    documentDate: '2025-06-03',
    description: 'תשלום שכר דירה חייל/ת בבית- יוני 2025',
    remarks: '',
    payType: 4,
  },
];

async function getDocument(token, id) {
  const res = await fetchWithTimeout(buildApiUrl(`documents/${id}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, 20000);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`Get document API returned non-JSON (${res.status}):`, text.slice(0, 200));
    throw new Error(`Get document API returned status ${res.status} (non-JSON response)`);
  }

  const data = await res.json();

  if (data.errorCode && data.errorCode !== 0) {
    throw new Error(`Get document failed: ${data.errorMessage || 'Unknown error'}`);
  }

  return data;
}

async function searchAccountantReceiptsPage(token, fromDate, toDate, page, pageSize) {
  const res = await fetchWithTimeout(buildApiUrl('documents/search'), {
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

  return data;
}

/**
 * Server Action: fetch soldier payment receipts (type 400 / קבלה) for the accountant report.
 * Searches the selected month, then keeps receipts with 0 < amount ≤ 5,000.
 */
export async function fetchAccountantReceipts(token, selectedMonth) {
  const { fromDate, toDate } = accountantReportDateRange(selectedMonth);

  if (isMock()) {
    return filterSoldierPaymentReceipts(MOCK_ACCOUNTANT_RECEIPTS)
      .map(r => ({ ...r }));
  }
  const all = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const data = await searchAccountantReceiptsPage(token, fromDate, toDate, page, pageSize);

    for (const doc of (data.items || [])) {
      const mapped = mapDocToAccountantReceipt(doc);
      if (isSoldierPaymentReceipt(mapped, selectedMonth)) {
        all.push(mapped);
      }
    }

    if (page >= (data.pages || 1)) break;
    page++;
  }

  for (let i = 0; i < all.length; i++) {
    if (all[i].payType != null) continue;
    if (!all[i].id) continue;
    const detail = await getDocument(token, all[i].id);
    const enriched = mapDocToAccountantReceipt(detail);
    all[i] = { ...all[i], ...enriched, id: all[i].id };
  }

  return all;
}
