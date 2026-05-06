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
      className="mb-6 rounded-xl border p-4 flex items-center gap-4 flex-wrap"
      style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
    >
      <label className="text-sm font-semibold" style={{ color: colors.text }}>
        חודש עבודה:
      </label>
      <select
        value={selectedMonth.month}
        onChange={e => update({ ...selectedMonth, month: Number(e.target.value) })}
        disabled={disabled}
        className="rounded-lg border px-3 py-2 text-sm font-medium"
        style={{ borderColor: colors.gray400 }}
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
        className="rounded-lg border px-3 py-2 text-sm font-medium w-24"
        style={{ borderColor: colors.gray400 }}
        min={2020}
        max={2040}
      />
    </section>
  );
}

export { HEBREW_MONTHS };
