// How far you can trust an LLM judge (or an agent's pass/fail call) by comparing it
// with a person on the same cases. Raw agreement flatters a judge when most cases
// pass; Cohen's kappa corrects for the agreement two raters would reach by chance.
import { wilson, zFor } from "./accuracy"

export type AgreementInput = {
  bothPass: number // judge pass, human pass
  judgePassHumanFail: number // the judge missed a failure
  judgeFailHumanPass: number // false alarm
  bothFail: number // judge fail, human fail
  confidencePct: number // 80, 90, 95 or 99
  targetKappa: number // 0-1: the bar for trusting the judge
}

export type Strength = "worse than chance" | "slight" | "fair" | "moderate" | "substantial" | "almost perfect"
export type AgreementVerdict = "meets" | "below" | "unclear" | "no-data"

export type AgreementResult = {
  n: number
  observed: number // share of cases where judge and human agree
  observedLow: number
  observedHigh: number
  expected: number // agreement expected by chance from each rater's pass rate
  kappa: number
  kappaLow: number
  kappaHigh: number
  strength: Strength
  pabak: number // prevalence- and bias-adjusted kappa: 2 × observed − 1
  humanFailRate: number
  judgeFailRate: number
  catchRate: number | null // of the cases the human failed, the share the judge also failed
  falseAlarmRate: number | null // of the cases the human passed, the share the judge failed
  verdict: AgreementVerdict
  /** Cases needed for the kappa interval to be ±0.1 wide at the current agreement. */
  casesForTenthWidth: number | null
}

const c = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0)

/** Landis & Koch (1977) bands. */
export function strengthOf(k: number): Strength {
  if (k < 0) return "worse than chance"
  if (k <= 0.2) return "slight"
  if (k <= 0.4) return "fair"
  if (k <= 0.6) return "moderate"
  if (k <= 0.8) return "substantial"
  return "almost perfect"
}

export function agreement(i: AgreementInput): AgreementResult {
  const a = c(i.bothPass), b = c(i.judgePassHumanFail), d0 = c(i.judgeFailHumanPass), d = c(i.bothFail)
  const n = a + b + d0 + d
  const z = zFor(i.confidencePct)
  if (n === 0) {
    return {
      n, observed: 0, observedLow: 0, observedHigh: 1, expected: 0, kappa: 0, kappaLow: -1, kappaHigh: 1, strength: "slight",
      pabak: 0, humanFailRate: 0, judgeFailRate: 0, catchRate: null, falseAlarmRate: null, verdict: "no-data", casesForTenthWidth: null,
    }
  }
  const po = (a + d) / n
  const judgePass = (a + b) / n, humanPass = (a + d0) / n
  const pe = judgePass * humanPass + (1 - judgePass) * (1 - humanPass)
  // When both raters put every case in one class, chance agreement is 1 and kappa is undefined; treat full agreement as 1.
  const kappa = pe < 1 ? (po - pe) / (1 - pe) : po === 1 ? 1 : 0
  // Large-sample standard error (Cohen 1960).
  const se = pe < 1 ? Math.sqrt((po * (1 - po)) / (n * (1 - pe) ** 2)) : 0
  const kappaLow = Math.max(-1, kappa - z * se), kappaHigh = Math.min(1, kappa + z * se)
  const ci = wilson(a + d, n, i.confidencePct)
  const target = Math.min(1, Math.max(-1, Number.isFinite(i.targetKappa) ? i.targetKappa : 0.6))
  const verdict: AgreementVerdict = kappaLow >= target ? "meets" : kappaHigh < target ? "below" : "unclear"
  const perCase = pe < 1 ? (po * (1 - po)) / (1 - pe) ** 2 : 0
  return {
    n,
    observed: po,
    observedLow: ci.low,
    observedHigh: ci.high,
    expected: pe,
    kappa,
    kappaLow,
    kappaHigh,
    strength: strengthOf(kappa),
    pabak: 2 * po - 1,
    humanFailRate: (b + d) / n,
    judgeFailRate: (d0 + d) / n,
    catchRate: b + d > 0 ? d / (b + d) : null,
    falseAlarmRate: a + d0 > 0 ? d0 / (a + d0) : null,
    verdict,
    casesForTenthWidth: perCase > 0 ? Math.ceil(perCase * (z / 0.1) ** 2) : null,
  }
}

export const DEFAULT_AGREEMENT: AgreementInput = {
  bothPass: 162,
  judgePassHumanFail: 9,
  judgeFailHumanPass: 7,
  bothFail: 22,
  confidencePct: 95,
  targetKappa: 0.6,
}
