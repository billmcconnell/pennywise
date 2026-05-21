import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedWellsFargoRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: null;
  fingerprint: string;
  rowIndex: number;
}

export interface WellsFargoParseResult {
  rows: ParsedWellsFargoRow[];
  errors: { rowIndex: number; message: string; raw: string[] }[];
}

export function parseWellsFargoCsv(csvText: string): WellsFargoParseResult {
  // Wells Fargo exports have no header row. Columns: Date, Amount, *, Check#, Description
  const records = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as string[][];

  const rows: ParsedWellsFargoRow[] = [];
  const errors: WellsFargoParseResult['errors'] = [];

  records.forEach((rec, i) => {
    if (rec.length < 5) return;

    try {
      const transactionDate = normalizeDate(rec[0] ?? '');
      const amount = normalizeAmount(rec[1] ?? '');
      const description = (rec[4] ?? '').trim();
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

// Detects Wells Fargo CSV by its headerless format: first field is a quoted date,
// second field is a quoted decimal amount.
export function isWellsFargoContent(buf: Buffer): boolean {
  const firstLine = buf.slice(0, 256).toString('utf8').split('\n')[0] ?? '';
  return /^"\d{2}\/\d{2}\/\d{4}","[\d.,-]+"/.test(firstLine.trim());
}

// MM/DD/YYYY → YYYY-MM-DD
function normalizeDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yy] = m;
  const yyyy = yy!.length === 2 ? `20${yy}` : yy!;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

// Wells Fargo sign: negative = debit/expense, positive = credit/deposit.
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
