import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedBaskRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: null;
  fingerprint: string;
  rowIndex: number;
}

export interface BaskParseResult {
  rows: ParsedBaskRow[];
  errors: { rowIndex: number; message: string; raw: Record<string, string> }[];
}

const REQUIRED_HEADERS = ['Post Date', 'Description', 'Debit', 'Credit'];

export function parseBaskCsv(csvText: string): BaskParseResult {
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

  const rows: ParsedBaskRow[] = [];
  const errors: BaskParseResult['errors'] = [];

  records.forEach((rec, i) => {
    // Skip trailing empty rows
    if (!rec['Post Date'] && !rec['Description']) return;

    // Skip non-posted rows
    const status = (rec['Status'] ?? '').trim();
    if (status && status.toLowerCase() !== 'posted') return;

    try {
      const transactionDate = normalizeDate(rec['Post Date'] ?? '');
      const amount = normalizeAmount(rec['Debit'] ?? '', rec['Credit'] ?? '');
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

// Detects Bask CSV by the presence of "Account Number" and "Post Date" headers.
export function isBaskContent(buf: Buffer): boolean {
  const firstLine = buf.slice(0, 256).toString('utf8').split('\n')[0] ?? '';
  return /Account Number/i.test(firstLine) && /Post Date/i.test(firstLine);
}

// M/D/YY or MM/DD/YY → YYYY-MM-DD. 2-digit years assumed 2000s.
function normalizeDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yy] = m;
  const yyyy = yy!.length === 2 ? `20${yy}` : yy!;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

// Bask uses separate Debit (expense) and Credit (income) columns.
// Our convention: positive = expense, negative = income/credit.
function normalizeAmount(debit: string, credit: string): string {
  const d = debit.trim().replace(/,/g, '');
  const c = credit.trim().replace(/,/g, '');
  if (d) {
    const n = parseFloat(d);
    if (isNaN(n)) throw new Error(`Invalid debit amount: ${debit}`);
    return n.toFixed(2);
  }
  if (c) {
    const n = parseFloat(c);
    if (isNaN(n)) throw new Error(`Invalid credit amount: ${credit}`);
    return (-n).toFixed(2);
  }
  throw new Error('Both Debit and Credit are empty');
}

function makeFingerprint(parts: {
  transactionDate: string;
  amount: string;
  originalDescription: string;
}): string {
  const key = [parts.transactionDate, parts.amount, parts.originalDescription].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}
