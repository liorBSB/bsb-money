import * as XLSX from 'xlsx';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const PAY_TYPE_HEBREW = {
  BankTransfer: 'העברה בנקאית',
  Cash: 'מזומן',
  Cheque: "צ'ק",
  CreditCard: 'כרטיס אשראי',
  App: 'אפליקציה',
};

function formatDateDMY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function buildRentChargeRecords(crmRecords) {
  return crmRecords.map(r => ({
    _id: r._id,
    soldierName: r._originalName || '',
    date: formatDateDMY(r.CloseDate),
    amount: r.Amount,
    transferMethod: PAY_TYPE_HEBREW[r.cash_cheque_pp__c] || 'העברה בנקאית',
    receiptNumber: r.Receipt_Num__c || '',
    sfEntered: true,
  }));
}

const TITLE_PREFIX = 'חיוב שכר דירה חודש';

const EXPORT_HEADERS = [
  'הוזן ב-SF',
  'מספר קבלה',
  'אופן העברה',
  'סכום',
  'תאריך',
  'שם חייל/ת',
];

const COL_WIDTHS = [
  { wch: 12 },
  { wch: 14 },
  { wch: 18 },
  { wch: 10 },
  { wch: 14 },
  { wch: 20 },
];

export function exportRentChargeXlsx(rentRecords, selectedMonth) {
  const monthName = HEBREW_MONTHS[selectedMonth.month];
  const shortYear = String(selectedMonth.year).slice(-2);
  const title = `${TITLE_PREFIX} ${monthName} ${shortYear}`;

  const ws = XLSX.utils.aoa_to_sheet([]);

  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' });
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: EXPORT_HEADERS.length - 1 } }];

  XLSX.utils.sheet_add_aoa(ws, [EXPORT_HEADERS], { origin: 'A2' });

  const dataRows = rentRecords.map(r => [
    r.sfEntered ? 'V' : '',
    r.receiptNumber,
    r.transferMethod,
    r.amount,
    r.date,
    r.soldierName,
  ]);
  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A3' });

  ws['!cols'] = COL_WIDTHS;
  ws['!dir'] = 'rtl';

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'חיוב שכר דירה');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function downloadRentChargeXlsx(buffer, filename) {
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
