// Three-year cost of ownership for three ways to take work off a team:
// buy a SaaS AI product, build a custom agent workflow, or keep doing it by hand.

export type BvbInput = {
  months: number
  // Manual baseline
  hoursPerMonth: number
  hourlyCost: number
  // Buy
  seats: number
  seatPricePerMonth: number
  buySetup: number
  buyAutomation: number // 0-100: share of the manual hours the product removes
  // Build
  buildCost: number
  apiPerMonth: number
  hostingPerMonth: number
  maintenancePctPerYear: number // of build cost
  buildAutomation: number // 0-100
  buildMonths: number // months before the build starts saving time
}

export type Series = { label: string; key: "manual" | "buy" | "build"; cumulative: number[] }
export type BvbResult = {
  series: Series[]
  totals: Record<"manual" | "buy" | "build", number>
  cheapest: "manual" | "buy" | "build"
  breakEvenBuildVsManual: number | null // first month the build is cheaper cumulatively
  breakEvenBuildVsBuy: number | null
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const pct = (v: number) => Math.min(100, n(v)) / 100

export function compare(i: BvbInput): BvbResult {
  const months = Math.max(1, Math.min(120, Math.round(n(i.months) || 36)))
  const labour = n(i.hoursPerMonth) * n(i.hourlyCost)
  const manual: number[] = [], buy: number[] = [], build: number[] = []
  let m = 0, b = n(i.buySetup), c = n(i.buildCost)
  for (let t = 1; t <= months; t++) {
    m += labour
    b += n(i.seats) * n(i.seatPricePerMonth) + labour * (1 - pct(i.buyAutomation))
    const live = t > n(i.buildMonths)
    c += labour * (live ? 1 - pct(i.buildAutomation) : 1)
      + (live ? n(i.apiPerMonth) + n(i.hostingPerMonth) : 0)
      + (n(i.buildCost) * pct(i.maintenancePctPerYear)) / 12 * (live ? 1 : 0)
    manual.push(m); buy.push(b); build.push(c)
  }
  const firstBelow = (a: number[], ref: number[]) => { const k = a.findIndex((v, j) => v < ref[j]); return k === -1 ? null : k + 1 }
  const totals = { manual: m, buy: b, build: c }
  const cheapest = (Object.keys(totals) as (keyof typeof totals)[]).reduce((x, y) => (totals[y] < totals[x] ? y : x))
  return {
    series: [
      { label: "keep it manual", key: "manual", cumulative: manual },
      { label: "buy a SaaS tool", key: "buy", cumulative: buy },
      { label: "build an agent workflow", key: "build", cumulative: build },
    ],
    totals,
    cheapest,
    breakEvenBuildVsManual: firstBelow(build, manual),
    breakEvenBuildVsBuy: firstBelow(build, buy),
  }
}

export const DEFAULT_BVB: BvbInput = {
  months: 36,
  hoursPerMonth: 600, hourlyCost: 45,
  seats: 25, seatPricePerMonth: 60, buySetup: 5000, buyAutomation: 25,
  buildCost: 90000, apiPerMonth: 1200, hostingPerMonth: 400, maintenancePctPerYear: 20, buildAutomation: 60, buildMonths: 3,
}
