'use client';

import { useState, useCallback } from 'react';
import colors from '@/app/colors';
import { PAY_TYPE_LABELS, createManualRentChargeRecord } from '@/lib/rentChargeExport';

const EMPTY_FORM = {
  soldierName: '',
  description: '',
  documentDate: '',
  amount: '',
  payType: '4',
  receiptNumber: '',
};

function defaultDocumentDate(selectedMonth) {
  const mm = String(selectedMonth.month + 1).padStart(2, '0');
  return `${selectedMonth.year}-${mm}-01`;
}

export default function ManualReceiptForm({ selectedMonth, sfDefault, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);

  const openForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      documentDate: defaultDocumentDate(selectedMonth),
    });
    setFormError(null);
    setOpen(true);
  }, [selectedMonth]);

  const closeForm = useCallback(() => {
    setOpen(false);
    setFormError(null);
  }, []);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!form.soldierName.trim()) {
      setFormError('יש להזין שם חייל/ת');
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('יש להזין סכום חיובי');
      return;
    }

    if (!form.documentDate) {
      setFormError('יש לבחור תאריך');
      return;
    }

    onAdd(createManualRentChargeRecord({
      ...form,
      sfEntered: sfDefault,
    }));

    closeForm();
  }, [form, sfDefault, onAdd, closeForm]);

  return (
    <section className="mb-6">
      {!open ? (
        <button
          type="button"
          onClick={openForm}
          className="rounded-xl border-2 border-dashed px-5 py-3 text-sm font-semibold transition-colors hover:opacity-90"
          style={{ borderColor: colors.secondaryText, color: colors.secondaryText }}
        >
          + הוסף קבלה ידנית
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-5"
          style={{ backgroundColor: colors.surface, borderColor: colors.gray400 }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-bold" style={{ color: colors.text }}>
              הוספת קבלה ידנית
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-sm font-medium"
              style={{ color: colors.muted }}
            >
              ביטול
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>שם חייל/ת *</span>
              <input
                type="text"
                value={form.soldierName}
                onChange={e => handleChange('soldierName', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>מספר קבלה</span>
              <input
                type="text"
                value={form.receiptNumber}
                onChange={e => handleChange('receiptNumber', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>תאריך *</span>
              <input
                type="date"
                value={form.documentDate}
                onChange={e => handleChange('documentDate', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>סכום (₪) *</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={e => handleChange('amount', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>אופן העברה</span>
              <select
                value={form.payType}
                onChange={e => handleChange('payType', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              >
                {Object.entries(PAY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold mb-1 block" style={{ color: colors.text }}>תיאור</span>
              <input
                type="text"
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: colors.gray400 }}
              />
            </label>
          </div>

          {formError && (
            <p className="mt-3 text-sm" style={{ color: colors.red }}>{formError}</p>
          )}

          <button
            type="submit"
            className="mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: colors.secondaryText, color: colors.white }}
          >
            הוסף לדוח
          </button>
        </form>
      )}
    </section>
  );
}
