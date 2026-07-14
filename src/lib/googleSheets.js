const WORD_MATCH_MIN = 0.62;

// Fuzzy name matching runs in tiers, from strictest to loosest. The matcher
// always prefers the tightest tier that has any candidate, so a loose (and
// possibly wrong) match can never override a tighter one.
const NAME_MATCH_STRONG = 0.9; // near-exact: only spelling variants
const NAME_MATCH_MEDIUM = 0.8; // clear match: reordering + minor typos
const NAME_MATCH_MIN = 0.72; // last resort: subset / partial matches

// Within the operative tier, if the top two candidates point to different
// people and are closer than this, we refuse to guess and leave it unmatched.
const AMBIGUITY_MARGIN = 0.05;

const FUZZY_TIERS = [NAME_MATCH_STRONG, NAME_MATCH_MEDIUM, NAME_MATCH_MIN];

function normalize(name) {
  return name
    .replace(/[\u200e\u200f]/g, '')
    .replace(/[-–—'"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function reverseWords(name) {
  return name.split(/\s+/).reverse().join(' ');
}

function wordsOf(name) {
  return normalize(name).split(/\s+/).filter(Boolean);
}

function levenshtein(a, b) {
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDistance = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);

    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function softenHebrew(word) {
  return word.replace(/[אעה]/g, '');
}

function normalizeWordForMatch(word) {
  return word
    .replace(/י{2,}/g, 'י')
    .replace(/ו{2,}/g, 'ו');
}

function consonantBag(word) {
  return normalizeWordForMatch(word)
    .replace(/[וי]/g, '')
    .split('')
    .sort()
    .join('');
}

function wordForms(word) {
  const base = normalizeWordForMatch(word);
  return {
    base,
    soft: softenHebrew(base),
    bag: consonantBag(base),
    noVav: base.replace(/ו/g, ''),
  };
}

function isUnsafePrefix(short, long) {
  return short.length >= 3 && long.startsWith(short) && short !== long;
}

function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const fa = wordForms(a);
  const fb = wordForms(b);

  if (fa.base === fb.base) return 1;
  if (fa.soft.length >= 2 && fa.soft === fb.soft) return 0.97;
  if (fa.bag.length >= 3 && fa.bag === fb.bag) return 0.94;

  const [short, long] = fa.base.length <= fb.base.length
    ? [fa.base, fb.base]
    : [fb.base, fa.base];

  const scores = [
    similarity(fa.base, fb.base),
    fa.soft.length >= 2 && fb.soft.length >= 2 ? similarity(fa.soft, fb.soft) : 0,
    fa.bag.length >= 3 && fb.bag.length >= 3 ? similarity(fa.bag, fb.bag) : 0,
    fa.noVav.length >= 4 && fb.noVav.length >= 4 ? similarity(fa.noVav, fb.noVav) : 0,
    jaroWinkler(fa.base, fb.base),
  ];

  if (!isUnsafePrefix(short, long) && short.length >= 3 && long.includes(short)) {
    scores.push(0.84 + (short.length / long.length) * 0.1);
  }

  let best = Math.max(...scores);
  if (isUnsafePrefix(short, long)) {
    best = Math.min(best, 0.55);
  }

  return best;
}

function scoreNameMatch(queryWords, sheetWords) {
  if (!queryWords.length || !sheetWords.length) return 0;

  const smaller = queryWords.length <= sheetWords.length ? queryWords : sheetWords;
  const larger = queryWords.length <= sheetWords.length ? sheetWords : queryWords;
  const used = new Set();
  const scores = [];

  for (const word of smaller) {
    let best = 0;
    let bestIndex = -1;

    for (let i = 0; i < larger.length; i++) {
      if (used.has(i)) continue;
      const score = wordSimilarity(word, larger[i]);
      if (score > best) {
        best = score;
        bestIndex = i;
      }
    }

    if (best < WORD_MATCH_MIN || bestIndex === -1) return 0;
    used.add(bestIndex);
    scores.push(best);
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const sameWordCount = queryWords.length === sheetWords.length ? 0.04 : 0;
  const minWord = Math.min(...scores);

  return Math.min(1, average * 0.75 + minWord * 0.25 + sameWordCount);
}

function findBestFuzzyMatch(queryWords, map) {
  const scored = [];
  for (const [sheetName, crmId] of map) {
    const score = scoreNameMatch(queryWords, wordsOf(sheetName));
    if (score >= NAME_MATCH_MIN) scored.push({ crmId, score });
  }
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);

  // Walk tiers strictest -> loosest and use the first tier that has any
  // candidate. Within that tier, if the two best candidates point to different
  // people and are too close to tell apart, refuse to guess so we never attach
  // a donation to the wrong soldier.
  for (const threshold of FUZZY_TIERS) {
    const tier = scored.filter(s => s.score >= threshold);
    if (!tier.length) continue;

    const [best, runnerUp] = tier;
    if (
      runnerUp &&
      runnerUp.crmId !== best.crmId &&
      best.score - runnerUp.score < AMBIGUITY_MARGIN
    ) {
      return null;
    }
    return best.crmId;
  }

  return null;
}

/**
 * Fetches the name->Soldier Contact RID mapping from the API proxy.
 * Sheet layout: column A = full name, column C = ID (מספר זהות).
 * Returns { map, leftMap, entries, leftEntries }
 */
export async function fetchAccountIdMap() {
  const res = await fetch('/api/sheets');
  if (!res.ok) throw new Error('Failed to load CRM ID sheet');

  const { primary, left } = await res.json();
  const map = new Map();
  const leftMap = new Map();

  for (const entry of primary) {
    map.set(entry.name, entry.crmId);
  }
  for (const entry of left) {
    leftMap.set(entry.name, entry.crmId);
  }

  return { map, leftMap, entries: primary, leftEntries: left };
}

function findInMap(rawName, map) {
  const name = normalize(rawName);
  if (!name) return null;

  // Sheet names come in with inconsistent spacing/punctuation, so normalize
  // the keys the same way as the query. This guarantees an exact (or reversed)
  // name match always wins and is never overridden by a fuzzy candidate.
  const normalizedMap = new Map();
  for (const [sheetName, crmId] of map) {
    const key = normalize(sheetName);
    if (key && !normalizedMap.has(key)) normalizedMap.set(key, crmId);
  }

  if (normalizedMap.has(name)) return normalizedMap.get(name);

  const reversed = reverseWords(name);
  if (normalizedMap.has(reversed)) return normalizedMap.get(reversed);

  return findBestFuzzyMatch(wordsOf(name), map);
}

/**
 * Flexible name lookup:
 * 1. Exact match (normalized)
 * 2. Reversed word order
 * 3. Best scored fuzzy match across all sheet names
 *
 * Tries the primary map first, then optionally falls back to the Left sheet map.
 */
export function findAccountId(rawName, map, fallbackMap = null) {
  const id = findInMap(rawName, map);
  if (id) return id;
  if (fallbackMap) return findInMap(rawName, fallbackMap);
  return null;
}
