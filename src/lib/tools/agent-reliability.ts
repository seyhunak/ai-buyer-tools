// How reliable a multi-step agent pipeline is end to end. Each step is right with
// probability p. When it is wrong, a check after it (schema validation, a rule, a
// judge model) catches the error with probability d. A caught error is retried, up
// to r times, and a step that is still failing after its last retry hands the case
// to a person. An error the check misses passes on silently, and the case ends with
// a wrong output unless a later step escalates it to a person.
//
// One attempt: right p, missed error q(1-d), caught error qd (q = 1 - p).
//   success  S = p    · (1 + qd + … + (qd)^r)
//   silent   E = q(1-d)(1 + qd + … + (qd)^r)
//   escalate H = (qd)^(r+1)
//   attempts A = 1 + qd + … + (qd)^r
// Attempts are treated as independent. Real retries fail together more often than
// that, so a retry is worth less than the formula says (see `retryFixPct`).

export type Step = {
  name: string
  accuracyPct: number // 0-100: share of attempts that are right
  catchPct: number // 0-100: share of wrong attempts the check after this step catches
  retries: number // retries allowed after a caught error, 0-5
}

export type ReliabilityInput = {
  casesPerMonth: number
  steps: Step[]
  /** 0-100: chance a retry succeeds where an independent attempt would. 100 = fully independent. */
  retryFixPct: number
  errorCost: number // cost of one wrong output that reaches a customer or a ledger
  minutesPerEscalation: number
  hourlyCost: number
}

export type StepResult = Step & {
  success: number
  silent: number
  escalate: number
  attempts: number // expected model calls for this step, given the case reached it
  reach: number // probability a case reaches this step (not escalated earlier)
  wrongShare: number // share of all wrong outputs whose first error happened here
  escalationShare: number // share of all escalations that happen here
}

export type ReliabilityResult = {
  steps: StepResult[]
  straightThrough: number // right with no person involved
  escalated: number
  wrong: number // wrong and no person saw it
  /** Product of step accuracies: no checks and no retries. */
  noChecks: number
  callsPerCase: number
  wrongPerMonth: number
  escalatedPerMonth: number
  reviewHours: number
  errorCostPerMonth: number
  reviewCostPerMonth: number
  totalCostPerMonth: number
  /** Index of the step that causes the most wrong outputs, or -1 when there are none. */
  weakest: number
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
const nonNeg = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
export const MAX_STEPS = 12
export const MAX_RETRIES = 5

/** Outcome of one step on its own. `fix` scales how much each retry is worth (1 = independent). */
export function stepOutcome(s: Step, fix = 1) {
  const p = clamp(s.accuracyPct, 0, 100) / 100
  const d = clamp(s.catchPct, 0, 100) / 100
  const r = Math.round(clamp(s.retries, 0, MAX_RETRIES))
  const q = 1 - p
  const caught = q * d
  // Retry k succeeds with probability p·fix; the rest of what fix withholds fails again
  // the same way the first attempt did (caught with d, missed with 1 - d).
  const pr = p * fix
  const qr = 1 - pr
  let success = p, silent = q * (1 - d), attempts = 1, pending = caught
  for (let k = 0; k < r; k++) {
    attempts += pending
    success += pending * pr
    silent += pending * qr * (1 - d)
    pending *= qr * d
  }
  return { success, silent, escalate: pending, attempts }
}

export function reliability(i: ReliabilityInput): ReliabilityResult {
  const steps = (Array.isArray(i.steps) ? i.steps : []).slice(0, MAX_STEPS)
  const fix = clamp(i.retryFixPct, 0, 100) / 100
  const outcomes = steps.map((s) => stepOutcome(s, fix))
  // Forward pass over three states: clean so far, carrying a missed error, escalated.
  let clean = 1, tainted = 0, escalated = 0, calls = 0
  const reach: number[] = []
  const firstError: number[] = []
  const escAt: number[] = []
  outcomes.forEach((o) => {
    const here = clean + tainted
    reach.push(here)
    calls += here * o.attempts
    escAt.push(here * o.escalate)
    escalated += here * o.escalate
    firstError.push(clean * o.silent)
    tainted = clean * o.silent + tainted * (o.success + o.silent)
    clean *= o.success
  })
  // A first error at step k only ends wrong if no later step escalates the case.
  const survive = (k: number) => outcomes.slice(k + 1).reduce((s, o) => s * (1 - o.escalate), 1)
  const wrongAt = firstError.map((f, k) => f * survive(k))
  const wrong = tainted
  const cases = nonNeg(i.casesPerMonth)
  const wrongPerMonth = wrong * cases
  const escalatedPerMonth = escalated * cases
  const reviewHours = (escalatedPerMonth * nonNeg(i.minutesPerEscalation)) / 60
  const errorCostPerMonth = wrongPerMonth * nonNeg(i.errorCost)
  const reviewCostPerMonth = reviewHours * nonNeg(i.hourlyCost)
  let weakest = -1
  wrongAt.forEach((w, k) => { if (w > 1e-12 && (weakest < 0 || w > wrongAt[weakest])) weakest = k })
  return {
    steps: steps.map((s, k) => ({
      ...s,
      ...outcomes[k],
      reach: reach[k],
      wrongShare: wrong > 0 ? wrongAt[k] / wrong : 0,
      escalationShare: escalated > 0 ? escAt[k] / escalated : 0,
    })),
    straightThrough: clean,
    escalated,
    wrong,
    noChecks: steps.reduce((s, x) => s * clamp(x.accuracyPct, 0, 100) / 100, 1),
    callsPerCase: calls,
    wrongPerMonth,
    escalatedPerMonth,
    reviewHours,
    errorCostPerMonth,
    reviewCostPerMonth,
    totalCostPerMonth: errorCostPerMonth + reviewCostPerMonth,
    weakest,
  }
}

/** The same pipeline with one step's check raised to `catchPct`: what fixing it is worth. */
export function withBetterCheck(i: ReliabilityInput, k: number, catchPct: number): ReliabilityResult {
  return reliability({ ...i, steps: i.steps.map((s, j) => (j === k ? { ...s, catchPct: Math.max(s.catchPct, catchPct) } : s)) })
}

/** Per-step accuracy every step needs for a target end-to-end accuracy with no checks: target^(1/n). */
export const perStepNeeded = (targetPct: number, n: number) =>
  n > 0 ? Math.pow(clamp(targetPct, 0, 100) / 100, 1 / n) * 100 : 0

export const DEFAULT_RELIABILITY: ReliabilityInput = {
  casesPerMonth: 5000,
  steps: [
    { name: "Classify the document", accuracyPct: 98, catchPct: 50, retries: 1 },
    { name: "Extract the fields", accuracyPct: 94, catchPct: 80, retries: 2 },
    { name: "Match to the system of record", accuracyPct: 97, catchPct: 90, retries: 1 },
    { name: "Decide", accuracyPct: 92, catchPct: 60, retries: 1 },
    { name: "Draft the response", accuracyPct: 96, catchPct: 70, retries: 1 },
  ],
  retryFixPct: 70,
  errorCost: 120,
  minutesPerEscalation: 8,
  hourlyCost: 45,
}
