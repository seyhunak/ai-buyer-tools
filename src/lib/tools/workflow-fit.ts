// Scores how well a business process suits an agent workflow, and suggests a shape.
// Each factor is 1-5 as the user rates it; weights reflect what usually decides success.

export type FitInput = {
  volumePerMonth: number // cases per month
  minutesPerCase: number // human handling time today
  hourlyCost: number
  ruleClarity: number // 1 = judgement calls everywhere, 5 = written rules cover nearly everything
  inputStructure: number // 1 = scans, handwriting, calls; 5 = clean structured data
  exceptionRate: number // 1 = most cases are exceptions, 5 = exceptions are rare
  errorCost: number // 1 = an error is cheap to fix, 5 = an error is costly, regulated or irreversible
  systemAccess: number // 1 = no APIs, screen-only; 5 = every system has an API
  dataAvailable: number // 1 = no past examples, 5 = thousands of labelled past cases
}

export type Pattern = "full-automation" | "agent-with-review" | "copilot" | "not-yet"

export type FitResult = {
  score: number // 0-100
  pattern: Pattern
  patternLabel: string
  hoursPerMonthToday: number
  automatableShare: number // 0-1, modelled share of handling time removed
  hoursSavedPerMonth: number
  valuePerYear: number
  strengths: string[]
  risks: string[]
  architecture: string[]
}

const r = (n: number) => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)))
const W = { ruleClarity: 0.22, inputStructure: 0.14, exceptionRate: 0.18, errorCost: 0.16, systemAccess: 0.15, dataAvailable: 0.15 }

export function scoreFit(raw: FitInput): FitResult {
  const f = {
    ruleClarity: r(raw.ruleClarity),
    inputStructure: r(raw.inputStructure),
    exceptionRate: r(raw.exceptionRate),
    errorCost: r(raw.errorCost),
    systemAccess: r(raw.systemAccess),
    dataAvailable: r(raw.dataAvailable),
  }
  // errorCost is inverted: costly errors make a process a worse fit.
  const norm = (k: keyof typeof f) => ((k === "errorCost" ? 6 - f[k] : f[k]) - 1) / 4
  const base = (Object.keys(W) as (keyof typeof W)[]).reduce((s, k) => s + W[k] * norm(k), 0)
  const volume = Math.max(0, raw.volumePerMonth) * Math.max(0, raw.minutesPerCase)
  // Volume does not make a process easier, but it decides whether it's worth building: -10..+10.
  const volumeAdj = volume <= 0 ? -10 : Math.max(-10, Math.min(10, Math.log10(volume / 6000) * 10))
  const score = Math.round(Math.min(100, Math.max(0, base * 90 + volumeAdj)))

  let pattern: Pattern
  if (score >= 75 && f.errorCost <= 3) pattern = "full-automation"
  else if (score >= 55) pattern = "agent-with-review"
  else if (score >= 35) pattern = "copilot"
  else pattern = "not-yet"
  const patternLabel = {
    "full-automation": "Straight-through agent workflow with sampled QA",
    "agent-with-review": "Agent workflow with a human approval step",
    copilot: "Copilot: agents draft, people decide",
    "not-yet": "Not yet: fix the inputs or the rules first",
  }[pattern]

  const automatableShare = { "full-automation": 0.85, "agent-with-review": 0.65, copilot: 0.35, "not-yet": 0.1 }[pattern]
  const hoursPerMonthToday = volume / 60
  const hoursSavedPerMonth = hoursPerMonthToday * automatableShare
  const valuePerYear = hoursSavedPerMonth * 12 * Math.max(0, raw.hourlyCost)

  const strengths: string[] = []
  const risks: string[] = []
  if (f.ruleClarity >= 4) strengths.push("Written rules cover most decisions, so agents can follow and cite them.")
  else if (f.ruleClarity <= 2) risks.push("Decisions rest on judgement that isn't written down. Capture the rules before you build.")
  if (f.inputStructure <= 2) risks.push("Messy inputs: budget for document extraction and test it on your worst scans.")
  else if (f.inputStructure >= 4) strengths.push("Inputs are already structured, so most steps can be plain code, not model calls.")
  if (f.exceptionRate <= 2) risks.push("Exceptions are common. Route them to people early rather than letting agents improvise.")
  if (f.errorCost >= 4) risks.push("Errors are costly or regulated: keep a human approval step and an audit trail.")
  if (f.systemAccess <= 2) risks.push("Few APIs: integration is the long pole. Screen automation is brittle, so plan for it.")
  else if (f.systemAccess >= 4) strengths.push("Systems have APIs, so agents can act, not just advise.")
  if (f.dataAvailable >= 4) strengths.push("Plenty of past cases to build a golden test set from.")
  else if (f.dataAvailable <= 2) risks.push("Few past examples: build a labelled test set of at least 100 cases before go-live.")
  if (volume < 3000) risks.push("Low volume: under 50 hours of work a month rarely pays back a custom build.")

  const architecture = [
    f.inputStructure <= 3 ? "Intake: document extraction (OCR plus a small model) into a typed schema" : "Intake: plain code reads the structured inputs",
    f.exceptionRate <= 3 ? "Router: a small, cheap model classifies cases and sends exceptions to a person" : "Router: rules route cases; a model handles only what rules can't",
    f.ruleClarity >= 3 ? "Worker agents: one per decision type, each citing the rule it applied" : "Drafting agent: prepares the case file and a recommendation for a person",
    pattern === "full-automation" ? "QA: sample 5–10% of completed cases for human review" : "Approval: a person approves before anything is sent, paid or filed",
    "Evaluation: a golden set re-run on every prompt or model change",
  ]
  return { score, pattern, patternLabel, hoursPerMonthToday, automatableShare, hoursSavedPerMonth, valuePerYear, strengths, risks, architecture }
}

export const DEFAULT_FIT: FitInput = {
  volumePerMonth: 1500, minutesPerCase: 20, hourlyCost: 45,
  ruleClarity: 4, inputStructure: 2, exceptionRate: 3, errorCost: 3, systemAccess: 3, dataAvailable: 4,
}
