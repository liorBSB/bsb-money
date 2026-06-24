const SPREADSHEET_ID = '14gsIyCSjvfHb-V27HuieQGkATrvufYEv65l6EUWTEaU';

const PRIMARY_SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

const LEFT_SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Left`;

const NAME_COL_INDEX = 0;

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseSheetEntries(csv, idColIndex) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const entries = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = (cols[NAME_COL_INDEX] || '').replace(/[\u200e\u200f]/g, '').trim();
    const crmId = (cols[idColIndex] || '').trim();
    if (name && crmId) {
      entries.push({ name, crmId });
    }
  }

  return entries;
}

async function fetchSheetEntries(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${url}`);
  }
  return res.text();
}

export async function GET() {
  try {
    const [primaryCsv, leftCsv] = await Promise.all([
      fetchSheetEntries(PRIMARY_SHEET_CSV_URL),
      fetchSheetEntries(LEFT_SHEET_CSV_URL),
    ]);

    return Response.json({
      primary: parseSheetEntries(primaryCsv, 2),
      left: parseSheetEntries(leftCsv, 1),
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
