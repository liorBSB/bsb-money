import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildRentChargeRecordsFromMorning,
  buildRentChargeSummary,
  createManualRentChargeRecord,
  payTypeToHebrew,
  exportRentChargeXlsx,
} from '../rentChargeExport';

describe('payTypeToHebrew', () => {
  it('maps known payment types', () => {
    expect(payTypeToHebrew(1)).toBe('מזומן');
    expect(payTypeToHebrew(4)).toBe('העברה בנקאית');
    expect(payTypeToHebrew(10)).toBe('אפליקציה');
  });

  it('returns fallback for unknown types', () => {
    expect(payTypeToHebrew(99)).toBe('אחר (99)');
    expect(payTypeToHebrew(null)).toBe('לא ידוע');
  });
});

describe('buildRentChargeRecordsFromMorning', () => {
  it('maps morning docs to rent records with sf default', () => {
    const docs = [{
      id: 'a1',
      clientName: 'דני לוי',
      amount: 500,
      receiptNumber: 100,
      documentDate: '2025-06-05',
      description: 'תשלום שכר דירה',
      payType: 1,
    }];

    const records = buildRentChargeRecordsFromMorning(docs, false);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      _id: 'a1',
      soldierName: 'דני לוי',
      description: 'תשלום שכר דירה',
      date: '05/06/2025',
      amount: 500,
      transferMethod: 'מזומן',
      receiptNumber: 100,
      sfEntered: false,
    });
  });

  it('uses remarks when description is empty', () => {
    const docs = [{
      id: 'a2',
      clientName: 'שרה',
      amount: 400,
      receiptNumber: 101,
      documentDate: '2025-06-01',
      description: '',
      remarks: 'הערה',
      payType: 4,
    }];

    const records = buildRentChargeRecordsFromMorning(docs, true);
    expect(records[0].description).toBe('הערה');
    expect(records[0].sfEntered).toBe(true);
  });
});

describe('createManualRentChargeRecord', () => {
  it('builds a manual rent record with formatted date and payment label', () => {
    const record = createManualRentChargeRecord({
      soldierName: ' דני לוי ',
      description: 'תשלום ידני',
      documentDate: '2025-06-03',
      amount: '750',
      payType: '4',
      receiptNumber: '12345',
      sfEntered: false,
    });

    expect(record.manual).toBe(true);
    expect(record._id).toMatch(/^manual-/);
    expect(record).toMatchObject({
      soldierName: 'דני לוי',
      description: 'תשלום ידני',
      date: '03/06/2025',
      amount: 750,
      transferMethod: 'העברה בנקאית',
      receiptNumber: '12345',
      sfEntered: false,
    });
  });
});

describe('buildRentChargeSummary', () => {
  it('aggregates by payment method and grand total', () => {
    const records = [
      { transferMethod: 'מזומן', amount: 500 },
      { transferMethod: 'מזומן', amount: 300 },
      { transferMethod: 'העברה בנקאית', amount: 600 },
    ];

    const summary = buildRentChargeSummary(records);

    expect(summary.count).toBe(3);
    expect(summary.grandTotal).toBe(1400);
    expect(summary.byMethod).toHaveLength(2);

    const cash = summary.byMethod.find(m => m.label === 'מזומן');
    expect(cash).toEqual({ label: 'מזומן', count: 2, total: 800 });

    const bank = summary.byMethod.find(m => m.label === 'העברה בנקאית');
    expect(bank).toEqual({ label: 'העברה בנקאית', count: 1, total: 600 });
  });
});

describe('exportRentChargeXlsx', () => {
  it('includes summary rows at the end of the sheet', () => {
    const records = [
      {
        _id: '1',
        soldierName: 'דני',
        description: 'תשלום',
        date: '01/06/2025',
        amount: 500,
        transferMethod: 'מזומן',
        receiptNumber: 100,
        sfEntered: true,
      },
      {
        _id: '2',
        soldierName: 'שרה',
        description: 'תשלום',
        date: '02/06/2025',
        amount: 600,
        transferMethod: 'העברה בנקאית',
        receiptNumber: 101,
        sfEntered: false,
      },
    ];

    const buf = exportRentChargeXlsx(records, { month: 5, year: 2025 });
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const flat = rows.flat().join('|');
    expect(flat).toContain('סיכום לפי אופן תשלום');
    expect(flat).toContain('סה״כ');
    expect(flat).toContain('מזומן');
    expect(flat).toContain('העברה בנקאית');
  });
});
