// Statistics for checking an AI system's accuracy claim against a test set.
// Wilson score interval: well-behaved near 0% and 100%, unlike the normal approximation.

const Z: Record<string, number> = { "80": 1.2816, "90": 1.6449, "95": 1.96, "99": 2.5758 }
/** Two-sided z for a confidence level in percent (80, 90, 95, 99). */
export const zFor = (confidencePct: number): number => Z[String(confidencePct)] ?? 1.96

export function wilson(passes: number, n: number, confidencePct = 95): { low: number; high: number; observed: number } {
  if (!(n > 0)) return { low: 0, high: 1, observed: 0 }
  const k = Math.min(Math.max(passes, 0), n)
  const z = zFor(confidencePct)
  const p = k / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half), observed: p }
}

/**
 * Smallest test-set size n at which a system that really scores `expected`
 * would show a Wilson lower bound at or above `target`.
 * Returns null when expected <= target (no sample size can prove it).
 */
export function requiredSampleSize(target: number, expected: number, confidencePct = 95, cap = 1_000_000): number | null {
  if (!(expected > target) || target < 0 || expected > 1) return null
  let lo = 1, hi = 1
  const ok = (n: number) => wilson(Math.round(expected * n), n, confidencePct).low >= target
  while (!ok(hi)) { lo = hi; hi *= 2; if (hi > cap) return null }
  // ok() is monotone enough in practice; binary search, then walk back for rounding wiggles.
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid + 1 }
  return hi
}

/** "Rule of three" generalised: tests with zero failures needed to claim accuracy >= target. */
export function zeroFailureTests(target: number, confidencePct = 95): number | null {
  if (!(target > 0 && target < 1)) return null
  const alpha = 1 - confidencePct / 100
  return Math.ceil(Math.log(alpha) / Math.log(target))
}

export type Verdict = "proven" | "not-proven" | "contradicted"
/** Does a vendor's test result support their claimed accuracy? */
export function judgeClaim(claimed: number, passes: number, n: number, confidencePct = 95): { verdict: Verdict; low: number; high: number } {
  const { low, high } = wilson(passes, n, confidencePct)
  const verdict: Verdict = low >= claimed ? "proven" : high < claimed ? "contradicted" : "not-proven"
  return { verdict, low, high }
}
