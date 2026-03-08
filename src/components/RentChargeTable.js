'use client';

import { useMemo, useCallback } from 'react';
import colors from '@/app/colors';
import { exportRentChargeXlsx, downloadRentChargeXlsx } from '@/lib/rentChargeExport';

const DISPLAY_COLUMNS = [
  { key: 'soldierName', label: 'שם חייל/ת', width: '160px' },
  { key: 'date', label: 'תאריך', width: '110px' },
  { key: 'amount', label: 'סכום', width: '90px' },
  { key: 'transferMethod', label: 'אופן העברה', width: '140px' },
  { key: 'receiptNumber', label: 'מספר קבלה', width: '110px' },
  { key: 'sfEntered', label: 'הוזן ב-SF', width: '90px', toggle: true },
];

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function RentChargeTable({ rentRecords, selectedMonth, onSfToggle }) {
  const enteredCount = useMemo(
    () => rentRecords.filter(r => r.sfEntered).length,
    [rentRecords]
  );
  const notEnteredCount = rentRecords.length - enteredCount;

  const monthName = HEBREW_MONTHS[selectedMonth.month];
  const shortYear = String(selectedMonth.year).slice(-2);
  const title = `חיוב שכר דירה חודש ${monthName} ${shortYear}`;

  const handleDownload = useCallback(() => {
    const buf = exportRentChargeXlsx(rentRecords, selectedMonth);
    const monthStr = String(selectedMonth.month + 1).padStart(2, '0');
    downloadRentChargeXlsx(buf, `חיוב_שכר_דירה_${selectedMonth.year}-${monthStr}.xlsx`);
  }, [rentRecords, selectedMonth]);

  if (!rentRecords.length) return null;

  return (
    <div className="mt-10">
      <div className="mb-4">
        <h2 className="text-xl font-bold" style={{ color: colors.primaryGreen }}>
          {title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: colors.muted }}>
          יש לסמן את כל החיילים שהוזנו ב-Sales Force. ברירת מחדל: כולם מסומנים.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.gray400 }}>
        <table className="w-full text-xs" style={{ direction: 'rtl' }}>
          <thead>
            <tr style={{ backgroundColor: colors.primaryGreen }}>
              <th
                className="px-2 py-2.5 text-right font-semibold whitespace-nowrap"
                style={{ color: colors.white, minWidth: '40px' }}
              >
                #
              </th>
              {DISPLAY_COLUMNS.map(col => (
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
                <td className="px-2 py-1.5 text-center" style={{ color: colors.muted }}>
                  {idx + 1}
                </td>
                {DISPLAY_COLUMNS.map(col => (
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
                      <span className="whitespace-nowrap">{row[col.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
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
