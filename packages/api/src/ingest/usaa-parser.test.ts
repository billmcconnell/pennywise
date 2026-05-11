import { describe, it, expect } from 'vitest';
import { parseUsaaCsv, isUsaaContent } from './usaa-parser.js';

const SAMPLE = `Date,Description,Original Description,Category,Amount,Status
5/8/26,foo,CHECK # 0000995273,Check,-3600,Posted
5/6/26,bar,MA DUA            MA UI TAX ***********9563,Income,940,Posted
5/1/26,pending txn,PENDING MERCHANT,Shopping,-25.00,Pending
`;

describe('isUsaaContent', () => {
  it('detects USAA header', () => {
    expect(isUsaaContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isUsaaContent(Buffer.from(amex))).toBe(false);
  });

  it('rejects SoFi header', () => {
    const sofi = 'Date,Description,Type,Amount,Current balance,Status\n';
    expect(isUsaaContent(Buffer.from(sofi))).toBe(false);
  });
});

describe('parseUsaaCsv', () => {
  it('parses posted rows and negates amounts', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2); // pending row excluded
  });

  it('normalizes expense amount (negative → positive)', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('3600.00');
    expect(result.rows[0]!.transactionDate).toBe('2026-05-08');
  });

  it('normalizes income amount (positive → negative)', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.rows[1]!.amount).toBe('-940.00');
    expect(result.rows[1]!.transactionDate).toBe('2026-05-06');
  });

  it('uses Original Description as originalDescription', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.rows[0]!.originalDescription).toBe('CHECK # 0000995273');
    expect(result.rows[0]!.description).toBe('foo');
  });

  it('falls back to Description when Original Description is absent', () => {
    const csv = `Date,Description,Amount,Status\n5/1/26,Grocery Store,-42.50,Posted\n`;
    const result = parseUsaaCsv(csv);
    expect(result.rows[0]!.originalDescription).toBe('Grocery Store');
  });

  it('skips pending rows', () => {
    const result = parseUsaaCsv(SAMPLE);
    const descs = result.rows.map((r) => r.description);
    expect(descs).not.toContain('pending txn');
  });

  it('bankTransactionId is always null (fingerprint dedup)', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseUsaaCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns an error for a bad date rather than throwing', () => {
    const csv = `Date,Description,Amount,Status\nnot-a-date,foo,-10,Posted\n`;
    const result = parseUsaaCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });
});
