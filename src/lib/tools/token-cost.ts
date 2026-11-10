import { BATCH_DISCOUNT, MODELS, type ModelPrice } from "./pricing"

export type TokenCostInput = {
  requestsPerMonth: number
  inputTokens: number // average per request, including any cached prefix
  outputTokens: number // average per request, including thinking
  cachedPct: number // 0-100: share of input tokens served from cache
  batchPct: number // 0-100: share of requests sent through the Batch API
  cacheWritesPerMonth: number // how many times the cached prefix is (re)written
  minutesSavedPerRequest: number
  hourlyCost: number // fully loaded cost of the person whose time is saved
  monthlyOverhead: number // hosting, OCR, observability…
}

export type TokenCostResult = {
  model: ModelPrice
  apiCostPerMonth: number
  costPerRequest: number
  labourValuePerMonth: number
  overheadPerMonth: number
  netPerMonth: number
  roiMultiple: number | null // labour value / total cost
  hoursSavedPerMonth: number
  breakdown: { input: number; cacheRead: number; cacheWrite: number; output: number }
}

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo)
const nonneg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function estimate(model: ModelPrice, raw: TokenCostInput): TokenCostResult {
  const req = nonneg(raw.requestsPerMonth)
  const inTok = nonneg(raw.inputTokens)
  const outTok = nonneg(raw.outputTokens)
  const cached = clamp(raw.cachedPct, 0, 100) / 100
  const batched = clamp(raw.batchPct, 0, 100) / 100
  // Blended multiplier: batched requests pay half on every token class.
  const mult = 1 - batched * BATCH_DISCOUNT
  const M = 1_000_000
  const cachedTokens = inTok * cached
  const cacheWriteTokens = cached > 0 ? cachedTokens * nonneg(raw.cacheWritesPerMonth) : 0

  const input = (req * (inTok - cachedTokens) * model.input) / M * mult
  const cacheRead = (req * cachedTokens * model.cacheRead) / M * mult
  const cacheWrite = (cacheWriteTokens * model.cacheWrite) / M * mult
  const output = (req * outTok * model.output) / M * mult
  const apiCostPerMonth = input + cacheRead + cacheWrite + output

  const hoursSavedPerMonth = (req * nonneg(raw.minutesSavedPerRequest)) / 60
  const labourValuePerMonth = hoursSavedPerMonth * nonneg(raw.hourlyCost)
  const overheadPerMonth = nonneg(raw.monthlyOverhead)
  const total = apiCostPerMonth + overheadPerMonth
  return {
    model,
    apiCostPerMonth,
    costPerRequest: req > 0 ? apiCostPerMonth / req : 0,
    labourValuePerMonth,
    overheadPerMonth,
    netPerMonth: labourValuePerMonth - total,
    roiMultiple: total > 0 ? labourValuePerMonth / total : null,
    hoursSavedPerMonth,
    breakdown: { input, cacheRead, cacheWrite, output },
  }
}

export const compareAll = (input: TokenCostInput) => MODELS.map((m) => estimate(m, input))

export const DEFAULT_INPUT: TokenCostInput = {
  requestsPerMonth: 20000,
  inputTokens: 6000,
  outputTokens: 800,
  cachedPct: 50,
  batchPct: 0,
  cacheWritesPerMonth: 300,
  minutesSavedPerRequest: 6,
  hourlyCost: 45,
  monthlyOverhead: 500,
}

/** Reads ?model=&requests=&input=&output=&cached=&batch=&minutes=&rate=&overhead= */
export function fromQuery(q: URLSearchParams): { modelId?: string; input: TokenCostInput } {
  const num = (k: string, d: number) => {
    const v = q.get(k)
    const n = v === null || v.trim() === "" ? NaN : Number(v)
    return Number.isFinite(n) && n >= 0 ? n : d
  }
  return {
    modelId: q.get("model") ?? undefined,
    input: {
      requestsPerMonth: num("requests", DEFAULT_INPUT.requestsPerMonth),
      inputTokens: num("input", DEFAULT_INPUT.inputTokens),
      outputTokens: num("output", DEFAULT_INPUT.outputTokens),
      cachedPct: Math.min(100, num("cached", DEFAULT_INPUT.cachedPct)),
      batchPct: Math.min(100, num("batch", DEFAULT_INPUT.batchPct)),
      cacheWritesPerMonth: num("writes", DEFAULT_INPUT.cacheWritesPerMonth),
      minutesSavedPerRequest: num("minutes", DEFAULT_INPUT.minutesSavedPerRequest),
      hourlyCost: num("rate", DEFAULT_INPUT.hourlyCost),
      monthlyOverhead: num("overhead", DEFAULT_INPUT.monthlyOverhead),
    },
  }
}
