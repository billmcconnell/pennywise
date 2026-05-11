import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedSofiRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: null;
  fingerprint: string;
  rowIndex: number;
}

export interface SofiParseResult {
  rows: ParsedSofiRow[];
  errors: { rowIndex: number; message: string; raw: Record<string, string> }[];
}

const REQUIRED_HEADERS = ['Date', 'Description', 'Amount'];

export function parseSofiCsv(csvText: string): SofiParseResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) return { rows: [], errors: [] };

  const sample = records[0]!;
  for (const h of REQUIRED_HEADERS) {
    if (!(h in sample)) throw new Error(`Missing required header: ${h}`);
  }

  const rows: ParsedSofiRow[] = [];
  const errors: SofiParseResult['errors'] = [];

  records.forEach((rec, i) => {
    // SoFi exports pad with empty trailing rows — skip them
    if (!rec['Date'] && !rec['Description'] && !rec['Amount']) return;

    // Skip non-posted rows
    const status = (rec['Status'] ?? '').trim();
    if (status && status.toLowerCase() !== 'posted') return;

    try {
      const transactionDate = normalizeDate(rec['Date'] ?? '');
      const amount = normalizeAmount(rec['Amount'] ?? '');
      const description = (rec['Description'] ?? '').trim();
      if (!description) throw new Error('Empty description');

      const fingerprint = makeFingerprint({ transactionDate, amount, originalDescription: description });

      rows.push({
        transactionDate,
        amount,
        description,
        originalDescription: description,
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

// Detects SoFi CSV by the presence of the "Current balance" column header.
export function isSofiContent(buf: Buffer): boolean {
  const head = buf.slice(0, 512).toString('utf8');
  return /Current balance/i.test(head.split('\n')[0] ?? '');
}

// M/D/YY or MM/DD/YY → YYYY-MM-DD. 2-digit years assumed 2000s.
function normalizeDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yy] = m;
  const yyyy = yy!.length === 2 ? `20${yy}` : yy!;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

// SoFi sign: negative = expense (debit). Our convention: positive = expense.
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
