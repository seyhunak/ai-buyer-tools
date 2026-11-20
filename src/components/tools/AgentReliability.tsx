"use client"
import { useMemo } from "react"
import { useUrlState } from "./useUrlState"
import {
  DEFAULT_RELIABILITY, MAX_RETRIES, MAX_STEPS, perStepNeeded, reliability, withBetterCheck,
  type ReliabilityInput, type ReliabilityResult, type Step,
} from "@/lib/tools/agent-reliability"
import { NumberField, Stat, num, pct, usd } from "./fields"

type Scalar = Exclude<keyof ReliabilityInput, "steps">

// One bar split three ways: right with no person, sent to a person, wrong and unseen.
function Split({ r }: { r: ReliabilityResult }) {
  const parts = [
    { key: "right", value: r.straightThrough, color: "hsl(var(--primary))", label: "right, no person involved" },
    { key: "person", value: r.escalated, color: "hsl(var(--muted-foreground))", label: "sent to a person" },
    { key: "wrong", value: r.wrong, color: "hsl(var(--destructive))", label: "wrong, nobody noticed" },
  ]
  return (
    <div>
      <div className="tl-bar" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value)}`).join(", ")}>
        {parts.map((p) => <span key={p.key} style={{ width: `${p.value * 100}%`, background: p.color }} />)}
      </div>
      <div className="tl-legend tl-legend--stack">
        {parts.map((p) => <span key={p.key}><span className="tl-swatch" style={{ background: p.color }} />{p.label}: {pct(p.value)}</span>)}
      </div>
    </div>
  )
}

export default function AgentReliability() {
  const [v, setV] = useUrlState<ReliabilityInput>("v", DEFAULT_RELIABILITY)
  const set = (k: Scalar) => (x: number) => setV((s) => ({ ...s, [k]: x }))
  const setStep = (k: number, patch: Partial<Step>) =>
    setV((s) => ({ ...s, steps: s.steps.map((x, j) => (j === k ? { ...x, ...patch } : x)) }))
  const addStep = () =>
    setV((s) => ({ ...s, steps: [...s.steps, { name: `Step ${s.steps.length + 1}`, accuracyPct: 95, catchPct: 50, retries: 1 }].slice(0, MAX_STEPS) }))
  const removeStep = (k: number) => setV((s) => ({ ...s, steps: s.steps.filter((_, j) => j !== k) }))

  const r = useMemo(() => reliability(v), [v])
  const w = r.weakest
  const fixed = useMemo(() => (w >= 0 ? withBetterCheck(v, w, 95) : null), [v, w])
  const n = v.steps.length

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Agent pipeline">
        <fieldset className="tl-fieldset">
          <legend>the volume</legend>
          <div className="tl-row">
            <NumberField id="ar-cases" label="Cases per month" value={v.casesPerMonth} onChange={set("casesPerMonth")} step={500} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the steps, in order</legend>
          <p className="tl-hint">
            For each step: how often one attempt is right, how many wrong attempts the check after it catches (schema validation, a rule, a judge model, a lookup), and how many retries a caught error gets before the case goes to a person. Measure accuracy on a labelled sample, not from the model&apos;s own confidence.
          </p>
          {v.steps.map((s, k) => (
            <div className="tl-step" key={k}>
              <div className="tl-step-head">
                <label className="tl-field" htmlFor={`ar-n${k}`}>
                  <span>Step {k + 1}</span>
                  <input id={`ar-n${k}`} className="tl-input" type="text" value={s.name} maxLength={60} onChange={(e) => setStep(k, { name: e.target.value })} />
                </label>
                {n > 1 && (
                  <button type="button" className="btn btn--secondary tl-btn" onClick={() => removeStep(k)} aria-label={`Remove step ${k + 1}, ${s.name}`}>
                    remove
                  </button>
                )}
              </div>
              <div className="tl-row">
                <NumberField id={`ar-a${k}`} label="Accuracy per attempt (%)" value={s.accuracyPct} onChange={(x) => setStep(k, { accuracyPct: x })} max={100} step={0.5} />
                <NumberField id={`ar-c${k}`} label="Errors the check catches (%)" value={s.catchPct} onChange={(x) => setStep(k, { catchPct: x })} max={100} step={5} hint="0 if nothing checks this step" />
                <NumberField id={`ar-r${k}`} label="Retries after a caught error" value={s.retries} onChange={(x) => setStep(k, { retries: x })} max={MAX_RETRIES} />
              </div>
            </div>
          ))}
          {n < MAX_STEPS && (
            <button type="button" className="btn btn--secondary tl-btn" onClick={addStep}>add a step</button>
          )}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>retries and costs</legend>
          <div className="tl-row">
            <NumberField id="ar-fix" label="How independent a retry is (%)" value={v.retryFixPct} onChange={set("retryFixPct")} max={100} step={5} hint="100 = a fresh coin toss; lower if the same input fails the same way" />
            <NumberField id="ar-err" label="Cost of a wrong output ($)" value={v.errorCost} onChange={set("errorCost")} step={10} hint="once it reaches a customer or a ledger" />
            <NumberField id="ar-min" label="Minutes per escalated case" value={v.minutesPerEscalation} onChange={set("minutesPerEscalation")} step={1} />
            <NumberField id="ar-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">
            {n === 0
              ? "add a step"
              : `${pct(r.straightThrough)} right end to end, ${pct(r.wrong)} wrong without anyone noticing`}
          </p>
          <div className="tl-stats">
            <Stat label="wrong outputs per month, unseen" value={num(r.wrongPerMonth)} signal />
            <Stat label="cases sent to a person per month" value={num(r.escalatedPerMonth)} />
            <Stat label="right with no checks or retries" value={pct(r.noChecks)} />
            <Stat label="model calls per case" value={num(r.callsPerCase, 2)} />
            <Stat label="cost of wrong outputs per month" value={usd(r.errorCostPerMonth)} />
            <Stat label="review time per month" value={`${num(r.reviewHours, 1)} h · ${usd(r.reviewCostPerMonth)}`} />
          </div>
          <Split r={r} />
          {n > 0 && (
            <div className="tl-scroll">
              <table className="tl-table">
                <caption className="tl-note" style={{ textAlign: "left", captionSide: "bottom", paddingTop: "var(--space-xs)" }}>
                  Each step on its own, then its share of the pipeline&apos;s wrong outputs and escalations.
                </caption>
                <thead>
                  <tr><th scope="col">step</th><th scope="col" className="num">right</th><th scope="col" className="num">missed</th><th scope="col" className="num">to a person</th><th scope="col" className="num">of wrong outputs</th><th scope="col" className="num">of escalations</th></tr>
                </thead>
                <tbody>
                  {r.steps.map((s, k) => (
                    <tr key={k} className={k === w ? "is-selected" : undefined} aria-current={k === w ? "true" : undefined}>
                      <td>{s.name || `Step ${k + 1}`}{k === w ? " (weakest)" : ""}</td>
                      <td className="num">{pct(s.success)}</td>
                      <td className="num">{pct(s.silent, 2)}</td>
                      <td className="num">{pct(s.escalate, 2)}</td>
                      <td className="num">{pct(s.wrongShare, 0)}</td>
                      <td className="num">{pct(s.escalationShare, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {w >= 0 && fixed && (
            <p className="tl-note">
              <strong>Fix first: {v.steps[w].name || `step ${w + 1}`}.</strong> It starts {pct(r.steps[w].wrongShare, 0)} of the wrong outputs. A check that catches 95% of its errors would cut unseen errors from {num(r.wrongPerMonth)} to {num(fixed.wrongPerMonth)} a month and send {num(fixed.escalatedPerMonth - r.escalatedPerMonth)} more cases to a person.
            </p>
          )}
          <p className="tl-note">
            Errors compound: {n} steps at 95% each are right {pct(Math.pow(0.95, n))} of the time end to end with no checks. Without checks, every step would need {num(perStepNeeded(99, n), 2)}% accuracy for the whole pipeline to reach 99%. A missed error is assumed to carry through to a wrong output unless a later step sends the case to a person, and people are assumed to fix what they are sent.
          </p>
        </section>
      </div>
    </div>
  )
}
