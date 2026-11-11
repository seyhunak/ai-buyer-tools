// What routing each request to the cheapest model that can handle it saves,
// compared with sending everything to one model. A small classifier call picks
// the tier; requests the cheap tier gets wrong are retried one tier up.
import { MODELS, modelById, type ModelPrice } from "./pricing"

export type Tier = "simple" | "standard" | "hard"
export const TIERS: Tier[] = ["simple", "standard", "hard"]

export type RoutingInput = {
  requestsPerMonth: number
  inputTokens: number // average per request
  outputTokens: number // average per request, including thinking
  cachedPct: number // 0-100: share of input served from cache, for every model
  baselineModel: string // the one model everything goes to today
  share: Record<Tier, number> // 0-100 each; normalised if they don't add to 100
  model: Record<Tier, string>
  escalationPct: Record<Tier, number> // 0-100: share of a tier's requests retried on the next tier up
  routerModel: string
  routerInputTokens: number
  routerOutputTokens: number
}

export type TierResult = { tier: Tier; model: ModelPrice; requests: number; retried: number; cost: number }
export type RoutingResult = {
  baselineCost: number
  routedCost: number
  routerCost: number
  retryCost: number
  savings: number
  savingsPct: number
  baselineCostPerRequest: number
  routedCostPerRequest: number
  tiers: TierResult[]
  /** Highest escalation rate on the simple tier before routing stops paying. */
  breakEvenSimpleEscalationPct: number | null
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const pct = (v: number) => Math.min(100, n(v)) / 100

/** Haiku over 100K input tokens bills at its long-context rate. */
export function priceFor(id: string, inputTokens: number): ModelPrice {
  const m = modelById(id) ?? MODELS[0]
  if (m.id === "claude-haiku-5-5" && inputTokens > 100_000) return modelById("claude-haiku-5-5-long") ?? m
  return m
}

/** List-price cost of one request, with a share of the input read from cache. */
export function requestCost(m: ModelPrice, input: number, output: number, cachedPct = 0): number {
  const c = pct(cachedPct)
  return (n(input) * (1 - c) * m.input + n(input) * c * m.cacheRead + n(output) * m.output) / 1e6
}

const NEXT: Record<Tier, Tier | null> = { simple: "standard", standard: "hard", hard: null }

export function route(i: RoutingInput): RoutingResult {
  const reqs = n(i.requestsPerMonth)
  const total = TIERS.reduce((s, t) => s + n(i.share[t]), 0) || 1
  const one = (id: string) => requestCost(priceFor(id, i.inputTokens), i.inputTokens, i.outputTokens, i.cachedPct)
  const baselineCost = reqs * one(i.baselineModel)

  const tiers: TierResult[] = TIERS.map((t) => {
    const requests = (reqs * n(i.share[t])) / total
    const up = NEXT[t]
    const retried = up ? requests * pct(i.escalationPct[t]) : 0
    // A failed request is paid twice: once on its own tier, once on the next.
    const cost = requests * one(i.model[t]) + (up ? retried * one(i.model[up]) : 0)
    return { tier: t, model: priceFor(i.model[t], i.inputTokens), requests, retried, cost }
  })
  const routerCost = reqs * requestCost(priceFor(i.routerModel, i.routerInputTokens), i.routerInputTokens, i.routerOutputTokens)
  const retryCost = tiers.reduce((s, t) => s + (NEXT[t.tier] ? t.retried * one(i.model[NEXT[t.tier]!]) : 0), 0)
  const routedCost = tiers.reduce((s, t) => s + t.cost, 0) + routerCost
  const savings = baselineCost - routedCost

  // Escalation on the simple tier is the usual unknown: solve for where savings hit zero.
  const simple = tiers[0], up = i.model.standard
  const perRetry = simple.requests * one(up)
  const withoutSimpleRetries = routedCost - simple.retried * one(up)
  const breakEven = perRetry > 0 ? ((baselineCost - withoutSimpleRetries) / perRetry) * 100 : null

  return {
    baselineCost,
    routedCost,
    routerCost,
    retryCost,
    savings,
    savingsPct: baselineCost > 0 ? savings / baselineCost : 0,
    baselineCostPerRequest: reqs > 0 ? baselineCost / reqs : 0,
    routedCostPerRequest: reqs > 0 ? routedCost / reqs : 0,
    tiers,
    breakEvenSimpleEscalationPct: breakEven === null ? null : Math.max(0, Math.min(100, breakEven)),
  }
}

export const DEFAULT_ROUTING: RoutingInput = {
  requestsPerMonth: 100_000,
  inputTokens: 3_000,
  outputTokens: 600,
  cachedPct: 40,
  baselineModel: "claude-opus-5-5",
  share: { simple: 60, standard: 30, hard: 10 },
  model: { simple: "claude-haiku-5-5", standard: "claude-sonnet-5-5", hard: "claude-opus-5-5" },
  escalationPct: { simple: 8, standard: 5, hard: 0 },
  routerModel: "claude-haiku-5-5",
  routerInputTokens: 800,
  routerOutputTokens: 10,
}
