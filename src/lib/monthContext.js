'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// Legacy key from a previous version that persisted a fixed month across
// reloads. We clear it so the app always opens on the real current month.
const LEGACY_STORAGE_KEY = 'bsb.workingMonth';

function currentMonth() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore unavailable storage
    }
  }, []);

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) {
    throw new Error('useMonth must be used within a MonthProvider');
  }
  return ctx;
}
