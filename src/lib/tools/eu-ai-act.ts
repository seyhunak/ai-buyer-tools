// EU AI Act (Regulation (EU) 2024/1689) first-pass classifier.
// A screening aid, not legal advice: it maps answers to the Act's risk tiers
// and lists the obligations and dates that follow, with article references.

export type Role = "provider" | "deployer" | "importer" | "distributor"

export type Answers = {
  role: Role
  inScope: boolean // placed on the EU market, put into service in the EU, or output used in the EU (Art. 2)
  exemption: "none" | "military" | "research" | "personal" // Art. 2(3), 2(6), 2(10)
  prohibited: string[] // ids from PROHIBITED
  annexI: boolean // safety component of a product under Annex I legislation needing third-party conformity assessment
  annexIII: string[] // ids from ANNEX_III
  derogation: boolean // Art. 6(3): narrow procedural / preparatory task, no material influence on the decision
  profiling: boolean // profiles natural persons (blocks the Art. 6(3) derogation)
  transparency: string[] // ids from TRANSPARENCY
  gpaiProvider: boolean // you place a general-purpose AI model on the market
  gpaiSystemic: boolean // trained with > 10^25 FLOPs or designated as systemic-risk
}

export type Option = { id: string; label: string; ref: string }

export const PROHIBITED: Option[] = [
  { id: "manipulation", label: "Subliminal, manipulative or deceptive techniques that materially distort behaviour and cause significant harm", ref: "Art. 5(1)(a)" },
  { id: "vulnerabilities", label: "Exploiting vulnerabilities due to age, disability or social or economic situation", ref: "Art. 5(1)(b)" },
  { id: "social-scoring", label: "Social scoring that leads to detrimental or unfavourable treatment", ref: "Art. 5(1)(c)" },
  { id: "crime-prediction", label: "Predicting a person's risk of committing a crime based solely on profiling or personality traits", ref: "Art. 5(1)(d)" },
  { id: "face-scraping", label: "Building facial recognition databases by untargeted scraping of images from the internet or CCTV", ref: "Art. 5(1)(e)" },
  { id: "emotion-work-edu", label: "Inferring emotions in the workplace or in education (except for medical or safety reasons)", ref: "Art. 5(1)(f)" },
  { id: "biometric-categorisation", label: "Biometric categorisation to infer race, political opinions, union membership, religion, sex life or sexual orientation", ref: "Art. 5(1)(g)" },
  { id: "realtime-rbi", label: "Real-time remote biometric identification in publicly accessible spaces for law enforcement (outside the narrow exceptions)", ref: "Art. 5(1)(h)" },
]

export const ANNEX_III: Option[] = [
  { id: "biometrics", label: "Biometrics: remote biometric identification, biometric categorisation, emotion recognition", ref: "Annex III(1)" },
  { id: "critical-infrastructure", label: "Safety components of critical infrastructure (digital infrastructure, road traffic, water, gas, heating, electricity)", ref: "Annex III(2)" },
  { id: "education", label: "Education: admission, assessing learning outcomes, steering learning, proctoring", ref: "Annex III(3)" },
  { id: "employment", label: "Employment: recruitment, screening CVs, promotion or termination decisions, task allocation, monitoring workers", ref: "Annex III(4)" },
  { id: "essential-services", label: "Essential services: public benefits eligibility, creditworthiness or credit scoring, life and health insurance risk and pricing, emergency call triage", ref: "Annex III(5)" },
  { id: "law-enforcement", label: "Law enforcement: victim risk, polygraph-type tools, evidence reliability, re-offending risk, profiling", ref: "Annex III(6)" },
  { id: "migration", label: "Migration, asylum and border control: risk assessment, application examination, identification", ref: "Annex III(7)" },
  { id: "justice-democracy", label: "Administration of justice and democratic processes, including influencing elections", ref: "Annex III(8)" },
]

export const TRANSPARENCY: Option[] = [
  { id: "interacts", label: "Interacts directly with people (chatbot, voice agent)", ref: "Art. 50(1)" },
  { id: "synthetic", label: "Generates synthetic audio, image, video or text", ref: "Art. 50(2)" },
  { id: "emotion-biometric", label: "Uses emotion recognition or biometric categorisation (where not prohibited)", ref: "Art. 50(3)" },
  { id: "deepfake", label: "Produces deepfakes, or text published to inform the public on matters of public interest", ref: "Art. 50(4)" },
]

export type Tier = "out-of-scope" | "exempt" | "prohibited" | "high-risk" | "limited" | "minimal"

export type Obligation = { text: string; ref: string; from: string }
export type Result = {
  tier: Tier
  headline: string
  reasons: string[]
  obligations: Obligation[]
  gpai: Obligation[]
  penalty: string | null
}

// Application dates from Art. 113.
export const DATES = {
  prohibitions: "2 February 2025",
  gpai: "2 August 2025",
  general: "2 August 2026",
  annexI: "2 August 2027",
} as const

const pick = (all: Option[], ids: string[]) => all.filter((o) => ids.includes(o.id))

export function classify(a: Answers): Result {
  const literacy: Obligation = { text: "Make sure staff who operate or use the system have sufficient AI literacy", ref: "Art. 4", from: DATES.prohibitions }

  if (!a.inScope) {
    return { tier: "out-of-scope", headline: "Likely outside the Act's territorial scope", reasons: ["The system is not placed on the EU market or put into service in the EU, and its output is not used in the EU (Art. 2(1))."], obligations: [], gpai: [], penalty: null }
  }
  if (a.exemption !== "none") {
    const why = {
      military: "Used exclusively for military, defence or national-security purposes (Art. 2(3)).",
      research: "Developed and put into service solely for scientific research and development (Art. 2(6)).",
      personal: "Used by a natural person in a purely personal, non-professional activity (Art. 2(10)).",
    }[a.exemption]
    return { tier: "exempt", headline: "Likely exempt from the Act", reasons: [why], obligations: [], gpai: [], penalty: null }
  }

  const gpai: Obligation[] = a.gpaiProvider
    ? [
        { text: "Keep technical documentation of the model and give downstream providers the information they need", ref: "Art. 53(1)(a)–(b)", from: DATES.gpai },
        { text: "Put in place a policy to comply with EU copyright law, including text-and-data-mining opt-outs", ref: "Art. 53(1)(c)", from: DATES.gpai },
        { text: "Publish a sufficiently detailed summary of the training content", ref: "Art. 53(1)(d)", from: DATES.gpai },
        ...(a.gpaiSystemic
          ? [
              { text: "Evaluate the model, including adversarial testing, and assess and mitigate systemic risks", ref: "Art. 55(1)(a)–(b)", from: DATES.gpai },
              { text: "Track and report serious incidents to the AI Office; ensure adequate cybersecurity", ref: "Art. 55(1)(c)–(d)", from: DATES.gpai },
            ]
          : []),
      ]
    : []

  const prohibited = pick(PROHIBITED, a.prohibited)
  if (prohibited.length) {
    return {
      tier: "prohibited",
      headline: "Prohibited practice: this use cannot be placed on the EU market",
      reasons: prohibited.map((p) => `${p.label} (${p.ref}).`),
      obligations: [{ text: "Stop or redesign the use. Prohibitions have applied since 2 February 2025", ref: "Art. 5", from: DATES.prohibitions }, literacy],
      gpai,
      penalty: "Up to €35 million or 7% of worldwide annual turnover, whichever is higher (Art. 99(3)).",
    }
  }

  const annexIII = pick(ANNEX_III, a.annexIII)
  const derogates = annexIII.length > 0 && !a.annexI && a.derogation && !a.profiling
  const highRisk = a.annexI || (annexIII.length > 0 && !derogates)
  const transparency = pick(TRANSPARENCY, a.transparency)
  const transparencyObligations: Obligation[] = transparency.map((t) => ({
    text: {
      interacts: "Provider: tell people they are interacting with an AI system, unless that is obvious from the context",
      synthetic: "Provider: mark synthetic output in a machine-readable format so it is detectable as AI-generated",
      "emotion-biometric": "Deployer: inform the people exposed to the system that it is operating",
      deepfake: "Deployer: disclose that the content has been artificially generated or manipulated",
    }[t.id as "interacts" | "synthetic" | "emotion-biometric" | "deepfake"],
    ref: t.ref,
    from: DATES.general,
  }))

  if (highRisk) {
    const from = a.annexI ? DATES.annexI : DATES.general
    const reasons = [
      ...(a.annexI ? ["Safety component of a product covered by Annex I legislation that needs third-party conformity assessment (Art. 6(1))."] : []),
      ...annexIII.map((o) => `${o.label} (${o.ref}, Art. 6(2)).`),
      ...(annexIII.length && a.derogation && a.profiling ? ["The Art. 6(3) derogation does not apply because the system profiles natural persons."] : []),
    ]
    const providerDuties: Obligation[] = [
      { text: "Run a risk management system across the lifecycle", ref: "Art. 9", from },
      { text: "Govern training, validation and test data for quality and bias", ref: "Art. 10", from },
      { text: "Draw up technical documentation and keep automatic logs", ref: "Arts. 11–12", from },
      { text: "Give deployers clear instructions for use", ref: "Art. 13", from },
      { text: "Design for effective human oversight", ref: "Art. 14", from },
      { text: "Achieve appropriate accuracy, robustness and cybersecurity", ref: "Art. 15", from },
      { text: "Operate a quality management system", ref: "Art. 17", from },
      { text: "Complete conformity assessment, sign the EU declaration of conformity, affix CE marking, register in the EU database", ref: "Arts. 43, 47–49", from },
      { text: "Monitor after placing on the market and report serious incidents", ref: "Arts. 72–73", from },
    ]
    const deployerDuties: Obligation[] = [
      { text: "Use the system according to the provider's instructions", ref: "Art. 26(1)", from },
      { text: "Assign human oversight to competent, trained people", ref: "Art. 26(2)", from },
      { text: "Make sure input data you control is relevant and representative", ref: "Art. 26(4)", from },
      { text: "Monitor operation, keep logs for at least six months, report serious incidents", ref: "Art. 26(5)–(6)", from },
      { text: "Inform workers' representatives before using it at work; inform people subject to decisions", ref: "Art. 26(7), (11)", from },
      { text: "Public bodies, and providers of public services, credit scoring or life and health insurance pricing: run a fundamental rights impact assessment", ref: "Art. 27", from },
      { text: "Explain individual decisions on request", ref: "Art. 86", from },
    ]
    const importerDuties: Obligation[] = [
      { text: "Verify the provider has done conformity assessment, documentation and CE marking before placing on the market", ref: a.role === "importer" ? "Art. 23" : "Art. 24", from },
      { text: "Do not place a non-conforming system on the market; keep documentation available to authorities", ref: a.role === "importer" ? "Art. 23" : "Art. 24", from },
    ]
    const duties = a.role === "provider" ? providerDuties : a.role === "deployer" ? deployerDuties : importerDuties
    return {
      tier: "high-risk",
      headline: a.annexI ? "High-risk under Annex I (product safety)" : "High-risk under Annex III",
      reasons,
      obligations: [...duties, ...transparencyObligations, literacy],
      gpai,
      penalty: "Up to €15 million or 3% of worldwide annual turnover for breaching these obligations (Art. 99(4)).",
    }
  }

  if (transparency.length) {
    return {
      tier: "limited",
      headline: "Limited risk: transparency obligations apply",
      reasons: [
        ...(derogates ? ["Listed in Annex III, but the Art. 6(3) derogation appears to apply. Document that assessment before placing it on the market, and register it (Art. 6(4), Art. 49(2))."] : []),
        ...transparency.map((t) => `${t.label} (${t.ref}).`),
      ],
      obligations: [...transparencyObligations, literacy],
      gpai,
      penalty: "Up to €15 million or 3% of worldwide annual turnover (Art. 99(4)).",
    }
  }

  return {
    tier: "minimal",
    headline: "Minimal risk: no specific obligations beyond AI literacy",
    reasons: [
      ...(derogates ? ["Listed in Annex III, but the Art. 6(3) derogation appears to apply. Document that assessment and register the system (Art. 6(4), Art. 49(2))."] : []),
      "No prohibited practice, no high-risk use and no transparency trigger was selected. Voluntary codes of conduct are encouraged (Art. 95).",
    ],
    obligations: [literacy],
    gpai,
    penalty: null,
  }
}

export const EMPTY_ANSWERS: Answers = {
  role: "deployer",
  inScope: true,
  exemption: "none",
  prohibited: [],
  annexI: false,
  annexIII: [],
  derogation: false,
  profiling: false,
  transparency: [],
  gpaiProvider: false,
  gpaiSystemic: false,
}

/** Markdown summary for pasting into a ticket or an email. */
export function toMarkdown(a: Answers, r: Result): string {
  const lines = [
    `# EU AI Act screening: ${r.headline}`,
    "",
    `Role: ${a.role}. Tier: ${r.tier}.`,
    "",
    "## Why",
    ...r.reasons.map((x) => `- ${x}`),
  ]
  if (r.obligations.length) lines.push("", "## Obligations", ...r.obligations.map((o) => `- ${o.text} (${o.ref}; applies from ${o.from})`))
  if (r.gpai.length) lines.push("", "## General-purpose AI model obligations", ...r.gpai.map((o) => `- ${o.text} (${o.ref}; applies from ${o.from})`))
  if (r.penalty) lines.push("", `Penalty exposure: ${r.penalty}`)
  lines.push("", "Screening aid only, not legal advice. Generated at https://seyhunakyurek.com/tools/eu-ai-act-compliance-auditor")
  return lines.join("\n")
}
