// Interprets Green Invoice (Morning) API errors into clear, actionable Hebrew
// guidance. Kept framework-agnostic (no 'use server') so both the page and the
// table component can import it.

// Green Invoice error code returned when the document date is in the future or
// too far in the past for the document type (e.g. issuing a receipt dated an
// earlier month). Message: "התאריך שנבחר עתידי או מוקדם מדי לסוג מסמך זה".
export const GI_DATE_OUT_OF_RANGE = 2405;

function isDateError(record) {
  if (!record) return false;
  if (record.errorCode === GI_DATE_OUT_OF_RANGE) return true;
  const raw = record.errorMessage || '';
  return /מוקדם מדי|עתידי|תאריך/.test(raw);
}

/**
 * Returns a friendly explanation for a single failed record, or null when the
 * record has no error. Falls back to the raw API message for unknown errors.
 */
export function interpretReceiptError(record) {
  if (!record || record.receiptStatus !== 'error') return null;

  if (isDateError(record)) {
    return {
      kind: 'date',
      short: 'התאריך רחוק מדי',
      detail:
        'חשבונית ירוקה לא מאפשרת להפיק קבלה עם תאריך רחוק מדי (מוקדם מדי או עתידי). ' +
        'יש לשנות את התאריך לתאריך קרוב יותר להיום ולנסות שוב.',
    };
  }

  const raw = (record.errorMessage || '').trim();
  return {
    kind: 'other',
    short: raw || 'שגיאה לא ידועה',
    detail: raw || 'הבקשה נדחתה על ידי חשבונית ירוקה ללא הודעת שגיאה.',
  };
}

/**
 * Summarizes failures across all records so the page can show a single, clear
 * banner. Returns null when there are no errors.
 */
export function summarizeReceiptErrors(records) {
  const errors = (records || []).filter(r => r.receiptStatus === 'error');
  if (!errors.length) return null;

  const dateErrors = errors.filter(isDateError);

  if (dateErrors.length) {
    return {
      kind: 'date',
      count: dateErrors.length,
      allSameCause: dateErrors.length === errors.length,
      title:
        dateErrors.length === errors.length
          ? `כל הקבלות נכשלו בגלל התאריך (${dateErrors.length})`
          : `${dateErrors.length} קבלות נכשלו בגלל התאריך`,
      detail:
        'חשבונית ירוקה דחתה את הקבלות כי התאריך רחוק מדי מהיום (מוקדם מדי או עתידי). ' +
        'יש לעדכן את התאריך לתאריך קרוב יותר להיום — אפשר להשתמש בשדה "תאריך לכל הקבלות" ' +
        'מעל הטבלה כדי לשנות את כל השורות בבת אחת, ואז ללחוץ שוב על הפקת הקבלות.',
    };
  }

  return {
    kind: 'other',
    count: errors.length,
    allSameCause: false,
    title: `${errors.length} קבלות נכשלו`,
    detail: 'ניתן לראות את סיבת השגיאה המדויקת לצד כל שורה בטבלה.',
  };
}
