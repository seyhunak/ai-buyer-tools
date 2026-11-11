// Weighted scorecard for comparing AI vendors (or build options) side by side.
// Beyond the ranking it answers two questions buyers usually skip: does any
// vendor fail a must-have, and would the winner change if one criterion
// mattered a little less?

export type Criterion = { id: string; label: string; hint: string; weight: number; mustHave: boolean }
export type Vendor = { name: string; scores: Record<string, number> } // 1-5 per criterion

export const CRITERIA: Criterion[] = [
  { id: "accuracy", label: "Accuracy on your own data", hint: "Measured on a test set you built, not the vendor's demo", weight: 5, mustHave: true },
  { id: "security", label: "Security and compliance", hint: "SOC 2 / ISO 27001, data residency, retention, no training on your data", weight: 5, mustHave: true },
  { id: "integration", label: "Fit with your systems", hint: "APIs, SSO, the systems of record it reads and writes", weight: 4, mustHave: false },
  { id: "cost", label: "Three-year total cost", hint: "Licences, usage, implementation, the labour it leaves behind", weight: 4, mustHave: false },
  { id: "time", label: "Time to value", hint: "Weeks to a pilot on real cases", weight: 3, mustHave: false },
  { id: "audit", label: "Audit trail and explainability", hint: "Can you show why it produced each answer, and who approved it?", weight: 3, mustHave: false },
  { id: "control", label: "Configurability", hint: "Can your team change prompts, rules and thresholds without a change request?", weight: 2, mustHave: false },
  { id: "exit", label: "Exit and portability", hint: "Export of data, prompts and evaluation sets; notice periods", weight: 2, mustHave: false },
  { id: "viability", label: "Vendor viability and support", hint: "Funding, customers like you, SLA and named support", weight: 2, mustHave: false },
]

export type Ranked = {
  name: string
  score: number // 0-100
  failsMustHave: string[] // criterion labels scored 2 or below while marked must-have
}
export type ScorecardResult = {
  ranked: Ranked[] // eligible first, by score
  winner: string | null
  margin: number | null // points between the top two eligible vendors
  /** Criteria whose weight, cut by one point, would change the winner or leave a tie. */
  swingCriteria: string[]
}

const clampScore = (v: number) => (Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 1)
const w = (v: number) => (Number.isFinite(v) ? Math.min(5, Math.max(0, v)) : 0)

/** Weighted average rescaled so all 1s is 0 and all 5s is 100. */
export function weightedScore(v: Vendor, criteria: Criterion[]): number {
  const total = criteria.reduce((s, c) => s + w(c.weight), 0)
  if (total === 0) return 0
  const avg = criteria.reduce((s, c) => s + w(c.weight) * clampScore(v.scores[c.id] ?? 1), 0) / total
  return ((avg - 1) / 4) * 100
}

function rank(vendors: Vendor[], criteria: Criterion[]): Ranked[] {
  return vendors
    .map((v) => ({
      name: v.name.trim() || "unnamed",
      score: weightedScore(v, criteria),
      failsMustHave: criteria.filter((c) => c.mustHave && w(c.weight) > 0 && clampScore(v.scores[c.id] ?? 1) <= 2).map((c) => c.label),
    }))
    .sort((a, b) => (a.failsMustHave.length > 0 ? 1 : 0) - (b.failsMustHave.length > 0 ? 1 : 0) || b.score - a.score)
}

export function scorecard(vendors: Vendor[], criteria: Criterion[] = CRITERIA): ScorecardResult {
  const ranked = rank(vendors, criteria)
  const eligible = ranked.filter((r) => r.failsMustHave.length === 0)
  const winner = eligible[0]?.name ?? null
  const margin = eligible.length > 1 ? eligible[0].score - eligible[1].score : null
  const swingCriteria = winner
    ? criteria
        .filter((c) => w(c.weight) > 0)
        .filter((c) => {
          const lighter = criteria.map((x) => (x.id === c.id ? { ...x, weight: w(x.weight) - 1 } : x))
          const [first, second] = rank(vendors, lighter).filter((r) => r.failsMustHave.length === 0)
          return first && (first.name !== winner || (second !== undefined && first.score - second.score < 0.05))
        })
        .map((c) => c.label)
    : []
  return { ranked, winner, margin, swingCriteria }
}

export function toMarkdown(vendors: Vendor[], criteria: Criterion[], r: ScorecardResult): string {
  const names = vendors.map((v) => v.name.trim() || "unnamed")
  const lines = [
    `# AI vendor scorecard${r.winner ? `: ${r.winner} leads` : ""}`,
    "",
    `| criterion | weight | ${names.join(" | ")} |`,
    `|---|---|${names.map(() => "---").join("|")}|`,
    ...criteria.map((c) => `| ${c.label}${c.mustHave ? " (must-have)" : ""} | ${w(c.weight)} | ${vendors.map((v) => clampScore(v.scores[c.id] ?? 1)).join(" | ")} |`),
    "",
    "## Ranking",
    ...r.ranked.map((x, i) => `${i + 1}. ${x.name}: ${x.score.toFixed(0)}/100${x.failsMustHave.length ? ` (fails must-have: ${x.failsMustHave.join(", ")})` : ""}`),
  ]
  if (r.margin !== null) lines.push("", `Margin between the top two: ${r.margin.toFixed(1)} points.`)
  if (r.swingCriteria.length) lines.push(`The result is sensitive to: ${r.swingCriteria.join(", ")}. Lowering any one of these weights by a point changes the winner or leaves a tie.`)
  lines.push("", "Generated at https://seyhunakyurek.com/tools/ai-vendor-scorecard")
  return lines.join("\n")
}

export const DEFAULT_VENDORS: Vendor[] = [
  { name: "Vendor A", scores: { accuracy: 4, security: 4, integration: 3, cost: 2, time: 4, audit: 3, control: 2, exit: 2, viability: 5 } },
  { name: "Vendor B", scores: { accuracy: 4, security: 3, integration: 4, cost: 4, time: 3, audit: 4, control: 4, exit: 3, viability: 3 } },
  { name: "Build in-house", scores: { accuracy: 4, security: 5, integration: 5, cost: 3, time: 2, audit: 5, control: 5, exit: 5, viability: 4 } },
]
