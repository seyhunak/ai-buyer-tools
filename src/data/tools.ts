// Free, single-purpose tools at /tools/<slug>. Logic lives in src/lib/tools/*,
// UI in src/components/tools/*. The same code is published at TOOLS_REPO.
export const TOOLS_REPO = "https://github.com/seyhunak/ai-buyer-tools"
export const POSTS_REPO = "https://github.com/seyhunak/agent-architecture-teardowns"

export type Tool = {
  slug: string
  name: string
  short: string // one line for cards and nav
  description: string // meta description, under ~160 chars
  intro: string // first paragraph on the page
  faqs: { q: string; a: string }[]
}

export const tools: Tool[] = [
  {
    slug: "ai-token-cost-estimator",
    name: "AI ROI & token cost estimator",
    short: "Monthly Claude API cost, cost per task and ROI for a workload",
    description: "Estimate monthly Claude API cost, cost per task and ROI for an AI workload, with prompt caching and Batch API discounts, at current list prices.",
    intro: "Put in how many requests a month, how big they are, and how much of each prompt repeats. You get the monthly API bill per model, the cost of a single task, and what the time saved is worth, so you can see whether the use case pays before anyone writes code.",
    faqs: [
      { q: "Which prices does it use?", a: "Anthropic's published Claude API list prices per million tokens, including the 5-minute cache-write and cache-read rates. The Batch API takes 50% off every token class. The check date is shown under the table." },
      { q: "What counts as a cached token?", a: "The part of the prompt that is identical across requests, such as a long system prompt, a policy document or tool definitions. Cache reads bill at a small fraction of the input price. Each time the cache expires, the prefix is written again at the cache-write rate." },
      { q: "Does it include thinking tokens?", a: "Count them in output tokens. Extended and adaptive thinking bill as output, so a reasoning-heavy step needs a bigger output allowance than its visible answer." },
      { q: "Can I share a scenario?", a: "Yes. The URL updates as you type, so a link reopens the same numbers." },
    ],
  },
  {
    slug: "eu-ai-act-compliance-auditor",
    name: "EU AI Act compliance auditor",
    short: "Risk tier, obligations and dates for one AI system",
    description: "Answer a few questions about one AI system and get its EU AI Act risk tier, the obligations for your role, the dates they apply, and article references.",
    intro: "Describe one AI system: what it does, who it affects, and whether you build it or use it. The auditor works through the Act's own order of tests (scope, prohibited practices, high-risk, transparency) and lists what you would have to do, with article numbers you can check.",
    faqs: [
      { q: "Is this legal advice?", a: "No. It is a screening aid that mirrors the structure of Regulation (EU) 2024/1689. Use it to decide what to take to counsel, not as the final word." },
      { q: "When do the obligations apply?", a: "Prohibitions and AI literacy from 2 February 2025; general-purpose AI model rules from 2 August 2025; most other provisions, including Annex III high-risk systems and transparency, from 2 August 2026; high-risk systems under Annex I from 2 August 2027. The Commission's Digital Omnibus proposal of November 2025 would push the high-risk dates back. Check whether it has been adopted before you plan around them." },
      { q: "What is the Article 6(3) derogation?", a: "An Annex III system is not high-risk if it only performs a narrow procedural or preparatory task, or improves the result of work a person already did, and does not materially influence the decision. It never applies when the system profiles people. You must document that assessment." },
      { q: "Is anything I enter stored?", a: "No. Everything runs in your browser; nothing is sent to a server." },
    ],
  },
  {
    slug: "agent-workflow-fit-scorer",
    name: "Agent workflow fit scorer",
    short: "Is this process a good fit for AI agents, and what shape?",
    description: "Score how well a business process fits an AI agent workflow, see the hours it could save, and get a suggested architecture: full automation, review, or copilot.",
    intro: "Rate one process on six things that decide whether agents will work: how clear the rules are, how clean the inputs are, how often exceptions happen, what an error costs, whether systems have APIs, and whether past cases exist. You get a score, the workflow shape that fits, and the risks to fix first.",
    faqs: [
      { q: "How is the score calculated?", a: "A weighted average of the six ratings (rule clarity carries the most weight, and a high error cost counts against the fit), adjusted up or down by the monthly volume of work. The weights are in the open-source code." },
      { q: "What do the patterns mean?", a: "Full automation runs straight through with sampled quality checks. Agent with review prepares everything and a person approves. Copilot drafts and a person decides. Not yet means fix the inputs or write the rules down first." },
      { q: "Where do the hours saved come from?", a: "Today's volume times handling time, multiplied by a typical share of that time each pattern removes: 85%, 65%, 35% and 10%. Treat it as a starting estimate to test in a pilot." },
    ],
  },
  {
    slug: "ai-build-vs-buy-calculator",
    name: "AI build vs buy calculator",
    short: "Three-year cost: SaaS tool, custom agents, or keep it manual",
    description: "Compare the three-year cost of buying a SaaS AI tool, building a custom agent workflow, or keeping the work manual, with break-even months and a cumulative chart.",
    intro: "Most AI build-versus-buy debates compare a licence fee with a build quote. The real comparison includes the labour each option leaves behind, the running cost, and maintenance. This calculator puts all three paths on one cumulative chart and tells you when, if ever, building pays back.",
    faqs: [
      { q: "Why is the manual option included?", a: "Because it's the baseline both other options must beat. A tool that removes a quarter of the work still leaves three quarters of the labour bill." },
      { q: "What should maintenance be?", a: "15–25% of the build cost a year is typical for prompt and model updates, evaluation runs, and integration fixes when connected systems change." },
      { q: "Does it discount future costs?", a: "No. It shows plain cumulative cash so the numbers are easy to check. For a three-year horizon the ranking rarely changes." },
    ],
  },
  {
    slug: "ai-accuracy-proof-calculator",
    name: "AI accuracy proof calculator",
    short: "How many test cases prove a vendor's accuracy claim?",
    description: "Check whether an AI vendor's accuracy claim is backed by their test set, and how many test cases you need to prove a target accuracy, using Wilson intervals.",
    intro: "\"95% accurate\" means little without the size of the test. Enter what a vendor measured and the calculator shows the range the true accuracy plausibly sits in, whether that proves their claim, and how many cases a fair test would need.",
    faqs: [
      { q: "Why the Wilson interval?", a: "It stays accurate near 0% and 100%, where AI accuracy figures usually sit and where the simple normal approximation gives impossible ranges." },
      { q: "What is the zero-failure rule?", a: "If a system passes every one of n tests, you can claim accuracy of at least p with confidence c once n ≥ ln(1−c)/ln(p). At 95% confidence that is 59 straight passes for 95% accuracy, and 299 for 99%." },
      { q: "Does a big test set make the claim true?", a: "Only if the cases look like your real work. A thousand easy cases prove nothing about your hard ones. Build the test set from your own data, including the exceptions." },
    ],
  },
]

export const getTool = (slug: string) => tools.find((t) => t.slug === slug) ?? null
