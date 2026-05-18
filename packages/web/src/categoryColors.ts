export const CATEGORY_COLORS: Record<string, string> = {
  housing:        '#3B82F6',
  transportation: '#0EA5E9',
  food:           '#22C55E',
  healthcare:     '#F43F5E',
  personal:       '#A855F7',
  financial:      '#F59E0B',
  income:         '#14B8A6',
  uncategorized:  '#94A3B8',
};

export const CATEGORY_PILL: Record<string, { bg: string; text: string }> = {
  housing:        { bg: 'bg-violet-50',  text: 'text-violet-700'  },
  transportation: { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  food:           { bg: 'bg-orange-50',  text: 'text-orange-700'  },
  healthcare:     { bg: 'bg-rose-50',    text: 'text-rose-700'    },
  personal:       { bg: 'bg-purple-50',  text: 'text-purple-700'  },
  financial:      { bg: 'bg-amber-50',   text: 'text-amber-700'   },
  income:         { bg: 'bg-green-50',   text: 'text-green-700'   },
  uncategorized:  { bg: 'bg-zinc-100',   text: 'text-zinc-500'    },
};
