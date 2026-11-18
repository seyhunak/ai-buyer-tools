// Q&A or extraction over a fixed reference corpus: put the whole corpus in every
// prompt and let prompt caching absorb the repeat, or retrieve the top-k chunks
// per query (RAG) and pay for embeddings and a vector store instead.
//
// Long context, per month:
//   every query re-reads the corpus. The corpus is the cached prefix. A cache entry
//   lives 5 minutes and each hit refreshes it, so the corpus is written (at the
//   cache-write rate) once each time traffic resumes after a gap of more than
//   5 minutes, and read (at the cache-read rate) on every other query. The reader
//   says how many such gaps a day there are; writes can't exceed the queries.
//   cost = writes × C × cacheWrite + (queries − writes) × C × cacheRead
//        + queries × (Q × input + O × output)
// RAG, per month:
//   cost = queries × ((Q + k × S) × input + O × output + Q × embed)
//        + vector store + re-indexes × C × embed
//        + (C × embed + extra build cost) ÷ months to spread one-off costs over
import { priceFor } from "./model-routing"
import type { ModelPrice } from "./pricing"

/** Context window assumed for every current Claude model, in tokens. A corpus
 *  that doesn't fit with the query and the answer can't be done as long context. */
export const CONTEXT_WINDOW = 1_000_000
/** Days in a month, for turning cache writes per day into writes per month. */
export const DAYS_PER_MONTH = 30
const M = 1e6

export type RagInput = {
  model: string
  queriesPerMonth: number
  corpusTokens: number // the whole reference corpus
  queryTokens: number // the question plus instructions, per query
  outputTokens: number // per query, including thinking
  // long context
  cacheWritesPerDay: number // times a day traffic resumes after a >5-minute gap
  // RAG
  chunksPerQuery: number // top-k
  chunkTokens: number
  embedPricePerM: number // USD per million tokens embedded (an estimate)
  vectorDbPerMonth: number // vector database / hosting
  reindexesPerMonth: number // full corpus re-embeds a month
  ragBuildCost: number // one-off extra engineering for the retrieval pipeline
  amortiseMonths: number // spread one-off costs over this many months
}

export type LongContextResult = {
  fits: boolean
  promptTokens: number // corpus + query
  price: ModelPrice // the rate actually billed (Haiku switches over 100K)
  writes: number // cache writes this month
  reads: number // queries served from cache
  writeCost: number
  readCost: number
  perQueryRest: number // query input + output, per query
  monthly: number
  perQuery: number
}

export type RagResult = {
  promptTokens: number // query + retrieved chunks
  price: ModelPrice
  perQueryLlm: number
  perQueryEmbed: number
  perQuery: number // marginal cost of one more query
  vectorDb: number
  reindex: number
  oneOff: number // corpus embedding + extra build cost, total
  oneOffMonthly: number
  fixedMonthly: number
  monthly: number
  costPerQuery: number // monthly ÷ queries, fixed costs included
}

export type RagVsLcResult = {
  longContext: LongContextResult
  rag: RagResult
  verdict: "long-context" | "rag" | "tie"
  /** Monthly saving of the cheaper option. */
  difference: number
  /** Query volumes per month at which the two cost the same (at most two; the long-
   *  context curve bends when the cache stops being rewritten on every query). */
  breakEvens: number[]
  breakEven: number | null
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

/** Monthly long-context cost at a given query volume. */
function longContextAt(i: RagInput, queries: number) {
  const C = n(i.corpusTokens), Q = n(i.queryTokens), O = n(i.outputTokens)
  const promptTokens = C + Q
  const price = priceFor(i.model, promptTokens)
  const writes = Math.min(queries, n(i.cacheWritesPerDay) * DAYS_PER_MONTH)
  const reads = queries - writes
  const writeCost = (writes * C * price.cacheWrite) / M
  const readCost = (reads * C * price.cacheRead) / M
  const perQueryRest = (Q * price.input + O * price.output) / M
  const monthly = writeCost + readCost + queries * perQueryRest
  return { promptTokens, price, writes, reads, writeCost, readCost, perQueryRest, monthly }
}

export function compareRag(i: RagInput): RagVsLcResult {
  const q = n(i.queriesPerMonth)
  const C = n(i.corpusTokens), Q = n(i.queryTokens), O = n(i.outputTokens)
  const e = n(i.embedPricePerM)

  const lc = longContextAt(i, q)
  const fits = lc.promptTokens + O <= CONTEXT_WINDOW
  const longContext: LongContextResult = { ...lc, fits, perQuery: q > 0 ? lc.monthly / q : 0 }

  const ragPrompt = Q + Math.round(n(i.chunksPerQuery)) * n(i.chunkTokens)
  const ragPrice = priceFor(i.model, ragPrompt)
  const perQueryLlm = (ragPrompt * ragPrice.input + O * ragPrice.output) / M
  const perQueryEmbed = (Q * e) / M
  const perQuery = perQueryLlm + perQueryEmbed
  const vectorDb = n(i.vectorDbPerMonth)
  const reindex = (n(i.reindexesPerMonth) * C * e) / M
  const oneOff = (C * e) / M + n(i.ragBuildCost)
  const oneOffMonthly = oneOff / Math.max(1, n(i.amortiseMonths))
  const fixedMonthly = vectorDb + reindex + oneOffMonthly
  const ragMonthly = fixedMonthly + q * perQuery
  const rag: RagResult = {
    promptTokens: ragPrompt, price: ragPrice, perQueryLlm, perQueryEmbed, perQuery,
    vectorDb, reindex, oneOff, oneOffMonthly, fixedMonthly,
    monthly: ragMonthly, costPerQuery: q > 0 ? ragMonthly / q : 0,
  }

  // Break-even. Long context is linear in two pieces: every query writes the cache
  // until the daily writes are used up (slope a1), then queries read it (slope a2).
  // RAG is a fixed cost F plus a slope r. Solve each piece for LC(q) = RAG(q).
  const breakEvens: number[] = []
  if (fits) {
    const W = n(i.cacheWritesPerDay) * DAYS_PER_MONTH
    const p = lc.price
    const a1 = (C * p.cacheWrite) / M + lc.perQueryRest
    const a2 = (C * p.cacheRead) / M + lc.perQueryRest
    const F = fixedMonthly, r = perQuery
    if (a1 !== r) {
      const x = F / (a1 - r)
      if (x > 0 && x <= W) breakEvens.push(x)
    }
    // Second piece: LC(q) = W × a1 + (q − W) × a2.
    if (a2 !== r) {
      const x = (F - W * (a1 - a2)) / (a2 - r)
      if (x > W && x > 0) breakEvens.push(x)
    }
  }

  let verdict: RagVsLcResult["verdict"]
  if (!fits) verdict = "rag"
  else if (Math.abs(lc.monthly - ragMonthly) < 0.005) verdict = "tie"
  else verdict = lc.monthly < ragMonthly ? "long-context" : "rag"

  return {
    longContext,
    rag,
    verdict,
    difference: fits ? Math.abs(lc.monthly - ragMonthly) : 0,
    breakEvens,
    breakEven: breakEvens[0] ?? null,
  }
}

export const DEFAULT_RAG: RagInput = {
  model: "claude-sonnet-5-5",
  queriesPerMonth: 20000,
  corpusTokens: 300_000,
  queryTokens: 1500,
  outputTokens: 400,
  cacheWritesPerDay: 40,
  chunksPerQuery: 8,
  chunkTokens: 800,
  embedPricePerM: 0.1,
  vectorDbPerMonth: 70,
  reindexesPerMonth: 4,
  ragBuildCost: 4000,
  amortiseMonths: 12,
}
