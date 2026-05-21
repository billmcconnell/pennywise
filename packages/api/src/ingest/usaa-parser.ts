import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedUsaaRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: null;
  fingerprint: string;
  rowIndex: number;
}

export interface UsaaParseResult {
  rows: ParsedUsaaRow[];
  errors: { rowIndex: number; message: string; raw: Record<string, string> }[];
}

const REQUIRED_HEADERS = ['Date', 'Description', 'Amount'];

export function parseUsaaCsv(csvText: string): UsaaParseResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (records.length === 0) return { rows: [], errors: [] };

  const sample = records[0]!;
  for (const h of REQUIRED_HEADERS) {
    if (!(h in sample)) throw new Error(`Missing required header: ${h}`);
  }

  const rows: ParsedUsaaRow[] = [];
  const errors: UsaaParseResult['errors'] = [];

  records.forEach((rec, i) => {
    // Skip non-posted rows (Pending, etc.)
    const status = (rec['Status'] ?? '').trim();
    if (status && status.toLowerCase() !== 'posted') return;

    // Skip empty rows (SoFi-style trailing blanks can appear in USAA too)
    if (!rec['Date'] && !rec['Description']) return;

    try {
      const transactionDate = normalizeDate(rec['Date'] ?? '');
      const rawAmount = rec['Amount'] ?? '';
      const amount = normalizeAmount(rawAmount);
      const description = (rec['Description'] ?? '').trim();
      if (!description) throw new Error('Empty description');
      const originalDescription = (rec['Original Description'] ?? description).trim();

      const fingerprint = makeFingerprint({ transactionDate, amount, originalDescription });

      rows.push({
        transactionDate,
        amount,
        description,
        originalDescription,
        bankTransactionId: null,
        fingerprint,
        rowIndex: i,
      });
    } catch (err) {
      errors.push({
        rowIndex: i,
        message: err instanceof Error ? err.message : String(err),
        raw: rec,
      });
    }
  });

  return { rows, errors };
}

// Detects USAA CSV by the presence of the "Original Description" column header.
export function isUsaaContent(buf: Buffer): boolean {
  const head = buf.slice(0, 512).toString('utf8');
  return /^Date,Description,Original Description/i.test(head.trimStart());
}

// Accepts YYYY-MM-DD (ISO), M/D/YY, MM/DD/YY, M/D/YYYY, MM/DD/YYYY.
function normalizeDate(raw: string): string {
  const cleaned = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yy] = m;
  const yyyy = yy!.length === 2 ? `20${yy}` : yy!;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

// USAA sign: negative = expense (debit). Our convention: positive = expense.
function normalizeAmount(raw: string): string {
  const cleaned = raw.trim().replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) throw new Error(`Invalid amount: ${raw}`);
  return (-n).toFixed(2);
}

function makeFingerprint(parts: {
  transactionDate: string;
  amount: string;
  originalDescription: string;
}): string {
  const key = [parts.transactionDate, parts.amount, parts.originalDescription].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}
