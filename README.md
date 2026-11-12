# AI buyer tools

Eleven free, single-purpose tools for practical AI decisions. Hosted at **https://seyhunakyurek.com/tools**. Run or host your own copy from this repo.

| tool | what it answers |
|---|---|
| [AI ROI & token cost estimator](https://seyhunakyurek.com/tools/ai-token-cost-estimator) | Monthly Claude API cost, cost per task and ROI for a workload |
| [EU AI Act compliance auditor](https://seyhunakyurek.com/tools/eu-ai-act-compliance-auditor) | Risk tier, obligations and dates for one AI system |
| [Agent workflow fit scorer](https://seyhunakyurek.com/tools/agent-workflow-fit-scorer) | Is this process a good fit for AI agents, and what shape? |
| [AI build vs buy calculator](https://seyhunakyurek.com/tools/ai-build-vs-buy-calculator) | Three-year cost: SaaS tool, custom agents, or keep it manual |
| [AI accuracy proof calculator](https://seyhunakyurek.com/tools/ai-accuracy-proof-calculator) | How many test cases prove a vendor's accuracy claim? |
| [AI model routing calculator](https://seyhunakyurek.com/tools/ai-model-routing-calculator) | What sending each request to the cheapest capable model saves |
| [Human review staffing calculator](https://seyhunakyurek.com/tools/human-review-staffing-calculator) | How many reviewers an AI workflow's escalations need |
| [AI vendor scorecard](https://seyhunakyurek.com/tools/ai-vendor-scorecard) | Weighted comparison of AI vendors, with must-haves and a swing check |
| [GDPR DPIA screener for AI](https://seyhunakyurek.com/tools/gdpr-dpia-screener) | Does this AI use of personal data need a DPIA? |
| [Agent loop cost calculator](https://seyhunakyurek.com/tools/agent-loop-cost-calculator) | What a tool-calling agent costs per task as its context grows |
| [LLM judge agreement calculator](https://seyhunakyurek.com/tools/llm-judge-agreement-calculator) | Does your LLM judge agree with people beyond chance? Cohen's kappa |

Everything runs in the browser. Nothing you type is sent anywhere.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for every calculation
npm run build    # static site in dist/; host it on any static host
```

Links use hash routes (`#/ai-token-cost-estimator`), so `dist/` works from any folder or bucket. The token cost estimator reads its inputs from the URL, so you can send a pre-filled link: `#/ai-token-cost-estimator?model=claude-sonnet-5-5&requests=20000&input=6000&output=800&cached=50&batch=0`. In this standalone build, put the query before the hash (`?model=…#/ai-token-cost-estimator`).

## Where things live

- `src/lib/tools/`: the calculations, as plain TypeScript with no UI. Use them on a server, in a spreadsheet export, or in another app.
  - `pricing.ts`: Claude API list prices, with the date they were checked. Update these first.
  - `token-cost.ts`: the monthly bill with prompt caching and Batch API discounts, and the ROI.
  - `eu-ai-act.ts`: Regulation (EU) 2024/1689 screening, with obligations by role and article references.
  - `workflow-fit.ts`: the weighted fit score and the suggested workflow shape.
  - `build-vs-buy.ts`: cumulative cost of ownership and break-even month.
  - `accuracy.ts`: Wilson intervals, sample size, the zero-failure rule.
  - `model-routing.ts`: cost of routing requests between model tiers versus one model, with router calls, retries and the break-even retry rate.
  - `review-staffing.ts`: Erlang C staffing for a human review queue, with shrinkage and cost per review.
  - `vendor-scorecard.ts`: weighted vendor scoring, must-have knockouts and the swing check.
  - `dpia.ts`: GDPR Art. 35 DPIA screening against the WP248 criteria, with the obligations that follow.
  - `agent-loop.ts`: turn-by-turn cost of a tool-calling agent loop as its context grows, with incremental prompt caching and the context-window limit.
  - `judge-agreement.ts`: Cohen's kappa between an LLM judge and human labels, with an interval, PABAK, catch and false-alarm rates.
- `src/components/tools/`: the React UI, one component per tool, styled by `tools.css` and `src/theme.css`.
- `tests/tools.test.mjs`: unit tests, including textbook values for the statistics.

## Caveats

- **Prices change.** Check `pricing.ts` against https://platform.claude.com/docs/en/about-claude/pricing.
- **The EU AI Act and GDPR DPIA tools are screening aids, not legal advice.** National data protection authorities publish their own DPIA lists (Art. 35(4)).
- **The EU AI Act tool** The Commission's Digital Omnibus proposal (November 2025) would move the high-risk dates. Check whether it has been adopted.
- **The fit scorer's weights and savings shares are judgement calls.** They are in the code so you can change them.

## License

MIT. Built by [Seyhun Akyürek](https://seyhunakyurek.com). For help applying these numbers to your own processes, see https://seyhunakyurek.com/contact.
