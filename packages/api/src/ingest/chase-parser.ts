import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedChaseRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: null;
  fingerprint: string;
  rowIndex: number;
}

export interface ChaseParseResult {
  rows: ParsedChaseRow[];
  errors: { rowIndex: number; message: string; raw: Record<string, string> }[];
}

const REQUIRED_HEADERS = ['Transaction Date', 'Description', 'Amount'];

export function parseChaseCsv(csvText: string): ChaseParseResult {
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

  const rows: ParsedChaseRow[] = [];
  const errors: ChaseParseResult['errors'] = [];

  records.forEach((rec, i) => {
    if (!rec['Transaction Date'] && !rec['Description']) return;

    try {
      const transactionDate = normalizeDate(rec['Transaction Date'] ?? '');
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

// Detects Chase CSV by its distinctive Transaction Date,Post Date header.
export function isChaseContent(buf: Buffer): boolean {
  const head = buf.slice(0, 256).toString('utf8').trimStart();
  return /^Transaction Date,Post Date,Description/i.test(head);
}

// MM/DD/YYYY → YYYY-MM-DD
function normalizeDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yy] = m;
  const yyyy = yy!.length === 2 ? `20${yy}` : yy!;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

// Chase sign: negative = charge (expense), positive = payment/credit.
// Our convention: positive = expense.
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
