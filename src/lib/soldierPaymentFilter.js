export const SOLDIER_PAYMENT_MAX_AMOUNT = 5000;

/** Heuristic filter: likely soldier rent receipts are 0 < amount ≤ 5k. */
export function isSoldierPaymentReceipt(receipt) {
  const amount = Number(receipt.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > SOLDIER_PAYMENT_MAX_AMOUNT) {
    return false;
  }

  return true;
}

export function filterSoldierPaymentReceipts(receipts) {
  return receipts.filter(r => isSoldierPaymentReceipt(r));
}

export function accountantReportDateRange(selectedMonth) {
  const { month, year } = selectedMonth;
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}
