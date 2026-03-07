function normalize(name) {
  return name.replace(/[\u200e\u200f]/g, '').trim();
}

function reverseWords(name) {
  return name.split(/\s+/).reverse().join(' ');
}

function wordsOf(name) {
  return name.split(/\s+/).filter(Boolean);
}

/**
 * Fetches the name->AccountId mapping from the API proxy.
 * Returns { map: Map<normalizedName, crmId>, entries: [{name, crmId}] }
 */
export async function fetchAccountIdMap() {
  const res = await fetch('/api/sheets');
  if (!res.ok) throw new Error('Failed to load CRM ID sheet');

  const entries = await res.json();
  const map = new Map();

  for (const entry of entries) {
    map.set(entry.name, entry.crmId);
  }

  return { map, entries };
}

/**
 * Flexible name lookup:
 * 1. Exact match (normalized)
 * 2. Reversed word order
 * 3. All words from the query appear in a sheet name (or vice versa)
 */
export function findAccountId(rawName, map) {
  const name = normalize(rawName);
  if (!name) return null;

  if (map.has(name)) return map.get(name);

  const reversed = reverseWords(name);
  if (map.has(reversed)) return map.get(reversed);

  const queryWords = wordsOf(name);

  for (const [sheetName, crmId] of map) {
    const sheetWords = wordsOf(sheetName);

    const allQueryInSheet = queryWords.every(w => sheetWords.includes(w));
    if (allQueryInSheet) return crmId;

    const allSheetInQuery = sheetWords.every(w => queryWords.includes(w));
    if (allSheetInQuery) return crmId;
  }

  return null;
}
