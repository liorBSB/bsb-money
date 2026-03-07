'use client';

import { useCallback, useMemo } from 'react';
import colors from '@/app/colors';

const PAY_TYPE_OPTIONS = [
  { value: 1, label: 'מזומן' },
  { value: 2, label: "צ'ק" },
  { value: 3, label: 'אשראי' },
  { value: 4, label: 'העברה בנקאית' },
  { value: 10, label: 'אפליקציה' },
];

const PAY_TYPE_LABELS = Object.fromEntries(PAY_TYPE_OPTIONS.map(o => [o.value, o.label]));

const STATUS_LABELS = {
  pending: { text: 'ממתין', color: colors.muted },
  processing: { text: 'בתהליך...', color: colors.secondaryText },
  done: { text: 'הצליח', color: colors.green },
  error: { text: 'שגיאה', color: colors.red },
};

const COLUMNS = [
  { key: 'index', label: '#', width: '50px', editable: false, required: false },
  { key: 'name', label: 'שם לקוח', width: '180px', editable: true, type: 'text', required: true },
  { key: 'email', label: 'אימייל', width: '160px', editable: true, type: 'text', required: false },
  { key: 'date', label: 'תאריך', width: '130px', editable: true, type: 'date', required: true },
  { key: 'amount', label: 'סכום', width: '100px', editable: true, type: 'number', required: true },
  { key: 'payType', label: 'אופן תשלום', width: '140px', editable: true, type: 'select', required: true },
  { key: 'card', label: 'כרטיס', width: '100px', editable: true, type: 'text', required: false, showWhen: (r) => r.payType === 3 },
  { key: 'appType', label: 'אפליקציה', width: '90px', editable: true, type: 'number', required: false, showWhen: (r) => r.payType === 10 },
  { key: 'description', label: 'תיאור', width: '150px', editable: true, type: 'text', required: false },
  { key: 'remarks', label: 'הערות', width: '150px', editable: true, type: 'text', required: false },
  { key: 'receiptStatus', label: 'סטטוס', width: '90px', editable: false, required: false },
  { key: 'receiptNumber', label: 'מספר קבלה', width: '110px', editable: false, required: false },
];

function isCellRelevant(col, record) {
  if (!col.showWhen) return true;
  return col.showWhen(record);
}

export default function PaymentTable({ records, onUpdate, onDelete, onAdd, onRetry, generating }) {
  const handleCellChange = useCallback((id, key, value) => {
    let parsed = value;
    if (key === 'amount' || key === 'appType') {
      parsed = Number(value) || 0;
    }
    if (key === 'payType') {
      parsed = Number(value);
    }
    onUpdate(id, key, parsed);
  }, [onUpdate]);

  const summaryByPayType = useMemo(() => {
    const map = {};
    for (const r of records) {
      const key = r.payType;
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count++;
      map[key].total += r.amount || 0;
    }
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([payType, data]) => ({
        label: PAY_TYPE_LABELS[payType] || payType,
        count: data.count,
        total: data.total,
      }));
  }, [records]);

  const grandTotal = records.reduce((sum, r) => sum + (r.amount || 0), 0);

  if (!records.length) return null;

  return (
    <div className="mt-6">
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.gray400 }}>
        <table className="w-full text-sm" style={{ direction: 'rtl' }}>
          <thead>
            <tr style={{ backgroundColor: colors.primaryGreen }}>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-right font-semibold whitespace-nowrap"
                  style={{ color: colors.white, minWidth: col.width }}
                >
                  {col.label}
                  {col.required && <span style={{ color: colors.gold }}> *</span>}
                </th>
              ))}
              <th
                className="px-3 py-2.5 text-center font-semibold"
                style={{ color: colors.white, minWidth: '60px' }}
              >
                פעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, rowIdx) => (
              <tr
                key={record.id}
                className="border-b transition-colors hover:opacity-90"
                style={{
                  backgroundColor: rowIdx % 2 === 0 ? '#fff' : colors.surface,
                  borderColor: colors.gray400,
                }}
              >
                {COLUMNS.map(col => {
                  const relevant = isCellRelevant(col, record);

                  return (
                    <td key={col.key} className="px-2 py-1.5">
                      {col.key === 'index' ? (
                        <span className="text-center block" style={{ color: colors.muted }}>
                          {rowIdx + 1}
                        </span>
                      ) : col.key === 'receiptStatus' ? (
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-full inline-block"
                          style={{
                            color: STATUS_LABELS[record.receiptStatus]?.color || colors.muted,
                            backgroundColor: `${STATUS_LABELS[record.receiptStatus]?.color || colors.muted}15`,
                          }}
                        >
                          {STATUS_LABELS[record.receiptStatus]?.text || record.receiptStatus}
                        </span>
                      ) : col.key === 'receiptNumber' ? (
                        <span className="font-mono text-xs">
                          {record.receiptNumber || '—'}
                        </span>
                      ) : col.key === 'payType' ? (
                        <select
                          value={record.payType}
                          onChange={(e) => handleCellChange(record.id, 'payType', e.target.value)}
                          disabled={generating || record.receiptStatus === 'done' || record.receiptStatus === 'processing'}
                          className="w-full rounded border px-1 py-1 text-sm bg-transparent"
                          style={{ borderColor: colors.gray400 }}
                        >
                          {PAY_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : !relevant ? (
                        <span className="block text-center" style={{ color: colors.gray400 }}>—</span>
                      ) : col.editable ? (
                        <input
                          type={col.type}
                          value={record[col.key] ?? ''}
                          onChange={(e) => handleCellChange(record.id, col.key, e.target.value)}
                          disabled={generating || record.receiptStatus === 'done' || record.receiptStatus === 'processing'}
                          className="w-full rounded border px-2 py-1 text-sm bg-transparent"
                          style={{ borderColor: colors.gray400 }}
                        />
                      ) : (
                        <span>{record[col.key]}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center flex items-center justify-center gap-1">
                  {record.receiptStatus === 'error' && (
                    <button
                      onClick={() => onRetry(record.id)}
                      disabled={generating}
                      className="rounded-lg px-3 py-2 text-base font-bold transition-colors hover:opacity-80 disabled:opacity-30"
                      style={{ backgroundColor: colors.red, color: '#fff' }}
                      title="נסה שוב"
                    >
                      ↻
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(record.id)}
                    disabled={generating || record.receiptStatus === 'done'}
                    className="text-xs rounded px-2 py-1 transition-colors hover:opacity-80 disabled:opacity-30"
                    style={{ color: colors.red }}
                    title="מחק שורה"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-3 flex justify-between items-center" style={{ backgroundColor: colors.surface }}>
          <button
            onClick={onAdd}
            disabled={generating}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: colors.gold, color: colors.black }}
          >
            + הוסף שורה
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: colors.muted }}>
              <span style={{ color: colors.gold }}>*</span> = שדה חובה
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border p-4"
        style={{ borderColor: colors.gray400, backgroundColor: '#fff' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
          סיכום לפי אופן תשלום
        </h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {summaryByPayType.map(item => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg px-4 py-2.5"
              style={{ backgroundColor: colors.surface }}
            >
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                {item.label}
              </span>
              <span className="text-sm" style={{ color: colors.muted }}>
                {item.count} רשומות&ensp;|&ensp;<strong style={{ color: colors.text }}>{item.total.toLocaleString()} ₪</strong>
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-3 pt-3 flex justify-between items-center border-t"
          style={{ borderColor: colors.gray400 }}
        >
          <span className="text-sm font-semibold" style={{ color: colors.primaryGreen }}>
            סה״כ
          </span>
          <span className="text-sm">
            <strong style={{ color: colors.primaryGreen }}>{records.length}</strong>
            <span style={{ color: colors.muted }}> רשומות</span>
            &ensp;|&ensp;
            <strong style={{ color: colors.primaryGreen }}>{grandTotal.toLocaleString()} ₪</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
