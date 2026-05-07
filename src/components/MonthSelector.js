'use client';

import colors from '@/app/colors';
import { useMonth } from '@/lib/monthContext';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function MonthSelector({ disabled = false, onChange }) {
  const { selectedMonth, setSelectedMonth } = useMonth();

  const update = (next) => {
    setSelectedMonth(next);
    if (onChange) onChange(next);
  };

  return (
    <section
      className="mb-8 flex items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm flex-wrap"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.gray200,
      }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: colors.gold }}>
          תקופת עבודה
        </p>
        <label className="mt-1 block text-base font-bold" style={{ color: colors.text }}>
          בחר חודש ושנה
        </label>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedMonth.month}
          onChange={e => update({ ...selectedMonth, month: Number(e.target.value) })}
          disabled={disabled}
          className="h-11 min-w-32 rounded-xl border px-4 text-sm font-semibold outline-none transition focus:ring-4"
          style={{ borderColor: colors.gray400, '--tw-ring-color': 'rgba(11,95,58,0.12)' }}
        >
          {HEBREW_MONTHS.map((label, idx) => (
            <option key={idx} value={idx}>{label}</option>
          ))}
        </select>
        <input
          type="number"
          value={selectedMonth.year}
          onChange={e => update({ ...selectedMonth, year: Number(e.target.value) })}
          disabled={disabled}
          className="h-11 w-28 rounded-xl border px-4 text-sm font-semibold outline-none transition focus:ring-4"
          style={{ borderColor: colors.gray400, '--tw-ring-color': 'rgba(11,95,58,0.12)' }}
          min={2020}
          max={2040}
        />
      </div>
    </section>
  );
}

export { HEBREW_MONTHS };
