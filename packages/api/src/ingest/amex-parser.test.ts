import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseAmexCsv, makeFingerprint } from './amex-parser.js';

const HEADER =
  'Date,Description,Card Member,Account #,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../Budget Project input files');

describe('parseAmexCsv', () => {
  it('parses a single charge row', () => {
    const csv = `${HEADER}\n01/15/2025,STARBUCKS,JOHN DOE,-12345,5.75,STARBUCKS,STARBUCKS,,,,,'150110040000063241',Food & Beverage`;
    const { rows, errors } = parseAmexCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      transactionDate: '2025-01-15',
      amount: '5.75',
      description: 'STARBUCKS',
      originalDescription: 'STARBUCKS',
      bankTransactionId: '150110040000063241',
      amexCategory: 'Food & Beverage',
    });
    expect(rows[0]!.fingerprint).toMatch(/^[a-f0-9]{32}$/);
  });

  it('preserves negative amounts (credits/payments)', () => {
    const csv = `${HEADER}\n01/09/2025,PAYMENT THANK YOU,JOHN DOE,-12345,-1500.00,PAYMENT,PAYMENT,,,,,'999',Payments`;
    const { rows } = parseAmexCsv(csv);
    expect(rows[0]!.amount).toBe('-1500.00');
  });

  it('strips single quotes from Reference', () => {
    const csv = `${HEADER}\n02/06/2025,RENEWAL FEE,JANE,-99999,195.00,RENEWAL,RENEWAL,,,,,'320250373841000850',Fees`;
    const { rows } = parseAmexCsv(csv);
    expect(rows[0]!.bankTransactionId).toBe('320250373841000850');
  });

  it('handles empty Reference as null', () => {
    const csv = `${HEADER}\n01/15/2025,FOO,JOHN,-1,1.00,FOO,FOO,,,,,,Misc`;
    const { rows } = parseAmexCsv(csv);
    expect(rows[0]!.bankTransactionId).toBeNull();
  });

  it('handles multi-line quoted Extended Details', () => {
    const csv = `${HEADER}\n03/09/2025,PRIME VIDEO,JAMES,-84003,9.99,"495915B55X4 DIGITAL\nPRIME VIDEO CHANNELS\nAMZN.COM/BILL WA",PRIME VIDEO,,,,,'X1',Subscription`;
    const { rows, errors } = parseAmexCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe('9.99');
  });

  it('rejects rows with bad date format', () => {
    const csv = `${HEADER}\n2025-01-15,FOO,JOHN,-1,1.00,FOO,FOO,,,,,,X`;
    const { rows, errors } = parseAmexCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('Invalid date');
  });

  it('rejects rows with bad amount', () => {
    const csv = `${HEADER}\n01/15/2025,FOO,JOHN,-1,not-a-number,FOO,FOO,,,,,,X`;
    const { rows, errors } = parseAmexCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('Invalid amount');
  });

  it('throws on missing required header', () => {
    const csv = `Foo,Bar\n1,2`;
    expect(() => parseAmexCsv(csv)).toThrow(/Missing required header/);
  });
});

describe('makeFingerprint', () => {
  it('is stable for identical inputs', () => {
    const a = makeFingerprint({
      transactionDate: '2025-01-15',
      amount: '5.75',
      originalDescription: 'STARBUCKS',
      bankTransactionId: '123',
    });
    const b = makeFingerprint({
      transactionDate: '2025-01-15',
      amount: '5.75',
      originalDescription: 'STARBUCKS',
      bankTransactionId: '123',
    });
    expect(a).toBe(b);
  });

  it('differs when description differs', () => {
    const a = makeFingerprint({
      transactionDate: '2025-01-15',
      amount: '5.75',
      originalDescription: 'STARBUCKS',
      bankTransactionId: null,
    });
    const b = makeFingerprint({
      transactionDate: '2025-01-15',
      amount: '5.75',
      originalDescription: 'PEETS',
      bankTransactionId: null,
    });
    expect(a).not.toBe(b);
  });
});

describe('parseAmexCsv against real fixtures', () => {
  const fixtures = (() => {
    try {
      return readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.csv'));
    } catch {
      return [];
    }
  })();

  if (fixtures.length === 0) {
    it.skip('no fixtures available', () => {});
    return;
  }

  it.each(fixtures)('parses %s without throwing', (file) => {
    const csv = readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
    const { rows, errors } = parseAmexCsv(csv);
    expect(rows.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  it('produces stable fingerprints across all fixtures', () => {
    const seen = new Map<string, string>();
    for (const file of fixtures) {
      const csv = readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
      const { rows } = parseAmexCsv(csv);
      for (const r of rows) {
        const key = `${r.transactionDate}|${r.amount}|${r.originalDescription}|${r.bankTransactionId ?? ''}`;
        const prev = seen.get(r.fingerprint);
        if (prev && prev !== key) {
          throw new Error(`Fingerprint collision: ${r.fingerprint}\n  prev=${prev}\n  curr=${key}`);
        }
        seen.set(r.fingerprint, key);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});
