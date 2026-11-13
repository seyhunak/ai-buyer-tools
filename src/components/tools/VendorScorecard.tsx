"use client"
import { useMemo, useState } from "react"
import { useUrlState } from "./useUrlState"
import { CRITERIA, DEFAULT_VENDORS, scorecard, toMarkdown, type Criterion, type Vendor } from "@/lib/tools/vendor-scorecard"
import { num } from "./fields"

const SCORES = [1, 2, 3, 4, 5]

export default function VendorScorecard() {
  const [criteria, setCriteria] = useUrlState<Criterion[]>("c", CRITERIA)
  const [vendors, setVendors] = useUrlState<Vendor[]>("v", DEFAULT_VENDORS)
  const [copied, setCopied] = useState(false)
  const r = useMemo(() => scorecard(vendors, criteria), [vendors, criteria])

  const setCrit = (id: string, patch: Partial<Criterion>) => { setCopied(false); setCriteria((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))) }
  const setScore = (vi: number, id: string, s: number) => { setCopied(false); setVendors((vs) => vs.map((v, i) => (i === vi ? { ...v, scores: { ...v.scores, [id]: s } } : v))) }
  const setName = (vi: number, name: string) => setVendors((vs) => vs.map((v, i) => (i === vi ? { ...v, name } : v)))
  const copy = async () => { try { await navigator.clipboard.writeText(toMarkdown(vendors, criteria, r)); setCopied(true) } catch { setCopied(false) } }

  return (
    <div className="tl-app tl-app--wide">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Scorecard">
        <fieldset className="tl-fieldset">
          <legend>the options</legend>
          <div className="tl-row tl-row--3">
            {vendors.map((v, i) => (
              <label key={i} className="tl-field" htmlFor={`vs-name-${i}`}>
                <span>Option {i + 1}</span>
                <input id={`vs-name-${i}`} className="tl-input" value={v.name} onChange={(e) => setName(i, e.target.value)} />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>score each one, 1 to 5</legend>
          <div className="tl-scroll">
            <table className="tl-table tl-grid">
              <thead>
                <tr>
                  <th scope="col">criterion</th>
                  <th scope="col">weight (0–5)</th>
                  <th scope="col">must-have</th>
                  {vendors.map((v, i) => <th key={i} scope="col">{v.name || `option ${i + 1}`}</th>)}
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <tr key={c.id}>
                    <th scope="row"><span className="tl-crit">{c.label}</span><small className="tl-hint">{c.hint}</small></th>
                    <td>
                      <select aria-label={`${c.label} weight`} className="tl-select" value={c.weight} onChange={(e) => setCrit(c.id, { weight: Number(e.target.value) })}>
                        {[0, ...SCORES].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" aria-label={`${c.label} is a must-have`} className="tl-box" checked={c.mustHave} onChange={(e) => setCrit(c.id, { mustHave: e.target.checked })} /></td>
                    {vendors.map((v, i) => (
                      <td key={i}>
                        <select aria-label={`${v.name}: ${c.label}`} className="tl-select" value={v.scores[c.id] ?? 1} onChange={(e) => setScore(i, c.id, Number(e.target.value))}>
                          {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      </form>
      <section className="well tl-result" aria-label="Result">
        <p className="tl-verdict" aria-live="polite">
          {r.winner ? (r.margin !== null && r.margin < 3 ? `too close to call: ${r.winner} by ${num(r.margin, 1)} points` : `${r.winner} leads`) : "every option fails a must-have"}
        </p>
        <ol className="tl-list" style={{ listStyle: "decimal" }}>
          {r.ranked.map((x) => (
            <li key={x.name}>
              <strong className="readout">{num(x.score, 0)}/100</strong> {x.name}
              {x.failsMustHave.length > 0 && <span className="tl-ref"> · fails must-have: {x.failsMustHave.join(", ").toLowerCase()}</span>}
            </li>
          ))}
        </ol>
        {r.swingCriteria.length > 0 ? (
          <p className="tl-note">The result rests on {r.swingCriteria.join(", ").toLowerCase()}: lower any one of these weights by a point and the winner changes or ties. Agree those weights before anyone sees the scores.</p>
        ) : r.winner ? (
          <p className="tl-note">The winner holds if any single weight drops by a point.</p>
        ) : null}
        <button type="button" className="btn btn--secondary tl-btn" onClick={copy}>{copied ? "copied as markdown" : "copy scorecard as markdown"}</button>
        <p className="tl-note">A must-have scored 2 or less rules an option out, whatever its total. Scores are rescaled so all 1s is 0 and all 5s is 100.</p>
      </section>
    </div>
  )
}
