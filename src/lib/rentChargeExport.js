import * as XLSX from 'xlsx';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const PAY_TYPE_LABELS = {
  1: 'מזומן',
  2: "צ'ק",
  3: 'אשראי',
  4: 'העברה בנקאית',
  10: 'אפליקציה',
};

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

export function formatAmountWithShekel(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return `${n.toLocaleString('he-IL')} ₪`;
}

export function payTypeToHebrew(payType) {
  if (payType == null) return 'לא ידוע';
  return PAY_TYPE_LABELS[payType] || `אחר (${payType})`;
}

export function buildRentChargeRecords(crmRecords) {
  return crmRecords.map(r => ({
    _id: r._id,
    soldierName: r._originalName || '',
    description: r.Description || '',
    date: formatDateDMY(r.CloseDate),
    amount: r.Amount,
    transferMethod: PAY_TYPE_HEBREW[r.cash_cheque_pp__c] || 'העברה בנקאית',
    receiptNumber: r.Receipt_Num__c || '',
    sfEntered: true,
  }));
}

export function buildRentChargeRecordsFromMorning(docs, sfDefault) {
  return docs.map(doc => ({
    _id: doc.id || crypto.randomUUID(),
    soldierName: doc.clientName || '',
    description: doc.description || doc.remarks || '',
    date: formatDateDMY(doc.documentDate),
    amount: doc.amount ?? 0,
    transferMethod: payTypeToHebrew(doc.payType),
    payType: doc.payType,
    receiptNumber: doc.receiptNumber ?? '',
    sfEntered: sfDefault,
  }));
}

export function buildRentChargeSummary(rentRecords) {
  const map = {};
  for (const r of rentRecords) {
    const label = r.transferMethod || 'לא ידוע';
    if (!map[label]) map[label] = { count: 0, total: 0 };
    map[label].count++;
    map[label].total += r.amount || 0;
  }

  const byMethod = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .map(([label, data]) => ({
      label,
      count: data.count,
      total: data.total,
    }));

  const grandTotal = rentRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    byMethod,
    count: rentRecords.length,
    grandTotal,
  };
}

const TITLE_PREFIX = 'חיוב שכר דירה חודש';

const EXPORT_HEADERS = [
  'הוזן ב-SF',
  'מספר קבלה',
  'אופן העברה',
  'סכום',
  'תאריך',
  'תיאור',
  'שם חייל/ת',
];

const COL_WIDTHS = [
  { wch: 12 },
  { wch: 14 },
  { wch: 18 },
  { wch: 10 },
  { wch: 14 },
  { wch: 36 },
  { wch: 20 },
];

export function exportRentChargeXlsx(rentRecords, selectedMonth) {
  const monthName = HEBREW_MONTHS[selectedMonth.month];
  const shortYear = String(selectedMonth.year).slice(-2);
  const title = `${TITLE_PREFIX} ${monthName} ${shortYear}`;
  const summary = buildRentChargeSummary(rentRecords);

  const ws = XLSX.utils.aoa_to_sheet([]);

  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' });
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: EXPORT_HEADERS.length - 1 } }];

  XLSX.utils.sheet_add_aoa(ws, [EXPORT_HEADERS], { origin: 'A2' });

  const dataRows = rentRecords.map(r => [
    r.sfEntered ? 'V' : '',
    r.receiptNumber,
    r.transferMethod,
    formatAmountWithShekel(r.amount),
    r.date,
    r.description,
    r.soldierName,
  ]);
  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A3' });

  const summaryStartRow = 3 + rentRecords.length + 1;
  const summaryRows = [
    [],
    ['סיכום לפי אופן תשלום'],
    ['אופן תשלום', 'מספר קבלות', 'סכום (₪)'],
    ...summary.byMethod.map(item => [item.label, item.count, formatAmountWithShekel(item.total)]),
    [],
    ['סה״כ', summary.count, formatAmountWithShekel(summary.grandTotal)],
  ];
  XLSX.utils.sheet_add_aoa(ws, summaryRows, { origin: `A${summaryStartRow}` });

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
