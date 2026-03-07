'use client';

import { useState, useMemo, useCallback } from 'react';
import colors from '@/app/colors';
import { CRM_COLUMNS, exportCrmXlsx, downloadXlsx } from '@/lib/crmExport';

const DISPLAY_COLUMNS = [
  { key: 'RecordTypeId', label: 'RecordTypeId', width: '160px' },
  { key: 'Name', label: 'Name', width: '240px' },
  { key: 'Amount', label: 'Amount', width: '90px' },
  { key: 'Event__c', label: 'Event__c', width: '110px' },
  { key: 'Accountid', label: 'Accountid', width: '170px', editable: true },
  { key: 'cash_cheque_pp__c', label: 'cash_cheque_pp__c', width: '130px' },
  { key: 'Receipt_Num__c', label: 'Receipt_Num__c', width: '120px' },
  { key: 'Bank_account__c', label: 'Bank_account__c', width: '110px' },
  { key: 'CloseDate', label: 'CloseDate', width: '110px' },
  { key: 'StageName', label: 'StageName', width: '90px' },
  { key: 'Description', label: 'Description', width: '260px' },
  { key: 'CurrencyIsoCode', label: 'CurrencyIsoCode', width: '80px' },
];

const MONTH_OPTIONS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function CrmTable({ crmRecords, onMonthChange, selectedMonth, onAccountIdChange }) {
  const matchedCount = useMemo(
    () => crmRecords.filter(r => r._matched).length,
    [crmRecords]
  );
  const unmatchedCount = crmRecords.length - matchedCount;

  const handleDownload = useCallback(() => {
    const buf = exportCrmXlsx(crmRecords);
    const monthStr = String(selectedMonth.month + 1).padStart(2, '0');
    downloadXlsx(buf, `CRM_Export_${selectedMonth.year}-${monthStr}.xlsx`);
  }, [crmRecords, selectedMonth]);

  if (!crmRecords.length) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{ color: colors.primaryGreen }}>
          טבלת CRM לייצוא
        </h2>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium" style={{ color: colors.text }}>
            חודש עבודה:
          </label>
          <select
            value={selectedMonth.month}
            onChange={e => onMonthChange({ ...selectedMonth, month: Number(e.target.value) })}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: colors.gray400 }}
          >
            {MONTH_OPTIONS.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            value={selectedMonth.year}
            onChange={e => onMonthChange({ ...selectedMonth, year: Number(e.target.value) })}
            className="rounded border px-2 py-1.5 text-sm w-20"
            style={{ borderColor: colors.gray400 }}
            min={2020}
            max={2040}
          />
        </div>
      </div>

      {unmatchedCount > 0 && (
        <div
          className="mb-3 rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ backgroundColor: `${colors.red}15`, color: colors.red }}
        >
          {unmatchedCount} רשומות ללא AccountId — יש להזין ידנית
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.gray400 }}>
        <table className="w-full text-xs" style={{ direction: 'ltr' }}>
          <thead>
            <tr style={{ backgroundColor: colors.primaryGreen }}>
              <th
                className="px-2 py-2.5 text-left font-semibold whitespace-nowrap"
                style={{ color: colors.white, minWidth: '40px' }}
              >
                #
              </th>
              {DISPLAY_COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-2 py-2.5 text-left font-semibold whitespace-nowrap"
                  style={{ color: colors.white, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crmRecords.map((row, idx) => (
              <tr
                key={row._id}
                className="border-b transition-colors hover:opacity-90"
                style={{
                  backgroundColor: idx % 2 === 0 ? '#fff' : colors.surface,
                  borderColor: colors.gray400,
                }}
              >
                <td className="px-2 py-1.5 text-center" style={{ color: colors.muted }}>
                  {idx + 1}
                </td>
                {DISPLAY_COLUMNS.map(col => (
                  <td key={col.key} className="px-2 py-1.5">
                    {col.editable ? (
                      <input
                        type="text"
                        value={row[col.key] || ''}
                        onChange={e => onAccountIdChange(row._id, e.target.value)}
                        placeholder="הזן AccountId..."
                        className="w-full rounded border px-1.5 py-1 text-xs"
                        style={{
                          borderColor: row._matched ? colors.green : colors.red,
                          backgroundColor: row._matched ? `${colors.green}08` : `${colors.red}08`,
                        }}
                      />
                    ) : col.key === 'Accountid' ? (
                      <span
                        className="font-mono text-xs"
                        style={{ color: row._matched ? colors.green : colors.red }}
                      >
                        {row[col.key] || '—'}
                      </span>
                    ) : (
                      <span className="whitespace-nowrap">{row[col.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: colors.muted }}>
            {crmRecords.length} רשומות
          </span>
          <span style={{ color: colors.green }}>
            {matchedCount} עם AccountId
          </span>
          {unmatchedCount > 0 && (
            <span style={{ color: colors.red }}>
              {unmatchedCount} חסרים
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          className="rounded-xl px-6 py-3 text-sm font-semibold transition-colors hover:opacity-90"
          style={{ backgroundColor: colors.primaryGreen, color: colors.white }}
        >
          הורד קובץ מוכן ל-Sales Force
        </button>
      </div>
    </div>
  );
}
