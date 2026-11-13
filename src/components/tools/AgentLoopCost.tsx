"use client"
import { useMemo, useState } from "react"
import { useUrlState } from "./useUrlState"
import { DEFAULT_LOOP, loopCost, loopOnEveryModel, type LoopInput, type LoopResult } from "@/lib/tools/agent-loop"
import { MODELS, PRICES_CHECKED } from "@/lib/tools/pricing"
import { Check, NumberField, Stat, num, pct, usd } from "./fields"

function Chart({ r }: { r: LoopResult }) {
  const W = 560, H = 220, P = { l: 56, r: 12, t: 12, b: 28 }
  const T = r.turns.length
  const max = Math.max(1e-9, ...r.turns.map((t) => Math.max(t.cost, t.uncachedCost)))
  const x = (k: number) => P.l + (T === 1 ? 0.5 : (k - 1) / (T - 1)) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const ticks = [0, 0.5, 1].map((f) => f * max)
  const line = (key: "cost" | "uncachedCost") => r.turns.map((t) => `${x(t.turn)},${y(t[key])}`).join(" ")
  return (
    <svg className="tl-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cost of each turn of the loop, with and without prompt caching">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" />
          <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">{usd(t, max < 0.1 ? 3 : 2)}</text>
        </g>
      ))}
      {[1, Math.ceil(T / 2), T].filter((v, i, a) => a.indexOf(v) === i).map((k) => (
        <text key={k} x={x(k)} y={H - 8} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">turn {k}</text>
      ))}
      <polyline fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" points={line("uncachedCost")} />
      <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth={2} points={line("cost")} />
    </svg>
  )
}

export default function AgentLoopCost() {
  const [v, setV] = useUrlState<LoopInput>("v", DEFAULT_LOOP)
  const set = (k: keyof LoopInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => loopCost(v), [v])
  const cached = useMemo(() => (v.caching ? r : loopCost({ ...v, caching: true })), [v, r])
  const all = useMemo(() => loopOnEveryModel(v), [v])
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Agent loop">
        <fieldset className="tl-fieldset">
          <legend>the agent</legend>
          <label className="tl-field" htmlFor="al-model">
            <span>Model</span>
            <select id="al-model" className="tl-select" value={v.model} onChange={(e) => setV((s) => ({ ...s, model: e.target.value }))}>
              {MODELS.filter((m) => m.id !== "claude-haiku-5-5-long").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="tl-row">
            <NumberField id="al-tasks" label="Tasks per month" value={v.tasksPerMonth} onChange={set("tasksPerMonth")} step={100} />
            <NumberField id="al-turns" label="Model calls per task" value={v.turns} onChange={set("turns")} min={1} max={500} hint="one per tool call, plus the final answer" />
            <NumberField id="al-prefix" label="System prompt + tool definitions (tokens)" value={v.prefixTokens} onChange={set("prefixTokens")} step={500} hint="the same for every task" />
            <NumberField id="al-task" label="Task and starting documents (tokens)" value={v.taskTokens} onChange={set("taskTokens")} step={500} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>each turn</legend>
          <div className="tl-row">
            <NumberField id="al-tool" label="Tool result added (tokens)" value={v.toolResultTokens} onChange={set("toolResultTokens")} step={100} hint="search hits, file contents, API responses" />
            <NumberField id="al-out" label="Model output (tokens)" value={v.outputTokens} onChange={set("outputTokens")} step={50} hint="include thinking" />
            <NumberField id="al-carry" label="Output kept in context (%)" value={v.carriedPct} onChange={set("carriedPct")} max={100} hint="lower it if earlier thinking is dropped" />
            <NumberField id="al-limit" label="Context window (tokens)" value={v.contextLimit} onChange={set("contextLimit")} step={10000} />
          </div>
          <Check checked={v.caching} onChange={(c) => setV((s) => ({ ...s, caching: c }))} hint="cache breakpoint at the end of each prompt: earlier turns are read from cache">
            Prompt caching on
          </Check>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">
            {r.overflowTurn !== null
              ? `turn ${r.overflowTurn} overflows the context window`
              : `${usd(r.costPerTask, 3)} a task, ${usd(r.monthlyCost)} a month`}
          </p>
          <div className="tl-stats">
            <Stat label="API cost per month" value={usd(r.monthlyCost)} signal />
            <Stat label="cost per task" value={usd(r.costPerTask, 4)} />
            <Stat label={v.caching ? "per month without caching" : "per month with caching"} value={usd(v.caching ? r.uncachedMonthlyCost : cached.monthlyCost)} />
            <Stat label="caching saves" value={pct(cached.cachingSavingsPct / 100)} />
            <Stat label="input tokens processed per task" value={num(r.inputTokensPerTask)} />
            <Stat label="context on the last turn" value={num(r.finalContext)} />
            <Stat label="first turn costs" value={usd(r.turns[0].cost, 4)} />
            <Stat label="last turn costs" value={usd(r.turns[r.turns.length - 1].cost, 4)} />
          </div>
          <div>
            <Chart r={r} />
            <div className="tl-legend">
              <span><span className="tl-swatch" style={{ background: "hsl(var(--primary))" }} />cost of each turn{v.caching ? ", cached" : ""}</span>
              <span><span className="tl-swatch" style={{ background: "hsl(var(--muted-foreground))" }} />without caching</span>
            </div>
          </div>
          <div className="tl-scroll">
            <p className="label">same loop on every model</p>
            <table className="tl-table">
              <thead><tr><th scope="col">model</th><th scope="col" className="num">per month</th><th scope="col" className="num">per task</th></tr></thead>
              <tbody>
                {all.map((x) => (
                  <tr key={x.model.id} className={x.model.id === v.model ? "is-selected" : undefined}>
                    <td>{x.model.name}</td><td className="num">{usd(x.monthlyCost)}</td><td className="num">{usd(x.costPerTask, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tl-note">
            Every call re-sends the whole conversation, so input grows by {num(v.toolResultTokens + (v.outputTokens * Math.min(100, v.carriedPct)) / 100)} tokens a turn. Reading the same tokens once, in one call, would cost {usd(r.singleCallCost, 4)}: the loop costs {num(r.growthMultiple, 1)}× that. Caching assumes the shared prefix is warm and turns follow within the 5-minute cache lifetime. Claude API list prices, checked {PRICES_CHECKED}; Haiku 5.5 switches to its long-context rate on turns over 100K tokens.
          </p>
        </section>
      </div>
    </div>
  )
}
