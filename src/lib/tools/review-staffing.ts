// How many people it takes to review the cases an AI workflow escalates, within
// a response-time target. Erlang C queueing, the standard contact-centre model:
// cases arrive at random, reviewers pick them up first come, first served.

export type StaffingInput = {
  casesPerMonth: number
  reviewPct: number // 0-100: share of cases a person has to review
  minutesPerReview: number
  hoursPerDay: number // hours the review queue is staffed
  daysPerMonth: number
  peakFactor: number // busiest hour's volume ÷ the average hour's
  targetMinutes: number // pick a case up within this many minutes…
  targetPct: number // …for this share of cases (0-100)
  shrinkagePct: number // 0-100: leave, training, meetings, breaks
  hourlyCost: number
}

export type StaffingResult = {
  reviewsPerMonth: number
  reviewsPerPeakHour: number
  erlangs: number // workload in the peak hour, in reviewer-hours per hour
  reviewersOnShift: number // needed at the same time in the peak hour
  serviceLevel: number // 0-1: share picked up within the target at that staffing
  averageWaitMinutes: number
  occupancy: number // 0-1
  fte: number // headcount after shrinkage
  workloadFte: number // pure workload, no queueing or shrinkage: the naive answer
  monthlyCost: number
  costPerReview: number
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

/** Erlang C: probability an arriving case has to wait, with `agents` servers and `erlangs` of traffic. */
export function erlangC(agents: number, erlangs: number): number {
  if (erlangs <= 0) return 0
  if (agents <= erlangs) return 1
  // Erlang B by recursion (numerically stable), then convert to C.
  let b = 1
  for (let k = 1; k <= agents; k++) b = (erlangs * b) / (k + erlangs * b)
  return (agents * b) / (agents - erlangs * (1 - b))
}

/** Share of cases picked up within `targetMinutes`, for a given staffing level. */
export function serviceLevel(agents: number, erlangs: number, handleMinutes: number, targetMinutes: number): number {
  if (erlangs <= 0) return 1
  if (agents <= erlangs || handleMinutes <= 0) return 0
  return 1 - erlangC(agents, erlangs) * Math.exp((-(agents - erlangs) * targetMinutes) / handleMinutes)
}

export function staff(i: StaffingInput): StaffingResult {
  const reviewsPerMonth = n(i.casesPerMonth) * Math.min(100, n(i.reviewPct)) / 100
  const openHours = Math.max(1, n(i.hoursPerDay) * n(i.daysPerMonth))
  const reviewsPerPeakHour = (reviewsPerMonth / openHours) * Math.max(1, n(i.peakFactor))
  const aht = n(i.minutesPerReview)
  const erlangs = (reviewsPerPeakHour * aht) / 60
  const target = Math.min(0.999, Math.max(0, n(i.targetPct) / 100))

  let agents = erlangs > 0 ? Math.max(1, Math.floor(erlangs) + 1) : 0
  while (agents > 0 && agents < 10_000 && serviceLevel(agents, erlangs, aht, n(i.targetMinutes)) < target) agents++

  const c = agents > 0 ? erlangC(agents, erlangs) : 0
  const shrink = 1 - Math.min(90, n(i.shrinkagePct)) / 100
  const fte = agents / shrink
  // Staffed only for the queue's open hours; the peak-hour headcount is held all day.
  const monthlyCost = fte * openHours * n(i.hourlyCost)
  return {
    reviewsPerMonth,
    reviewsPerPeakHour,
    erlangs,
    reviewersOnShift: agents,
    serviceLevel: agents > 0 ? serviceLevel(agents, erlangs, aht, n(i.targetMinutes)) : 1,
    averageWaitMinutes: agents > erlangs ? (c * aht) / (agents - erlangs) : 0,
    occupancy: agents > 0 ? erlangs / agents : 0,
    fte,
    workloadFte: (reviewsPerMonth * aht) / 60 / openHours,
    monthlyCost,
    costPerReview: reviewsPerMonth > 0 ? monthlyCost / reviewsPerMonth : 0,
  }
}

export const DEFAULT_STAFFING: StaffingInput = {
  casesPerMonth: 9000,
  reviewPct: 25,
  minutesPerReview: 12,
  hoursPerDay: 9,
  daysPerMonth: 22,
  peakFactor: 1.6,
  targetMinutes: 30,
  targetPct: 90,
  shrinkagePct: 30,
  hourlyCost: 40,
}
