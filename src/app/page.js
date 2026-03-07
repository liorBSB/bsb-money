'use client';

import { useState, useCallback } from 'react';
import colors from '@/app/colors';
import FileUploader from '@/components/FileUploader';
import PaymentTable from '@/components/PaymentTable';
import CrmTable from '@/components/CrmTable';
import { processBankFile, createEmptyRecord, exportToExcel, downloadExcel } from '@/lib/processBank';
import { authenticate, processOneReceipt } from '@/lib/greenInvoice';
import { fetchAccountIdMap } from '@/lib/googleSheets';
import { buildCrmRecords } from '@/lib/crmExport';

export default function Home() {
  const [records, setRecords] = useState([]);
  const [fileName, setFileName] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [accountIdMap, setAccountIdMap] = useState(null);
  const [crmRecords, setCrmRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [crmLoading, setCrmLoading] = useState(false);

  const handleFileProcessed = useCallback((arrayBuffer, name) => {
    const parsed = processBankFile(arrayBuffer);
    setRecords(parsed);
    setFileName(name);
    setDone(false);
    setProgress({ current: 0, total: 0 });
    setCrmRecords([]);
    setAccountIdMap(null);
  }, []);

  const handleUpdate = useCallback((id, key, value) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  }, []);

  const handleDelete = useCallback((id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    setRecords(prev => [...prev, createEmptyRecord(prev.length)]);
  }, []);

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

  const runGenerate = useCallback(async (toProcess) => {
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

      setDone(true);
    } catch (err) {
      alert('שגיאה באימות: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    const pending = records.filter(r => r.receiptStatus === 'pending' && r.name && r.amount > 0);
    if (!pending.length) {
      alert('אין רשומות תקינות לשליחה');
      return;
    }
    // Defer to avoid Next.js Server Action hanging in dev
    await new Promise(r => setTimeout(r, 0));
    await runGenerate(pending);
  }, [records, runGenerate]);

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

  const handleCrmMonthChange = useCallback((newMonth) => {
    setSelectedMonth(newMonth);
    if (accountIdMap) {
      setCrmRecords(buildCrmRecords(records, accountIdMap, newMonth));
    }
  }, [records, accountIdMap]);

  const handleAccountIdChange = useCallback((recordId, value) => {
    setCrmRecords(prev =>
      prev.map(r => r._id === recordId ? { ...r, Accountid: value, _matched: !!value } : r)
    );
  }, []);

  const successCount = records.filter(r => r.receiptStatus === 'done').length;
  const errorCount = records.filter(r => r.receiptStatus === 'error').length;
  const pendingCount = records.filter(r => r.receiptStatus === 'pending').length;

  return (
    <div className="min-h-screen p-6 max-w-[1400px] mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold" style={{ color: colors.primaryGreen }}>
          BSB Money
        </h1>
        <p className="mt-1" style={{ color: colors.muted }}>
          מערכת ניהול תשלומים וקבלות
        </p>
      </header>

      <section className="mb-6">
        <p className="mb-3 text-sm font-medium" style={{ color: colors.muted }}>
          יש להעלות את קובץ האקסל שמתקבל ממערכת שקד
        </p>
        <FileUploader onFileProcessed={handleFileProcessed} disabled={generating} />
      </section>

      {records.length > 0 && (
        <>
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
              <button
                onClick={handleGenerate}
                disabled={generating || pendingCount === 0}
                className="rounded-xl px-8 py-3.5 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
              >
                {generating ? 'מעבד...' : 'הפק קבלות'}
              </button>

              {!generating && done && errorCount > 0 && (
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
            {done && (successCount > 0 || errorCount > 0) && (
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

          {done && successCount > 0 && crmRecords.length === 0 && (
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
              onMonthChange={handleCrmMonthChange}
              onAccountIdChange={handleAccountIdChange}
            />
          )}
        </>
      )}
    </div>
  );
}
