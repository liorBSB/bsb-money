const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/14gsIyCSjvfHb-V27HuieQGkATrvufYEv65l6EUWTEaU/export?format=csv&gid=0';

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

export async function GET() {
  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 300 } });

    if (!res.ok) {
      return Response.json(
        { error: 'Failed to fetch Google Sheet' },
        { status: 502 }
      );
    }

    const csv = await res.text();
    const lines = csv.split(/\r?\n/).filter(Boolean);

    const entries = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = (cols[0] || '').replace(/[\u200e\u200f]/g, '').trim();
      const crmId = (cols[1] || '').trim();
      if (name && crmId) {
        entries.push({ name, crmId });
      }
    }

    return Response.json(entries);
  } catch (err) {
    return Response.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
