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
  {
    slug: "ai-model-routing-calculator",
    name: "AI model routing calculator",
    short: "What sending each request to the cheapest capable model saves",
    description: "See what routing requests between Haiku, Sonnet and Opus saves against one model for everything, including the router call and retries.",
    intro: "Most workloads are a mix: many easy requests, some ordinary ones, a few hard ones. Sending them all to the strongest model is simple and expensive. Put in your mix and the calculator shows what a router saves after paying for the routing call and for the requests that fail on a cheap model and have to run again.",
    faqs: [
      { q: "How does the router decide?", a: "Usually a small, fast model (or plain rules) reads the request, or its first part, and labels it simple, standard or hard. The cost of that call is included. Rules cost nothing per request, so set the router's tokens to zero if you route with code." },
      { q: "What is the retry rate?", a: "The share of requests a cheaper model gets wrong, or flags as low confidence, that you then rerun one tier up. You pay for both attempts. The calculator shows the retry rate at which routing stops paying, so you know what to measure in a pilot." },
      { q: "Does it include prompt caching?", a: "Cache reads, yes: set the share of input served from cache. Cache writes are left out because they depend on traffic patterns; the token cost estimator includes them." },
      { q: "Which prices does it use?", a: "Claude API list prices per million tokens, the same table as the token cost estimator, with the date they were checked. Haiku prompts over 100K tokens bill at its long-context rate." },
    ],
  },
  {
    slug: "human-review-staffing-calculator",
    name: "Human review staffing calculator",
    short: "How many reviewers an AI workflow's escalations need",
    description: "Work out how many people you need to review the cases an AI workflow escalates, within a response-time target, using Erlang C queueing.",
    intro: "Every agent workflow with a human checkpoint creates a queue. Divide the review hours by a working month and you get the naive answer, which misses the target every busy afternoon. This calculator uses Erlang C, the model contact centres staff with, to find the reviewers you need at the busiest hour to pick cases up on time, then adds shrinkage.",
    faqs: [
      { q: "What is Erlang C?", a: "A queueing formula for work that arrives at random and is handled first come, first served by a pool of people. From the arrival rate, the handling time and the number of people, it gives the chance a case waits and how long. It is the standard way to staff contact centres and works the same way for review queues." },
      { q: "What is shrinkage?", a: "The share of paid time people are not available to review: leave, sickness, training, meetings and breaks. 25–35% is common. Headcount is the reviewers needed on shift divided by one minus shrinkage." },
      { q: "Why plan for the busiest hour?", a: "Cases bunch up. If Monday mornings bring 1.6 times the average hour, staffing for the average means Monday's cases miss the target. Set the busiest-hour factor from your own arrival data." },
      { q: "What if the queue can wait a day?", a: "Then set a long pick-up target, such as 480 minutes. The answer falls towards the plain workload figure, because a queue with a slow target can absorb peaks." },
    ],
  },
  {
    slug: "ai-vendor-scorecard",
    name: "AI vendor scorecard",
    short: "Weighted comparison of AI vendors, with must-haves and a swing check",
    description: "Compare up to three AI vendors or build options on weighted criteria, rule out any that fail a must-have, and see which weights decide the result.",
    intro: "Vendor selections usually end in a weighted spreadsheet that nobody questions. This one does two extra things. A must-have rules a vendor out however well it scores elsewhere, and a swing check tells you which criteria decide the result, so you argue about the weights before the demos rather than after.",
    faqs: [
      { q: "How is the score calculated?", a: "A weighted average of the 1–5 scores, rescaled so all 1s is 0 and all 5s is 100. A weight of 0 leaves a criterion out." },
      { q: "What does the swing check do?", a: "For each criterion it lowers the weight by one point and reranks. If the winner changes or ties, that criterion is listed: the decision rests on it, so it deserves the most evidence." },
      { q: "How should I score accuracy?", a: "On a test set built from your own cases, with the hard ones included, run by every vendor under the same conditions. The accuracy proof calculator tells you how many cases you need for the result to mean something." },
      { q: "Should building in-house be one of the options?", a: "Usually, yes. It sets the bar on control, audit trail and exit, and the build vs buy calculator gives you its three-year cost." },
    ],
  },
  {
    slug: "gdpr-dpia-screener",
    name: "GDPR DPIA screener for AI",
    short: "Does this AI use of personal data need a DPIA?",
    description: "Check whether an AI system's use of personal data needs a GDPR data protection impact assessment, and what else applies, with article references.",
    intro: "Under GDPR, processing that is likely to be high risk needs a data protection impact assessment before it starts. AI projects meet the tests more often than teams expect, because the guidelines list new technology as a criterion. Tick what applies and the screener tells you whether a DPIA is required and what else to put in place, with the articles to check.",
    faqs: [
      { q: "When is a DPIA mandatory?", a: "Always for the three cases in Art. 35(3): systematic automated evaluation with legal or similar effects, large-scale special-category or criminal data, and large-scale monitoring of public areas. Beyond those, the WP29 guidelines endorsed by the EDPB say processing that meets two of nine criteria needs one in most cases." },
      { q: "Does using an LLM always need a DPIA?", a: "No. Using new technology is one criterion, so an LLM that processes personal data meets one already. Add a second, such as profiling, sensitive data or large scale, and a DPIA is usually required." },
      { q: "How does this relate to the EU AI Act?", a: "Deployers of high-risk AI systems must use the provider's instructions for use in their DPIA (Art. 26(9)), and some deployers must also run a fundamental rights impact assessment (Art. 27). The EU AI Act auditor works out whether a system is high-risk." },
      { q: "Is this legal advice?", a: "No. It is a screening aid. National supervisory authorities publish their own lists of processing that always needs a DPIA, so check yours and take the result to your data protection officer." },
    ],
  },
]

export const getTool = (slug: string) => tools.find((t) => t.slug === slug) ?? null
