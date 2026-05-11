import Anthropic from '@anthropic-ai/sdk';

export interface TxnForLlm {
  index: number;
  description: string;
  originalDescription: string;
  amount: string;
}

export interface LlmResult {
  index: number;
  categorySlug: string;
  confidence: number;
  matchTerm: string | null;
}

export interface CategoryInfo {
  id: string;
  slug: string;
  name: string;
}

export const LLM_APPLY_THRESHOLD = 0.85;
export const LLM_RULE_THRESHOLD = 0.90;

const BATCH_SIZE = 20;

const CATEGORIZE_TOOL: Anthropic.Tool = {
  name: 'categorize_transactions',
  description: 'Return category assignments for each transaction in the batch',
  input_schema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'Transaction index from input' },
            categorySlug: { type: 'string', description: 'Category slug from the provided list' },
            confidence: { type: 'number', description: '0.0–1.0 confidence score' },
            matchTerm: {
              type: 'string',
              description:
                'Key word(s) from the description that identify this merchant for future rules. Only include when confidence >= 0.90.',
            },
          },
          required: ['index', 'categorySlug', 'confidence'],
        },
      },
    },
    required: ['results'],
  },
};

function buildSystemPrompt(categories: CategoryInfo[]): string {
  const catLines = categories.map((c) => `- ${c.slug}: ${c.name}`).join('\n');
  return `You are a personal finance transaction categorizer. Assign each transaction to the most appropriate category based on its description.

Available categories:
${catLines}

Guidelines:
- Negative amounts are credits/refunds; positive amounts are charges
- Assign "income" only for salary, direct deposits, tax refunds, or cashback — not store credits or returns
- Use "uncategorized" when genuinely unsure
- confidence: 0.0–1.0 (use ≥0.85 only when confident)
- matchTerm: a short keyword (1–3 words) from the description that would identify this merchant in future transactions. Include only when confidence ≥ 0.90.`;
}

async function callChunk(
  client: Anthropic,
  chunk: TxnForLlm[],
  systemPrompt: string,
): Promise<LlmResult[]> {
  const userMessage =
    'Categorize these transactions:\n' +
    chunk.map((t) => `[${t.index}] ${t.description} $${t.amount}`).join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [CATEGORIZE_TOOL],
    tool_choice: { type: 'tool', name: 'categorize_transactions' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return [];

  const raw = (toolUse.input as { results?: unknown }).results;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((r) => {
    if (typeof r !== 'object' || r === null) return [];
    const item = r as Record<string, unknown>;
    if (typeof item.index !== 'number' || typeof item.categorySlug !== 'string') return [];
    return [
      {
        index: item.index as number,
        categorySlug: item.categorySlug as string,
        confidence: typeof item.confidence === 'number' ? (item.confidence as number) : 0,
        matchTerm: typeof item.matchTerm === 'string' ? (item.matchTerm as string) : null,
      },
    ];
  });
}

// Categorize a list of transactions using the LLM.
// Each txn must have a unique `index` that will be echoed back in results.
export async function categorizeBatch(
  client: Anthropic,
  txns: TxnForLlm[],
  categories: CategoryInfo[],
): Promise<LlmResult[]> {
  if (txns.length === 0) return [];

  const systemPrompt = buildSystemPrompt(categories);
  const results: LlmResult[] = [];

  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    const chunk = txns.slice(i, i + BATCH_SIZE);
    const chunkResults = await callChunk(client, chunk, systemPrompt);
    results.push(...chunkResults);
  }

  return results;
}
