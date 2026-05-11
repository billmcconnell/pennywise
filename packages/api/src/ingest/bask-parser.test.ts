import { describe, it, expect } from 'vitest';
import { parseBaskCsv, isBaskContent } from './bask-parser.js';

const SAMPLE = `Account Number,Post Date,Check,Description,Debit,Credit,Status,Balance
xx6511,3/3/26,,AMEX EPAYMENT ,514.35,,Posted,7359.52
xx6511,2/27/26,,INTEREST PAYMENT  ,,36.07,Posted,7873.87
xx6511,2/20/26,,PENDING TXN ,10.00,,Pending,7909.94
,,,,,,,
,,,,,,,
`;

describe('isBaskContent', () => {
  it('detects Bask header', () => {
    expect(isBaskContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isBaskContent(Buffer.from(amex))).toBe(false);
  });

  it('rejects USAA header', () => {
    const usaa = 'Date,Description,Original Description,Category,Amount,Status\n';
    expect(isBaskContent(Buffer.from(usaa))).toBe(false);
  });

  it('rejects SoFi header', () => {
    const sofi = 'Date,Description,Type,Amount,Current balance,Status\n';
    expect(isBaskContent(Buffer.from(sofi))).toBe(false);
  });
});

describe('parseBaskCsv', () => {
  it('parses posted rows and skips trailing empty rows', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2); // pending excluded
  });

  it('debit column becomes positive expense amount', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('514.35');
    expect(result.rows[0]!.transactionDate).toBe('2026-03-03');
  });

  it('credit column becomes negative income amount', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.rows[1]!.amount).toBe('-36.07');
    expect(result.rows[1]!.transactionDate).toBe('2026-02-27');
  });

  it('trims description whitespace', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.rows[0]!.description).toBe('AMEX EPAYMENT');
    expect(result.rows[1]!.description).toBe('INTEREST PAYMENT');
  });

  it('skips pending rows', () => {
    const result = parseBaskCsv(SAMPLE);
    const descs = result.rows.map((r) => r.description);
    expect(descs).not.toContain('PENDING TXN');
  });

  it('bankTransactionId is always null', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseBaskCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('errors when both debit and credit are empty', () => {
    const csv = `Account Number,Post Date,Check,Description,Debit,Credit,Status,Balance\nxx1234,3/1/26,,FOO BAR ,,,Posted,100\n`;
    const result = parseBaskCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });

  it('errors on invalid date', () => {
    const csv = `Account Number,Post Date,Check,Description,Debit,Credit,Status,Balance\nxx1234,not-a-date,,FOO,10.00,,Posted,100\n`;
    const result = parseBaskCsv(csv);
    expect(result.errors).toHaveLength(1);
  });
});
