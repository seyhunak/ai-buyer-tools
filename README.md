# AI buyer tools

Five free, single-purpose tools for practical AI decisions. Hosted at **https://seyhunakyurek.com/tools**. Run or host your own copy from this repo.

| tool | what it answers |
|---|---|
| [AI ROI & token cost estimator](https://seyhunakyurek.com/tools/ai-token-cost-estimator) | Monthly Claude API cost, cost per task and ROI for a workload |
| [EU AI Act compliance auditor](https://seyhunakyurek.com/tools/eu-ai-act-compliance-auditor) | Risk tier, obligations and dates for one AI system |
| [Agent workflow fit scorer](https://seyhunakyurek.com/tools/agent-workflow-fit-scorer) | Is this process a good fit for AI agents, and what shape? |
| [AI build vs buy calculator](https://seyhunakyurek.com/tools/ai-build-vs-buy-calculator) | Three-year cost: SaaS tool, custom agents, or keep it manual |
| [AI accuracy proof calculator](https://seyhunakyurek.com/tools/ai-accuracy-proof-calculator) | How many test cases prove a vendor's accuracy claim? |

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
- `src/components/tools/`: the React UI, one component per tool, styled by `tools.css` and `src/theme.css`.
- `tests/tools.test.mjs`: unit tests, including textbook values for the statistics.

## Caveats

- **Prices change.** Check `pricing.ts` against https://platform.claude.com/docs/en/about-claude/pricing.
- **The EU AI Act tool is a screening aid, not legal advice.** The Commission's Digital Omnibus proposal (November 2025) would move the high-risk dates. Check whether it has been adopted.
- **The fit scorer's weights and savings shares are judgement calls.** They are in the code so you can change them.

## License

MIT. Built by [Seyhun Akyürek](https://seyhunakyurek.com). For help applying these numbers to your own processes, see https://seyhunakyurek.com/contact.
