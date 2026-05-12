import { describe, it, expect } from 'vitest';
import { parseWellsFargoCsv, isWellsFargoContent } from './wellsfargo-parser.js';

const SAMPLE = `"01/15/2026","-25.99"," ","","AMAZON.COM #12345"
"01/20/2026","-15.99"," ","","NETFLIX.COM"
"01/25/2026","1500.00"," ","","DIRECT DEPOSIT EMPLOYER"
`;

describe('isWellsFargoContent', () => {
  it('detects Wells Fargo headerless format', () => {
    expect(isWellsFargoContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Chase header', () => {
    const chase = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n';
    expect(isWellsFargoContent(Buffer.from(chase))).toBe(false);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isWellsFargoContent(Buffer.from(amex))).toBe(false);
  });
});

describe('parseWellsFargoCsv', () => {
  it('parses all rows', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it('negates debit amount (negative → positive)', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('25.99');
    expect(result.rows[0]!.transactionDate).toBe('2026-01-15');
  });

  it('negates deposit amount (positive → negative)', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.rows[2]!.amount).toBe('-1500.00');
  });

  it('uses field 4 (description) for both description and originalDescription', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.rows[0]!.description).toBe('AMAZON.COM #12345');
    expect(result.rows[0]!.originalDescription).toBe('AMAZON.COM #12345');
  });

  it('bankTransactionId is always null', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseWellsFargoCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('skips rows with fewer than 5 fields', () => {
    const csv = `"01/15/2026","-25.99"," "\n"01/20/2026","-15.99"," ","","NETFLIX"\n`;
    const result = parseWellsFargoCsv(csv);
    expect(result.rows).toHaveLength(1);
  });

  it('returns an error for a bad date rather than throwing', () => {
    const csv = `"not-a-date","-25.99"," ","","AMAZON"\n`;
    const result = parseWellsFargoCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });
});
