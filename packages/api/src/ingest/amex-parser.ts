import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export interface ParsedAmexRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: string | null;
  amexCategory: string | null;
  fingerprint: string;
  rowIndex: number;
}

export interface ParseResult {
  rows: ParsedAmexRow[];
  errors: { rowIndex: number; message: string; raw: Record<string, string> }[];
}

const REQUIRED_HEADERS = ['Date', 'Description', 'Amount'];

export function parseAmexCsv(csvText: string): ParseResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    return { rows: [], errors: [] };
  }

  const sample = records[0]!;
  for (const h of REQUIRED_HEADERS) {
    if (!(h in sample)) {
      throw new Error(`Missing required header: ${h}`);
    }
  }

  const rows: ParsedAmexRow[] = [];
  const errors: ParseResult['errors'] = [];

  records.forEach((rec, i) => {
    try {
      const transactionDate = normalizeDate(rec.Date ?? '');
      const amount = normalizeAmount(rec.Amount ?? '');
      const originalDescription = (rec.Description ?? '').trim();
      if (!originalDescription) throw new Error('Empty description');
      const bankTransactionId = stripRefQuotes(rec.Reference ?? '') || null;
      const amexCategory = (rec.Category ?? '').trim() || null;
      const fingerprint = makeFingerprint({
        transactionDate,
        amount,
        originalDescription,
        bankTransactionId,
      });
      rows.push({
        transactionDate,
        amount,
        description: originalDescription,
        originalDescription,
        bankTransactionId,
        amexCategory,
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

function normalizeDate(raw: string): string {
  const cleaned = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new Error(`Invalid date: ${raw}`);
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

function normalizeAmount(raw: string): string {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return cleaned;
}

function stripRefQuotes(raw: string): string {
  return raw.trim().replace(/^'+|'+$/g, '');
}

export function makeFingerprint(parts: {
  transactionDate: string;
  amount: string;
  originalDescription: string;
  bankTransactionId: string | null;
}): string {
  const key = [
    parts.transactionDate,
    parts.amount,
    parts.originalDescription,
    parts.bankTransactionId ?? '',
  ].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}
