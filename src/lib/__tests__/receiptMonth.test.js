import { describe, it, expect } from 'vitest';
import {
  parseServiceMonth,
  receiptServiceMonth,
  filterReceiptsForMonth,
  receiptSearchRange,
} from '../receiptMonth';

const NOV_2026 = { month: 10, year: 2026 };
const SEP_2026 = { month: 8, year: 2026 };

describe('parseServiceMonth', () => {
  it('reads the month from the default rent remark', () => {
    expect(parseServiceMonth('תשלום שכר דירה חייל/ת בבית- ספטמבר 2026')).toEqual({ month: 8, year: 2026 });
  });

  it('ignores RTL marks and missing spaces', () => {
    expect(parseServiceMonth('‏אוקטובר2026')).toEqual({ month: 9, year: 2026 });
  });

  it('returns null when no month is written', () => {
    expect(parseServiceMonth('תשלום')).toBeNull();
    expect(parseServiceMonth('')).toBeNull();
    expect(parseServiceMonth(undefined)).toBeNull();
  });
});

describe('receiptServiceMonth', () => {
  it('prefers the month in the remarks over the issue date', () => {
    const doc = { documentDate: '2026-11-02', remarks: 'תשלום שכר דירה חייל/ת בבית- ספטמבר 2026' };
    expect(receiptServiceMonth(doc)).toEqual(SEP_2026);
  });

  it('falls back to the issue date when remarks have no month', () => {
    expect(receiptServiceMonth({ documentDate: '2026-11-05', remarks: '' })).toEqual(NOV_2026);
  });
});

describe('filterReceiptsForMonth', () => {
  const docs = [
    { clientName: 'א', documentDate: '2026-11-02', remarks: 'תשלום שכר דירה חייל/ת בבית- ספטמבר 2026' },
    { clientName: 'ב', documentDate: '2026-11-02', remarks: 'תשלום שכר דירה חייל/ת בבית- אוקטובר 2026' },
    { clientName: 'ג', documentDate: '2026-11-03', remarks: 'תשלום שכר דירה חייל/ת בבית- נובמבר 2026' },
    { clientName: 'ד', documentDate: '2026-11-04', remarks: '' },
    { clientName: 'ה', documentDate: '2026-12-01', remarks: '' },
  ];

  it('keeps only receipts for November, not catch-up receipts issued in November', () => {
    expect(filterReceiptsForMonth(docs, NOV_2026).map(d => d.clientName)).toEqual(['ג', 'ד']);
  });

  it('finds September receipts even though they were issued in November', () => {
    expect(filterReceiptsForMonth(docs, SEP_2026).map(d => d.clientName)).toEqual(['א']);
  });
});

describe('receiptSearchRange', () => {
  it('spans the month plus three catch-up months', () => {
    expect(receiptSearchRange(SEP_2026)).toEqual({ fromDate: '2026-09-01', toDate: '2026-12-31' });
  });

  it('rolls over the year', () => {
    expect(receiptSearchRange({ month: 10, year: 2026 })).toEqual({ fromDate: '2026-11-01', toDate: '2027-02-28' });
  });
});
