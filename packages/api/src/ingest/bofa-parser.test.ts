import { describe, it, expect } from 'vitest';
import { parseBofaCsv, isBofaContent } from './bofa-parser.js';

const SAMPLE = `Posted Date,Reference Number,Payee,Address,Amount
01/15/2026,243180000000001,AMAZON.COM,SEATTLE WA,-25.99
01/20/2026,243180000000002,NETFLIX.COM,LOS GATOS CA,-15.99
01/25/2026,243180000000003,Online Banking payment - thank you,,500.00
`;

describe('isBofaContent', () => {
  it('detects BofA header', () => {
    expect(isBofaContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Chase header', () => {
    const chase = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n';
    expect(isBofaContent(Buffer.from(chase))).toBe(false);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isBofaContent(Buffer.from(amex))).toBe(false);
  });
});

describe('parseBofaCsv', () => {
  it('parses all rows', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it('negates charge amount (negative → positive)', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('25.99');
    expect(result.rows[0]!.transactionDate).toBe('2026-01-15');
  });

  it('negates payment amount (positive → negative)', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.rows[2]!.amount).toBe('-500.00');
  });

  it('uses Payee as description', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.rows[0]!.description).toBe('AMAZON.COM');
    expect(result.rows[0]!.originalDescription).toBe('AMAZON.COM');
  });

  it('bankTransactionId is always null', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseBofaCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns an error for a bad date rather than throwing', () => {
    const csv = `Posted Date,Reference Number,Payee,Address,Amount\nnot-a-date,REF123,AMAZON,,- 10.00\n`;
    const result = parseBofaCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });
});
