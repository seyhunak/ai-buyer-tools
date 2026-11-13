"use client"
import { useMemo, useState } from "react"
import { useUrlState } from "./useUrlState"
import { MODELS, PRICES_CHECKED } from "@/lib/tools/pricing"
import { DEFAULT_ROUTING, TIERS, route, type RoutingInput, type Tier } from "@/lib/tools/model-routing"
import { NumberField, Stat, num, pct, usd } from "./fields"

// The long-context Haiku row is a price tier, not a model you pick.
const PICKABLE = MODELS.filter((m) => !m.id.endsWith("-long"))
const TIER_LABEL: Record<Tier, string> = { simple: "simple", standard: "standard", hard: "hard" }
const TIER_HINT: Record<Tier, string> = {
  simple: "classify, route, extract a field, short answers",
  standard: "extraction with judgement, drafting, summaries",
  hard: "multi-step reasoning, policy calls, edge cases",
}

function ModelSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="tl-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="tl-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {PICKABLE.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </label>
  )
}

export default function ModelRouting() {
  const [v, setV] = useUrlState<RoutingInput>("v", DEFAULT_ROUTING)
  const set = (k: "requestsPerMonth" | "inputTokens" | "outputTokens" | "cachedPct" | "routerInputTokens") => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const setTier = (k: "share" | "escalationPct", t: Tier) => (n: number) => setV((s) => ({ ...s, [k]: { ...s[k], [t]: n } }))
  const setModel = (t: Tier) => (id: string) => setV((s) => ({ ...s, model: { ...s.model, [t]: id } }))
  const r = useMemo(() => route(v), [v])
  const shareTotal = TIERS.reduce((s, t) => s + (Number(v.share[t]) || 0), 0)
  const be = r.breakEvenSimpleEscalationPct

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Workload and routing">
        <fieldset className="tl-fieldset">
          <legend>workload</legend>
          <div className="tl-row">
            <NumberField id="mr-req" label="Requests per month" value={v.requestsPerMonth} onChange={set("requestsPerMonth")} step={1000} />
            <ModelSelect id="mr-base" label="Today, everything goes to" value={v.baselineModel} onChange={(id) => setV((s) => ({ ...s, baselineModel: id }))} />
            <NumberField id="mr-in" label="Input tokens per request" value={v.inputTokens} onChange={set("inputTokens")} step={100} />
            <NumberField id="mr-out" label="Output tokens per request" value={v.outputTokens} onChange={set("outputTokens")} step={50} hint="include thinking" />
            <NumberField id="mr-cache" label="Input served from cache (%)" value={v.cachedPct} onChange={set("cachedPct")} max={100} />
          </div>
        </fieldset>
        {TIERS.map((t) => (
          <fieldset key={t} className="tl-fieldset">
            <legend>{TIER_LABEL[t]} requests</legend>
            <p className="tl-note">{TIER_HINT[t]}</p>
            <div className="tl-row">
              <NumberField id={`mr-share-${t}`} label="Share of requests (%)" value={v.share[t]} onChange={setTier("share", t)} max={100} />
              <ModelSelect id={`mr-model-${t}`} label="Routed to" value={v.model[t]} onChange={setModel(t)} />
              {t !== "hard" && <NumberField id={`mr-esc-${t}`} label="Retried one tier up (%)" value={v.escalationPct[t]} onChange={setTier("escalationPct", t)} max={100} hint="fails a check, low confidence" />}
            </div>
          </fieldset>
        ))}
        <fieldset className="tl-fieldset">
          <legend>router</legend>
          <div className="tl-row">
            <ModelSelect id="mr-router" label="Router model" value={v.routerModel} onChange={(id) => setV((s) => ({ ...s, routerModel: id }))} />
            <NumberField id="mr-rin" label="Router input tokens" value={v.routerInputTokens} onChange={set("routerInputTokens")} step={100} hint="the request, or just its first part" />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">
            {r.savings > 0 ? `routing saves ${usd(r.savings)} a month (${pct(r.savingsPct, 0)})` : "routing costs more than one model here"}
          </p>
          <div className="tl-stats">
            <Stat label="one model, per month" value={usd(r.baselineCost)} />
            <Stat label="routed, per month" value={usd(r.routedCost)} signal />
            <Stat label="cost per request, one model" value={usd(r.baselineCostPerRequest, 4)} />
            <Stat label="cost per request, routed" value={usd(r.routedCostPerRequest, 4)} />
          </div>
          <div className="tl-scroll">
            <table className="tl-table">
              <thead><tr><th>tier</th><th>model</th><th className="num">requests</th><th className="num">retried</th><th className="num">cost</th></tr></thead>
              <tbody>
                {r.tiers.map((t) => (
                  <tr key={t.tier}><td>{TIER_LABEL[t.tier]}</td><td>{t.model.name.replace("Claude ", "")}</td><td className="num">{num(t.requests)}</td><td className="num">{num(t.retried)}</td><td className="num">{usd(t.cost)}</td></tr>
                ))}
                <tr><td>router</td><td>{(MODELS.find((m) => m.id === v.routerModel)?.name ?? "").replace("Claude ", "")}</td><td className="num">{num(v.requestsPerMonth)}</td><td className="num">–</td><td className="num">{usd(r.routerCost)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="tl-note">
            {be === null ? "" : be >= 100 ? "Routing still pays even if every simple request is retried one tier up. " : `Routing stops paying if more than ${num(be, 1)}% of simple requests have to be retried one tier up. Measure that rate on your own cases before you count the savings. `}
            {shareTotal !== 100 && `Shares add up to ${num(shareTotal)}%, so they are scaled to 100%. `}
            A retried request is paid twice. List prices checked {PRICES_CHECKED}; cache writes are left out.
          </p>
        </section>
      </div>
    </div>
  )
}
