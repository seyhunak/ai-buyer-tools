"use client"
import { useMemo, useState } from "react"
import { DEFAULT_FIT, scoreFit, type FitInput } from "@/lib/tools/workflow-fit"
import { NumberField, RatingField, Stat, num, usd } from "./fields"

export default function WorkflowFitScorer() {
  const [v, setV] = useState<FitInput>(DEFAULT_FIT)
  const set = (k: keyof FitInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => scoreFit(v), [v])
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Process">
        <fieldset className="tl-fieldset">
          <legend>the work today</legend>
          <div className="tl-row">
            <NumberField id="wf-vol" label="Cases per month" value={v.volumePerMonth} onChange={set("volumePerMonth")} step={50} />
            <NumberField id="wf-min" label="Minutes per case" value={v.minutesPerCase} onChange={set("minutesPerCase")} />
            <NumberField id="wf-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>rate the process</legend>
          <RatingField id="wf-rules" label="Rule clarity" value={v.ruleClarity} onChange={set("ruleClarity")} low="judgement calls" high="written rules" />
          <RatingField id="wf-input" label="Input structure" value={v.inputStructure} onChange={set("inputStructure")} low="scans, calls" high="clean data" />
          <RatingField id="wf-exc" label="Exceptions" value={v.exceptionRate} onChange={set("exceptionRate")} low="most cases" high="rare" />
          <RatingField id="wf-err" label="Cost of an error" value={v.errorCost} onChange={set("errorCost")} low="cheap to fix" high="costly or regulated" />
          <RatingField id="wf-api" label="System access" value={v.systemAccess} onChange={set("systemAccess")} low="screens only" high="APIs everywhere" />
          <RatingField id="wf-data" label="Past examples" value={v.dataAvailable} onChange={set("dataAvailable")} low="none" high="thousands" />
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <div className="tl-stats">
            <Stat label="fit score out of 100" value={String(r.score)} signal />
            <Stat label="hours of work per month today" value={num(r.hoursPerMonthToday)} />
            <Stat label="hours saved per month (modelled)" value={num(r.hoursSavedPerMonth)} />
            <Stat label="value per year" value={usd(r.valuePerYear)} />
          </div>
          <p className="tl-verdict" aria-live="polite">{r.patternLabel.toLowerCase()}</p>
          <div>
            <p className="label">suggested architecture</p>
            <ol className="tl-list" style={{ listStyle: "decimal" }}>{r.architecture.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
          {r.strengths.length > 0 && <div><p className="label">in its favour</p><ul className="tl-list">{r.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {r.risks.length > 0 && <div><p className="label">fix or plan for</p><ul className="tl-list">{r.risks.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <p className="tl-note">Hours saved assume the pattern removes {Math.round(r.automatableShare * 100)}% of handling time. Test that in a pilot before you bank it.</p>
        </section>
      </div>
    </div>
  )
}
