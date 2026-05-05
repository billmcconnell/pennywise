import type { RuleMatchType } from '@pennywise/shared';

export interface RuleLike {
  id: string;
  matchType: RuleMatchType;
  pattern: string;
  caseInsensitive: boolean;
  categoryId: string;
  priority: number;
  enabled: boolean;
}

export interface TxnLike {
  description: string;
  originalDescription: string;
  merchant: string | null;
}

export interface RuleMatch {
  ruleId: string;
  categoryId: string;
}

export function sortRules<T extends { enabled: boolean; priority: number }>(rules: T[]): T[] {
  return rules
    .filter((r) => r.enabled)
    .slice()
    .sort((a, b) => b.priority - a.priority);
}

function eq(a: string, b: string, ci: boolean): boolean {
  return ci ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function contains(haystack: string, needle: string, ci: boolean): boolean {
  if (ci) return haystack.toLowerCase().includes(needle.toLowerCase());
  return haystack.includes(needle);
}

export function matchRule(rule: RuleLike, txn: TxnLike): boolean {
  const merchant = txn.merchant ?? '';
  switch (rule.matchType) {
    case 'merchant_equals':
      return merchant !== '' && eq(merchant, rule.pattern, rule.caseInsensitive);
    case 'merchant_contains':
      return merchant !== '' && contains(merchant, rule.pattern, rule.caseInsensitive);
    case 'description_contains':
      return (
        contains(txn.description, rule.pattern, rule.caseInsensitive) ||
        contains(txn.originalDescription, rule.pattern, rule.caseInsensitive)
      );
    case 'description_regex': {
      try {
        const re = new RegExp(rule.pattern, rule.caseInsensitive ? 'i' : '');
        return re.test(txn.description) || re.test(txn.originalDescription);
      } catch {
        return false;
      }
    }
  }
}

export function applyRules(txn: TxnLike, sortedRules: RuleLike[]): RuleMatch | null {
  for (const r of sortedRules) {
    if (matchRule(r, txn)) {
      return { ruleId: r.id, categoryId: r.categoryId };
    }
  }
  return null;
}
