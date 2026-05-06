'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bsb.workingMonth';

function currentMonth() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

function isValidMonth(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isInteger(value.month) &&
    value.month >= 0 &&
    value.month <= 11 &&
    Number.isInteger(value.year) &&
    value.year >= 2000 &&
    value.year <= 2100
  );
}

const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const [selectedMonth, setSelectedMonthState] = useState(currentMonth);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (isValidMonth(parsed)) {
        setSelectedMonthState(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const setSelectedMonth = useCallback((next) => {
    setSelectedMonthState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // ignore quota / unavailable storage
      }
      return value;
    });
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
