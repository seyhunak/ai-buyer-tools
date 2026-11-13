// Where to set the confidence threshold below which an AI workflow hands a case to
// a person. Each option auto-completes the top k confidence bands and reviews the
// rest; the cheapest is the one whose error cost plus review cost is lowest.
// Reviewed cases are not error-free: people make mistakes too.

/** The five confidence bands, highest first. `min` is the band's lower bound. */
export const BANDS = [
  { label: "0.95 and above", min: 0.95 },
  { label: "0.90 to 0.95", min: 0.9 },
  { label: "0.80 to 0.90", min: 0.8 },
  { label: "0.60 to 0.80", min: 0.6 },
  { label: "below 0.60", min: 0 },
] as const

export type Band = {
  sharePct: number // 0-100: share of cases the model puts in this band
  accuracyPct: number // 0-100: measured accuracy of the model's answer in this band
}

export type EscalationInput = {
  casesPerMonth: number
  bands: Band[] // one per BANDS entry, highest confidence first
  errorCost: number // cost of one undetected error
  minutesPerReview: number
  hourlyCost: number // loaded cost of a reviewer hour
  humanAccuracyPct: number // 0-100: reviewers get this share of reviewed cases right
}

export type ThresholdOption = {
  autoBands: number // k: the top k bands are auto-completed
  threshold: string // plain-English cut-off
  autoRate: number // 0-1
  autoCases: number
  reviewedCases: number
  autoErrors: number
  humanErrors: number
  errors: number // expected undetected errors a month
  reviewCost: number
  errorCost: number
  totalCost: number
  costPerCase: number
}

export type BandBreakEven = {
  label: string
  share: number // 0-1, normalised
  accuracy: number // 0-1
  autoCostPerCase: number // expected error cost if auto-completed
  reviewCostPerCase: number // review labour + residual human error cost
  breakEvenAccuracy: number | null // 0-1; null when errors cost nothing
  autoCheaper: boolean
}

export type EscalationResult = {
  sharesTotal: number // the shares as entered, in percent
  sharesOk: boolean // add up to 100 (within 0.05)
  reviewCostPerCase: number // labour only
  options: ThresholdOption[] // k = 0..5
  best: ThresholdOption
  /** Accuracy at which auto-completing a case costs the same as reviewing it. */
  breakEvenAccuracy: number | null
  bands: BandBreakEven[]
  /** Band accuracies do not fall as confidence falls: the model is not calibrated, and a threshold may not be the best rule. */
  uncalibrated: boolean
  savingsVsAllReview: number
  savingsVsAllAuto: number
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const frac = (v: number) => Math.min(1, n(v) / 100)

/** Accuracy at which auto-completing costs the same as a review: errorCost × (1 − acc) = review + errorCost × (1 − humanAcc). */
export function breakEven(errorCost: number, reviewCostPerCase: number, humanAccuracy: number): number | null {
  if (!(errorCost > 0)) return null
  return 1 - (n(reviewCostPerCase) + errorCost * (1 - humanAccuracy)) / errorCost
}

export function thresholds(i: EscalationInput): EscalationResult {
  const cases = n(i.casesPerMonth)
  const raw = BANDS.map((_, b) => i.bands?.[b] ?? { sharePct: 0, accuracyPct: 0 })
  const sharesTotal = raw.reduce((s, b) => s + n(b.sharePct), 0)
  // Normalise so the bands always cover every case; all zeros means no cases to place.
  const shares = raw.map((b) => (sharesTotal > 0 ? n(b.sharePct) / sharesTotal : 0))
  const acc = raw.map((b) => frac(b.accuracyPct))
  const errorCost = n(i.errorCost)
  const humanAcc = frac(i.humanAccuracyPct)
  const reviewCostPerCase = (n(i.minutesPerReview) / 60) * n(i.hourlyCost)

  const options: ThresholdOption[] = []
  for (let k = 0; k <= BANDS.length; k++) {
    let autoShare = 0, autoErrRate = 0
    for (let b = 0; b < k; b++) {
      autoShare += shares[b]
      autoErrRate += shares[b] * (1 - acc[b])
    }
    const autoCases = cases * autoShare
    const reviewedCases = sharesTotal > 0 ? cases - autoCases : 0
    const autoErrors = cases * autoErrRate
    const humanErrors = reviewedCases * (1 - humanAcc)
    const errors = autoErrors + humanErrors
    const reviewCost = reviewedCases * reviewCostPerCase
    const errCost = errors * errorCost
    const totalCost = reviewCost + errCost
    options.push({
      autoBands: k,
      threshold: k === 0 ? "review everything" : k === BANDS.length ? "auto-complete everything" : `${BANDS[k - 1].min.toFixed(2)} and above`,
      autoRate: sharesTotal > 0 ? autoShare : 0,
      autoCases,
      reviewedCases,
      autoErrors,
      humanErrors,
      errors,
      reviewCost,
      errorCost: errCost,
      totalCost,
      costPerCase: cases > 0 ? totalCost / cases : 0,
    })
  }
  // Cheapest wins; on a tie (within a cent) keep the more cautious option, with more review.
  const best = options.reduce((a, o) => (o.totalCost < a.totalCost - 0.005 ? o : a))

  const reviewAll = reviewCostPerCase + errorCost * (1 - humanAcc)
  const be = breakEven(errorCost, reviewCostPerCase, humanAcc)
  const bands: BandBreakEven[] = BANDS.map((band, b) => {
    const autoCostPerCase = errorCost * (1 - acc[b])
    return {
      label: band.label,
      share: shares[b],
      accuracy: acc[b],
      autoCostPerCase,
      reviewCostPerCase: reviewAll,
      breakEvenAccuracy: be,
      autoCheaper: autoCostPerCase < reviewAll,
    }
  })
  const uncalibrated = acc.some((a, b) => b > 0 && shares[b] > 0 && shares[b - 1] > 0 && a > acc[b - 1])

  return {
    sharesTotal,
    sharesOk: Math.abs(sharesTotal - 100) < 0.05,
    reviewCostPerCase,
    options,
    best,
    breakEvenAccuracy: be,
    bands,
    uncalibrated,
    savingsVsAllReview: options[0].totalCost - best.totalCost,
    savingsVsAllAuto: options[BANDS.length].totalCost - best.totalCost,
  }
}

export const DEFAULT_ESCALATION: EscalationInput = {
  casesPerMonth: 10000,
  bands: [
    { sharePct: 55, accuracyPct: 98.5 },
    { sharePct: 20, accuracyPct: 95 },
    { sharePct: 12, accuracyPct: 88 },
    { sharePct: 8, accuracyPct: 75 },
    { sharePct: 5, accuracyPct: 55 },
  ],
  errorCost: 150,
  minutesPerReview: 6,
  hourlyCost: 40,
  humanAccuracyPct: 99,
}
