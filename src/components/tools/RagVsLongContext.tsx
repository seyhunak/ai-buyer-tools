"use client"
import { useMemo } from "react"
import { useUrlState } from "./useUrlState"
import { CONTEXT_WINDOW, DAYS_PER_MONTH, DEFAULT_RAG, compareRag, type RagInput } from "@/lib/tools/rag-vs-long-context"
import { MODELS, PRICES_CHECKED } from "@/lib/tools/pricing"
import { NumberField, Stat, num, usd } from "./fields"

const rate = (v: number) => `$${v}`

export default function RagVsLongContext() {
  const [v, setV] = useUrlState<RagInput>("v", DEFAULT_RAG)
  const set = (k: keyof RagInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => compareRag(v), [v])
  const lc = r.longContext, rag = r.rag
  const q = v.queriesPerMonth
  const C = num(v.corpusTokens)
  const longTier = lc.price.id === "claude-haiku-5-5-long"

  const verdict = !lc.fits
    ? `the corpus doesn't fit in a ${num(CONTEXT_WINDOW / 1000)}K window: use rag`
    : r.verdict === "tie"
      ? "both cost the same at this volume"
      : r.verdict === "long-context"
        ? `long context is cheaper by ${usd(r.difference)} a month`
        : `rag is cheaper by ${usd(r.difference)} a month`

  const breakEvenText = !lc.fits
    ? "none: long context can't run"
    : r.breakEvens.length === 0
      ? "none"
      : r.breakEvens.map((x) => num(Math.round(x))).join(" and ")

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Workload">
        <fieldset className="tl-fieldset">
          <legend>the workload</legend>
          <label className="tl-field" htmlFor="rl-model">
            <span>Model</span>
            <select id="rl-model" className="tl-select" value={v.model} onChange={(e) => setV((s) => ({ ...s, model: e.target.value }))}>
              {MODELS.filter((m) => m.id !== "claude-haiku-5-5-long").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="tl-row">
            <NumberField id="rl-q" label="Queries per month" value={v.queriesPerMonth} onChange={set("queriesPerMonth")} step={1000} />
            <NumberField id="rl-corpus" label="Corpus size (tokens)" value={v.corpusTokens} onChange={set("corpusTokens")} step={10000} hint="the whole manual, nomenclature or contract set" />
            <NumberField id="rl-query" label="Query + instructions (tokens)" value={v.queryTokens} onChange={set("queryTokens")} step={100} />
            <NumberField id="rl-out" label="Output per query (tokens)" value={v.outputTokens} onChange={set("outputTokens")} step={50} hint="include thinking" />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>long context</legend>
          <NumberField id="rl-writes" label="Cache writes per day" value={v.cacheWritesPerDay} onChange={set("cacheWritesPerDay")} step={5}
            hint="how often traffic resumes after a pause of more than 5 minutes; each time, the corpus is written to the cache again" />
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>rag</legend>
          <div className="tl-row">
            <NumberField id="rl-k" label="Chunks retrieved per query" value={v.chunksPerQuery} onChange={set("chunksPerQuery")} />
            <NumberField id="rl-chunk" label="Chunk size (tokens)" value={v.chunkTokens} onChange={set("chunkTokens")} step={100} />
            <NumberField id="rl-embed" label="Embedding price per million tokens ($)" value={v.embedPricePerM} onChange={set("embedPricePerM")} step={0.01} hint="estimate: hosted models run about $0.02–0.13" />
            <NumberField id="rl-db" label="Vector database / hosting per month ($)" value={v.vectorDbPerMonth} onChange={set("vectorDbPerMonth")} step={10} />
            <NumberField id="rl-reindex" label="Full re-indexes per month" value={v.reindexesPerMonth} onChange={set("reindexesPerMonth")} hint="the corpus re-embedded when it changes" />
            <NumberField id="rl-build" label="Extra build cost, one-off ($)" value={v.ragBuildCost} onChange={set("ragBuildCost")} step={500} hint="chunking, retrieval and evaluation work long context doesn't need" />
            <NumberField id="rl-amort" label="Spread one-off costs over (months)" value={v.amortiseMonths} onChange={set("amortiseMonths")} min={1} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">{verdict}</p>
          <div className="tl-stats">
            <Stat label="long context per month" value={lc.fits ? usd(lc.monthly) : "doesn't fit"} signal={lc.fits && r.verdict === "long-context"} />
            <Stat label="rag per month" value={usd(rag.monthly)} signal={r.verdict === "rag"} />
            <Stat label="long context per query" value={lc.fits ? usd(lc.perQuery, 4) : "n/a"} />
            <Stat label="rag per query, fixed costs included" value={usd(rag.costPerQuery, 4)} />
            <Stat label="break-even, queries a month" value={breakEvenText} />
            <Stat label="rag one-off cost" value={usd(rag.oneOff)} />
          </div>
          <div>
            <p className="label">the arithmetic</p>
            <ul className="tl-list">
              <li>
                Long context ({lc.price.name}, {num(lc.promptTokens)}-token prompt): {num(lc.writes)} cache writes ({num(v.cacheWritesPerDay)} a day × {DAYS_PER_MONTH}, at most one per query) × {C} tokens × {rate(lc.price.cacheWrite)}/M = {usd(lc.writeCost, 2)}; {num(lc.reads)} cache reads × {C} × {rate(lc.price.cacheRead)}/M = {usd(lc.readCost, 2)}; {num(q)} queries × ({num(v.queryTokens)} × {rate(lc.price.input)}/M + {num(v.outputTokens)} × {rate(lc.price.output)}/M) = {usd(q * lc.perQueryRest, 2)}. Total {usd(lc.monthly, 2)}.
              </li>
              <li>
                RAG ({rag.price.name}, {num(rag.promptTokens)}-token prompt): {num(q)} queries × (({num(v.queryTokens)} + {num(v.chunksPerQuery)} × {num(v.chunkTokens)}) × {rate(rag.price.input)}/M + {num(v.outputTokens)} × {rate(rag.price.output)}/M + {num(v.queryTokens)} × {rate(v.embedPricePerM)}/M embedding) = {usd(q * rag.perQuery, 2)}; vector store {usd(rag.vectorDb, 2)}; re-indexing {num(v.reindexesPerMonth)} × {C} × {rate(v.embedPricePerM)}/M = {usd(rag.reindex, 2)}; one-off ({C} × {rate(v.embedPricePerM)}/M + {usd(v.ragBuildCost)}) ÷ {num(Math.max(1, v.amortiseMonths))} months = {usd(rag.oneOffMonthly, 2)}. Total {usd(rag.monthly, 2)}.
              </li>
              {lc.fits && (
                <li>
                  Break-even: the volume where both totals match. Below {num(v.cacheWritesPerDay * DAYS_PER_MONTH)} queries a month every query writes the cache, so long context costs {usd((v.corpusTokens * lc.price.cacheWrite) / 1e6 + lc.perQueryRest, 4)} a query; above it, {usd((v.corpusTokens * lc.price.cacheRead) / 1e6 + lc.perQueryRest, 4)}. RAG costs {usd(rag.fixedMonthly, 2)} a month before its first query, then {usd(rag.perQuery, 4)} a query.
                </li>
              )}
            </ul>
          </div>
          <p className="tl-note">
            {!lc.fits && `${num(lc.promptTokens + v.outputTokens)} tokens of corpus, query and answer exceed the ${num(CONTEXT_WINDOW)}-token context window, so only RAG (or splitting the corpus) can work. `}
            {longTier && "The long-context prompt is over 100K tokens, so Haiku 5.5 bills it at its long-context rate. "}
            Cost is not the only difference. Long context sees the whole corpus, so nothing is lost to a retrieval miss and questions that span sections work. RAG scales past the context window, keeps prompts short and fast, and cites the chunks it used. Claude API list prices, checked {PRICES_CHECKED}; cache writes at the 5-minute rate. Embedding and hosting prices are estimates: change them to your provider&apos;s.
          </p>
        </section>
      </div>
    </div>
  )
}
