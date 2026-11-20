// Is variant B (a new prompt, model or retrieval setup) really better than variant A?
// Both run on the same golden set, so the comparison is paired: cases both get right
// or both get wrong say nothing about the difference. Only the cases where they
// disagree do, and McNemar's test uses only those.
//
//   difference B − A = (bOnly − aOnly) / n
//   exact McNemar p  = 2 · P(X ≤ min(aOnly, bOnly)),  X ~ Binomial(aOnly + bOnly, ½)
//   interval         = Bonett & Price (2012) adjusted Wald for paired proportions
//   cases needed     = Connor (1987): n = (zα·√ψ + zβ·√(ψ − δ²))² / δ²
//                      ψ = share of cases where the variants disagree, δ = smallest difference worth finding
import { zFor } from "./accuracy"

export type AbInput = {
  bothRight: number
  aOnly: number // A right, B wrong: cases B broke
  bOnly: number // B right, A wrong: cases B fixed
  bothWrong: number
  confidencePct: number // 90, 95 or 99
  powerPct: number // 80, 90 or 95
  minDiffPts: number // smallest difference worth acting on, in percentage points
}

export type AbVerdict = "b-better" | "a-better" | "equivalent" | "unclear" | "no-data"

export type AbResult = {
  n: number
  accA: number
  accB: number
  diff: number // B − A, as a share
  diffLow: number
  diffHigh: number
  pValue: number // exact two-sided McNemar
  discordant: number // cases where A and B disagree
  discordantRate: number
  verdict: AbVerdict
  /** Cases for a paired test to find a difference of minDiffPts at the chosen power. */
  casesNeeded: number | null
  /** The same, if A and B were run on two separate test sets (cases per set). */
  casesNeededUnpaired: number | null
}

const c = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0)
const ZB: Record<string, number> = { "80": 0.8416, "90": 1.2816, "95": 1.6449 }
/** One-sided z for a power in percent (80, 90, 95). */
export const zPower = (powerPct: number) => ZB[String(powerPct)] ?? 0.8416

/** Exact two-sided McNemar p-value from the two discordant counts. */
export function mcnemarExact(b: number, cc: number): number {
  const m = c(b) + c(cc)
  if (m === 0) return 1
  const k = Math.min(c(b), c(cc))
  // Sum binomial(m, i) · 2^−m for i ≤ k in log space, so large m doesn't underflow.
  const ln2m = m * Math.LN2
  let logC = 0, max = -Infinity
  const logs: number[] = []
  for (let i = 0; i <= k; i++) {
    if (i > 0) logC += Math.log(m - i + 1) - Math.log(i)
    const t = logC - ln2m
    logs.push(t)
    if (t > max) max = t
  }
  const tail = Math.exp(max) * logs.reduce((s, t) => s + Math.exp(t - max), 0)
  return Math.min(1, 2 * tail)
}

/** Bonett–Price adjusted Wald interval for B − A on paired data. */
export function pairedInterval(aOnly: number, bOnly: number, n: number, confidencePct = 95) {
  const z = zFor(confidencePct)
  const pa = (c(aOnly) + 1) / (n + 2)
  const pb = (c(bOnly) + 1) / (n + 2)
  const d = pb - pa
  const se = Math.sqrt(Math.max(0, pa + pb - d * d) / (n + 2))
  return { low: Math.max(-1, d - z * se), high: Math.min(1, d + z * se) }
}

/** Connor's sample size for a paired comparison. ψ is the discordant share, δ the difference. */
export function pairedSampleSize(psi: number, delta: number, confidencePct = 95, powerPct = 80): number | null {
  if (!(delta > 0 && delta < 1)) return null
  const s = Math.min(1, Math.max(psi, delta)) // B can't beat A by more than the cases they disagree on
  const za = zFor(confidencePct), zb = zPower(powerPct)
  return Math.ceil((za * Math.sqrt(s) + zb * Math.sqrt(Math.max(0, s - delta * delta))) ** 2 / (delta * delta))
}

/** Cases per set to find the same difference with two independent test sets. */
export function unpairedSampleSize(p1: number, delta: number, confidencePct = 95, powerPct = 80): number | null {
  if (!(delta > 0 && delta < 1)) return null
  const a = Math.min(1 - delta, Math.max(0, p1))
  const b = a + delta
  const bar = (a + b) / 2
  const za = zFor(confidencePct), zb = zPower(powerPct)
  return Math.ceil((za * Math.sqrt(2 * bar * (1 - bar)) + zb * Math.sqrt(a * (1 - a) + b * (1 - b))) ** 2 / (delta * delta))
}

export function abTest(i: AbInput): AbResult {
  const rr = c(i.bothRight), ro = c(i.aOnly), or = c(i.bOnly), oo = c(i.bothWrong)
  const n = rr + ro + or + oo
  const delta = (Number.isFinite(i.minDiffPts) ? Math.max(0, i.minDiffPts) : 0) / 100
  // zFor falls back to 95% for an unknown level; the significance bar does the same.
  const alpha = 1 - ([80, 90, 95, 99].includes(i.confidencePct) ? i.confidencePct : 95) / 100
  if (n === 0) {
    return {
      n, accA: 0, accB: 0, diff: 0, diffLow: -1, diffHigh: 1, pValue: 1, discordant: 0, discordantRate: 0, verdict: "no-data",
      casesNeeded: pairedSampleSize(0.1, delta, i.confidencePct, i.powerPct),
      casesNeededUnpaired: unpairedSampleSize(0.9 - delta, delta, i.confidencePct, i.powerPct),
    }
  }
  const accA = (rr + ro) / n
  const accB = (rr + or) / n
  const diff = (or - ro) / n
  const { low, high } = pairedInterval(ro, or, n, i.confidencePct)
  const pValue = mcnemarExact(ro, or)
  const discordant = ro + or
  const discordantRate = discordant / n
  let verdict: AbVerdict = "unclear"
  if (pValue < alpha && diff > 0) verdict = "b-better"
  else if (pValue < alpha && diff < 0) verdict = "a-better"
  else if (delta > 0 && low > -delta && high < delta) verdict = "equivalent"
  return {
    n, accA, accB, diff, diffLow: low, diffHigh: high, pValue, discordant, discordantRate, verdict,
    casesNeeded: pairedSampleSize(discordantRate, delta, i.confidencePct, i.powerPct),
    casesNeededUnpaired: unpairedSampleSize(accA, delta, i.confidencePct, i.powerPct),
  }
}

export const DEFAULT_AB: AbInput = {
  bothRight: 352,
  aOnly: 9,
  bOnly: 23,
  bothWrong: 16,
  confidencePct: 95,
  powerPct: 80,
  minDiffPts: 2,
}
