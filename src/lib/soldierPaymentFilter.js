export const SOLDIER_PAYMENT_MAX_AMOUNT = 5000;
export const SOLDIER_PAYMENT_LAST_DAY = 10;

/** Heuristic filter: soldier rent receipts are 1–10th of month, 0 < amount ≤ 5k. */
export function isSoldierPaymentReceipt(receipt, selectedMonth) {
  const amount = Number(receipt.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > SOLDIER_PAYMENT_MAX_AMOUNT) {
    return false;
  }

  const { documentDate } = receipt;
  if (!documentDate || !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) return false;

  const [y, m, d] = documentDate.split('-').map(Number);
  const { month, year } = selectedMonth;
  if (y !== year || m !== month + 1 || d < 1 || d > SOLDIER_PAYMENT_LAST_DAY) {
    return false;
  }

  return true;
}

export function filterSoldierPaymentReceipts(receipts, selectedMonth) {
  return receipts.filter(r => isSoldierPaymentReceipt(r, selectedMonth));
}

export function accountantReportDateRange(selectedMonth) {
  const { month, year } = selectedMonth;
  const mm = String(month + 1).padStart(2, '0');
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(SOLDIER_PAYMENT_LAST_DAY).padStart(2, '0')}`,
  };
}
