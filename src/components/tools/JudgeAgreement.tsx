"use client"
import { useMemo, useState } from "react"
import { DEFAULT_AGREEMENT, agreement, type AgreementInput } from "@/lib/tools/judge-agreement"
import { NumberField, Stat, num, pct } from "./fields"

const LEVELS = [80, 90, 95, 99]
const VERDICT = {
  meets: "the judge clears your bar",
  below: "the judge falls short of your bar",
  unclear: "too few cases to tell",
  "no-data": "enter the four counts",
}

export default function JudgeAgreement() {
  const [v, setV] = useState<AgreementInput>(DEFAULT_AGREEMENT)
  const set = (k: keyof AgreementInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => agreement(v), [v])
  const k2 = (x: number) => num(x, 2)
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Judge and human labels">
        <fieldset className="tl-fieldset">
          <legend>the same cases, labelled twice</legend>
          <p className="tl-hint">Count the cases in each box: what the LLM judge (or the agent) said, against what a person said.</p>
          <div className="tl-row">
            <NumberField id="ja-pp" label="Judge pass, human pass" value={v.bothPass} onChange={set("bothPass")} />
            <NumberField id="ja-pf" label="Judge pass, human fail" value={v.judgePassHumanFail} onChange={set("judgePassHumanFail")} hint="failures the judge missed" />
            <NumberField id="ja-fp" label="Judge fail, human pass" value={v.judgeFailHumanPass} onChange={set("judgeFailHumanPass")} hint="false alarms" />
            <NumberField id="ja-ff" label="Judge fail, human fail" value={v.bothFail} onChange={set("bothFail")} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the bar</legend>
          <div className="tl-row">
            <NumberField id="ja-target" label="Kappa you need" value={v.targetKappa} onChange={set("targetKappa")} min={-1} max={1} step={0.05} hint="0.6 is a common floor; 0.8 for automated gating" />
            <label className="tl-field" htmlFor="ja-conf">
              <span>Confidence</span>
              <select id="ja-conf" className="tl-select" value={v.confidencePct} onChange={(e) => setV((s) => ({ ...s, confidencePct: Number(e.target.value) }))}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}%</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">{VERDICT[r.verdict]}</p>
          <div className="tl-stats">
            <Stat label={`Cohen's kappa: ${r.strength}`} value={k2(r.kappa)} signal />
            <Stat label={`kappa range (${v.confidencePct}% confidence)`} value={`${k2(r.kappaLow)} to ${k2(r.kappaHigh)}`} />
            <Stat label="raw agreement" value={pct(r.observed)} />
            <Stat label="agreement expected by chance" value={pct(r.expected)} />
            <Stat label="human failures the judge also caught" value={r.catchRate === null ? "–" : pct(r.catchRate)} />
            <Stat label="human passes the judge failed" value={r.falseAlarmRate === null ? "–" : pct(r.falseAlarmRate)} />
          </div>
          <div className="tl-stats">
            <Stat label="cases labelled" value={num(r.n)} />
            <Stat label="cases for a kappa range of ±0.1" value={r.casesForTenthWidth === null ? "–" : num(r.casesForTenthWidth)} />
            <Stat label="human fail rate" value={pct(r.humanFailRate)} />
            <Stat label="judge fail rate" value={pct(r.judgeFailRate)} />
          </div>
          <p className="tl-note">
            Kappa = (observed − chance) ÷ (1 − chance), with a large-sample interval; Landis and Koch bands. Raw agreement of {pct(r.observed)} sounds high, but two raters who both pass {pct(1 - r.humanFailRate, 0)} of cases would agree {pct(r.expected)} of the time by luck.
            {r.humanFailRate < 0.1 || r.humanFailRate > 0.9 ? ` With failures this ${r.humanFailRate < 0.1 ? "rare" : "common"}, kappa runs low even for a good judge; the prevalence-adjusted figure (PABAK) is ${k2(r.pabak)}. Report both, and judge the catch rate on its own.` : " Watch the catch rate as well as kappa: a missed failure usually costs more than a false alarm."}
          </p>
        </section>
      </div>
    </div>
  )
}
