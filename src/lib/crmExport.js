import * as XLSX from 'xlsx';
import { findAccountId } from '@/lib/googleSheets';

const RECORD_TYPE_ID = '012b0000000HvT9AAK';
const EVENT = 'soldiers HK';
const BANK_ACCOUNT = 'Hapoalim';
const STAGE_NAME = 'Posted';
const CURRENCY = 'ILS';

const PAY_TYPE_EN = {
  1: 'Cash',
  2: 'Cheque',
  3: 'CreditCard',
  4: 'BankTransfer',
  10: 'App',
};

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatTodayDMY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function buildDescription(month, year) {
  const monthName = HEBREW_MONTHS[month];
  return `תשלום שכר דירה חייל/ת בבית ${monthName} ${year}`;
}

const CRM_COLUMNS = [
  'RecordTypeId', 'Name', 'Amount', 'Event__c', 'Accountid',
  'cash_cheque_pp__c', 'Receipt_Num__c', 'Bank_account__c',
  'CloseDate', 'StageName', 'Description', 'CurrencyIsoCode',
];

/**
 * Transforms successful receipt records into CRM row objects.
 * selectedMonth is { month: 0-11, year: number }
 */
export function buildCrmRecords(records, accountIdMap, selectedMonth) {
  const today = formatTodayDMY();
  const closeDate = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}-01`;
  const description = buildDescription(selectedMonth.month, selectedMonth.year);

  return records
    .filter(r => r.receiptStatus === 'done')
    .map(r => {
      const accountId = findAccountId(r.name, accountIdMap) || '';
      return {
        RecordTypeId: RECORD_TYPE_ID,
        Name: `${r.name}-Donation ${today}`,
        Amount: r.amount,
        Event__c: EVENT,
        Accountid: accountId,
        cash_cheque_pp__c: PAY_TYPE_EN[r.payType] || 'BankTransfer',
        Receipt_Num__c: r.receiptNumber || '',
        Bank_account__c: BANK_ACCOUNT,
        CloseDate: closeDate,
        StageName: STAGE_NAME,
        Description: description,
        CurrencyIsoCode: CURRENCY,
        _matched: !!accountId,
        _originalName: r.name,
        _id: r.id,
      };
    });
}

const COL_WIDTHS = [
  { wch: 20 },  // RecordTypeId
  { wch: 38 },  // Name
  { wch: 10 },  // Amount
  { wch: 14 },  // Event__c
  { wch: 20 },  // Accountid
  { wch: 16 },  // cash_cheque_pp__c
  { wch: 14 },  // Receipt_Num__c
  { wch: 14 },  // Bank_account__c
  { wch: 12 },  // CloseDate
  { wch: 10 },  // StageName
  { wch: 42 },  // Description
  { wch: 16 },  // CurrencyIsoCode
];

export function exportCrmXlsx(crmRecords) {
  const rows = crmRecords.map(row => {
    const obj = {};
    for (const col of CRM_COLUMNS) {
      obj[col] = row[col];
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: CRM_COLUMNS });
  ws['!cols'] = COL_WIDTHS;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CRM Export');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function downloadXlsx(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { CRM_COLUMNS };
