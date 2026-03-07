import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { buildCrmRecords, exportCrmXlsx, CRM_COLUMNS } from '../crmExport';

const accountIdMap = new Map([
  ['יוסי כהן', 'ACC001'],
  ['דני לוי', 'ACC002'],
]);

function makeRecord(overrides = {}) {
  return {
    id: 'rec-1',
    name: 'יוסי כהן',
    amount: 500,
    date: '2025-01-15',
    payType: 4,
    appType: 2,
    card: '1234',
    receiptStatus: 'done',
    receiptNumber: 99001,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

describe('buildCrmRecords', () => {
  const selectedMonth = { month: 0, year: 2025 }; // January 2025

  it('transforms done records into CRM format', () => {
    const records = [makeRecord()];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);

    expect(result).toHaveLength(1);
    expect(result[0].RecordTypeId).toBe('012b0000000HvT9AAK');
    expect(result[0].Amount).toBe(500);
    expect(result[0].Event__c).toBe('soldiers HK');
    expect(result[0].Accountid).toBe('ACC001');
    expect(result[0].cash_cheque_pp__c).toBe('BankTransfer');
    expect(result[0].Receipt_Num__c).toBe(99001);
    expect(result[0].Bank_account__c).toBe('Hapoalim');
    expect(result[0].CloseDate).toBe('2025-01-01');
    expect(result[0].StageName).toBe('Posted');
    expect(result[0].CurrencyIsoCode).toBe('ILS');
    expect(result[0]._matched).toBe(true);
  });

  it('only includes records with receiptStatus "done"', () => {
    const records = [
      makeRecord({ receiptStatus: 'done' }),
      makeRecord({ id: 'rec-2', receiptStatus: 'error' }),
      makeRecord({ id: 'rec-3', receiptStatus: 'pending' }),
    ];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);
    expect(result).toHaveLength(1);
  });

  it('sets _matched to false when account ID not found', () => {
    const records = [makeRecord({ name: 'לא קיים' })];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);

    expect(result[0].Accountid).toBe('');
    expect(result[0]._matched).toBe(false);
  });

  it('maps payment types correctly', () => {
    const types = [
      { payType: 1, expected: 'Cash' },
      { payType: 2, expected: 'Cheque' },
      { payType: 3, expected: 'CreditCard' },
      { payType: 4, expected: 'BankTransfer' },
      { payType: 10, expected: 'App' },
    ];

    for (const { payType, expected } of types) {
      const records = [makeRecord({ payType })];
      const result = buildCrmRecords(records, accountIdMap, selectedMonth);
      expect(result[0].cash_cheque_pp__c).toBe(expected);
    }
  });

  it('defaults to BankTransfer for unknown payment type', () => {
    const records = [makeRecord({ payType: 999 })];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);
    expect(result[0].cash_cheque_pp__c).toBe('BankTransfer');
  });

  it('formats close date correctly for different months', () => {
    const dec = { month: 11, year: 2025 }; // December
    const records = [makeRecord()];
    const result = buildCrmRecords(records, accountIdMap, dec);
    expect(result[0].CloseDate).toBe('2025-12-01');

    const jan = { month: 0, year: 2026 };
    const result2 = buildCrmRecords(records, accountIdMap, jan);
    expect(result2[0].CloseDate).toBe('2026-01-01');
  });

  it('includes Hebrew month in description', () => {
    const months = [
      { month: 0, word: 'ינואר' },
      { month: 5, word: 'יוני' },
      { month: 11, word: 'דצמבר' },
    ];

    for (const { month, word } of months) {
      const selected = { month, year: 2025 };
      const records = [makeRecord()];
      const result = buildCrmRecords(records, accountIdMap, selected);
      expect(result[0].Description).toContain(word);
      expect(result[0].Description).toContain('2025');
    }
  });

  it('formats Name field as "name-Donation DD/MM/YYYY"', () => {
    const records = [makeRecord({ name: 'אבי' })];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);
    expect(result[0].Name).toMatch(/^אבי-Donation \d{2}\/\d{2}\/\d{4}$/);
  });

  it('handles empty records array', () => {
    const result = buildCrmRecords([], accountIdMap, selectedMonth);
    expect(result).toEqual([]);
  });

  it('handles receipt with null receiptNumber', () => {
    const records = [makeRecord({ receiptNumber: null })];
    const result = buildCrmRecords(records, accountIdMap, selectedMonth);
    expect(result[0].Receipt_Num__c).toBe('');
  });
});

function readXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}

describe('exportCrmXlsx', () => {
  it('generates XLSX with correct headers and data', () => {
    const crmRecords = [{
      RecordTypeId: 'RT1',
      Name: 'Test',
      Amount: 100,
      Event__c: 'E1',
      Accountid: 'A1',
      cash_cheque_pp__c: 'Cash',
      Receipt_Num__c: '123',
      Bank_account__c: 'Bank',
      CloseDate: '2025-01-01',
      StageName: 'Posted',
      Description: 'Desc',
      CurrencyIsoCode: 'ILS',
    }];

    const buffer = exportCrmXlsx(crmRecords);
    const data = readXlsx(buffer);

    expect(data).toHaveLength(1);
    expect(data[0].RecordTypeId).toBe('RT1');
    expect(data[0].Name).toBe('Test');
    expect(data[0].Amount).toBe(100);
    expect(data[0].Accountid).toBe('A1');
    expect(data[0].CurrencyIsoCode).toBe('ILS');
  });

  it('only includes CRM_COLUMNS (strips internal fields)', () => {
    const crmRecords = [{
      RecordTypeId: 'RT1', Name: 'Test', Amount: 100,
      Event__c: 'E1', Accountid: 'A1', cash_cheque_pp__c: 'Cash',
      Receipt_Num__c: '123', Bank_account__c: 'Bank',
      CloseDate: '2025-01-01', StageName: 'Posted',
      Description: 'Desc', CurrencyIsoCode: 'ILS',
      _matched: true, _originalName: 'Test', _id: 'x',
    }];

    const buffer = exportCrmXlsx(crmRecords);
    const data = readXlsx(buffer);

    expect(data[0]._matched).toBeUndefined();
    expect(data[0]._originalName).toBeUndefined();
    expect(data[0]._id).toBeUndefined();
  });

  it('handles empty records array', () => {
    const buffer = exportCrmXlsx([]);
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const headerRow = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];

    expect(headerRow).toEqual(CRM_COLUMNS);
  });

  it('generates multiple rows correctly', () => {
    const row = {
      RecordTypeId: 'RT1', Name: 'A', Amount: 1,
      Event__c: '', Accountid: '', cash_cheque_pp__c: '',
      Receipt_Num__c: '', Bank_account__c: '', CloseDate: '',
      StageName: '', Description: '', CurrencyIsoCode: '',
    };
    const buffer = exportCrmXlsx([row, { ...row, Name: 'B' }, { ...row, Name: 'C' }]);
    const data = readXlsx(buffer);

    expect(data).toHaveLength(3);
    expect(data.map(d => d.Name)).toEqual(['A', 'B', 'C']);
  });

  it('preserves numeric amounts without rounding', () => {
    const crmRecords = [{
      RecordTypeId: 'RT1', Name: 'Test', Amount: 1234.56,
      Event__c: '', Accountid: '', cash_cheque_pp__c: '',
      Receipt_Num__c: '', Bank_account__c: '', CloseDate: '',
      StageName: '', Description: '', CurrencyIsoCode: '',
    }];

    const buffer = exportCrmXlsx(crmRecords);
    const data = readXlsx(buffer);
    expect(data[0].Amount).toBe(1234.56);
  });

  it('names sheet "CRM Export"', () => {
    const buffer = exportCrmXlsx([]);
    const wb = XLSX.read(buffer, { type: 'array' });
    expect(wb.SheetNames[0]).toBe('CRM Export');
  });
});

describe('CRM_COLUMNS', () => {
  it('has exactly 12 columns', () => {
    expect(CRM_COLUMNS).toHaveLength(12);
  });

  it('includes all required Salesforce fields', () => {
    expect(CRM_COLUMNS).toContain('RecordTypeId');
    expect(CRM_COLUMNS).toContain('Accountid');
    expect(CRM_COLUMNS).toContain('Amount');
    expect(CRM_COLUMNS).toContain('CloseDate');
    expect(CRM_COLUMNS).toContain('StageName');
  });
});
