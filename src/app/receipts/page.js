'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import colors from '@/app/colors';
import FileUploader from '@/components/FileUploader';
import PaymentTable from '@/components/PaymentTable';
import CrmTable from '@/components/CrmTable';
import RentChargeTable from '@/components/RentChargeTable';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';
import { processBankFile, createEmptyRecord, exportToExcel, downloadExcel, getMonthDateRange, matchExistingReceipts, extractReportMonth } from '@/lib/processBank';
import { authenticate, processOneReceipt, searchExistingReceipts } from '@/lib/greenInvoice';
import { fetchAccountIdMap } from '@/lib/googleSheets';
import { buildCrmRecords } from '@/lib/crmExport';
import { buildRentChargeRecords } from '@/lib/rentChargeExport';

export default function ReceiptsPage() {
  const { selectedMonth, setSelectedMonth } = useMonth();

  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [accountIdMap, setAccountIdMap] = useState(null);
  const [crmRecords, setCrmRecords] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [rentChargeRecords, setRentChargeRecords] = useState([]);

  const handleFileProcessed = useCallback(async (arrayBuffer, name) => {
    const reportMonth = extractReportMonth(arrayBuffer);
    if (reportMonth && (reportMonth.month !== selectedMonth.month || reportMonth.year !== selectedMonth.year)) {
      setFileError(
        `הקובץ שהועלה הוא לחודש ${HEBREW_MONTHS[reportMonth.month]} ${reportMonth.year}, ` +
        `אך נבחר חודש ${HEBREW_MONTHS[selectedMonth.month]} ${selectedMonth.year}. ` +
        `יש לבחור את אותו חודש כמו בקובץ או להעלות קובץ של החודש הנכון.`
      );
      setRecords([]);
      return;
    }

    let parsed;
    try {
      parsed = processBankFile(arrayBuffer, selectedMonth);
      if (!parsed.length) {
        setFileError('לא נמצאו רשומות תקינות בקובץ — יש לוודא שזהו הקובץ הנכון ממערכת שקד');
        setRecords([]);
        return;
      }
    } catch (err) {
      setFileError(err.message);
      setRecords([]);
      return;
    }

    setFileError(null);
    setFileName(name);
    setDone(false);
    setProgress({ current: 0, total: 0 });
    setCrmRecords([]);
    setRentChargeRecords([]);
    setAccountIdMap(null);
    setMatchInfo(null);

    setRecords(parsed);
    setMatchLoading(true);

    try {
      const token = await authenticate();
      const { fromDate, toDate } = getMonthDateRange(selectedMonth);
      const existingDocs = await searchExistingReceipts(token, fromDate, toDate);
      const merged = matchExistingReceipts(parsed, existingDocs);
      setRecords(merged);

      const matched = merged.filter(r => r.receiptStatus === 'done').length;
      if (matched > 0) {
        setMatchInfo(`${matched} קבלות כבר קיימות בחשבונית ירוקה לחודש זה`);
      }
    } catch (err) {
      console.error('Receipt match check failed:', err);
    } finally {
      setMatchLoading(false);
    }
  }, [selectedMonth]);

  const handleUpdate = useCallback((id, key, value) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  }, []);

  const handleDelete = useCallback((id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    setRecords(prev => [...prev, createEmptyRecord(prev.length, selectedMonth)]);
  }, [selectedMonth]);

  const handleStartManual = useCallback(() => {
    setRecords([createEmptyRecord(0, selectedMonth)]);
    setFileName(null);
    setDone(false);
    setProgress({ current: 0, total: 0 });
    setFileError(null);
    setMatchInfo(null);
    setCrmRecords([]);
    setRentChargeRecords([]);
    setAccountIdMap(null);
  }, [selectedMonth]);

  const handleRetryOne = useCallback((id) => {
    setRecords(prev => prev.map(r =>
      r.id === id ? { ...r, receiptStatus: 'pending', receiptNumber: null, errorCode: null, errorMessage: null } : r
    ));
  }, []);

  const handleRetryAllFailed = useCallback(() => {
    setRecords(prev => prev.map(r =>
      r.receiptStatus === 'error' ? { ...r, receiptStatus: 'pending', receiptNumber: null, errorCode: null, errorMessage: null } : r
    ));
    setDone(false);
  }, []);

  const runGenerate = useCallback(async (toProcess, { markDone = true } = {}) => {
    setGenerating(true);
    setProgress({ current: 0, total: toProcess.length });

    try {
      const token = await authenticate();

      for (let i = 0; i < toProcess.length; i++) {
        const result = await processOneReceipt(token, toProcess[i]);

        setRecords(prev =>
          prev.map(r => r.id === result.id ? { ...r, ...result } : r)
        );
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      if (markDone) setDone(true);
    } catch (err) {
      alert('שגיאה באימות: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const getPending = useCallback(() =>
    records.filter(r => r.receiptStatus === 'pending' && r.name && r.amount > 0),
    [records]
  );

  const handleGenerate = useCallback(async () => {
    const pending = getPending();
    if (!pending.length) {
      alert('אין רשומות תקינות לשליחה');
      return;
    }
    await new Promise(r => setTimeout(r, 0));
    await runGenerate(pending);
  }, [getPending, runGenerate]);

  const handleTestFirst = useCallback(async () => {
    const first = getPending()[0];
    if (!first) {
      alert('אין רשומה תקינה לבדיקה');
      return;
    }
    await new Promise(r => setTimeout(r, 0));
    await runGenerate([first], { markDone: false });
  }, [getPending, runGenerate]);

  const handleNextOne = useCallback(async () => {
    const next = getPending()[0];
    if (!next) {
      alert('אין עוד רשומות ממתינות');
      return;
    }
    await new Promise(r => setTimeout(r, 0));
    await runGenerate([next], { markDone: false });
  }, [getPending, runGenerate]);

  const handleDownloadSuccess = useCallback(() => {
    const buf = exportToExcel(records, 'success');
    downloadExcel(buf, 'דוח תשלומים ומספרי קבלות.xlsx');
  }, [records]);

  const handleDownloadErrors = useCallback(() => {
    const buf = exportToExcel(records, 'errors');
    downloadExcel(buf, 'שגויים.xlsx');
  }, [records]);

  const handleBuildCrm = useCallback(async () => {
    setCrmLoading(true);
    try {
      const { map } = await fetchAccountIdMap();
      setAccountIdMap(map);
      setCrmRecords(buildCrmRecords(records, map, selectedMonth));
    } catch (err) {
      console.error('Failed to load CRM IDs:', err);
      alert('שגיאה בטעינת נתוני CRM: ' + err.message);
    } finally {
      setCrmLoading(false);
    }
  }, [records, selectedMonth]);

  const handleMonthChange = useCallback((newMonth) => {
    if (accountIdMap) {
      setCrmRecords(buildCrmRecords(records, accountIdMap, newMonth));
    }
  }, [records, accountIdMap]);

  const handleFieldChange = useCallback((recordId, key, value) => {
    setCrmRecords(prev =>
      prev.map(r => {
        if (r._id !== recordId) return r;
        const next = { ...r, [key]: value };
        if (key === 'Accountid') next._matched = !!value;
        return next;
      })
    );
  }, []);

  const handleBuildRentCharge = useCallback(() => {
    setRentChargeRecords(buildRentChargeRecords(crmRecords));
  }, [crmRecords]);

  const handleSfToggle = useCallback((id) => {
    setRentChargeRecords(prev =>
      prev.map(r => r._id === id ? { ...r, sfEntered: !r.sfEntered } : r)
    );
  }, []);

  const successCount = records.filter(r => r.receiptStatus === 'done').length;
  const errorCount = records.filter(r => r.receiptStatus === 'error').length;
  const pendingCount = records.filter(r => r.receiptStatus === 'pending').length;

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
          <h1 className="text-3xl font-bold" style={{ color: colors.primaryGreen }}>
            הפקת קבלות
          </h1>
          <p className="mt-1" style={{ color: colors.muted }}>
            העלאת קובץ ממערכת שקד והפקת קבלות בחשבונית ירוקה
          </p>
        </div>
      </header>

      <MonthSelector disabled={generating || matchLoading} onChange={handleMonthChange} />

      <section className="mb-6">
        <p className="mb-3 text-sm font-medium" style={{ color: colors.muted }}>
          יש להעלות את קובץ האקסל שמתקבל ממערכת שקד
        </p>
        <FileUploader onFileProcessed={handleFileProcessed} disabled={generating || matchLoading} externalError={fileError} />
        {matchInfo && !matchLoading && (
          <p className="mt-2 text-sm font-medium" style={{ color: colors.green }}>
            {matchInfo}
          </p>
        )}
      </section>

      {matchLoading && (
        <div
          className="rounded-xl border p-12 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
        >
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${colors.gray400}`, borderTopColor: colors.primaryGreen }}
          />
          <p className="text-base font-semibold" style={{ color: colors.text }}>
            בודק קבלות קיימות בחשבונית ירוקה...
          </p>
          <p className="text-sm" style={{ color: colors.muted }}>
            {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
        </div>
      )}

      {!matchLoading && records.length > 0 && (
        <>
          {!generating && pendingCount === 0 && (successCount > 0 || errorCount > 0) && (
            <div className="mt-6 flex items-center justify-end gap-3 flex-wrap">
              <span className="text-sm font-medium ml-1" style={{ color: colors.muted }}>
                הורדות:
              </span>
              {successCount > 0 && (
                <button
                  onClick={handleDownloadSuccess}
                  className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
                  style={{ backgroundColor: colors.green, color: '#fff' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                  </svg>
                  דוח תשלומים וקבלות
                </button>
              )}
              {errorCount > 0 && (
                <button
                  onClick={handleDownloadErrors}
                  className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
                  style={{ backgroundColor: colors.red, color: '#fff' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                  </svg>
                  שגויים ({errorCount})
                </button>
              )}
            </div>
          )}

          <PaymentTable
            records={records}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
            onRetry={handleRetryOne}
            generating={generating}
          />

          <div
            className="mt-6 rounded-xl border p-5"
            style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
          >
            {/* Status counters */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.primaryGreen }}
                />
                <span className="text-sm" style={{ color: colors.text }}>
                  ממתינים: <strong>{pendingCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.green }}
                />
                <span className="text-sm" style={{ color: colors.text }}>
                  הצליחו: <strong>{successCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors.red }}
                />
                <span className="text-sm" style={{ color: colors.text }}>
                  נכשלו: <strong>{errorCount}</strong>
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {generating && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: colors.muted }}>
                    מעבד קבלות...
                  </span>
                  <span className="text-xs font-semibold" style={{ color: colors.primaryGreen }}>
                    {progress.current}/{progress.total}
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.gray400 }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%',
                      backgroundColor: colors.primaryGreen,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {pendingCount > 0 && successCount === 0 && (
                <button
                  onClick={handleTestFirst}
                  disabled={generating || matchLoading}
                  className="rounded-xl px-6 py-3.5 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-40 border-2"
                  style={{ borderColor: colors.primaryGreen, color: colors.primaryGreen, backgroundColor: '#fff' }}
                >
                  {generating ? 'בודק...' : 'בדיקה — הפק קבלה ראשונה בלבד'}
                </button>
              )}

              {pendingCount > 0 && (
                <button
                  onClick={handleNextOne}
                  disabled={generating || matchLoading}
                  className="rounded-xl px-6 py-3.5 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-40 border-2"
                  style={{ borderColor: colors.gold, color: colors.gold, backgroundColor: '#fff' }}
                >
                  {generating ? 'מעבד...' : `הפק הבאה (${pendingCount} נותרו)`}
                </button>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || matchLoading || pendingCount === 0}
                className="rounded-xl px-8 py-3.5 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
              >
                {generating ? 'מעבד...' : `הפק את כל הקבלות (${pendingCount})`}
              </button>

              {!generating && pendingCount === 0 && errorCount > 0 && (
                <button
                  onClick={handleRetryAllFailed}
                  className="rounded-xl px-8 py-3.5 text-base font-semibold transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.red, color: '#fff' }}
                >
                  נסה שוב להפיק קבלות שהחזירו שגיאה ({errorCount})
                </button>
              )}
            </div>

            {/* Download section */}
            {!generating && pendingCount === 0 && (successCount > 0 || errorCount > 0) && (
              <div
                className="mt-4 pt-4 flex items-center gap-3 flex-wrap"
                style={{ borderTop: `1px solid ${colors.gray400}` }}
              >
                <span className="text-sm font-medium ml-1" style={{ color: colors.muted }}>
                  הורדות:
                </span>
                {successCount > 0 && (
                  <button
                    onClick={handleDownloadSuccess}
                    className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
                    style={{ backgroundColor: colors.green, color: '#fff' }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                    </svg>
                    דוח תשלומים וקבלות
                  </button>
                )}
                {errorCount > 0 && (
                  <button
                    onClick={handleDownloadErrors}
                    className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 flex items-center gap-2"
                    style={{ backgroundColor: colors.red, color: '#fff' }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                    </svg>
                    שגויים ({errorCount})
                  </button>
                )}
              </div>
            )}
          </div>

          {!generating && pendingCount === 0 && successCount > 0 && crmRecords.length === 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={handleBuildCrm}
                disabled={crmLoading}
                className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: colors.gold, color: colors.black }}
              >
                {crmLoading ? 'טוען נתונים...' : 'תחילת עבודה על טבלה ל-Sales Force'}
              </button>
            </div>
          )}

          {crmRecords.length > 0 && (
            <CrmTable
              crmRecords={crmRecords}
              selectedMonth={selectedMonth}
              onFieldChange={handleFieldChange}
            />
          )}

          {crmRecords.length > 0 && rentChargeRecords.length === 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={handleBuildRentCharge}
                className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.secondaryText, color: '#fff' }}
              >
                דוח לרואה חשבון
              </button>
            </div>
          )}

          {rentChargeRecords.length > 0 && (
            <RentChargeTable
              rentRecords={rentChargeRecords}
              selectedMonth={selectedMonth}
              onSfToggle={handleSfToggle}
            />
          )}
        </>
      )}

      {!matchLoading && records.length === 0 && (
        <section
          className="mt-8 rounded-xl border p-6 text-center"
          style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
        >
          <p className="mb-4 text-sm font-medium" style={{ color: colors.muted }}>
            ניתן להתחיל בהזנה ידנית של קבלה אחת או יותר ללא העלאת קובץ
          </p>
          <button
            onClick={handleStartManual}
            disabled={generating || matchLoading}
            className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: colors.gold, color: colors.black }}
          >
            התחל הזנה ידנית
          </button>
        </section>
      )}
    </div>
  );
}
