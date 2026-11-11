"use client"
import { useMemo, useState } from "react"
import { CRITERIA, EMPTY_DPIA, MANDATORY, screen, toMarkdown, type DpiaAnswers } from "@/lib/tools/dpia"
import { Check } from "./fields"

const VERDICT_LABEL = { required: "required", likely: "likely required", borderline: "borderline", "not-indicated": "not indicated" }

export default function DpiaScreener() {
  const [a, setA] = useState<DpiaAnswers>(EMPTY_DPIA)
  const [copied, setCopied] = useState(false)
  const r = useMemo(() => screen(a), [a])
  const set = <K extends keyof DpiaAnswers>(k: K, v: DpiaAnswers[K]) => { setCopied(false); setA((s) => ({ ...s, [k]: v })) }
  const toggle = (k: "mandatory" | "criteria", id: string) => (on: boolean) => set(k, on ? [...a[k], id] : a[k].filter((x) => x !== id))
  const copy = async () => { try { await navigator.clipboard.writeText(toMarkdown(a, r)); setCopied(true) } catch { setCopied(false) } }

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="About the processing">
        <fieldset className="tl-fieldset">
          <legend>1. always needs a DPIA</legend>
          {MANDATORY.map((o) => <Check key={o.id} checked={a.mandatory.includes(o.id)} onChange={toggle("mandatory", o.id)} hint={`${o.hint} · ${o.ref}`}>{o.label}</Check>)}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>2. the nine criteria</legend>
          {CRITERIA.map((o) => <Check key={o.id} checked={a.criteria.includes(o.id)} onChange={toggle("criteria", o.id)} hint={`${o.hint} · ${o.ref}`}>{o.label}</Check>)}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>3. what else applies</legend>
          <Check checked={a.solelyAutomated} onChange={(v) => set("solelyAutomated", v)} hint="No person meaningfully reviews the outcome before it takes effect · Art. 22">Decisions are made solely by the system and have legal or similar effects</Check>
          <Check checked={a.specialCategory} onChange={(v) => set("specialCategory", v)} hint="Health, biometric, genetic, ethnicity, religion, politics, union membership, sex life · Art. 9">It processes any special-category data</Check>
          <Check checked={a.vendorProcessor} onChange={(v) => set("vendorProcessor", v)} hint="A model API, a SaaS AI product, a hosting provider · Art. 28">An outside vendor processes the data for you</Check>
          <Check checked={a.transfersOutsideEea} onChange={(v) => set("transfersOutsideEea", v)} hint="Including a model API hosted outside the EEA · Chapter V">Data leaves the EEA</Check>
          <Check checked={a.euAiActHighRisk} onChange={(v) => set("euAiActHighRisk", v)} hint="Check with the EU AI Act auditor · AI Act Art. 6">The system is high-risk under the EU AI Act, and you deploy it</Check>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result" aria-live="polite">
          <div>
            <p className="label">dpia {VERDICT_LABEL[r.verdict]}</p>
            <p className="tl-verdict">{r.headline.toLowerCase()}</p>
          </div>
          <div><p className="label">why</p><ul className="tl-list">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div>
            <p className="label">what to do</p>
            <ul className="tl-list">{r.actions.map((x) => <li key={x.text}>{x.text} <span className="tl-ref">{x.ref}</span></li>)}</ul>
          </div>
          <button type="button" className="btn btn--secondary tl-btn" onClick={copy}>{copied ? "copied as markdown" : "copy result as markdown"}</button>
          <p className="tl-note">Screening aid, not legal advice. Based on Art. 35 GDPR and the WP29 DPIA guidelines (WP248 rev.01) endorsed by the EDPB. National authorities publish their own lists, so check yours. Nothing you enter leaves your browser.</p>
        </section>
      </div>
    </div>
  )
}
