'use client';

import { useMemo, useCallback, useState } from 'react';
import colors from '@/app/colors';
import { exportRentChargeXlsx, downloadRentChargeXlsx, buildRentChargeSummary, formatAmountWithShekel } from '@/lib/rentChargeExport';

const DISPLAY_COLUMNS = [
  { key: 'soldierName', label: 'שם חייל/ת', width: '160px' },
  { key: 'description', label: 'תיאור', width: '240px' },
  { key: 'date', label: 'תאריך', width: '110px' },
  { key: 'amount', label: 'סכום', width: '90px' },
  { key: 'transferMethod', label: 'אופן העברה', width: '140px' },
  { key: 'receiptNumber', label: 'מספר קבלה', width: '110px' },
  { key: 'sfEntered', label: 'הוזן ב-SF', width: '90px', toggle: true },
];

const OTHER_COLUMNS = DISPLAY_COLUMNS.filter(col => col.key !== 'soldierName');
const SOLDIER_NAME_COLUMN = DISPLAY_COLUMNS.find(col => col.key === 'soldierName');

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatCellValue(col, row) {
  if (col.key === 'amount') return formatAmountWithShekel(row.amount);
  return row[col.key];
}

function RemoveReceiptModal({ open, soldierName, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-xl text-center"
        style={{ backgroundColor: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-2" style={{ color: colors.text }}>
          להסיר מהדוח?
        </h3>
        <p className="text-sm mb-6" style={{ color: colors.muted }}>
          האם להסיר את <strong style={{ color: colors.text }}>{soldierName}</strong> מהדוח?
          <br />
          הקבלה לא תימחק מ-Morning.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold border"
            style={{ borderColor: colors.gray400, color: colors.text }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: colors.red, color: colors.white }}
          >
            הסר מהדוח
          </button>
        </div>
      </div>
    </div>
  );
}

function SoldierNameCell({ row }) {
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full">
      <span className="whitespace-nowrap">{row.soldierName}</span>
      {row.manual && (
        <span
          className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${colors.secondaryText}18`, color: colors.secondaryText }}
        >
          ידני
        </span>
      )}
    </span>
  );
}

function RemoveCell({ row, onRemoveRequest }) {
  return (
    <button
      type="button"
      onClick={() => onRemoveRequest(row)}
      className="w-7 h-7 rounded border-2 flex items-center justify-center text-sm font-bold transition-colors mx-auto"
      style={{
        borderColor: colors.red,
        backgroundColor: `${colors.red}10`,
        color: colors.red,
      }}
      title="הסר מהדוח"
      aria-label={`הסר את ${row.soldierName} מהדוח`}
    >
      ✕
    </button>
  );
}

export default function RentChargeTable({ rentRecords, selectedMonth, onSfToggle, onRemove }) {
  const [pendingRemove, setPendingRemove] = useState(null);

  const enteredCount = useMemo(
    () => rentRecords.filter(r => r.sfEntered).length,
    [rentRecords]
  );
  const notEnteredCount = rentRecords.length - enteredCount;

  const monthName = HEBREW_MONTHS[selectedMonth.month];
  const shortYear = String(selectedMonth.year).slice(-2);
  const title = `חיוב שכר דירה חודש ${monthName} ${shortYear}`;

  const summary = useMemo(() => buildRentChargeSummary(rentRecords), [rentRecords]);

  const handleDownload = useCallback(() => {
    const buf = exportRentChargeXlsx(rentRecords, selectedMonth);
    const monthStr = String(selectedMonth.month + 1).padStart(2, '0');
    downloadRentChargeXlsx(buf, `חיוב_שכר_דירה_${selectedMonth.year}-${monthStr}.xlsx`);
  }, [rentRecords, selectedMonth]);

  const handleRemoveRequest = useCallback((row) => {
    if (!onRemove) return;
    setPendingRemove({ id: row._id, soldierName: row.soldierName || 'רשומה זו' });
  }, [onRemove]);

  const handleRemoveConfirm = useCallback(() => {
    if (pendingRemove && onRemove) {
      onRemove(pendingRemove.id);
    }
    setPendingRemove(null);
  }, [pendingRemove, onRemove]);

  const handleRemoveCancel = useCallback(() => {
    setPendingRemove(null);
  }, []);

  if (!rentRecords.length) return null;

  const columnCount = DISPLAY_COLUMNS.length + 1 + (onRemove ? 1 : 0);

  return (
    <div className="mt-10">
      <RemoveReceiptModal
        open={Boolean(pendingRemove)}
        soldierName={pendingRemove?.soldierName}
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.primaryGreen }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: colors.muted }}>
            יש לסמן את כל החיילים שהוזנו ב-Sales Force. ברירת מחדל: כולם מסומנים.
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="rounded-xl px-6 py-3 text-sm font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
          style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          הורד דוח לרואה חשבון
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.gray400 }}>
        <table className="w-full text-xs" style={{ direction: 'rtl' }}>
          <thead>
            <tr style={{ backgroundColor: colors.primaryGreen }}>
              {onRemove && (
                <th
                  className="px-1 py-2.5 text-center font-semibold whitespace-nowrap"
                  style={{ color: colors.white, minWidth: '48px' }}
                >
                  הסר
                </th>
              )}
              <th
                className="px-2 py-2.5 text-center font-semibold whitespace-nowrap"
                style={{ color: colors.white, minWidth: '40px' }}
              >
                #
              </th>
              <th
                className="px-2 py-2.5 text-right font-semibold whitespace-nowrap"
                style={{ color: colors.white, minWidth: SOLDIER_NAME_COLUMN.width }}
              >
                {SOLDIER_NAME_COLUMN.label}
              </th>
              {OTHER_COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-2 py-2.5 text-right font-semibold whitespace-nowrap"
                  style={{ color: colors.white, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rentRecords.map((row, idx) => (
              <tr
                key={row._id}
                className="border-b transition-colors hover:opacity-90"
                style={{
                  backgroundColor: idx % 2 === 0 ? '#fff' : colors.surface,
                  borderColor: colors.gray400,
                }}
              >
                {onRemove && (
                  <td className="px-1 py-1.5 text-center">
                    <RemoveCell row={row} onRemoveRequest={handleRemoveRequest} />
                  </td>
                )}
                <td className="px-2 py-1.5 text-center" style={{ color: colors.muted }}>
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5">
                  <SoldierNameCell row={row} />
                </td>
                {OTHER_COLUMNS.map(col => (
                  <td key={col.key} className="px-2 py-1.5">
                    {col.toggle ? (
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onSfToggle(row._id)}
                          className="w-7 h-7 rounded border-2 flex items-center justify-center text-sm font-bold transition-colors"
                          style={{
                            borderColor: row.sfEntered ? colors.green : colors.red,
                            backgroundColor: row.sfEntered ? `${colors.green}15` : `${colors.red}10`,
                            color: row.sfEntered ? colors.green : colors.red,
                          }}
                        >
                          {row.sfEntered ? 'V' : '✕'}
                        </button>
                      </div>
                    ) : (
                      <span className={col.key === 'description' ? '' : 'whitespace-nowrap'}>
                        {formatCellValue(col, row)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={columnCount} className="px-2 py-3" style={{ backgroundColor: colors.gray100 }}>
                <p className="text-sm font-bold mb-2" style={{ color: colors.text }}>
                  סיכום לפי אופן תשלום
                </p>
                <div className="space-y-1">
                  {summary.byMethod.map(item => (
                    <p key={item.label} className="text-sm" style={{ color: colors.text }}>
                      {item.label}: {item.count} קבלות, {formatAmountWithShekel(item.total)}
                    </p>
                  ))}
                </div>
                <p className="text-sm font-bold mt-3" style={{ color: colors.primaryGreen }}>
                  סה״כ: {summary.count} קבלות, {formatAmountWithShekel(summary.grandTotal)}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: colors.muted }}>
            {rentRecords.length} רשומות
          </span>
          <span style={{ color: colors.green }}>
            {enteredCount} הוזנו ב-SF
          </span>
          {notEnteredCount > 0 && (
            <span style={{ color: colors.red }}>
              {notEnteredCount} לא הוזנו
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          className="rounded-xl px-6 py-3 text-sm font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
          style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          הורד דוח לרואה חשבון
        </button>
      </div>
    </div>
  );
}
