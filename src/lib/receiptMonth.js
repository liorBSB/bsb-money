// Works out which month a receipt is FOR, not when it was issued.
//
// Morning (Green Invoice) won't accept receipt dates far in the past, so
// catch-up receipts for earlier months get issued with a later date (e.g.
// September rent issued on a November date). The month the payment is for is
// still written in the receipt's remarks ("תשלום שכר דירה חייל/ת בבית- ספטמבר 2026"),
// so we match on that and only fall back to the issue date when it's missing.
// Kept framework-agnostic (no 'use server') so pages and tests can import it.

export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

// How many months after a month its catch-up receipts may still be issued.
export const CATCH_UP_MONTHS = 3;

const MONTH_PATTERN = new RegExp(`(${HEBREW_MONTHS.join('|')})\\s*(\\d{4})`);

/** Returns { month: 0-11, year } parsed from the remarks/description, or null. */
export function parseServiceMonth(text) {
  if (typeof text !== 'string' || !text) return null;
  const m = text.replace(/[‎‏]/g, '').match(MONTH_PATTERN);
  if (!m) return null;
  return { month: HEBREW_MONTHS.indexOf(m[1]), year: Number(m[2]) };
}

/** Month a receipt is for: from its remarks/description, else its issue date. */
export function receiptServiceMonth(doc) {
  const fromText = parseServiceMonth(doc?.remarks) || parseServiceMonth(doc?.description);
  if (fromText) return fromText;
  const m = /^(\d{4})-(\d{2})/.exec(doc?.documentDate || '');
  if (!m) return null;
  return { month: Number(m[2]) - 1, year: Number(m[1]) };
}

export function isReceiptForMonth(doc, selectedMonth) {
  const sm = receiptServiceMonth(doc);
  return !!sm && sm.month === selectedMonth.month && sm.year === selectedMonth.year;
}

export function filterReceiptsForMonth(docs, selectedMonth) {
  return (docs || []).filter(doc => isReceiptForMonth(doc, selectedMonth));
}

function fmt(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Issue-date window to search when looking for a month's receipts: from the
 * 1st of that month to the end of the month CATCH_UP_MONTHS later.
 */
export function receiptSearchRange(selectedMonth) {
  const { month, year } = selectedMonth;
  const end = new Date(year, month + CATCH_UP_MONTHS + 1, 0);
  return {
    fromDate: fmt(year, month, 1),
    toDate: fmt(end.getFullYear(), end.getMonth(), end.getDate()),
  };
}
