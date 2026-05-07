'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import colors from '@/app/colors';
import MonthSelector, { HEBREW_MONTHS } from '@/components/MonthSelector';
import { useMonth } from '@/lib/monthContext';

const CARDS = [
  {
    href: '/receipts',
    title: 'הפקת קבלות',
    eyebrow: 'תהליך מרכזי',
    description: 'העלאת קובץ ממערכת שקד והפקת קבלות בחשבונית ירוקה. כולל המשך לטבלת CRM ולדוח לרואה חשבון.',
    color: 'primaryGreen',
    requiresMonthPick: true,
  },
  {
    href: '/crm',
    title: 'קובץ ל-CRM',
    eyebrow: 'ייצוא נתונים',
    description: 'בניית קובץ ל-Sales Force מתוך קבלות שכבר קיימות בחשבונית ירוקה לחודש שנבחר.',
    color: 'gold',
    requiresMonthPick: true,
  },
  {
    href: '/accountant',
    title: 'דוח לרואה חשבון',
    eyebrow: 'דוחות חודשיים',
    description: 'בניית דוח חיוב שכר דירה מתוך קבלות שכבר קיימות בחשבונית ירוקה לחודש שנבחר.',
    color: 'secondaryText',
    requiresMonthPick: true,
  },
  {
    href: '/receipt-lookup',
    title: 'חיפוש קבלה',
    eyebrow: 'איתור מהיר',
    description: 'חיפוש קבלה ספציפית של חייל לפי שם וחודש. מציג את שם החייל, הסכום, מספר הקבלה, התיאור ומזהה ה-Salesforce.',
    color: 'gold',
    requiresMonthPick: false,
  },
];

function MonthPickerModal({ onCancel, onConfirm, initialMonth, initialYear, accentColor, title }) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(16,24,40,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-xl"
        style={{ backgroundColor: '#fff', borderColor: colors.gray200 }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black"
          style={{ backgroundColor: `${accentColor}16`, color: accentColor }}
        >
          {title.charAt(0)}
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight" style={{ color: colors.text }}>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: colors.muted }}>
          בחר את החודש שעבורו תרצה לבצע את הפעולה. הבחירה תישמר לתהליך הבא.
        </p>

        <div
          className="my-6 flex items-center gap-3 rounded-xl border p-3 flex-wrap"
          style={{ backgroundColor: colors.gray100, borderColor: colors.gray200 }}
        >
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="h-11 min-w-32 flex-1 rounded-xl border px-3 text-sm font-semibold outline-none transition focus:ring-4"
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
            className="h-11 w-28 rounded-xl border px-3 text-sm font-semibold outline-none transition focus:ring-4"
            style={{ borderColor: colors.gray400 }}
            min={2020}
            max={2040}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border px-5 py-3 text-sm font-bold transition hover:bg-gray-50"
            style={{ borderColor: colors.gray300, color: colors.text, backgroundColor: '#fff' }}
          >
            ביטול
          </button>
          <button
            onClick={() => onConfirm({ month, year })}
            className="rounded-xl px-7 py-3 text-sm font-bold transition hover:opacity-95"
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

  const cardClassName = 'group block rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md text-right cursor-pointer focus:outline-none focus:ring-4';
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.gray200,
    borderWidth: 1,
    boxShadow: '0 8px 24px rgba(16,24,40,0.05)',
    '--tw-ring-color': 'rgba(11,95,58,0.12)',
  };

  const renderCardBody = (card, featured = false) => (
    <>
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: colors[card.color] }}>
            {card.eyebrow}
          </p>
          <h3
            className={`${featured ? 'mt-3 text-3xl md:text-4xl' : 'mt-2 text-2xl'} font-bold tracking-tight`}
            style={{ color: colors.text }}
          >
            {card.title}
          </h3>
        </div>
        <span
          className={`${featured ? 'h-12 w-12' : 'h-10 w-10'} flex shrink-0 items-center justify-center rounded-xl`}
          style={{ backgroundColor: `${colors[card.color]}16`, color: colors[card.color] }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[card.color] }} />
        </span>
      </div>
      <p
        className={`${featured ? 'mt-5 max-w-3xl text-base leading-8' : 'mt-4 text-sm leading-7'}`}
        style={{ color: colors.muted }}
      >
        {card.description}
      </p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold" style={{ color: colors[card.color] }}>
        <span>כניסה לתהליך</span>
        <span className="transition group-hover:-translate-x-1">←</span>
      </div>
    </>
  );

  return (
    <div className="min-h-screen px-5 py-8 md:px-8 md:py-10">
      <header className="mx-auto mb-8 max-w-6xl">
        <div className="flex flex-col gap-6 rounded-2xl border p-7 shadow-sm md:flex-row md:items-center md:justify-between"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.gray200,
          }}
        >
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.22em]" style={{ color: colors.gold }}>
              מערכת כספים
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl" style={{ color: colors.primaryGreen }}>
              BSB Money
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7" style={{ color: colors.muted }}>
              ניהול קבלות, ייצוא ל-CRM והפקת דוחות חודשיים בצורה מסודרת ומהירה.
            </p>
          </div>
          <div
            className="rounded-xl border px-5 py-4 text-right"
            style={{ backgroundColor: 'rgba(11,95,58,0.06)', borderColor: 'rgba(11,95,58,0.14)' }}
          >
            <p className="text-sm font-semibold" style={{ color: colors.muted }}>
              חודש נוכחי
            </p>
            <p className="mt-1 text-2xl font-extrabold" style={{ color: colors.primaryGreen }}>
              {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        <MonthSelector />

        <section className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: colors.gold }}>
              מרכז פעולות
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ color: colors.text }}>
              מה תרצה לעשות?
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6" style={{ color: colors.muted }}>
            בחר פעולה עבור החודש שנבחר. בכל תהליך ניתן לעדכן את החודש לפני המעבר.
          </p>
        </section>

        {(() => {
          const [mainCard, ...secondaryCards] = CARDS;

          const renderCard = (card, featured = false) =>
            card.requiresMonthPick ? (
              <button
                key={card.href}
                type="button"
                onClick={() => setModalCard(card)}
                className={`${cardClassName} ${featured ? 'min-h-56' : 'min-h-52'}`}
                style={{ ...cardStyle, width: '100%' }}
              >
                {renderCardBody(card, featured)}
              </button>
            ) : (
              <Link
                key={card.href}
                href={card.href}
                className={`${cardClassName} ${featured ? 'min-h-56' : 'min-h-52'}`}
                style={cardStyle}
              >
                {renderCardBody(card, featured)}
              </Link>
            );

          return (
            <>
              <section className="mb-5">
                {renderCard(mainCard, true)}
              </section>

              <section className="grid gap-5 md:grid-cols-3">
                {secondaryCards.map(card => renderCard(card))}
              </section>
            </>
          );
        })()}
      </main>

      {modalCard && (
        <MonthPickerModal
          key={`${modalCard.href}-${selectedMonth.month}-${selectedMonth.year}`}
          title={modalCard.title}
          accentColor={colors[modalCard.color]}
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
      )}
    </div>
  );
}
