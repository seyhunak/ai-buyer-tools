"use client"
import { useMemo } from "react"
import { useUrlState } from "./useUrlState"
import { BANDS, DEFAULT_ESCALATION, thresholds, type Band, type EscalationInput } from "@/lib/tools/escalation-threshold"
import { NumberField, Stat, num, pct, usd } from "./fields"

type Scalar = Exclude<keyof EscalationInput, "bands">

function verdict(k: number, reviewShare: number, cases: number): string {
  if (cases <= 0) return "enter a monthly volume"
  if (k === 0) return "send every case to a person"
  if (k === BANDS.length) return "auto-complete every case; no review pays for itself"
  return `auto-complete at ${BANDS[k - 1].min.toFixed(2)} confidence and above; send the other ${pct(reviewShare, 0)} to a person`
}

export default function EscalationThreshold() {
  const [v, setV] = useUrlState<EscalationInput>("v", DEFAULT_ESCALATION)
  const set = (k: Scalar) => (x: number) => setV((s) => ({ ...s, [k]: x }))
  const setBand = (b: number, k: keyof Band) => (x: number) =>
    setV((s) => ({ ...s, bands: BANDS.map((_, j) => ({ ...(s.bands[j] ?? { sharePct: 0, accuracyPct: 0 }), ...(j === b ? { [k]: x } : {}) })) }))
  const r = useMemo(() => thresholds(v), [v])
  const best = r.best
  const be = r.breakEvenAccuracy
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Confidence bands and costs">
        <fieldset className="tl-fieldset">
          <legend>the volume</legend>
          <div className="tl-row">
            <NumberField id="et-cases" label="Cases per month" value={v.casesPerMonth} onChange={set("casesPerMonth")} step={500} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the confidence bands</legend>
          <p className="tl-hint">For each band of model confidence: the share of cases that land there, and how often the model is right in it, measured on a labelled sample.</p>
          {BANDS.map((band, b) => (
            <div className="tl-row" key={band.label}>
              <NumberField id={`et-s${b}`} label={`${band.label}: share of cases (%)`} value={v.bands[b]?.sharePct ?? 0} onChange={setBand(b, "sharePct")} max={100} />
              <NumberField id={`et-a${b}`} label={`${band.label}: accuracy (%)`} value={v.bands[b]?.accuracyPct ?? 0} onChange={setBand(b, "accuracyPct")} max={100} step={0.5} />
            </div>
          ))}
          {!r.sharesOk && (
            <p className="tl-hint" role="status">
              <strong>The shares add up to {num(r.sharesTotal, 1)}%, not 100%.</strong> {r.sharesTotal > 0 ? "They are scaled to 100% for the maths; fix them to match your data." : "Enter at least one share."}
            </p>
          )}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the costs</legend>
          <div className="tl-row">
            <NumberField id="et-err" label="Cost of an undetected error ($)" value={v.errorCost} onChange={set("errorCost")} step={10} hint="rework, refunds, penalties, churn" />
            <NumberField id="et-hacc" label="Reviewer accuracy (%)" value={v.humanAccuracyPct} onChange={set("humanAccuracyPct")} max={100} step={0.5} hint="people miss errors too" />
            <NumberField id="et-min" label="Minutes per review" value={v.minutesPerReview} onChange={set("minutesPerReview")} step={0.5} />
            <NumberField id="et-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">{verdict(best.autoBands, 1 - best.autoRate, v.casesPerMonth)}</p>
          <div className="tl-stats">
            <Stat label="total cost per month at that threshold" value={usd(best.totalCost)} signal />
            <Stat label="cost per case" value={usd(best.costPerCase, 2)} />
            <Stat label="auto-completed" value={pct(best.autoRate, 0)} />
            <Stat label="undetected errors per month" value={num(best.errors, 1)} />
            <Stat label="saved against reviewing everything" value={usd(r.savingsVsAllReview)} />
            <Stat label="saved against reviewing nothing" value={usd(r.savingsVsAllAuto)} />
          </div>
          <div className="tl-scroll">
            <table className="tl-table">
              <caption className="tl-note" style={{ textAlign: "left", captionSide: "bottom", paddingTop: "var(--space-xs)" }}>Every threshold, per month. The cheapest is marked.</caption>
              <thead><tr><th>auto-complete</th><th className="num">auto</th><th className="num">reviewed</th><th className="num">errors</th><th className="num">review cost</th><th className="num">error cost</th><th className="num">total</th></tr></thead>
              <tbody>
                {r.options.map((o) => {
                  const on = o.autoBands === best.autoBands
                  return (
                    <tr key={o.autoBands} className={on ? "is-selected" : undefined} aria-current={on ? "true" : undefined}>
                      <td>{o.autoBands === 0 ? "nothing" : o.autoBands === BANDS.length ? "everything" : o.threshold}{on ? " (cheapest)" : ""}</td>
                      <td className="num">{pct(o.autoRate, 0)}</td>
                      <td className="num">{num(o.reviewedCases)}</td>
                      <td className="num">{num(o.errors, 1)}</td>
                      <td className="num">{usd(o.reviewCost)}</td>
                      <td className="num">{usd(o.errorCost)}</td>
                      <td className="num">{usd(o.totalCost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="tl-scroll">
            <table className="tl-table">
              <thead><tr><th>band</th><th className="num">accuracy</th><th className="num">auto, per case</th><th className="num">review, per case</th><th>cheaper</th></tr></thead>
              <tbody>
                {r.bands.map((b) => (
                  <tr key={b.label}><td>{b.label}</td><td className="num">{pct(b.accuracy)}</td><td className="num">{usd(b.autoCostPerCase, 2)}</td><td className="num">{usd(b.reviewCostPerCase, 2)}</td><td>{b.autoCheaper ? "auto" : "review"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tl-note">
            {be === null
              ? "Errors cost nothing here, so a review never pays for itself. "
              : be <= 0
                ? "Errors are cheap next to a review, so auto-completing pays at any accuracy. "
                : `Break-even accuracy: ${pct(Math.min(1, be), 2)}. A band the model gets right more often than that is cheaper to auto-complete than to review. `}
            A review costs {usd(r.reviewCostPerCase, 2)} in time, and still lets through {pct(1 - Math.min(1, Math.max(0, v.humanAccuracyPct / 100)), 1)} of errors.
            {r.uncalibrated && " Accuracy does not fall with confidence across your bands, so the model's scores are not calibrated; recalibrate before trusting any threshold."}
            {" "}Band accuracy is only as good as the sample behind it; check it with the accuracy proof calculator.
          </p>
        </section>
      </div>
    </div>
  )
}
