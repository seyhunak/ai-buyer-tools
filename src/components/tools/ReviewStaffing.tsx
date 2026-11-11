"use client"
import { useMemo, useState } from "react"
import { DEFAULT_STAFFING, staff, type StaffingInput } from "@/lib/tools/review-staffing"
import { NumberField, Stat, num, pct, usd } from "./fields"

export default function ReviewStaffing() {
  const [v, setV] = useState<StaffingInput>(DEFAULT_STAFFING)
  const set = (k: keyof StaffingInput) => (n: number) => setV((s) => ({ ...s, [k]: n }))
  const r = useMemo(() => staff(v), [v])
  return (
    <div className="tl-app">
      <form className="tl-form" onSubmit={(e) => e.preventDefault()} aria-label="Review queue">
        <fieldset className="tl-fieldset">
          <legend>the queue</legend>
          <div className="tl-row">
            <NumberField id="rs-cases" label="Cases per month" value={v.casesPerMonth} onChange={set("casesPerMonth")} step={100} />
            <NumberField id="rs-pct" label="Sent to a person (%)" value={v.reviewPct} onChange={set("reviewPct")} max={100} hint="escalations plus quality samples" />
            <NumberField id="rs-min" label="Minutes per review" value={v.minutesPerReview} onChange={set("minutesPerReview")} step={0.5} />
            <NumberField id="rs-peak" label="Busiest hour vs average" value={v.peakFactor} onChange={set("peakFactor")} min={1} step={0.1} hint="1.0 is flat; 1.5–2 is typical" />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the target</legend>
          <div className="tl-row">
            <NumberField id="rs-tpct" label="Share of cases (%)" value={v.targetPct} onChange={set("targetPct")} max={99.9} step={1} />
            <NumberField id="rs-tmin" label="Picked up within (minutes)" value={v.targetMinutes} onChange={set("targetMinutes")} step={5} />
          </div>
        </fieldset>
        <fieldset className="tl-fieldset">
          <legend>the team</legend>
          <div className="tl-row">
            <NumberField id="rs-hours" label="Queue open, hours a day" value={v.hoursPerDay} onChange={set("hoursPerDay")} max={24} />
            <NumberField id="rs-days" label="Days a month" value={v.daysPerMonth} onChange={set("daysPerMonth")} max={31} />
            <NumberField id="rs-shrink" label="Shrinkage (%)" value={v.shrinkagePct} onChange={set("shrinkagePct")} max={90} hint="leave, training, meetings, breaks" />
            <NumberField id="rs-rate" label="Loaded hourly cost ($)" value={v.hourlyCost} onChange={set("hourlyCost")} />
          </div>
        </fieldset>
      </form>
      <div className="tl-sticky">
        <section className="well tl-result" aria-label="Result">
          <p className="tl-verdict" aria-live="polite">
            {r.reviewersOnShift === 0 ? "no reviews, no reviewers" : `${num(r.reviewersOnShift)} on shift at peak, ${num(r.fte, 1)} people in total`}
          </p>
          <div className="tl-stats">
            <Stat label="reviewers on shift in the busiest hour" value={num(r.reviewersOnShift)} signal />
            <Stat label="headcount after shrinkage" value={num(r.fte, 1)} />
            <Stat label="the naive answer: workload alone" value={num(r.workloadFte, 1)} />
            <Stat label={`picked up within ${num(v.targetMinutes)} min`} value={pct(r.serviceLevel)} />
            <Stat label="average wait" value={`${num(r.averageWaitMinutes, 1)} min`} />
            <Stat label="reviewer occupancy at peak" value={pct(r.occupancy, 0)} />
          </div>
          <div className="tl-stats">
            <Stat label="reviews per month" value={num(r.reviewsPerMonth)} />
            <Stat label="review labour per month" value={usd(r.monthlyCost)} />
            <Stat label="cost per review" value={usd(r.costPerReview, 2)} />
            <Stat label="reviews in the busiest hour" value={num(r.reviewsPerPeakHour, 1)} />
          </div>
          <p className="tl-note">
            Erlang C queueing at the busiest hour. The gap between the naive workload figure and the headcount is the cost of answering on time, plus shrinkage. Cost assumes the peak headcount is held for every open hour, so it is an upper bound; staggered shifts bring it down. Occupancy above about 85% for long stretches burns people out.
          </p>
        </section>
      </div>
    </div>
  )
}
