// GDPR data protection impact assessment (DPIA) screener for AI systems.
// Follows Art. 35 GDPR and the EDPB-endorsed WP29 guidelines (WP248 rev.01):
// a DPIA is mandatory for the three Art. 35(3) cases, and in most cases when
// processing meets two or more of the nine criteria. A screening aid, not legal advice.

export type Option = { id: string; label: string; hint: string; ref: string }

/** Art. 35(3): a DPIA is always required. */
export const MANDATORY: Option[] = [
  { id: "automated-evaluation", label: "Systematic, extensive evaluation of people by automated means, including profiling, that drives decisions with legal or similarly significant effects", hint: "Credit decisions, automated hiring shortlists, insurance pricing", ref: "Art. 35(3)(a)" },
  { id: "large-scale-special", label: "Large-scale processing of special-category data or criminal convictions data", hint: "Health, biometric, genetic, ethnicity, religion, union membership, sex life; Art. 9 and 10", ref: "Art. 35(3)(b)" },
  { id: "public-monitoring", label: "Systematic monitoring of a publicly accessible area on a large scale", hint: "CCTV analytics, footfall tracking, licence-plate recognition", ref: "Art. 35(3)(c)" },
]

/** WP248 rev.01: meeting two of these usually means a DPIA is required. */
export const CRITERIA: Option[] = [
  { id: "scoring", label: "Evaluates or scores people", hint: "Profiling, predicting performance, reliability, behaviour, health or interests", ref: "WP248 criterion 1" },
  { id: "automated-decision", label: "Makes automated decisions with legal or similarly significant effect", hint: "Approvals, rejections, pricing, eligibility without meaningful human review", ref: "WP248 criterion 2" },
  { id: "monitoring", label: "Systematically monitors people", hint: "Employees, users' behaviour across sessions, location", ref: "WP248 criterion 3" },
  { id: "sensitive", label: "Uses sensitive or highly personal data", hint: "Special categories, financial data, location, communications content", ref: "WP248 criterion 4" },
  { id: "large-scale", label: "Processes data on a large scale", hint: "Many people, much data, long retention, or wide geography", ref: "WP248 criterion 5" },
  { id: "matching", label: "Matches or combines datasets", hint: "Joining data collected for different purposes or by different controllers", ref: "WP248 criterion 6" },
  { id: "vulnerable", label: "Concerns vulnerable people", hint: "Employees, children, patients, the elderly, asylum seekers", ref: "WP248 criterion 7" },
  { id: "innovative", label: "Uses new technology, such as AI models, in a new way", hint: "The guidelines name new technology as a criterion; most LLM uses meet it", ref: "WP248 criterion 8" },
  { id: "blocks-rights", label: "Can stop someone using a service or entering a contract", hint: "Screening that can refuse a loan, an account or a policy", ref: "WP248 criterion 9" },
]

export type DpiaAnswers = {
  mandatory: string[]
  criteria: string[]
  solelyAutomated: boolean // Art. 22: decision based solely on automated processing, legal or similar effect
  specialCategory: boolean // any Art. 9 data at all
  vendorProcessor: boolean // an AI vendor processes the data for you
  transfersOutsideEea: boolean
  euAiActHighRisk: boolean // the system is high-risk under the EU AI Act and you deploy it
}

export type Verdict = "required" | "likely" | "borderline" | "not-indicated"
export type DpiaResult = {
  verdict: Verdict
  headline: string
  reasons: string[]
  actions: { text: string; ref: string }[]
}

const pick = (list: Option[], ids: string[]) => list.filter((o) => ids.includes(o.id))

export function screen(a: DpiaAnswers): DpiaResult {
  const mand = pick(MANDATORY, a.mandatory)
  const crit = pick(CRITERIA, a.criteria)
  const reasons: string[] = []
  let verdict: Verdict
  if (mand.length) {
    verdict = "required"
    reasons.push(...mand.map((o) => `${o.ref}: ${o.label.charAt(0).toLowerCase()}${o.label.slice(1)}.`))
  } else if (crit.length >= 2) {
    verdict = "likely"
    reasons.push(`Meets ${crit.length} of the nine WP248 criteria (${crit.map((o) => o.label.toLowerCase()).join("; ")}). The guidelines say a DPIA is required in most cases at two or more.`)
  } else if (crit.length === 1) {
    verdict = "borderline"
    reasons.push(`Meets one criterion (${crit[0].label.toLowerCase()}). A DPIA may not be required, but some single-criterion processing still needs one. Record your reasoning either way.`)
  } else {
    verdict = "not-indicated"
    reasons.push("No Art. 35(3) case and none of the nine criteria was selected.")
  }
  reasons.push("Also check your supervisory authority's own list of processing that always needs a DPIA (Art. 35(4)); national lists add cases.")

  const headline = {
    required: "A DPIA is required before processing starts",
    likely: "A DPIA is required in most cases like this",
    borderline: "A DPIA may not be required: document why",
    "not-indicated": "A DPIA is not indicated",
  }[verdict]

  const actions: DpiaResult["actions"] = []
  if (verdict === "required" || verdict === "likely") {
    actions.push(
      { text: "Run the DPIA before processing starts: describe the processing, assess necessity and proportionality, assess risks to people, and list the measures that address them", ref: "Art. 35(7)" },
      { text: "Ask your data protection officer for advice and record it", ref: "Art. 35(2)" },
      { text: "If high risk remains after the measures, consult the supervisory authority before you start", ref: "Art. 36" },
      { text: "Review the DPIA when the processing changes, including a new model or new data sources", ref: "Art. 35(11)" },
    )
  } else {
    actions.push({ text: "Keep a short written record of this screening and the reasons a DPIA is not needed", ref: "Art. 5(2)" })
  }
  if (a.solelyAutomated) actions.push(
    { text: "Solely automated decisions with legal or similar effect need an exception (contract, law or explicit consent), plus the right to human intervention, to express a view and to contest", ref: "Art. 22(2)–(3)" },
    { text: "Tell people the decision is automated and give meaningful information about the logic and its consequences", ref: "Art. 13(2)(f), 14(2)(g)" },
  )
  if (a.specialCategory || a.mandatory.includes("large-scale-special")) actions.push({ text: "Identify an Art. 9(2) condition for the special-category data; automated decisions on it are allowed only with explicit consent or substantial public interest", ref: "Art. 9(2), 22(4)" })
  if (a.vendorProcessor) actions.push({ text: "Sign a processing agreement with the AI vendor that covers sub-processors, retention, and whether your data trains their models", ref: "Art. 28" })
  if (a.transfersOutsideEea) actions.push({ text: "Put a transfer mechanism in place for data leaving the EEA (adequacy decision, the EU–US Data Privacy Framework, or standard contractual clauses with a transfer impact assessment)", ref: "Art. 44–46" })
  if (a.euAiActHighRisk) actions.push(
    { text: "As a deployer of a high-risk AI system, use the provider's instructions for use (Art. 13 information) in your DPIA", ref: "AI Act Art. 26(9)" },
    { text: "Public bodies, private entities providing public services, and deployers using credit scoring or life and health insurance pricing must also run a fundamental rights impact assessment; it can build on the DPIA", ref: "AI Act Art. 27" },
  )
  actions.push({ text: "Record the processing in your records of processing activities", ref: "Art. 30" })
  return { verdict, headline, reasons, actions }
}

export const EMPTY_DPIA: DpiaAnswers = {
  mandatory: [],
  criteria: [],
  solelyAutomated: false,
  specialCategory: false,
  vendorProcessor: true,
  transfersOutsideEea: false,
  euAiActHighRisk: false,
}

export function toMarkdown(a: DpiaAnswers, r: DpiaResult): string {
  return [
    `# GDPR DPIA screening: ${r.headline}`,
    "",
    "## Why",
    ...r.reasons.map((x) => `- ${x}`),
    "",
    "## What to do",
    ...r.actions.map((x) => `- ${x.text} (${x.ref})`),
    "",
    "Screening aid only, not legal advice. Generated at https://seyhunakyurek.com/tools/gdpr-dpia-screener",
  ].join("\n")
}
