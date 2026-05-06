'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import colors from '@/app/colors';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';

const CARDS = [
  {
    href: '/receipts',
    title: 'הפקת קבלות',
    description: 'העלאת קובץ ממערכת שקד והפקת קבלות בחשבונית ירוקה. כולל המשך לטבלת CRM ולדוח לרואה חשבון.',
    color: 'primaryGreen',
    requiresMonthPick: true,
  },
  {
    href: '/crm',
    title: 'קובץ ל-CRM',
    description: 'בניית קובץ ל-Sales Force מתוך קבלות שכבר קיימות בחשבונית ירוקה לחודש שנבחר.',
    color: 'gold',
    requiresMonthPick: true,
  },
  {
    href: '/accountant',
    title: 'דוח לרואה חשבון',
    description: 'בניית דוח חיוב שכר דירה מתוך קבלות שכבר קיימות בחשבונית ירוקה לחודש שנבחר.',
    color: 'secondaryText',
    requiresMonthPick: true,
  },
  {
    href: '/receipt-lookup',
    title: 'חיפוש קבלה',
    description: 'חיפוש קבלה ספציפית של חייל לפי שם וחודש. מציג את שם החייל, הסכום, מספר הקבלה, התיאור ומזהה ה-Salesforce.',
    color: 'gold',
    requiresMonthPick: false,
  },
];

function MonthPickerModal({ open, onCancel, onConfirm, initialMonth, initialYear, accentColor, title }) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    if (open) {
      setMonth(initialMonth);
      setYear(initialYear);
    }
  }, [open, initialMonth, initialYear]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-xl"
        style={{ backgroundColor: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-1" style={{ color: accentColor }}>
          {title}
        </h3>
        <p className="text-sm mb-5" style={{ color: colors.muted }}>
          בחר את החודש שעבורו תרצה לבצע את הפעולה
        </p>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm font-medium flex-1"
            style={{ borderColor: colors.gray400 }}
          >
            {HEBREW_MONTHS.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm font-medium w-28"
            style={{ borderColor: colors.gray400 }}
            min={2020}
            max={2040}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-base font-semibold transition-colors hover:opacity-90 border"
            style={{ borderColor: colors.gray400, color: colors.text, backgroundColor: '#fff' }}
          >
            ביטול
          </button>
          <button
            onClick={() => onConfirm({ month, year })}
            className="rounded-xl px-6 py-2.5 text-base font-semibold transition-colors hover:opacity-90"
            style={{ backgroundColor: accentColor, color: '#fff' }}
          >
            המשך
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [modalCard, setModalCard] = useState(null);

  const cardClassName = 'block rounded-xl border p-6 transition-all hover:shadow-md hover:-translate-y-0.5 text-right cursor-pointer';
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.gray400,
    borderWidth: 1,
  };

  const renderCardBody = (card) => (
    <>
      <div className="flex items-center gap-3 mb-3">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: colors[card.color] }}
        />
        <h3 className="text-xl font-bold" style={{ color: colors[card.color] }}>
          {card.title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
        {card.description}
      </p>
      <div className="mt-4 text-sm font-semibold" style={{ color: colors[card.color] }}>
        כניסה לתהליך ←
      </div>
    </>
  );

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

      <MonthSelector />

      <section className="mb-4">
        <h2 className="text-lg font-semibold mb-1" style={{ color: colors.text }}>
          מה תרצה לעשות?
        </h2>
        <p className="text-sm" style={{ color: colors.muted }}>
          בחר את הפעולה שברצונך לבצע עבור החודש שנבחר.
        </p>
      </section>

      {(() => {
        const [mainCard, ...secondaryCards] = CARDS;

        const renderCard = (card) =>
          card.requiresMonthPick ? (
            <button
              key={card.href}
              type="button"
              onClick={() => setModalCard(card)}
              className={cardClassName}
              style={{ ...cardStyle, width: '100%' }}
            >
              {renderCardBody(card)}
            </button>
          ) : (
            <Link
              key={card.href}
              href={card.href}
              className={cardClassName}
              style={cardStyle}
            >
              {renderCardBody(card)}
            </Link>
          );

        return (
          <>
            <section className="mb-4">
              {renderCard(mainCard)}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {secondaryCards.map(renderCard)}
            </section>
          </>
        );
      })()}

      <MonthPickerModal
        open={!!modalCard}
        title={modalCard?.title || ''}
        accentColor={modalCard ? colors[modalCard.color] : colors.primaryGreen}
        initialMonth={selectedMonth.month}
        initialYear={selectedMonth.year}
        onCancel={() => setModalCard(null)}
        onConfirm={({ month, year }) => {
          setSelectedMonth({ month, year });
          const href = modalCard.href;
          setModalCard(null);
          router.push(href);
        }}
      />
    </div>
  );
}
