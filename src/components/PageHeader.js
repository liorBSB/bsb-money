'use client';

import Link from 'next/link';
import colors from '@/app/colors';

export default function PageHeader({ title, subtitle, accent = colors.primaryGreen }) {
  return (
    <header className="mb-8 app-fade-in">
      <Link
        href="/"
        className="focus-ring mb-5 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white"
        style={{ color: colors.muted }}
      >
        <span aria-hidden>←</span>
        חזרה לדשבורד
      </Link>

      <div className="flex items-start gap-4">
        <span
          className="mt-1 h-12 w-1.5 shrink-0 rounded-full"
          style={{ background: `linear-gradient(${accent}, ${accent}55)` }}
        />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl" style={{ color: accent }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-base leading-7" style={{ color: colors.muted }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
