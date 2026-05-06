'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import colors from '@/app/colors';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';
import { authenticate, searchExistingReceipts } from '@/lib/greenInvoice';
import { getMonthDateRange } from '@/lib/processBank';
import { fetchAccountIdMap, findAccountId } from '@/lib/googleSheets';

function normalizeForCompare(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\u200e\u200f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(str) {
  return normalizeForCompare(str).split(' ').filter(Boolean);
}

/**
 * Case-insensitive fuzzy matcher for receipts: tries exact, reverse-words,
 * and word-subset matches against the list of existing Green Invoice docs.
 */
function findReceiptByName(query, docs) {
  const q = normalizeForCompare(query);
  if (!q || !docs?.length) return null;

  for (const doc of docs) {
    if (normalizeForCompare(doc.clientName) === q) return doc;
  }

  const reversed = q.split(' ').reverse().join(' ');
  for (const doc of docs) {
    if (normalizeForCompare(doc.clientName) === reversed) return doc;
  }

  const queryWords = wordsOf(query);
  if (!queryWords.length) return null;

  for (const doc of docs) {
    const docWords = wordsOf(doc.clientName);
    if (!docWords.length) continue;
    const allQueryInDoc = queryWords.every(w => docWords.includes(w));
    if (allQueryInDoc) return doc;
    const allDocInQuery = docWords.every(w => queryWords.includes(w));
    if (allDocInQuery) return doc;
  }

  return null;
}

function NotFoundModal({ open, name, nameInRecords, onClose }) {
  if (!open) return null;

  const title = nameInRecords ? 'לא נמצאה קבלה' : 'לא נמצאה התאמה';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-xl text-center"
        style={{ backgroundColor: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ backgroundColor: colors.red, color: '#fff' }}
        >
          !
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: colors.red }}>
          {title}
        </h3>

        {nameInRecords ? (
          <p className="text-sm mb-5" style={{ color: colors.text }}>
            לא קיימת קבלה עבור <strong>{name}</strong> בחודש שנבחר.
          </p>
        ) : (
          <div className="text-sm mb-5 text-right" style={{ color: colors.text }}>
            <p className="mb-2">
              לא נמצאה קבלה עבור <strong>{name}</strong> בחודש שנבחר,
              <br />
              והשם גם לא קיים ברשומות הבוקר.
            </p>
            <p className="font-semibold mb-1" style={{ color: colors.text }}>
              לא ניתן לדעת בוודאות אם:
            </p>
            <ul className="list-disc pr-6 space-y-1">
              <li>הקבלה טרם הופקה לחייל זה, או</li>
              <li>השם הוקלד בצורה שגויה / החייל לא קיים ברשומות.</li>
            </ul>
            <p className="mt-3 text-xs" style={{ color: colors.muted }}>
              מומלץ לוודא את כתיב השם ולנסות שוב.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="rounded-xl px-6 py-2.5 text-base font-semibold transition-colors hover:opacity-90"
          style={{ backgroundColor: colors.primaryGreen, color: '#fff' }}
        >
          סגור
        </button>
      </div>
    </div>
  );
}

function formatCurrency(n) {
  if (typeof n !== 'number') return n;
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
}

export default function ReceiptLookupPage() {
  const { selectedMonth } = useMonth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(null);
  const [error, setError] = useState(null);

  const handleNameChange = (e) => {
    const cleaned = e.target.value.replace(/[0-9\u0660-\u0669]/g, '');
    setName(cleaned);
  };

  const handleSearch = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('יש להזין שם של חייל');
      return;
    }
    setError(null);
    setResult(null);
    setNotFound(null);
    setLoading(true);

    try {
      const token = await authenticate();
      const { fromDate, toDate } = getMonthDateRange(selectedMonth);

      const [docs, mapResult] = await Promise.all([
        searchExistingReceipts(token, fromDate, toDate),
        fetchAccountIdMap().catch(err => {
          console.error('Failed to load Salesforce account ID map:', err);
          return { map: new Map() };
        }),
      ]);

      const map = mapResult?.map || new Map();
      const match = findReceiptByName(trimmed, docs);

      if (!match) {
        const accountIdInRecords = findAccountId(trimmed, map);
        setNotFound({
          name: trimmed,
          nameInRecords: !!accountIdInRecords,
        });
        return;
      }

      const accountId = findAccountId(match.clientName, map);

      setResult({
        name: match.clientName,
        amount: match.amount,
        receiptNumber: match.receiptNumber,
        description: match.description,
        accountId,
      });
    } catch (err) {
      console.error('Receipt lookup failed:', err);
      setError('שגיאה בחיפוש: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [name, selectedMonth]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleResetSearch = () => {
    setResult(null);
    setError(null);
    setName('');
  };

  return (
    <div className="min-h-screen p-6 max-w-[1100px] mx-auto">
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
            חיפוש קבלה
          </h1>
          <p className="mt-1" style={{ color: colors.muted }}>
            מציאת קבלה ספציפית של חייל לפי שם וחודש
          </p>
        </div>
      </header>

      <MonthSelector disabled={loading} onChange={() => setResult(null)} />

      <section
        className="mb-6 rounded-xl border p-5"
        style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
      >
        <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
          שם החייל
        </label>
        <div className="flex items-stretch gap-3 flex-wrap">
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="לדוגמה: ישראל ישראלי"
            className="rounded-lg border px-3 py-2 text-base flex-1 min-w-[220px]"
            style={{ borderColor: colors.gray400, backgroundColor: '#fff' }}
            autoComplete="off"
            inputMode="text"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !name.trim()}
            className="rounded-lg px-6 py-2 text-base font-semibold transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: colors.secondaryText, color: '#fff' }}
          >
            {loading ? 'מחפש...' : 'חפש קבלה'}
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: colors.muted }}>
          ניתן להזין שם בעברית או באנגלית. החיפוש אינו רגיש לרישיות (case-insensitive). מספרים אינם מותרים בשם.
        </p>
        {error && (
          <p className="mt-3 text-sm font-semibold" style={{ color: colors.red }}>
            {error}
          </p>
        )}
      </section>

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
            מחפש קבלה בחשבונית ירוקה...
          </p>
          <p className="text-sm" style={{ color: colors.muted }}>
            {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </p>
        </div>
      )}

      {!loading && result && (
        <section
          className="rounded-xl border-2 p-6"
          style={{ backgroundColor: '#fff', borderColor: colors.secondaryText }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <h2 className="text-xl font-bold" style={{ color: colors.secondaryText }}>
              נמצאה קבלה
            </h2>
            <span
              className="text-sm px-3 py-1 rounded-full font-medium"
              style={{ backgroundColor: colors.surface, color: colors.muted }}
            >
              {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
            </span>
          </div>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                שם החייל
              </dt>
              <dd className="text-base font-medium" style={{ color: colors.text }}>
                {result.name || '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                סכום
              </dt>
              <dd className="text-base font-medium" style={{ color: colors.text }}>
                {result.amount != null ? formatCurrency(result.amount) : '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                מספר קבלה
              </dt>
              <dd className="text-base font-medium" style={{ color: colors.text }}>
                {result.receiptNumber || '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                מזהה Salesforce
              </dt>
              <dd className="text-base font-medium" style={{ color: result.accountId ? colors.text : colors.muted }}>
                {result.accountId || 'לא נמצא במיפוי'}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                תיאור
              </dt>
              <dd className="text-base whitespace-pre-wrap" style={{ color: colors.text }}>
                {result.description || '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleResetSearch}
              className="rounded-lg px-5 py-2 text-sm font-semibold transition-colors hover:opacity-90 border"
              style={{ borderColor: colors.gray400, color: colors.text, backgroundColor: colors.surface }}
            >
              חיפוש חדש
            </button>
          </div>
        </section>
      )}

      <NotFoundModal
        open={!!notFound}
        name={notFound?.name || ''}
        nameInRecords={!!notFound?.nameInRecords}
        onClose={() => setNotFound(null)}
      />
    </div>
  );
}
