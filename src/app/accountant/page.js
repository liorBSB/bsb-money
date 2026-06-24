'use client';

import { useState, useCallback } from 'react';
import colors from '@/app/colors';
import PageHeader from '@/components/PageHeader';
import RentChargeTable from '@/components/RentChargeTable';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';
import { authenticate, fetchAccountantReceipts } from '@/lib/greenInvoice';
import { buildRentChargeRecordsFromMorning } from '@/lib/rentChargeExport';

export default function AccountantPage() {
  const { selectedMonth } = useMonth();
  const [sfAllEntered, setSfAllEntered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emptyResult, setEmptyResult] = useState(false);
  const [rentRecords, setRentRecords] = useState([]);

  const resetReport = useCallback(() => {
    setRentRecords([]);
    setError(null);
    setEmptyResult(false);
  }, []);

  const handleMonthChange = useCallback(() => {
    resetReport();
  }, [resetReport]);

  const handleCreateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyResult(false);
    setRentRecords([]);

    try {
      const token = await authenticate();
      const docs = await fetchAccountantReceipts(token, selectedMonth);

      if (!docs.length) {
        setEmptyResult(true);
        return;
      }

      setRentRecords(buildRentChargeRecordsFromMorning(docs, sfAllEntered));
    } catch (err) {
      console.error('Failed to load accountant report:', err);
      setError('שגיאה בטעינת נתונים: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, sfAllEntered]);

  const handleSfToggle = useCallback((id) => {
    setRentRecords(prev =>
      prev.map(r => r._id === id ? { ...r, sfEntered: !r.sfEntered } : r)
    );
  }, []);

  return (
    <div className="min-h-screen px-5 py-8 md:px-8 md:py-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="דוח לרואה חשבון"
        subtitle="דוח חיוב שכר דירה מתוך קבלות (קבלה) שהופקו ב-Morning ב-1 לחודש שנבחר"
        accent={colors.secondaryText}
      />

      <MonthSelector disabled={loading} onChange={handleMonthChange} />

      <section
        className="mb-6 rounded-xl border p-5"
        style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
          האם כל החיילים כבר הוזנו ב-Sales Force?
        </p>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: colors.text }}>
            <input
              type="radio"
              name="sf-entered"
              checked={sfAllEntered}
              onChange={() => setSfAllEntered(true)}
              disabled={loading}
              className="h-4 w-4"
            />
            כן
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: colors.text }}>
            <input
              type="radio"
              name="sf-entered"
              checked={!sfAllEntered}
              onChange={() => setSfAllEntered(false)}
              disabled={loading}
              className="h-4 w-4"
            />
            לא
          </label>
        </div>
        <p className="mt-2 text-xs" style={{ color: colors.muted }}>
          ניתן לשנות את הסימון לכל שורה גם אחרי יצירת הדוח
        </p>

        <button
          onClick={handleCreateReport}
          disabled={loading}
          className="mt-5 rounded-xl px-8 py-3 text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ backgroundColor: colors.primaryGreen, color: '#fff' }}
        >
          {loading ? 'טוען...' : 'צור דוח'}
        </button>
      </section>

      {error && (
        <div
          className="rounded-xl border-2 p-4 mb-6 text-sm"
          style={{ backgroundColor: colors.surface, borderColor: colors.red, color: colors.red }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
        >
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: colors.gray400, borderTopColor: colors.secondaryText }}
          />
          <p className="text-base font-semibold" style={{ color: colors.text }}>
            טוען קבלות מ-Morning...
          </p>
          <p className="text-sm" style={{ color: colors.muted }}>
            {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
        </div>
      )}

      {!loading && emptyResult && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
        >
          <p className="text-base font-semibold" style={{ color: colors.text }}>
            לא נמצאו קבלות (קבלה) ל-1 ב{HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
        </div>
      )}

      {!loading && rentRecords.length > 0 && (
        <RentChargeTable
          rentRecords={rentRecords}
          selectedMonth={selectedMonth}
          onSfToggle={handleSfToggle}
        />
      )}
    </div>
  );
}
