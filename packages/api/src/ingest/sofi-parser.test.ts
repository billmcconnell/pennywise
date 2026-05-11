import { describe, it, expect } from 'vitest';
import { parseSofiCsv, isSofiContent } from './sofi-parser.js';

const SAMPLE = `Date,Description,Type,Amount,Current balance,Status
5/6/26,foo,DIRECT_PAY,-50,3233.22,Posted
5/5/26,bar,DIRECT_PAY,-30,3283.22,Posted
,,,,,
,,,,,
`;

describe('isSofiContent', () => {
  it('detects SoFi header', () => {
    expect(isSofiContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isSofiContent(Buffer.from(amex))).toBe(false);
  });

  it('rejects USAA header', () => {
    const usaa = 'Date,Description,Original Description,Category,Amount,Status\n';
    expect(isSofiContent(Buffer.from(usaa))).toBe(false);
  });
});

describe('parseSofiCsv', () => {
  it('parses posted rows and skips trailing empty rows', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });

  it('negates amounts (negative → positive for expenses)', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('50.00');
    expect(result.rows[1]!.amount).toBe('30.00');
  });

  it('normalizes dates', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.rows[0]!.transactionDate).toBe('2026-05-06');
    expect(result.rows[1]!.transactionDate).toBe('2026-05-05');
  });

  it('uses Description as both description and originalDescription', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.rows[0]!.description).toBe('foo');
    expect(result.rows[0]!.originalDescription).toBe('foo');
  });

  it('bankTransactionId is always null', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseSofiCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('skips non-posted rows', () => {
    const csv = `Date,Description,Type,Amount,Current balance,Status\n5/1/26,foo,ACH,-10,100,Pending\n`;
    const result = parseSofiCsv(csv);
    expect(result.rows).toHaveLength(0);
  });

  it('returns an error for a bad amount rather than throwing', () => {
    const csv = `Date,Description,Type,Amount,Current balance,Status\n5/1/26,foo,ACH,not-a-number,100,Posted\n`;
    const result = parseSofiCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });
});
