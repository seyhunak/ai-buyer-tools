// Claude API list prices, USD per million tokens, from
// https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-11-10).
// Batch API: 50% off every token class. Cache writes here are the 5-minute TTL.
export const PRICES_CHECKED = "2026-11-10"
export const BATCH_DISCOUNT = 0.5

export type ModelPrice = {
  id: string
  name: string
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  note?: string
}

export const MODELS: ModelPrice[] = [
  { id: "claude-fable-5-2", name: "Claude Fable 5.2", input: 8, output: 40, cacheWrite: 10, cacheRead: 0.2 },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, note: "prompts up to 100K tokens" },
  { id: "claude-haiku-5-5-long", name: "Claude Haiku 5.5 (over 100K)", input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05, note: "prompts over 100K tokens" },
]

export const modelById = (id: string): ModelPrice | undefined => MODELS.find((m) => m.id === id)
