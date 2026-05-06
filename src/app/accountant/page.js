'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import colors from '@/app/colors';
import RentChargeTable from '@/components/RentChargeTable';
import FileUploader from '@/components/FileUploader';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';
import { authenticate, searchExistingReceipts } from '@/lib/greenInvoice';
import { processBankFile, getMonthDateRange, matchExistingReceipts, extractReportMonth } from '@/lib/processBank';
import { buildCrmRecords } from '@/lib/crmExport';
import { buildRentChargeRecords } from '@/lib/rentChargeExport';

export default function AccountantPage() {
  const { selectedMonth } = useMonth();
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [missing, setMissing] = useState(null);
  const [matchedRecords, setMatchedRecords] = useState(null);
  const [rentRecords, setRentRecords] = useState([]);
  const [resetKey, setResetKey] = useState(0);

  const reset = useCallback(() => {
    setLoading(false);
    setFileError(null);
    setMissing(null);
    setMatchedRecords(null);
    setRentRecords([]);
    setResetKey(k => k + 1);
  }, []);

  const handleFileProcessed = useCallback(async (arrayBuffer) => {
    setFileError(null);
    setMissing(null);
    setMatchedRecords(null);
    setRentRecords([]);

    const reportMonth = extractReportMonth(arrayBuffer);
    if (reportMonth && (reportMonth.month !== selectedMonth.month || reportMonth.year !== selectedMonth.year)) {
      setFileError(
        `הקובץ שהועלה הוא לחודש ${HEBREW_MONTHS[reportMonth.month]} ${reportMonth.year}, ` +
        `אך נבחר חודש ${HEBREW_MONTHS[selectedMonth.month]} ${selectedMonth.year}. ` +
        `יש לבחור את אותו חודש כמו בקובץ או להעלות קובץ של החודש הנכון.`
      );
      return;
    }

    let parsed;
    try {
      parsed = processBankFile(arrayBuffer, selectedMonth);
      if (!parsed.length) {
        setFileError('לא נמצאו רשומות תקינות בקובץ — יש לוודא שזהו הקובץ הנכון ממערכת שקד');
        return;
      }
    } catch (err) {
      setFileError(err.message);
      return;
    }

    setLoading(true);

    try {
      const token = await authenticate();
      const { fromDate, toDate } = getMonthDateRange(selectedMonth);
      const existingDocs = await searchExistingReceipts(token, fromDate, toDate);
      const merged = matchExistingReceipts(parsed, existingDocs);

      const matched = merged.filter(r => r.receiptStatus === 'done');
      const missingRecords = merged.filter(r => r.receiptStatus === 'pending');

      setMatchedRecords(matched);
      if (missingRecords.length > 0) {
        setMissing(missingRecords.map(r => r.name).filter(Boolean));
      }
    } catch (err) {
      console.error('Failed to load accountant data:', err);
      setFileError('שגיאה בטעינת נתונים: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const handleContinueWithoutMissing = useCallback(() => {
    setMissing(null);
  }, []);

  const buildReport = useCallback((sfDefault) => {
    if (!matchedRecords) return;
    const crm = buildCrmRecords(matchedRecords, new Map(), selectedMonth);
    const rent = buildRentChargeRecords(crm).map(r => ({ ...r, sfEntered: sfDefault }));
    setRentRecords(rent);
  }, [matchedRecords, selectedMonth]);

  const handleSfToggle = useCallback((id) => {
    setRentRecords(prev =>
      prev.map(r => r._id === id ? { ...r, sfEntered: !r.sfEntered } : r)
    );
  }, []);

  const showUploader = !loading && !missing && !matchedRecords && rentRecords.length === 0;
  const showSfPrompt = !loading && !missing && matchedRecords && matchedRecords.length > 0 && rentRecords.length === 0;

  return (
    <div className="min-h-screen p-6 max-w-[1400px] mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:opacity-80 border"
            style={{ borderColor: colors.gray400, color: colors.text, backgroundColor: colors.surface }}
          >
            ← חזרה לדשבורד
          </Link>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: colors.secondaryText }}>
            דוח לרואה חשבון
          </h1>
          <p className="mt-1" style={{ color: colors.muted }}>
            דוח חיוב שכר דירה מתוך הקבלות שכבר הופקו לחודש שנבחר
          </p>
        </div>
      </header>

      <MonthSelector disabled={loading} onChange={reset} />

      {showUploader && (
        <section className="mb-6">
          <p className="mb-3 text-sm font-medium" style={{ color: colors.muted }}>
            יש להעלות את קובץ האקסל ממערכת שקד עבור חודש {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
          <FileUploader
            key={resetKey}
            onFileProcessed={handleFileProcessed}
            disabled={loading}
            externalError={fileError}
          />
        </section>
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
            בודק קבלות קיימות בחשבונית ירוקה...
          </p>
          <p className="text-sm" style={{ color: colors.muted }}>
            {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
        </div>
      )}

      {!loading && missing && (
        <div
          className="rounded-xl border-2 p-6"
          style={{ backgroundColor: colors.surface, borderColor: colors.red }}
        >
          <p className="text-base font-bold mb-2" style={{ color: colors.red }}>
            חסרות {missing.length} קבלות עבור החודש הזה
          </p>
          <p className="text-sm mb-3" style={{ color: colors.text }}>
            לא נמצאו קבלות בחשבונית ירוקה עבור החיילים הבאים:
          </p>
          <ul className="text-sm mb-5 list-disc pr-6 space-y-0.5" style={{ color: colors.text }}>
            {missing.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/receipts"
              className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primaryGreen, color: '#fff' }}
            >
              הפקת הקבלות החסרות
            </Link>
            {matchedRecords && matchedRecords.length > 0 && (
              <button
                onClick={handleContinueWithoutMissing}
                className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 border-2"
                style={{ borderColor: colors.secondaryText, color: colors.secondaryText, backgroundColor: '#fff' }}
              >
                המשך ללא הקבלות החסרות ({matchedRecords.length} קיימות)
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 border"
              style={{ borderColor: colors.gray400, color: colors.text, backgroundColor: '#fff' }}
            >
              החלף קובץ
            </button>
          </div>
        </div>
      )}

      {showSfPrompt && (
        <div
          className="rounded-xl border-2 p-6 text-center"
          style={{ backgroundColor: colors.surface, borderColor: colors.secondaryText }}
        >
          <p className="text-lg font-bold mb-2" style={{ color: colors.text }}>
            האם כל החיילים כבר הוזנו ב-Sales Force?
          </p>
          <p className="text-sm mb-5" style={{ color: colors.muted }}>
            ניתן לשנות את הסימון לכל שורה גם אחר כך בטבלה
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => buildReport(true)}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 hover:brightness-110"
              style={{ backgroundColor: colors.green, color: '#fff' }}
            >
              כן, כולם הוזנו
            </button>
            <button
              onClick={() => buildReport(false)}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 hover:brightness-95 border-2"
              style={{ borderColor: colors.gold, color: colors.gold, backgroundColor: '#fff' }}
            >
              חלק מהם הוזנו
            </button>
            <button
              onClick={() => buildReport(false)}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 hover:brightness-95 border-2"
              style={{ borderColor: colors.secondaryText, color: colors.secondaryText, backgroundColor: '#fff' }}
            >
              לא, אף אחד לא הוזן
            </button>
            <button
              onClick={reset}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-all hover:shadow hover:brightness-95 border"
              style={{ borderColor: colors.gray400, color: colors.text, backgroundColor: '#fff' }}
            >
              החלף קובץ
            </button>
          </div>
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
