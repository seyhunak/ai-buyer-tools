"use client"
import { useMemo } from "react"
import { useUrlState } from "./useUrlState"
import { DEFAULT_AB, abTest, type AbInput, type AbResult } from "@/lib/tools/eval-ab-test"
import { NumberField, Stat, num, pct } from "./fields"

const LEVELS = [90, 95, 99]
const POWERS = [80, 90, 95]
const VERDICT = {
  "b-better": "B is better, beyond chance",
  "a-better": "B is worse than A, beyond chance",
  equivalent: "no difference that matters",
  unclear: "too few cases to tell",
  "no-data": "enter the four counts",
}
const pts = (x: number, d = 1) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(d)} pts`

// The interval for B − A on a track, with the band of differences too small to matter.
function Interval({ r, margin }: { r: AbResult; margin: number }) {
  const span = Math.max(0.05, Math.abs(r.diffLow), Math.abs(r.diffHigh), margin * 1.5)
  const x = (v: number) => 50 + (v / span) * 46
  return (
    <svg viewBox="0 0 100 18" width="100%" height="54" role="img" aria-label={`Difference B minus A: ${pts(r.diff)}, interval ${pts(r.diffLow)} to ${pts(r.diffHigh)}; differences within ±${(margin * 100).toFixed(1)} points are treated as too small to matter`}>
      {margin > 0 && <rect x={x(-margin)} y="3" width={x(margin) - x(-margin)} height="8" fill="hsl(var(--muted))" />}
      <line x1="2" x2="98" y1="7" y2="7" stroke="hsl(var(--border))" strokeWidth="0.4" />
      <line x1="50" x2="50" y1="2" y2="12" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" />
      <line x1={x(r.diffLow)} x2={x(r.diffHigh)} y1="7" y2="7" stroke="hsl(var(--primary))" strokeWidth="1.2" />
      <circle cx={x(r.diff)} cy="7" r="1.4" fill="hsl(var(--primary))" />
      <text x="2" y="17" fontSize="3" fill="hsl(var(--muted-foreground))">A better</text>
      <text x="50" y="17" fontSize="3" textAnchor="middle" fill="hsl(var(--muted-foreground))">0</text>
      <text x="98" y="17" fontSize="3" textAnchor="end" fill="hsl(var(--muted-foreground))">B better</text>
    </svg>
  )
}

export default function EvalAbTest() {
  const [v, setV] = useUrlState<AbInput>("v", DEFAULT_AB)
  const set = (k: keyof AbInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => abTest(v), [v])
  const margin = Math.max(0, v.minDiffPts) / 100
  const pText = r.pValue < 0.001 ? "< 0.001" : num(r.pValue, 3)
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="A and B on the same cases">
        <fieldset className="tl-fieldset">
          <legend>the same cases, run through both</legend>
          <p className="tl-hint">
            Run variant A (today&apos;s prompt or model) and variant B (the change) on the same golden set, grade both the same way, and count the cases in each box.
          </p>
          <div className="tl-row">
            <NumberField id="ab-rr" label="Both right" value={v.bothRight} onChange={set("bothRight")} />
            <NumberField id="ab-ro" label="A right, B wrong" value={v.aOnly} onChange={set("aOnly")} hint="cases B broke" />
            <NumberField id="ab-or" label="A wrong, B right" value={v.bOnly} onChange={set("bOnly")} hint="cases B fixed" />
            <NumberField id="ab-oo" label="Both wrong" value={v.bothWrong} onChange={set("bothWrong")} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the bar</legend>
          <div className="tl-row">
            <NumberField id="ab-min" label="Smallest difference that matters (points)" value={v.minDiffPts} onChange={set("minDiffPts")} max={50} step={0.5} hint="below this, treat A and B as the same" />
            <label className="tl-field" htmlFor="ab-conf">
              <span>Confidence</span>
              <select id="ab-conf" className="tl-select" value={v.confidencePct} onChange={(e) => setV((s) => ({ ...s, confidencePct: Number(e.target.value) }))}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}%</option>)}
              </select>
            </label>
            <label className="tl-field" htmlFor="ab-power">
              <span>Power</span>
              <select id="ab-power" className="tl-select" value={v.powerPct} onChange={(e) => setV((s) => ({ ...s, powerPct: Number(e.target.value) }))}>
                {POWERS.map((l) => <option key={l} value={l}>{l}%</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">{VERDICT[r.verdict]}</p>
          <div className="tl-stats">
            <Stat label="B − A" value={pts(r.diff)} signal />
            <Stat label={`range (${v.confidencePct}% confidence)`} value={`${pts(r.diffLow)} to ${pts(r.diffHigh)}`} />
            <Stat label="accuracy A" value={pct(r.accA)} />
            <Stat label="accuracy B" value={pct(r.accB)} />
            <Stat label="exact McNemar p-value" value={pText} />
            <Stat label="cases where A and B disagree" value={`${num(r.discordant)} (${pct(r.discordantRate)})`} />
          </div>
          {r.n > 0 && <Interval r={r} margin={margin} />}
          <div className="tl-stats">
            <Stat label="cases B fixed" value={num(v.bOnly)} />
            <Stat label="cases B broke" value={num(v.aOnly)} />
            <Stat label={`cases to find a ${num(v.minDiffPts, 1)}-point difference`} value={r.casesNeeded === null ? "–" : num(r.casesNeeded)} />
            <Stat label="the same with two separate test sets, each" value={r.casesNeededUnpaired === null ? "–" : num(r.casesNeededUnpaired)} />
          </div>
          {r.n > 0 && v.aOnly > 0 && (
            <p className="tl-note">
              <strong>Read the {num(v.aOnly)} cases B broke before you ship.</strong> An average can rise while B fails cases A handled. If they are the expensive ones, a better score is still a regression; add them to the golden set so the next change is tested on them too.
            </p>
          )}
          <p className="tl-note">
            Only the {num(r.discordant)} cases where A and B disagree carry information about the difference; the {num(v.bothRight + v.bothWrong)} they agree on cancel out. The p-value is McNemar&apos;s exact test on those cases, and the range is the Bonett–Price adjusted Wald interval. Cases needed use Connor&apos;s formula at the disagreement rate you measured: changes that rarely flip an answer need fewer cases to judge.
            {r.verdict === "unclear" && r.casesNeeded !== null && r.casesNeeded > r.n ? ` You have ${num(r.n)}; label about ${num(r.casesNeeded - r.n)} more, or accept that a difference this small can't be seen.` : ""}
          </p>
        </section>
      </div>
    </div>
  )
}
