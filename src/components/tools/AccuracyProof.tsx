"use client"
import { useMemo, useState } from "react"
import { useUrlState } from "./useUrlState"
import { judgeClaim, requiredSampleSize, zeroFailureTests } from "@/lib/tools/accuracy"
import { NumberField, Stat, num, pct } from "./fields"

const LEVELS = [80, 90, 95, 99]

export default function AccuracyProof() {
  const [claimed, setClaimed] = useUrlState("claimed", 95)
  const [n, setN] = useUrlState("n", 50)
  const [passes, setPasses] = useUrlState("passes", 48)
  const [conf, setConf] = useUrlState("conf", 95)
  const [target, setTarget] = useUrlState("target", 90)
  const [expected, setExpected] = useUrlState("expected", 95)

  const claim = useMemo(() => judgeClaim(claimed / 100, Math.min(passes, n), n, conf), [claimed, passes, n, conf])
  const need = useMemo(() => requiredSampleSize(target / 100, expected / 100, conf), [target, expected, conf])
  const zero = useMemo(() => zeroFailureTests(target / 100, conf), [target, conf])
  const verdict = { proven: "the test supports the claim", "not-proven": "the test is too small to tell", contradicted: "the test contradicts the claim" }[claim.verdict]

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Test results">
        <fieldset className="tl-fieldset">
          <legend>check a claim</legend>
          <div className="tl-row">
            <NumberField id="ap-claim" label="Claimed accuracy (%)" value={claimed} onChange={setClaimed} max={100} step={0.5} />
            <label className="tl-field" htmlFor="ap-conf">
              <span>Confidence</span>
              <select id="ap-conf" className="tl-select" value={conf} onChange={(e) => setConf(Number(e.target.value))}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}%</option>)}
              </select>
            </label>
            <NumberField id="ap-n" label="Test cases run" value={n} onChange={setN} min={1} />
            <NumberField id="ap-pass" label="Cases passed" value={passes} onChange={setPasses} max={n} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>plan a test</legend>
          <div className="tl-row">
            <NumberField id="ap-target" label="Accuracy you need to prove (%)" value={target} onChange={setTarget} max={99.9} step={0.5} />
            <NumberField id="ap-exp" label="Accuracy you expect it to score (%)" value={expected} onChange={setExpected} max={100} step={0.5} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">{verdict}</p>
          <div className="tl-stats">
            <Stat label="measured accuracy" value={pct(passes / Math.max(1, n))} />
            <Stat label={`true accuracy is at least (${conf}% confidence)`} value={pct(claim.low)} signal />
            <Stat label="and at most" value={pct(claim.high)} />
            <Stat label="claimed" value={`${num(claimed, 1)}%`} />
          </div>
          <div className="tl-stats">
            <Stat label={`test cases to prove ${num(target, 1)}% if it really scores ${num(expected, 1)}%`} value={need === null ? "impossible" : num(need)} signal />
            <Stat label={`straight passes, no failures, to prove ${num(target, 1)}%`} value={zero === null ? "–" : num(zero)} />
          </div>
          <p className="tl-note">
            Wilson score interval. {need === null ? "To prove a target, the system has to score above it: a system that scores exactly 90% can never prove 90% at any test size." : "The cases must look like your real work, including the hard ones, or the number proves nothing."}
          </p>
        </section>
      </div>
    </div>
  )
}
