import { describe, it, expect } from 'vitest';
import { findAccountId } from '../googleSheets';

function createMap(entries) {
  return new Map(entries);
}

describe('findAccountId', () => {
  describe('exact match', () => {
    it('returns CRM ID for exact name match', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('יוסי כהן', map)).toBe('ACC001');
    });

    it('trims whitespace before matching', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('  יוסי כהן  ', map)).toBe('ACC001');
    });

    it('strips unicode directional marks', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('\u200eיוסי כהן\u200f', map)).toBe('ACC001');
    });
  });

  describe('reversed word order', () => {
    it('matches when words are in reverse order', () => {
      const map = createMap([['כהן יוסי', 'ACC002']]);
      expect(findAccountId('יוסי כהן', map)).toBe('ACC002');
    });

    it('handles three-word names reversed', () => {
      const map = createMap([['בן דוד אברהם', 'ACC003']]);
      expect(findAccountId('אברהם דוד בן', map)).toBe('ACC003');
    });

    it('matches hyphenated sheet names against reordered bank names', () => {
      const map = createMap([['שני-הדר אבן', '322318643']]);
      expect(findAccountId('אבן שני הדר', map)).toBe('322318643');
    });
  });

  describe('fuzzy Hebrew spelling', () => {
    it('matches similar surname spellings with reversed order', () => {
      const map = createMap([['נתנאל עיאש', '227494143']]);
      expect(findAccountId('איש נתנאל', map)).toBe('227494143');
    });

    it('matches when sheet and query spellings differ slightly', () => {
      const map = createMap([['איש נתנאל', '227494143']]);
      expect(findAccountId('נתנאל עיאש', map)).toBe('227494143');
    });

    it('matches double-yod bank spellings against ayin spellings', () => {
      const map = createMap([['נתנאל עיאש', '227494143']]);
      expect(findAccountId('אייש נתנאל', map)).toBe('227494143');
    });

    it('matches transliterated surname spellings with reordered names', () => {
      const map = createMap([['איתן בובריק', '230477515']]);
      expect(findAccountId('בורוביק איתן', map)).toBe('230477515');
    });

    it('matches wootton surname spellings with reordered names', () => {
      const map = createMap([['חזי וואוטון', '230468902']]);
      expect(findAccountId('וואוטון חזי', map)).toBe('230468902');
      expect(findAccountId('ווטון חזי', map)).toBe('230468902');
    });

    it('picks the best candidate when multiple names share a word', () => {
      const map = createMap([
        ['איתן דנזגר', '111'],
        ['איתן בובריק', '230477515'],
      ]);
      expect(findAccountId('בורוביק איתן', map)).toBe('230477515');
    });

    it('matches minor typos in Hebrew names', () => {
      const map = createMap([['משה כהן', 'ACC100']]);
      expect(findAccountId('כהן משה', map)).toBe('ACC100');
    });
  });

  describe('fuzzy word matching', () => {
    it('matches when all query words appear in sheet name', () => {
      const map = createMap([['יוסי כהן הגדול', 'ACC004']]);
      expect(findAccountId('יוסי כהן', map)).toBe('ACC004');
    });

    it('matches when all sheet words appear in query', () => {
      const map = createMap([['יוסי כהן', 'ACC005']]);
      expect(findAccountId('יוסי כהן הגדול', map)).toBe('ACC005');
    });

    it('matches single word queries against multi-word names', () => {
      const map = createMap([['יוסי כהן', 'ACC006']]);
      expect(findAccountId('יוסי', map)).toBe('ACC006');
    });
  });

  describe('no match', () => {
    it('returns null when no match found', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('דני לוי', map)).toBeNull();
    });

    it('returns null for empty name', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('', map)).toBeNull();
    });

    it('returns null for whitespace-only name', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('   ', map)).toBeNull();
    });

    it('returns null for name with only directional marks', () => {
      const map = createMap([['יוסי כהן', 'ACC001']]);
      expect(findAccountId('\u200e\u200f', map)).toBeNull();
    });
  });

  describe('priority order', () => {
    it('prefers exact match over reversed match', () => {
      const map = createMap([
        ['יוסי כהן', 'EXACT'],
        ['כהן יוסי', 'REVERSED'],
      ]);
      expect(findAccountId('יוסי כהן', map)).toBe('EXACT');
    });

    it('prefers exact match over fuzzy match', () => {
      const map = createMap([
        ['יוסי כהן', 'EXACT'],
        ['יוסי כהן הגדול', 'FUZZY'],
      ]);
      expect(findAccountId('יוסי כהן', map)).toBe('EXACT');
    });
  });

  describe('edge cases', () => {
    it('handles empty map', () => {
      expect(findAccountId('test', new Map())).toBeNull();
    });

    it('handles single character names', () => {
      const map = createMap([['א', 'ACC010']]);
      expect(findAccountId('א', map)).toBe('ACC010');
    });

    it('handles names with extra spaces between words', () => {
      const map = createMap([['יוסי כהן', 'ACC011']]);
      expect(findAccountId('יוסי   כהן', map)).toBe('ACC011');
    });

    it('does not match partial words', () => {
      const map = createMap([['יוסי', 'ACC012']]);
      expect(findAccountId('יוסיף', map)).toBeNull();
    });

    it('handles large map efficiently', () => {
      const entries = Array.from({ length: 1000 }, (_, i) => [`name${i}`, `ACC${i}`]);
      const map = createMap(entries);
      expect(findAccountId('name999', map)).toBe('ACC999');
      expect(findAccountId('nonexistent', map)).toBeNull();
    });
  });

  describe('left sheet fallback', () => {
    it('uses the primary map before the Left sheet map', () => {
      const primary = createMap([['יוסי כהן', 'PRIMARY']]);
      const left = createMap([['יוסי כהן', 'LEFT']]);
      expect(findAccountId('יוסי כהן', primary, left)).toBe('PRIMARY');
    });

    it('falls back to the Left sheet map when primary has no match', () => {
      const primary = createMap([['יוסי כהן', 'PRIMARY']]);
      const left = createMap([['דני לוי', 'LEFT001']]);
      expect(findAccountId('דני לוי', primary, left)).toBe('LEFT001');
    });

    it('returns null when neither map matches', () => {
      const primary = createMap([['יוסי כהן', 'PRIMARY']]);
      const left = createMap([['דני לוי', 'LEFT001']]);
      expect(findAccountId('לא קיים', primary, left)).toBeNull();
    });
  });
});
