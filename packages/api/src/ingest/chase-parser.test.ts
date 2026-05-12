import { describe, it, expect } from 'vitest';
import { parseChaseCsv, isChaseContent } from './chase-parser.js';

const SAMPLE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2026,01/16/2026,AMAZON.COM,Shopping,Sale,-25.99,
01/20/2026,01/21/2026,NETFLIX.COM,Entertainment,Sale,-15.99,
01/25/2026,01/26/2026,Payment Thank You - Web,,Payment,500.00,
`;

describe('isChaseContent', () => {
  it('detects Chase header', () => {
    expect(isChaseContent(Buffer.from(SAMPLE))).toBe(true);
  });

  it('rejects Amex header', () => {
    const amex = 'Date,Description,Card Member,Account #,Amount\n';
    expect(isChaseContent(Buffer.from(amex))).toBe(false);
  });

  it('rejects USAA header', () => {
    const usaa = 'Date,Description,Original Description,Category,Amount,Status\n';
    expect(isChaseContent(Buffer.from(usaa))).toBe(false);
  });
});

describe('parseChaseCsv', () => {
  it('parses all rows', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);
  });

  it('negates charge amount (negative → positive)', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.rows[0]!.amount).toBe('25.99');
    expect(result.rows[0]!.transactionDate).toBe('2026-01-15');
  });

  it('negates payment amount (positive → negative)', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.rows[2]!.amount).toBe('-500.00');
  });

  it('uses Description as both description and originalDescription', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.rows[0]!.description).toBe('AMAZON.COM');
    expect(result.rows[0]!.originalDescription).toBe('AMAZON.COM');
  });

  it('bankTransactionId is always null', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.rows[0]!.bankTransactionId).toBeNull();
  });

  it('produces a 32-char hex fingerprint', () => {
    const result = parseChaseCsv(SAMPLE);
    expect(result.rows[0]!.fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns an error for a bad date rather than throwing', () => {
    const csv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo\nnot-a-date,01/01/2026,AMAZON,Shopping,Sale,-10.00,\n`;
    const result = parseChaseCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });
});
