'use client';

import Link from 'next/link';
import colors from '@/app/colors';
import { useMonth } from '@/lib/monthContext';
import { HEBREW_MONTHS } from '@/components/MonthSelector';

export default function AppNavbar() {
  const { selectedMonth } = useMonth();

  return (
    <nav className="app-navbar sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8">
        <Link href="/" className="group flex items-center gap-3 focus-ring rounded-xl">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black shadow-sm transition-transform group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${colors.primaryGreen}, ${colors.primaryGreenHover})`,
              color: '#fff',
            }}
          >
            ₪
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight" style={{ color: colors.primaryGreen }}>
              BSB Money
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: colors.gold }}>
              מערכת כספים
            </span>
          </span>
        </Link>

        <div
          className="flex items-center gap-2 rounded-full border px-4 py-1.5"
          style={{ borderColor: 'rgba(11,95,58,0.16)', backgroundColor: 'rgba(11,95,58,0.06)' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.gold }} />
          <span className="text-sm font-bold" style={{ color: colors.primaryGreen }}>
            {HEBREW_MONTHS[selectedMonth.month]} {selectedMonth.year}
          </span>
        </div>
      </div>
    </nav>
  );
}
