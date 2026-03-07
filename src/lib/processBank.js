import * as XLSX from 'xlsx';

const COL_AMOUNT = 2;      // Column C
const COL_CONDITION = 12;   // Column M
const COL_NAME = 14;        // Column O

const SKIP_PATTERNS = ['סה"כ', 'שם לקוח', 'מיון ראשי'];

function parseAmount(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const str = val.toString().replace(/[^0-9.\-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u200e\u200f]/g, '').trim();
}

function isValidName(name) {
  if (!name) return false;
  return !SKIP_PATTERNS.some(pattern => name.includes(pattern));
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a raw bank Excel buffer and groups payments by customer name.
 * Returns records in the Green Invoice 9-column format.
 */
export function processBankFile(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!data.length) {
    throw new Error('הקובץ ריק — אין נתונים בגיליון');
  }
  if (data[0] && data[0].length < 15) {
    throw new Error('הקובץ לא תואם את הפורמט הנדרש — חסרות עמודות. יש להעלות את הקובץ שמתקבל ממערכת שקד');
  }

  const grouped = [];
  let currentName = '';
  let currentSum = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 15) continue;

    const rawName = row[COL_NAME];
    const rawAmount = row[COL_AMOUNT];
    const conditionVal = row[COL_CONDITION];

    const name = cleanName(typeof rawName === 'number' ? String(rawName) : rawName);
    const isNew = isValidName(name);

    if (isNew) {
      if (currentName && Math.abs(currentSum) > 0.01) {
        grouped.push({ name: currentName, amount: currentSum });
      }
      currentName = name;
      currentSum = 0;
    }

    if (currentName) {
      if (conditionVal !== '' && conditionVal != null) {
        currentSum += parseAmount(rawAmount);
      }
    }
  }

  if (currentName && Math.abs(currentSum) > 0.01) {
    grouped.push({ name: currentName, amount: currentSum });
  }

  const today = formatDate(new Date());

  return grouped.map((record, index) => ({
    id: crypto.randomUUID(),
    index: index + 1,
    name: record.name,
    email: '',
    date: today,
    amount: Math.round(record.amount),
    payType: 4,
    card: '',
    appType: 2,
    description: '',
    remarks: '',
    source: 'bank',
    receiptStatus: 'pending',
    receiptNumber: null,
    errorCode: null,
    errorMessage: null,
  }));
}

/**
 * Creates an empty record for manual entry.
 */
export function createEmptyRecord(existingCount) {
  return {
    id: crypto.randomUUID(),
    index: existingCount + 1,
    name: '',
    email: '',
    date: formatDate(new Date()),
    amount: 0,
    payType: 1,
    card: '',
    appType: 2,
    description: '',
    remarks: '',
    source: 'manual',
    receiptStatus: 'pending',
    receiptNumber: null,
    errorCode: null,
    errorMessage: null,
  };
}

const PAY_TYPE_LABELS = {
  1: 'מזומן',
  2: "צ'ק",
  3: 'אשראי',
  4: 'העברה בנקאית',
  10: 'אפליקציה',
};

function buildSummaryByPayType(filtered) {
  const map = {};
  for (const r of filtered) {
    const key = r.payType;
    if (!map[key]) map[key] = { count: 0, total: 0 };
    map[key].count++;
    map[key].total += r.amount || 0;
  }
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([payType, data]) => ({
      label: PAY_TYPE_LABELS[payType] || payType,
      count: data.count,
      total: data.total,
    }));
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

/**
 * Exports records to an xlsx buffer for download.
 */
export function exportToExcel(records, type) {
  const wb = XLSX.utils.book_new();

  if (type === 'success') {
    const filtered = records.filter(r => r.receiptStatus === 'done');
    const summary = buildSummaryByPayType(filtered);
    const grandTotal = filtered.reduce((s, r) => s + (r.amount || 0), 0);

    const sheetData = [];

    sheetData.push(['דוח תשלומים ומספרי קבלות']);
    sheetData.push([`תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`]);
    sheetData.push([]);

    sheetData.push(['#', 'שם לקוח', 'תאריך', 'סכום (₪)', 'אופן תשלום', 'כרטיס', 'מספר קבלה']);

    filtered.forEach((r, i) => {
      sheetData.push([
        i + 1,
        r.name,
        r.date,
        r.amount,
        PAY_TYPE_LABELS[r.payType] || r.payType,
        r.card || '',
        r.receiptNumber,
      ]);
    });

    sheetData.push([]);
    sheetData.push(['סיכום לפי אופן תשלום']);
    sheetData.push(['אופן תשלום', 'מספר רשומות', 'סכום (₪)']);

    for (const item of summary) {
      sheetData.push([item.label, item.count, item.total]);
    }

    sheetData.push([]);
    sheetData.push(['סה״כ', filtered.length, grandTotal]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!dir'] = 'rtl';

    setColWidths(ws, [5, 25, 14, 14, 18, 12, 14]);

    const headerRow = 3;
    const summaryHeaderRow = headerRow + filtered.length + 2;
    for (let c = 0; c < 7; c++) {
      const headerCell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      if (headerCell) headerCell.t = 's';
      const sumHeaderCell = ws[XLSX.utils.encode_cell({ r: summaryHeaderRow + 1, c })];
      if (sumHeaderCell) sumHeaderCell.t = 's';
    }

    for (let r = headerRow + 1; r < headerRow + 1 + filtered.length; r++) {
      const amountCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      if (amountCell) amountCell.z = '#,##0';
    }

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: summaryHeaderRow, c: 0 }, e: { r: summaryHeaderRow, c: 2 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'דוח תשלומים');

  } else {
    const filtered = records.filter(r => r.receiptStatus === 'error');

    const sheetData = [];

    sheetData.push(['דוח שגיאות']);
    sheetData.push([`תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`]);
    sheetData.push([]);

    sheetData.push(['#', 'שם לקוח', 'תאריך', 'סכום (₪)', 'אופן תשלום', 'קוד שגיאה', 'שגיאה']);

    filtered.forEach((r, i) => {
      sheetData.push([
        i + 1,
        r.name,
        r.date,
        r.amount,
        PAY_TYPE_LABELS[r.payType] || r.payType,
        r.errorCode,
        r.errorMessage || '',
      ]);
    });

    sheetData.push([]);
    sheetData.push([`סה״כ שגויים: ${filtered.length}`]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!dir'] = 'rtl';
    setColWidths(ws, [5, 25, 14, 14, 18, 12, 30]);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'שגויים');
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function downloadExcel(buffer, filename) {
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
