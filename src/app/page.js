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
      <header className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: colors.primaryGreen }}>
          BSB Money
        </h1>
        <p className="mt-1" style={{ color: colors.muted }}>
          מערכת ניהול תשלומים וקבלות
        </p>
      </header>

      <section className="mb-6">
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

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating || pendingCount === 0}
              className="rounded-xl px-6 py-3 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
            >
              {generating
                ? `מעבד... ${progress.current}/${progress.total}`
                : 'הפק קבלות'}
            </button>

            {!generating && errorCount > 0 && pendingCount === 0 && (
              <button
                onClick={handleRetryAllFailed}
                className="rounded-xl px-5 py-3 text-base font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.red, color: '#fff' }}
              >
                אפס שגויים לשליחה מחדש ({errorCount})
              </button>
            )}

            {generating && (
              <div className="flex-1 max-w-xs">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.gray400 }}>
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

            {done && (
              <div className="flex items-center gap-3">
                {successCount > 0 && (
                  <button
                    onClick={handleDownloadSuccess}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.green, color: '#fff' }}
                  >
                    הורד דוח תשלומים ומספרי קבלות
                  </button>
                )}
                {errorCount > 0 && (
                  <button
                    onClick={handleDownloadErrors}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.red, color: '#fff' }}
                  >
                    הורד שגויים ({errorCount})
                  </button>
                )}
                <span className="text-sm" style={{ color: colors.muted }}>
                  {successCount} הצליחו, {errorCount} נכשלו
                </span>
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
