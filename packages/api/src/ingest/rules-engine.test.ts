import { describe, it, expect } from 'vitest';
import { applyRules, matchRule, sortRules, type RuleLike, type TxnLike } from './rules-engine.js';

const baseRule = (over: Partial<RuleLike> = {}): RuleLike => ({
  id: 'r1',
  matchType: 'merchant_contains',
  pattern: 'whole foods',
  caseInsensitive: true,
  categoryId: 'cat-groceries',
  priority: 0,
  enabled: true,
  ...over,
});

const baseTxn = (over: Partial<TxnLike> = {}): TxnLike => ({
  description: 'WHOLE FOODS MARKET 123',
  originalDescription: 'WHOLE FOODS MARKET 123',
  merchant: 'Whole Foods Market',
  ...over,
});

describe('matchRule', () => {
  it('merchant_contains case-insensitive matches', () => {
    expect(matchRule(baseRule(), baseTxn())).toBe(true);
  });

  it('merchant_contains case-sensitive does not match across cases', () => {
    expect(
      matchRule(baseRule({ caseInsensitive: false, pattern: 'whole foods' }), baseTxn()),
    ).toBe(false);
  });

  it('merchant_equals requires full equality', () => {
    expect(
      matchRule(baseRule({ matchType: 'merchant_equals', pattern: 'Whole Foods Market' }), baseTxn()),
    ).toBe(true);
    expect(
      matchRule(baseRule({ matchType: 'merchant_equals', pattern: 'Whole Foods' }), baseTxn()),
    ).toBe(false);
  });

  it('merchant_* skips when merchant is null', () => {
    expect(matchRule(baseRule(), baseTxn({ merchant: null }))).toBe(false);
  });

  it('description_contains checks both description and originalDescription', () => {
    const rule = baseRule({ matchType: 'description_contains', pattern: 'NETFLIX' });
    expect(
      matchRule(rule, baseTxn({ description: 'edited', originalDescription: 'NETFLIX.COM' })),
    ).toBe(true);
  });

  it('description_regex with case insensitivity', () => {
    const rule = baseRule({ matchType: 'description_regex', pattern: '^starbucks' });
    expect(
      matchRule(rule, baseTxn({ description: 'STARBUCKS #99', originalDescription: '' })),
    ).toBe(true);
  });

  it('description_regex returns false on invalid pattern', () => {
    const rule = baseRule({ matchType: 'description_regex', pattern: '[' });
    expect(matchRule(rule, baseTxn())).toBe(false);
  });
});

describe('sortRules + applyRules', () => {
  it('higher priority wins', () => {
    const rules: RuleLike[] = [
      baseRule({ id: 'low', priority: 0, categoryId: 'cat-low' }),
      baseRule({ id: 'high', priority: 10, categoryId: 'cat-high' }),
    ];
    const match = applyRules(baseTxn(), sortRules(rules));
    expect(match?.ruleId).toBe('high');
    expect(match?.categoryId).toBe('cat-high');
  });

  it('disabled rules are skipped', () => {
    const rules: RuleLike[] = [
      baseRule({ id: 'a', enabled: false, priority: 100 }),
      baseRule({ id: 'b', priority: 1, categoryId: 'cat-b' }),
    ];
    const match = applyRules(baseTxn(), sortRules(rules));
    expect(match?.ruleId).toBe('b');
  });

  it('returns null with no matches', () => {
    const rules: RuleLike[] = [baseRule({ pattern: 'no-such-thing' })];
    expect(applyRules(baseTxn(), sortRules(rules))).toBeNull();
  });
});
