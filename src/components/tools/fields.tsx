"use client"
import type { ReactNode } from "react"

export const usd = (n: number, digits = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits })
export const num = (n: number, digits = 0) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: digits })
export const pct = (n: number, digits = 1) => `${((Number.isFinite(n) ? n : 0) * 100).toFixed(digits)}%`

export function NumberField({ label, value, onChange, hint, min = 0, max, step = 1, id }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; min?: number; max?: number; step?: number; id: string
}) {
  return (
    <label className="tl-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id} className="tl-input" type="number" inputMode="decimal" min={min} max={max} step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {hint && <small className="tl-hint">{hint}</small>}
    </label>
  )
}

export function RatingField({ label, value, onChange, low, high, id }: {
  label: string; value: number; onChange: (v: number) => void; low: string; high: string; id: string
}) {
  return (
    <label className="tl-field" htmlFor={id}>
      <span>{label}: <strong className="readout">{value}</strong></span>
      <input id={id} className="tl-range" type="range" min={1} max={5} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} of 5`} />
      <span className="tl-scale"><span>{low}</span><span>{high}</span></span>
    </label>
  )
}

export function Check({ checked, onChange, children, hint }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: string }) {
  return (
    <label className="tl-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}{hint && <small>{hint}</small>}</span>
    </label>
  )
}

export function Stat({ label, value, signal }: { label: string; value: string; signal?: boolean }) {
  return (
    <div className="tl-stat">
      <span className={`tl-stat-value${signal ? " is-signal" : ""}`} aria-live="polite">{value}</span>
      <span className="tl-stat-label">{label}</span>
    </div>
  )
}
