"use client"
import { useEffect, useMemo, useState } from "react"
import { MODELS, PRICES_CHECKED, modelById } from "@/lib/tools/pricing"
import { DEFAULT_INPUT, estimate, fromQuery, type TokenCostInput } from "@/lib/tools/token-cost"
import { NumberField, Stat, num, usd } from "./fields"

const KEYS: [keyof TokenCostInput, string][] = [
  ["requestsPerMonth", "requests"], ["inputTokens", "input"], ["outputTokens", "output"], ["cachedPct", "cached"], ["batchPct", "batch"],
  ["cacheWritesPerMonth", "writes"], ["minutesSavedPerRequest", "minutes"], ["hourlyCost", "rate"], ["monthlyOverhead", "overhead"],
]

export default function TokenCostEstimator() {
  const [modelId, setModelId] = useState("claude-sonnet-5-5")
  const [v, setV] = useState<TokenCostInput>(DEFAULT_INPUT)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const q = fromQuery(new URLSearchParams(window.location.search))
    if (q.modelId && modelById(q.modelId)) setModelId(q.modelId)
    setV(q.input)
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    const q = new URLSearchParams({ model: modelId })
    for (const [k, p] of KEYS) q.set(p, String(v[k]))
    window.history.replaceState(null, "", `${window.location.pathname}?${q}${window.location.hash}`)
  }, [ready, modelId, v])

  const set = (k: keyof TokenCostInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const model = modelById(modelId) ?? MODELS[1]
  const r = useMemo(() => estimate(model, v), [model, v])
  const all = useMemo(() => MODELS.map((m) => estimate(m, v)), [v])

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Workload">
        <fieldset className="tl-fieldset">
          <legend>workload</legend>
          <label className="tl-field" htmlFor="tc-model">
            <span>Model</span>
            <select id="tc-model" className="tl-select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="tl-row">
            <NumberField id="tc-req" label="API calls per month" value={v.requestsPerMonth} onChange={set("requestsPerMonth")} step={100} />
            <NumberField id="tc-in" label="Input tokens per call" value={v.inputTokens} onChange={set("inputTokens")} step={100} hint="≈ 750 words per 1,000 tokens" />
            <NumberField id="tc-out" label="Output tokens per call" value={v.outputTokens} onChange={set("outputTokens")} step={50} hint="include thinking" />
            <NumberField id="tc-cached" label="Input served from cache (%)" value={v.cachedPct} onChange={set("cachedPct")} max={100} hint="repeated system prompt, policies, tools" />
            <NumberField id="tc-batch" label="Calls sent by Batch API (%)" value={v.batchPct} onChange={set("batchPct")} max={100} hint="work that can wait hours: 50% off" />
            <NumberField id="tc-writes" label="Cache writes per month" value={v.cacheWritesPerMonth} onChange={set("cacheWritesPerMonth")} hint="each time the cached prefix expires" />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>return</legend>
          <div className="tl-row">
            <NumberField id="tc-min" label="Minutes saved per call" value={v.minutesSavedPerRequest} onChange={set("minutesSavedPerRequest")} step={0.5} />
            <NumberField id="tc-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
            <NumberField id="tc-oh" label="Other running cost per month ($)" value={v.monthlyOverhead} onChange={set("monthlyOverhead")} step={50} hint="hosting, OCR, monitoring" />
          </div>
        </fieldset>
      </form>

      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <div className="tl-stats">
            <Stat label="API cost per month" value={usd(r.apiCostPerMonth)} signal />
            <Stat label="API cost per call" value={usd(r.costPerRequest, 4)} />
            <Stat label="value of time saved per month" value={usd(r.labourValuePerMonth)} />
            <Stat label={`net per month after ${usd(r.overheadPerMonth)} other cost`} value={usd(r.netPerMonth)} />
            <Stat label="hours saved per month" value={num(r.hoursSavedPerMonth)} />
            <Stat label="return on running cost" value={r.roiMultiple === null ? "–" : `${num(r.roiMultiple, 1)}×`} />
          </div>
          <div>
            <p className="label">where the API money goes</p>
            <table className="tl-table">
              <tbody>
                <tr><td>uncached input</td><td className="num">{usd(r.breakdown.input, 2)}</td></tr>
                <tr><td>cache reads</td><td className="num">{usd(r.breakdown.cacheRead, 2)}</td></tr>
                <tr><td>cache writes</td><td className="num">{usd(r.breakdown.cacheWrite, 2)}</td></tr>
                <tr><td>output</td><td className="num">{usd(r.breakdown.output, 2)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="tl-scroll">
            <p className="label">same workload on every model</p>
            <table className="tl-table">
              <thead><tr><th scope="col">model</th><th scope="col" className="num">per month</th><th scope="col" className="num">per call</th></tr></thead>
              <tbody>
                {all.map((x) => (
                  <tr key={x.model.id} className={x.model.id === modelId ? "is-selected" : undefined}>
                    <td>{x.model.name}</td><td className="num">{usd(x.apiCostPerMonth)}</td><td className="num">{usd(x.costPerRequest, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tl-note">Claude API list prices per million tokens, checked {PRICES_CHECKED}: input, output, 5-minute cache write and cache read; Batch API 50% off. Haiku 5.5 rates are for prompts up to 100K tokens. The URL keeps your numbers, so you can share the link.</p>
        </section>
      </div>
    </div>
  )
}
