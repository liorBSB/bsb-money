import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { processBankFile, createEmptyRecord, exportToExcel } from '../processBank';

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

const selectedMonth = { month: 0, year: 2025 };

function buildExcelBuffer(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

function makeRow({ name = '', amount = 0, condition = 'X' } = {}) {
  const row = new Array(15).fill('');
  row[2] = amount;      // COL_AMOUNT (C)
  row[12] = condition;   // COL_CONDITION (M)
  row[14] = name;        // COL_NAME (O)
  return row;
}

describe('processBankFile', () => {
  it('groups payments by customer name', () => {
    const rows = [
      makeRow({ name: 'יוסי כהן', amount: 100, condition: 'X' }),
      makeRow({ name: '', amount: 200, condition: 'X' }),
      makeRow({ name: 'דני לוי', amount: 300, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('יוסי כהן');
    expect(result[0].amount).toBe(300);
    expect(result[1].name).toBe('דני לוי');
    expect(result[1].amount).toBe(300);
  });

  it('sums multiple amounts under the same customer', () => {
    const rows = [
      makeRow({ name: 'אבי', amount: 100.5, condition: 'Y' }),
      makeRow({ name: '', amount: 200.3, condition: 'Y' }),
      makeRow({ name: '', amount: 50, condition: 'Y' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('אבי');
    expect(result[0].amount).toBe(351); // Math.round(350.8) = 351
  });

  it('skips rows with skip patterns in name', () => {
    const rows = [
      makeRow({ name: 'סה"כ', amount: 999, condition: 'X' }),
      makeRow({ name: 'שם לקוח', amount: 999, condition: 'X' }),
      makeRow({ name: 'מיון ראשי', amount: 999, condition: 'X' }),
      makeRow({ name: 'לקוח אמיתי', amount: 500, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('לקוח אמיתי');
  });

  it('skips rows where condition column is empty', () => {
    const rows = [
      makeRow({ name: 'ראובן', amount: 100, condition: 'X' }),
      makeRow({ name: '', amount: 999, condition: '' }),
      makeRow({ name: '', amount: 200, condition: 'Y' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(300); // 100 + 200, skipping the 999
  });

  it('ignores customers with zero total', () => {
    const rows = [
      makeRow({ name: 'אפס', amount: 0, condition: 'X' }),
      makeRow({ name: 'ריק', amount: 0.001, condition: 'X' }),
      makeRow({ name: 'תקין', amount: 50, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('תקין');
  });

  it('handles negative amounts', () => {
    const rows = [
      makeRow({ name: 'זיכוי', amount: -150, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-150);
  });

  it('handles amounts as strings with commas and currency symbols', () => {
    const rows = [
      makeRow({ name: 'טקסט', amount: '₪1,234.56', condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1235); // Math.round(1234.56)
  });

  it('strips unicode directional marks from names', () => {
    const rows = [
      makeRow({ name: '\u200eשלום\u200f', amount: 100, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('שלום');
  });

  it('handles numeric name values', () => {
    const rows = [
      makeRow({ name: 12345, amount: 100, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('12345');
  });

  it('throws for empty or narrow spreadsheet', () => {
    const narrow = buildExcelBuffer([['a', 'b', 'c']]);
    expect(() => processBankFile(narrow, selectedMonth)).toThrow();

    const empty = buildExcelBuffer([]);
    expect(() => processBankFile(empty, selectedMonth)).toThrow();
  });

  it('sets correct default fields on each record', () => {
    const rows = [
      makeRow({ name: 'בדיקה', amount: 100, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result[0]).toMatchObject({
      id: 'test-uuid-1234',
      index: 1,
      name: 'בדיקה',
      email: '',
      date: '2025-01-01',
      amount: 100,
      payType: 4,
      card: '',
      appType: 2,
      description: '',
      remarks: 'תשלום שכר דירה חייל/ת בבית- ינואר 2025',
      source: 'bank',
      receiptStatus: 'pending',
      receiptNumber: null,
      errorCode: null,
      errorMessage: null,
    });
  });

  it('handles very small amounts near the 0.01 threshold', () => {
    const rows = [
      makeRow({ name: 'כמעט אפס', amount: 0.005, condition: 'X' }),
      makeRow({ name: 'מעל סף', amount: 0.02, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('מעל סף');
  });

  it('handles multiple customers sequentially', () => {
    const rows = [
      makeRow({ name: 'א', amount: 10, condition: 'X' }),
      makeRow({ name: 'ב', amount: 20, condition: 'X' }),
      makeRow({ name: 'ג', amount: 30, condition: 'X' }),
      makeRow({ name: 'ד', amount: 40, condition: 'X' }),
    ];
    const buf = buildExcelBuffer(rows);
    const result = processBankFile(buf, selectedMonth);

    expect(result).toHaveLength(4);
    expect(result.map(r => r.name)).toEqual(['א', 'ב', 'ג', 'ד']);
    expect(result.map(r => r.amount)).toEqual([10, 20, 30, 40]);
    expect(result.map(r => r.index)).toEqual([1, 2, 3, 4]);
  });
});

describe('createEmptyRecord', () => {
  it('creates a record with correct defaults', () => {
    const record = createEmptyRecord(5, selectedMonth);
    expect(record).toMatchObject({
      id: 'test-uuid-1234',
      index: 6,
      name: '',
      email: '',
      date: '2025-01-01',
      amount: 0,
      payType: 1,
      card: '',
      appType: 2,
      description: '',
      remarks: 'תשלום שכר דירה חייל/ת בבית- ינואר 2025',
      source: 'manual',
      receiptStatus: 'pending',
      receiptNumber: null,
      errorCode: null,
      errorMessage: null,
    });
  });

  it('sets index based on existing count', () => {
    expect(createEmptyRecord(0, selectedMonth).index).toBe(1);
    expect(createEmptyRecord(10, selectedMonth).index).toBe(11);
    expect(createEmptyRecord(999, selectedMonth).index).toBe(1000);
  });

  it('sets date in YYYY-MM-DD format based on selected month', () => {
    const record = createEmptyRecord(0, selectedMonth);
    expect(record.date).toBe('2025-01-01');
  });
});

function readSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

describe('exportToExcel', () => {
  const baseRecords = [
    {
      name: 'הצלחה', date: '2025-01-15', amount: 500, payType: 4,
      card: '1234', appType: 2, receiptStatus: 'done', receiptNumber: 99001,
      errorCode: null, errorMessage: null,
    },
    {
      name: 'כישלון', date: '2025-01-15', amount: 300, payType: 1,
      card: '', appType: 2, receiptStatus: 'error', receiptNumber: null,
      errorCode: 3012, errorMessage: 'Invalid client',
    },
    {
      name: 'ממתין', date: '2025-01-15', amount: 100, payType: 2,
      card: '', appType: 2, receiptStatus: 'pending', receiptNumber: null,
      errorCode: null, errorMessage: null,
    },
  ];

  it('exports success report with title, headers, data and summary', () => {
    const buffer = exportToExcel(baseRecords, 'success');
    const rows = readSheet(buffer);

    expect(rows[0][0]).toBe('דוח תשלומים ומספרי קבלות');
    expect(rows[1][0]).toContain('תאריך הפקה');

    expect(rows[3][1]).toBe('שם לקוח');
    expect(rows[3][3]).toBe('סכום (₪)');
    expect(rows[3][6]).toBe('מספר קבלה');

    const dataRow = rows[4];
    expect(dataRow[0]).toBe(1);
    expect(dataRow[1]).toBe('הצלחה');
    expect(dataRow[2]).toBe('2025-01-15');
    expect(dataRow[3]).toBe(500);
    expect(dataRow[4]).toBe('העברה בנקאית');
    expect(dataRow[5]).toBe('1234');
    expect(dataRow[6]).toBe(99001);
  });

  it('exports error report with error details', () => {
    const buffer = exportToExcel(baseRecords, 'error');
    const rows = readSheet(buffer);

    expect(rows[0][0]).toBe('דוח שגיאות');
    expect(rows[3][5]).toBe('קוד שגיאה');
    expect(rows[3][6]).toBe('שגיאה');

    const dataRow = rows[4];
    expect(dataRow[1]).toBe('כישלון');
    expect(dataRow[3]).toBe(300);
    expect(dataRow[5]).toBe(3012);
    expect(dataRow[6]).toBe('Invalid client');
  });

  it('has no data rows when no records match', () => {
    const onlyErrors = [baseRecords[1]];
    const buffer = exportToExcel(onlyErrors, 'success');
    const rows = readSheet(buffer);

    expect(rows[0][0]).toBe('דוח תשלומים ומספרי קבלות');
    expect(rows[3][1]).toBe('שם לקוח');
    // Row 4 should be empty (no data), row 5 is summary section
    expect(rows[4]).toEqual(expect.arrayContaining(['']));
  });

  it('includes payment type summary in success report', () => {
    const twoTypes = [
      { ...baseRecords[0], payType: 4, amount: 500 },
      { ...baseRecords[0], name: 'עוד', payType: 1, amount: 200, receiptNumber: 99002 },
    ];
    const buffer = exportToExcel(twoTypes, 'success');
    const rows = readSheet(buffer);

    const summaryHeaderIdx = rows.findIndex(r => r[0] === 'סיכום לפי אופן תשלום');
    expect(summaryHeaderIdx).toBeGreaterThan(4);

    const totalIdx = rows.findIndex(r => r[0] === 'סה״כ');
    expect(totalIdx).toBeGreaterThan(summaryHeaderIdx);
    expect(rows[totalIdx][1]).toBe(2);
    expect(rows[totalIdx][2]).toBe(700);
  });

  it('translates payment types to Hebrew labels', () => {
    const record = { ...baseRecords[0], payType: 1 };
    const buffer = exportToExcel([record], 'success');
    const rows = readSheet(buffer);
    expect(rows[4][4]).toBe('מזומן');

    const record2 = { ...baseRecords[0], payType: 3 };
    const buffer2 = exportToExcel([record2], 'success');
    const rows2 = readSheet(buffer2);
    expect(rows2[4][4]).toBe('אשראי');
  });

  it('shows error total count in error report', () => {
    const buffer = exportToExcel(baseRecords, 'error');
    const rows = readSheet(buffer);

    const totalRow = rows.find(r => typeof r[0] === 'string' && r[0].includes('סה״כ שגויים'));
    expect(totalRow).toBeDefined();
    expect(totalRow[0]).toContain('1');
  });
});
