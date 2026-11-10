"use client"
import { useMemo, useState } from "react"
import { DEFAULT_BVB, compare, type BvbInput } from "@/lib/tools/build-vs-buy"
import { NumberField, Stat, usd } from "./fields"

const COLOR = { manual: "hsl(var(--muted-foreground))", buy: "hsl(var(--foreground))", build: "hsl(var(--primary))" }
const DASH = { manual: "4 4", buy: "", build: "" }

function Chart({ r }: { r: ReturnType<typeof compare> }) {
  const W = 560, H = 260, P = { l: 56, r: 12, t: 12, b: 28 }
  const months = r.series[0].cumulative.length
  const max = Math.max(1, ...r.series.flatMap((s) => s.cumulative))
  const x = (i: number) => P.l + (i / Math.max(1, months - 1)) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const short = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`)
  return (
    <svg className="tl-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative cost by month for the three options">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" />
          <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">{short(t)}</text>
        </g>
      ))}
      {[1, Math.ceil(months / 2), months].map((m) => (
        <text key={m} x={x(m - 1)} y={H - 8} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">month {m}</text>
      ))}
      {r.series.map((s) => (
        <polyline key={s.key} fill="none" stroke={COLOR[s.key]} strokeWidth={s.key === "build" ? 2 : 1.5} strokeDasharray={DASH[s.key]}
          points={s.cumulative.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      ))}
    </svg>
  )
}

export default function BuildVsBuy() {
  const [v, setV] = useState<BvbInput>(DEFAULT_BVB)
  const set = (k: keyof BvbInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => compare(v), [v])
  const name = { manual: "keep it manual", buy: "buy a SaaS tool", build: "build an agent workflow" }
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Options">
        <fieldset className="tl-fieldset">
          <legend>the work</legend>
          <div className="tl-row">
            <NumberField id="bb-hours" label="Hours of work per month" value={v.hoursPerMonth} onChange={set("hoursPerMonth")} step={10} />
            <NumberField id="bb-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
            <NumberField id="bb-months" label="Horizon (months)" value={v.months} onChange={set("months")} min={1} max={120} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>buy</legend>
          <div className="tl-row">
            <NumberField id="bb-seats" label="Seats" value={v.seats} onChange={set("seats")} />
            <NumberField id="bb-seat" label="Price per seat per month ($)" value={v.seatPricePerMonth} onChange={set("seatPricePerMonth")} />
            <NumberField id="bb-setup" label="Setup and training ($)" value={v.buySetup} onChange={set("buySetup")} step={500} />
            <NumberField id="bb-bauto" label="Work it removes (%)" value={v.buyAutomation} onChange={set("buyAutomation")} max={100} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>build</legend>
          <div className="tl-row">
            <NumberField id="bb-build" label="Build cost ($)" value={v.buildCost} onChange={set("buildCost")} step={1000} />
            <NumberField id="bb-bmonths" label="Months to go live" value={v.buildMonths} onChange={set("buildMonths")} />
            <NumberField id="bb-api" label="API cost per month ($)" value={v.apiPerMonth} onChange={set("apiPerMonth")} step={50} hint="use the token cost estimator" />
            <NumberField id="bb-host" label="Hosting per month ($)" value={v.hostingPerMonth} onChange={set("hostingPerMonth")} step={50} />
            <NumberField id="bb-maint" label="Maintenance per year (% of build)" value={v.maintenancePctPerYear} onChange={set("maintenancePctPerYear")} max={100} />
            <NumberField id="bb-cauto" label="Work it removes (%)" value={v.buildAutomation} onChange={set("buildAutomation")} max={100} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">cheapest over {r.series[0].cumulative.length} months: {name[r.cheapest]}</p>
          <div className="tl-stats">
            <Stat label="keep it manual" value={usd(r.totals.manual)} signal={r.cheapest === "manual"} />
            <Stat label="buy a SaaS tool" value={usd(r.totals.buy)} signal={r.cheapest === "buy"} />
            <Stat label="build an agent workflow" value={usd(r.totals.build)} signal={r.cheapest === "build"} />
            <Stat label="build pays back vs manual" value={r.breakEvenBuildVsManual ? `month ${r.breakEvenBuildVsManual}` : "not in horizon"} />
          </div>
          <Chart r={r} />
          <div className="tl-legend">
            {r.series.map((s) => <span key={s.key}><span className="tl-swatch" style={{ background: COLOR[s.key] }} />{s.label}</span>)}
          </div>
          <p className="tl-note">Build beats buy {r.breakEvenBuildVsBuy ? `from month ${r.breakEvenBuildVsBuy}` : "at no point in this horizon"}. Plain cumulative cash, no discounting. Labour left over by each option is included.</p>
        </section>
      </div>
    </div>
  )
}
