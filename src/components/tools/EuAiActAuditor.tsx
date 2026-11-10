"use client"
import { useMemo, useState } from "react"
import { ANNEX_III, EMPTY_ANSWERS, PROHIBITED, TRANSPARENCY, classify, toMarkdown, type Answers, type Role } from "@/lib/tools/eu-ai-act"
import { Check } from "./fields"

const ROLES: { id: Role; label: string }[] = [
  { id: "provider", label: "Provider: we build it or put our name on it" },
  { id: "deployer", label: "Deployer: we use it in our business" },
  { id: "importer", label: "Importer: we bring a non-EU system into the EU" },
  { id: "distributor", label: "Distributor: we resell it" },
]
const TIER_LABEL = { "out-of-scope": "out of scope", exempt: "exempt", prohibited: "prohibited", "high-risk": "high-risk", limited: "limited risk", minimal: "minimal risk" }

export default function EuAiActAuditor() {
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS)
  const [copied, setCopied] = useState(false)
  const r = useMemo(() => classify(a), [a])
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => { setCopied(false); setA((s) => ({ ...s, [k]: v })) }
  const toggle = (k: "prohibited" | "annexIII" | "transparency", id: string) => (on: boolean) =>
    set(k, on ? [...a[k], id] : a[k].filter((x) => x !== id))

  const copy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(a, r)); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="About the AI system">
        <fieldset className="tl-fieldset">
          <legend>1. your role and scope</legend>
          <label className="tl-field" htmlFor="ai-role">
            <span>Your role for this system</span>
            <select id="ai-role" className="tl-select" value={a.role} onChange={(e) => set("role", e.target.value as Role)}>
              {ROLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <Check checked={a.inScope} onChange={(v) => set("inScope", v)} hint="Placed on the EU market, put into service in the EU, or its output is used in the EU (Art. 2)">The system touches the EU</Check>
          <label className="tl-field" htmlFor="ai-ex">
            <span>Is it used only for one of these?</span>
            <select id="ai-ex" className="tl-select" value={a.exemption} onChange={(e) => set("exemption", e.target.value as Answers["exemption"])}>
              <option value="none">None of these</option>
              <option value="military">Military, defence or national security only</option>
              <option value="research">Scientific research and development only</option>
              <option value="personal">Personal, non-professional use only</option>
            </select>
          </label>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>2. does it do any of these?</legend>
          {PROHIBITED.map((o) => <Check key={o.id} checked={a.prohibited.includes(o.id)} onChange={toggle("prohibited", o.id)} hint={o.ref}>{o.label}</Check>)}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>3. is it used in any of these areas?</legend>
          <Check checked={a.annexI} onChange={(v) => set("annexI", v)} hint="Annex I: machinery, toys, lifts, medical devices, vehicles… needing third-party conformity assessment">It is a safety component of a regulated product, or is that product</Check>
          {ANNEX_III.map((o) => <Check key={o.id} checked={a.annexIII.includes(o.id)} onChange={toggle("annexIII", o.id)} hint={o.ref}>{o.label}</Check>)}
          {a.annexIII.length > 0 && (
            <>
              <Check checked={a.derogation} onChange={(v) => set("derogation", v)} hint="Art. 6(3): a narrow procedural or preparatory task, or it improves work a person already did, without materially influencing the decision">It only does a narrow, preparatory task in that area</Check>
              <Check checked={a.profiling} onChange={(v) => set("profiling", v)} hint="Profiling always keeps an Annex III system high-risk">It profiles people (evaluates personal aspects such as performance, reliability or behaviour)</Check>
            </>
          )}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>4. transparency</legend>
          {TRANSPARENCY.map((o) => <Check key={o.id} checked={a.transparency.includes(o.id)} onChange={toggle("transparency", o.id)} hint={o.ref}>{o.label}</Check>)}
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>5. general-purpose models</legend>
          <Check checked={a.gpaiProvider} onChange={(v) => set("gpaiProvider", v)} hint="Not someone who calls a model through an API: that makes you a provider or deployer of a system">We place a general-purpose AI model on the market</Check>
          {a.gpaiProvider && <Check checked={a.gpaiSystemic} onChange={(v) => set("gpaiSystemic", v)} hint="Trained with more than 10^25 FLOPs, or designated by the Commission">The model has systemic risk</Check>}
        </fieldset>
      </form>

      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result" aria-live="polite">
          <div>
            <p className="label">{TIER_LABEL[r.tier]}</p>
            <p className="tl-verdict">{r.headline.toLowerCase()}</p>
          </div>
          <div>
            <p className="label">why</p>
            <ul className="tl-list">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          {r.obligations.length > 0 && (
            <div>
              <p className="label">what you have to do ({a.role})</p>
              <ul className="tl-list">
                {r.obligations.map((o) => <li key={o.text}>{o.text} <span className="tl-ref">{o.ref} · from {o.from}</span></li>)}
              </ul>
            </div>
          )}
          {r.gpai.length > 0 && (
            <div>
              <p className="label">general-purpose model obligations</p>
              <ul className="tl-list">{r.gpai.map((o) => <li key={o.text}>{o.text} <span className="tl-ref">{o.ref} · from {o.from}</span></li>)}</ul>
            </div>
          )}
          {r.penalty && <p className="tl-note">Penalty exposure: {r.penalty}</p>}
          <button type="button" className="btn btn--secondary tl-btn" onClick={copy}>{copied ? "copied as markdown" : "copy result as markdown"}</button>
          <p className="tl-note">Screening aid, not legal advice. Dates follow Art. 113 of Regulation (EU) 2024/1689. The Commission's Digital Omnibus proposal (November 2025) would push the high-risk dates back; check whether it has been adopted. Nothing you enter leaves your browser.</p>
        </section>
      </div>
    </div>
  )
}
