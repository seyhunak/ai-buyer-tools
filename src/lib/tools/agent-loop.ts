// What one run of a tool-calling agent costs. Every model call re-sends the whole
// conversation so far: the system prompt and tool definitions, the task, and every
// earlier tool call and tool result. Input grows with each turn, so cost grows
// roughly with the square of the number of turns. Prompt caching bills the part
// already seen at the cache-read rate and only the new part at the write rate.
import { MODELS, type ModelPrice } from "./pricing"
import { priceFor } from "./model-routing"

export type LoopInput = {
  model: string
  tasksPerMonth: number
  prefixTokens: number // system prompt + tool definitions: identical for every task
  taskTokens: number // the request and any documents attached at the start
  turns: number // model calls per task; each tool call adds one
  toolResultTokens: number // tokens each tool result adds to the context
  outputTokens: number // tokens the model writes per turn, including thinking
  carriedPct: number // 0-100: share of each turn's output kept in the context for later turns
  caching: boolean
  contextLimit: number // the model's context window, in tokens
}

export type Turn = { turn: number; context: number; cost: number; uncachedCost: number }

export type LoopResult = {
  turns: Turn[]
  costPerTask: number
  uncachedCostPerTask: number
  monthlyCost: number
  uncachedMonthlyCost: number
  cachingSavingsPct: number
  inputTokensPerTask: number // total input processed across all turns
  outputTokensPerTask: number
  finalContext: number // input tokens on the last turn
  /** First turn whose prompt plus output no longer fits the context window, or null. */
  overflowTurn: number | null
  /** Cost per task if the same work fitted in a single call (no growth): the floor. */
  singleCallCost: number
  growthMultiple: number // costPerTask ÷ singleCallCost
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const M = 1e6

export function loopCost(i: LoopInput): LoopResult {
  const P = n(i.prefixTokens), I = n(i.taskTokens), O = n(i.outputTokens)
  const T = Math.min(500, Math.max(1, Math.round(n(i.turns))))
  const grow = n(i.toolResultTokens) + (O * Math.min(100, n(i.carriedPct))) / 100
  const limit = n(i.contextLimit)
  const turns: Turn[] = []
  let overflowTurn: number | null = null
  for (let k = 1; k <= T; k++) {
    const context = P + I + (k - 1) * grow
    const m: ModelPrice = priceFor(i.model, context)
    const uncachedCost = (context * m.input + O * m.output) / M
    // Cache breakpoint at the end of every prompt: what the previous turn sent is
    // read back, the new tail is written. The shared prefix is assumed warm.
    const read = k === 1 ? P : P + I + (k - 2) * grow
    const write = context - read
    const cost = i.caching ? (read * m.cacheRead + write * m.cacheWrite + O * m.output) / M : uncachedCost
    if (overflowTurn === null && limit > 0 && context + O > limit) overflowTurn = k
    turns.push({ turn: k, context, cost, uncachedCost })
  }
  const costPerTask = turns.reduce((s, t) => s + t.cost, 0)
  const uncachedCostPerTask = turns.reduce((s, t) => s + t.uncachedCost, 0)
  const tasks = n(i.tasksPerMonth)
  // The floor: the same tokens read once, as one call, at the uncached rate.
  const base = priceFor(i.model, P + I)
  const singleCallCost = ((P + I + (T - 1) * n(i.toolResultTokens)) * base.input + T * O * base.output) / M
  return {
    turns,
    costPerTask,
    uncachedCostPerTask,
    monthlyCost: costPerTask * tasks,
    uncachedMonthlyCost: uncachedCostPerTask * tasks,
    cachingSavingsPct: uncachedCostPerTask > 0 ? (1 - costPerTask / uncachedCostPerTask) * 100 : 0,
    inputTokensPerTask: turns.reduce((s, t) => s + t.context, 0),
    outputTokensPerTask: T * O,
    finalContext: turns[turns.length - 1].context,
    overflowTurn,
    singleCallCost,
    growthMultiple: singleCallCost > 0 ? costPerTask / singleCallCost : 0,
  }
}

/** Same task on every model (the long-context Haiku row is chosen automatically by prompt size). */
export const loopOnEveryModel = (i: LoopInput) =>
  MODELS.filter((m) => m.id !== "claude-haiku-5-5-long").map((m) => ({ model: m, ...loopCost({ ...i, model: m.id }) }))

export const DEFAULT_LOOP: LoopInput = {
  model: "claude-sonnet-5-5",
  tasksPerMonth: 2000,
  prefixTokens: 8000,
  taskTokens: 3000,
  turns: 12,
  toolResultTokens: 2500,
  outputTokens: 600,
  carriedPct: 100,
  caching: true,
  contextLimit: 200_000,
}
