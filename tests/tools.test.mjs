// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODELS, modelById } from '../src/lib/tools/pricing.ts'
import { estimate, fromQuery, DEFAULT_INPUT } from '../src/lib/tools/token-cost.ts'
import { wilson, requiredSampleSize, zeroFailureTests, judgeClaim } from '../src/lib/tools/accuracy.ts'
import { classify, EMPTY_ANSWERS, toMarkdown } from '../src/lib/tools/eu-ai-act.ts'
import { scoreFit, DEFAULT_FIT } from '../src/lib/tools/workflow-fit.ts'
import { compare, DEFAULT_BVB } from '../src/lib/tools/build-vs-buy.ts'
import { route, requestCost, priceFor, DEFAULT_ROUTING } from '../src/lib/tools/model-routing.ts'
import { erlangC, serviceLevel, staff, DEFAULT_STAFFING } from '../src/lib/tools/review-staffing.ts'
import { scorecard, weightedScore, CRITERIA as VENDOR_CRITERIA, DEFAULT_VENDORS, toMarkdown as vendorMarkdown } from '../src/lib/tools/vendor-scorecard.ts'
import { screen, EMPTY_DPIA, toMarkdown as dpiaMarkdown } from '../src/lib/tools/dpia.ts'
import { loopCost, loopOnEveryModel, DEFAULT_LOOP } from '../src/lib/tools/agent-loop.ts'
import { agreement, strengthOf, DEFAULT_AGREEMENT } from '../src/lib/tools/judge-agreement.ts'
import { thresholds, breakEven, BANDS, DEFAULT_ESCALATION } from '../src/lib/tools/escalation-threshold.ts'
import { compareRag, DEFAULT_RAG, CONTEXT_WINDOW } from '../src/lib/tools/rag-vs-long-context.ts'
import { reliability, stepOutcome, withBetterCheck, perStepNeeded, DEFAULT_RELIABILITY } from '../src/lib/tools/agent-reliability.ts'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`)
const base = { ...DEFAULT_INPUT, cachedPct: 0, batchPct: 0, cacheWritesPerMonth: 0, monthlyOverhead: 0 }

// --- pricing + token cost
test('price table matches the published list prices', () => {
  const opus = modelById('claude-opus-5-5')
  assert.deepEqual([opus.input, opus.cacheWrite, opus.cacheRead, opus.output], [4, 5, 0.2, 20])
  const haiku = modelById('claude-haiku-5-5')
  assert.deepEqual([haiku.input, haiku.cacheRead, haiku.output], [0.1, 0.01, 0.5])
  assert.equal(new Set(MODELS.map(m => m.id)).size, MODELS.length)
})

test('token cost: 1M requests x 1M tokens priced exactly', () => {
  const sonnet = modelById('claude-sonnet-5-5')
  const r = estimate(sonnet, { ...base, requestsPerMonth: 1000, inputTokens: 1000, outputTokens: 1000 })
  close(r.breakdown.input, 2) // 1M input tokens at $2
  close(r.breakdown.output, 10) // 1M output tokens at $10
  close(r.apiCostPerMonth, 12)
  close(r.costPerRequest, 0.012)
})

test('token cost: batch halves every class, caching bills reads and writes', () => {
  const opus = modelById('claude-opus-5-5')
  const plain = estimate(opus, { ...base, requestsPerMonth: 1000, inputTokens: 1000, outputTokens: 1000 })
  const batched = estimate(opus, { ...base, requestsPerMonth: 1000, inputTokens: 1000, outputTokens: 1000, batchPct: 100 })
  close(batched.apiCostPerMonth, plain.apiCostPerMonth / 2)
  const cached = estimate(opus, { ...base, requestsPerMonth: 1000, inputTokens: 1000, outputTokens: 0, cachedPct: 100, cacheWritesPerMonth: 10 })
  close(cached.breakdown.input, 0)
  close(cached.breakdown.cacheRead, 0.2) // 1M tokens at $0.20
  close(cached.breakdown.cacheWrite, 10 * 1000 * 5 / 1e6)
})

test('token cost: ROI and bad input are handled', () => {
  const r = estimate(modelById('claude-haiku-5-5'), { ...base, requestsPerMonth: 600, minutesSavedPerRequest: 10, hourlyCost: 30 })
  close(r.hoursSavedPerMonth, 100)
  close(r.labourValuePerMonth, 3000)
  const bad = estimate(modelById('claude-haiku-5-5'), { ...base, requestsPerMonth: -5, inputTokens: NaN, cachedPct: 400 })
  assert.equal(bad.apiCostPerMonth, 0)
  assert.equal(bad.roiMultiple, null)
})

test('token cost: query string pre-fills and ignores junk', () => {
  const { modelId, input } = fromQuery(new URLSearchParams('model=claude-sonnet-5-5&requests=120&input=90000&cached=150&batch=x'))
  assert.equal(modelId, 'claude-sonnet-5-5')
  assert.equal(input.requestsPerMonth, 120)
  assert.equal(input.inputTokens, 90000)
  assert.equal(input.cachedPct, 100)
  assert.equal(input.batchPct, DEFAULT_INPUT.batchPct)
})

// --- accuracy
test('wilson interval matches the textbook value', () => {
  const { low, high } = wilson(95, 100, 95) // standard reference: 0.8882 - 0.9785
  close(low, 0.8882, 5e-4); close(high, 0.9785, 5e-4)
  const zero = wilson(0, 10); assert.equal(zero.low, 0)
  const all = wilson(10, 10); close(all.high, 1)
})

test('sample size and zero-failure rule', () => {
  assert.equal(zeroFailureTests(0.95, 95), 59) // ln(0.05)/ln(0.95) = 58.4 -> 59
  assert.equal(zeroFailureTests(0.99, 95), 299)
  const n = requiredSampleSize(0.9, 0.95, 95)
  assert.ok(n > 50 && n < 200, `n=${n}`)
  assert.ok(wilson(Math.round(0.95 * n), n).low >= 0.9)
  assert.ok(wilson(Math.round(0.95 * (n - 1)), n - 1).low < 0.9)
  assert.equal(requiredSampleSize(0.95, 0.95), null)
})

test('vendor claim verdicts', () => {
  assert.equal(judgeClaim(0.95, 48, 50).verdict, 'not-proven') // 96% on 50 cases does not prove 95%
  assert.equal(judgeClaim(0.95, 1990, 2000).verdict, 'proven')
  assert.equal(judgeClaim(0.95, 160, 200).verdict, 'contradicted')
})

// --- EU AI Act
test('EU AI Act: out of scope and exemptions', () => {
  assert.equal(classify({ ...EMPTY_ANSWERS, inScope: false }).tier, 'out-of-scope')
  assert.equal(classify({ ...EMPTY_ANSWERS, exemption: 'military' }).tier, 'exempt')
})

test('EU AI Act: prohibited beats everything else', () => {
  const r = classify({ ...EMPTY_ANSWERS, prohibited: ['social-scoring'], annexIII: ['employment'], transparency: ['interacts'] })
  assert.equal(r.tier, 'prohibited')
  assert.match(r.penalty, /7%/)
})

test('EU AI Act: Annex III is high-risk; derogation blocked by profiling', () => {
  const credit = classify({ ...EMPTY_ANSWERS, role: 'deployer', annexIII: ['essential-services'] })
  assert.equal(credit.tier, 'high-risk')
  assert.ok(credit.obligations.some(o => o.ref === 'Art. 27'), 'FRIA missing for deployer')
  const derog = classify({ ...EMPTY_ANSWERS, annexIII: ['employment'], derogation: true })
  assert.equal(derog.tier, 'minimal')
  assert.match(derog.reasons[0], /6\(3\)/)
  const profiled = classify({ ...EMPTY_ANSWERS, annexIII: ['employment'], derogation: true, profiling: true })
  assert.equal(profiled.tier, 'high-risk')
})

test('EU AI Act: provider duties, Annex I date, transparency and GPAI', () => {
  const prov = classify({ ...EMPTY_ANSWERS, role: 'provider', annexI: true })
  assert.ok(prov.obligations.some(o => o.ref === 'Art. 9' && o.from === '2 August 2027'))
  const bot = classify({ ...EMPTY_ANSWERS, transparency: ['interacts'] })
  assert.equal(bot.tier, 'limited')
  assert.ok(bot.obligations.some(o => o.ref === 'Art. 50(1)'))
  const gpai = classify({ ...EMPTY_ANSWERS, gpaiProvider: true, gpaiSystemic: true })
  assert.ok(gpai.gpai.some(o => o.ref.startsWith('Art. 55')))
  assert.ok(gpai.obligations.some(o => o.ref === 'Art. 4'), 'AI literacy always applies')
  assert.match(toMarkdown(EMPTY_ANSWERS, bot), /not legal advice/)
})

// --- workflow fit
test('workflow fit: patterns follow the score and error cost', () => {
  const ideal = scoreFit({ ...DEFAULT_FIT, volumePerMonth: 20000, ruleClarity: 5, inputStructure: 5, exceptionRate: 5, errorCost: 1, systemAccess: 5, dataAvailable: 5 })
  assert.equal(ideal.pattern, 'full-automation')
  assert.ok(ideal.score >= 90)
  const risky = scoreFit({ ...DEFAULT_FIT, volumePerMonth: 20000, ruleClarity: 5, inputStructure: 5, exceptionRate: 5, errorCost: 5, systemAccess: 5, dataAvailable: 5 })
  assert.equal(risky.pattern, 'agent-with-review')
  const poor = scoreFit({ ...DEFAULT_FIT, volumePerMonth: 10, ruleClarity: 1, inputStructure: 1, exceptionRate: 1, errorCost: 5, systemAccess: 1, dataAvailable: 1 })
  assert.equal(poor.pattern, 'not-yet')
  assert.ok(poor.score >= 0 && poor.score <= 100)
  close(ideal.hoursPerMonthToday, 20000 * 20 / 60)
})

// --- build vs buy
test('build vs buy: cumulative series and break-even', () => {
  const r = compare(DEFAULT_BVB)
  assert.equal(r.series[0].cumulative.length, 36)
  close(r.totals.manual, 600 * 45 * 36)
  assert.ok(r.breakEvenBuildVsManual > DEFAULT_BVB.buildMonths)
  const noBuild = compare({ ...DEFAULT_BVB, buildAutomation: 0 })
  assert.equal(noBuild.breakEvenBuildVsManual, null)
  assert.notEqual(noBuild.cheapest, 'build')
})

// --- model routing
test('model routing: request cost at list price, Haiku long-context tier', () => {
  close(requestCost(modelById('claude-sonnet-5-5'), 1000, 1000), (1000 * 2 + 1000 * 10) / 1e6)
  close(requestCost(modelById('claude-opus-5-5'), 1000, 0, 100), 1000 * 0.2 / 1e6)
  assert.equal(priceFor('claude-haiku-5-5', 150_000).id, 'claude-haiku-5-5-long')
  assert.equal(priceFor('claude-haiku-5-5', 90_000).id, 'claude-haiku-5-5')
})

test('model routing: no-op routing costs the router; savings and break-even add up', () => {
  const same = { ...DEFAULT_ROUTING, cachedPct: 0, model: { simple: 'claude-opus-5-5', standard: 'claude-opus-5-5', hard: 'claude-opus-5-5' }, escalationPct: { simple: 0, standard: 0, hard: 0 } }
  const r0 = route(same)
  close(r0.savings, -r0.routerCost, 1e-6)
  const r = route(DEFAULT_ROUTING)
  assert.ok(r.savings > 0 && r.savingsPct < 1)
  close(r.routedCost, r.tiers.reduce((s, t) => s + t.cost, 0) + r.routerCost, 1e-6)
  // At the break-even escalation rate, savings are zero.
  const at = route({ ...DEFAULT_ROUTING, escalationPct: { ...DEFAULT_ROUTING.escalationPct, simple: r.breakEvenSimpleEscalationPct } })
  if (r.breakEvenSimpleEscalationPct < 100) close(at.savings, 0, 1e-6)
  // Shares that don't add to 100 are normalised.
  const doubled = route({ ...DEFAULT_ROUTING, share: { simple: 120, standard: 60, hard: 20 } })
  close(doubled.routedCost, r.routedCost, 1e-6)
})

// --- review staffing (Erlang C)
test('erlang C matches the textbook value', () => {
  close(erlangC(3, 2), 4 / 9, 1e-9) // C(3, 2) = 0.4444
  assert.equal(erlangC(2, 2), 1)
  assert.equal(erlangC(5, 0), 0)
  // 10 Erlangs, 12 agents, 3-minute handle time, 20-second target: SL ≈ 0.64 in published tables
  const sl = serviceLevel(12, 10, 3, 20 / 60)
  assert.ok(sl > 0.6 && sl < 0.7, `sl=${sl}`)
})

test('review staffing: meets the target with the fewest reviewers', () => {
  const r = staff(DEFAULT_STAFFING)
  close(r.reviewsPerMonth, 9000 * 0.25)
  assert.ok(r.reviewersOnShift > r.erlangs)
  assert.ok(r.serviceLevel >= 0.9)
  const one = staff({ ...DEFAULT_STAFFING })
  const fewer = serviceLevel(one.reviewersOnShift - 1, one.erlangs, DEFAULT_STAFFING.minutesPerReview, DEFAULT_STAFFING.targetMinutes)
  assert.ok(fewer < 0.9, 'one fewer reviewer should miss the target')
  assert.ok(r.fte > r.workloadFte)
  const none = staff({ ...DEFAULT_STAFFING, reviewPct: 0 })
  assert.equal(none.reviewersOnShift, 0)
  assert.equal(none.monthlyCost, 0)
})

// --- vendor scorecard
test('vendor scorecard: scale, must-haves and swing criteria', () => {
  const all5 = Object.fromEntries(VENDOR_CRITERIA.map(c => [c.id, 5]))
  const all1 = Object.fromEntries(VENDOR_CRITERIA.map(c => [c.id, 1]))
  close(weightedScore({ name: 'x', scores: all5 }, VENDOR_CRITERIA), 100)
  close(weightedScore({ name: 'x', scores: all1 }, VENDOR_CRITERIA), 0)
  const r = scorecard([{ name: 'Strong but insecure', scores: { ...all5, security: 2 } }, { name: 'Middling', scores: Object.fromEntries(VENDOR_CRITERIA.map(c => [c.id, 3])) }])
  assert.equal(r.winner, 'Middling')
  assert.deepEqual(r.ranked[1].failsMustHave, ['Security and compliance'])
  const d = scorecard(DEFAULT_VENDORS)
  assert.ok(d.winner)
  assert.ok(d.ranked[0].score >= d.ranked[1].score)
  // Two vendors that differ only on cost: cost is the swing criterion.
  const tie = scorecard([{ name: 'A', scores: { ...Object.fromEntries(VENDOR_CRITERIA.map(c => [c.id, 3])), cost: 4, time: 2 } }, { name: 'B', scores: { ...Object.fromEntries(VENDOR_CRITERIA.map(c => [c.id, 3])), time: 3 } }])
  assert.equal(tie.winner, 'A')
  assert.ok(tie.swingCriteria.includes('Three-year total cost'))
  assert.match(vendorMarkdown(DEFAULT_VENDORS, VENDOR_CRITERIA, d), /\| criterion \| weight \|/)
})

// --- DPIA
test('DPIA: Art. 35(3) is mandatory, two criteria is likely, one is borderline', () => {
  assert.equal(screen({ ...EMPTY_DPIA, mandatory: ['automated-evaluation'] }).verdict, 'required')
  assert.equal(screen({ ...EMPTY_DPIA, criteria: ['scoring', 'innovative'] }).verdict, 'likely')
  assert.equal(screen({ ...EMPTY_DPIA, criteria: ['innovative'] }).verdict, 'borderline')
  assert.equal(screen(EMPTY_DPIA).verdict, 'not-indicated')
  const r = screen({ ...EMPTY_DPIA, criteria: ['scoring', 'automated-decision'], solelyAutomated: true, transfersOutsideEea: true, euAiActHighRisk: true })
  for (const ref of ['Art. 35(7)', 'Art. 36', 'Art. 22(2)–(3)', 'Art. 28', 'Art. 44–46', 'AI Act Art. 26(9)', 'Art. 30']) assert.ok(r.actions.some(a => a.ref === ref), ref)
  assert.match(dpiaMarkdown(EMPTY_DPIA, screen(EMPTY_DPIA)), /not legal advice/)
})

// --- agent loop
test('agent loop: context grows each turn and is priced at list rates', () => {
  const r = loopCost({ ...DEFAULT_LOOP, caching: false })
  // 12 turns, 8,000 + 3,000 to start, +3,100 a turn (2,500 tool result + 600 output)
  assert.equal(r.turns.length, 12)
  assert.equal(r.finalContext, 11000 + 11 * 3100)
  assert.equal(r.inputTokensPerTask, 12 * 11000 + 3100 * 66)
  close(r.costPerTask, (336600 * 2 + 7200 * 10) / 1e6)
  close(r.monthlyCost, r.costPerTask * 2000, 1e-6)
  assert.equal(r.overflowTurn, null)
})

test('agent loop: caching reads the previous prompt and writes only the new tail', () => {
  const r = loopCost(DEFAULT_LOOP)
  // reads: prefix on turn 1, then the previous turn's full prompt; writes: the task, then 3,100 a turn
  const reads = 8000 + 11 * 11000 + 3100 * 55, writes = 3000 + 11 * 3100
  close(r.costPerTask, (reads * 0.1 + writes * 2.5 + 7200 * 10) / 1e6)
  close(r.uncachedCostPerTask, loopCost({ ...DEFAULT_LOOP, caching: false }).costPerTask)
  assert.ok(r.cachingSavingsPct > 70 && r.cachingSavingsPct < 75)
  // one turn with no growth costs the same as a single call
  const one = loopCost({ ...DEFAULT_LOOP, turns: 1, caching: false })
  close(one.costPerTask, one.singleCallCost)
})

test('agent loop: overflow, Haiku long-context tier, junk input', () => {
  const big = loopCost({ ...DEFAULT_LOOP, turns: 80, toolResultTokens: 5000 })
  assert.ok(big.overflowTurn !== null && big.overflowTurn > 1)
  assert.ok(big.turns[big.overflowTurn - 2].context + 600 <= 200000)
  const h = loopCost({ ...DEFAULT_LOOP, model: 'claude-haiku-5-5', turns: 2, prefixTokens: 0, taskTokens: 150000, toolResultTokens: 0, outputTokens: 0, caching: false })
  close(h.turns[0].cost, 150000 * 0.5 / 1e6) // over 100K: long-context input rate
  assert.equal(loopOnEveryModel(DEFAULT_LOOP).some((x) => x.model.id === 'claude-haiku-5-5-long'), false)
  const bad = loopCost({ ...DEFAULT_LOOP, turns: NaN, tasksPerMonth: -3, prefixTokens: -1 })
  assert.equal(bad.turns.length, 1)
  assert.equal(bad.monthlyCost, 0)
})

// --- judge agreement
test('kappa matches the textbook value (20/5/10/15 -> 0.40)', () => {
  const r = agreement({ bothPass: 20, judgePassHumanFail: 5, judgeFailHumanPass: 10, bothFail: 15, confidencePct: 95, targetKappa: 0.6 })
  close(r.observed, 0.7)
  close(r.expected, 0.5)
  close(r.kappa, 0.4, 1e-12)
  assert.equal(r.strength, 'fair')
  close(r.catchRate, 0.75)
  close(r.falseAlarmRate, 1 / 3)
  assert.equal(r.verdict, 'unclear')
})

test('kappa: verdicts, prevalence paradox, edge cases', () => {
  const strong = agreement({ bothPass: 900, judgePassHumanFail: 10, judgeFailHumanPass: 10, bothFail: 300, confidencePct: 95, targetKappa: 0.6 })
  assert.equal(strong.verdict, 'meets')
  const weak = agreement({ bothPass: 300, judgePassHumanFail: 100, judgeFailHumanPass: 100, bothFail: 100, confidencePct: 95, targetKappa: 0.6 })
  assert.equal(weak.verdict, 'below')
  // rare failures: 96% agreement, but kappa far lower than PABAK
  const rare = agreement({ bothPass: 950, judgePassHumanFail: 20, judgeFailHumanPass: 20, bothFail: 10, confidencePct: 95, targetKappa: 0.6 })
  assert.ok(rare.observed === 0.96 && rare.kappa < 0.35 && rare.pabak > 0.9)
  assert.equal(agreement({ ...DEFAULT_AGREEMENT, bothPass: 0, judgePassHumanFail: 0, judgeFailHumanPass: 0, bothFail: 0 }).verdict, 'no-data')
  assert.equal(agreement({ ...DEFAULT_AGREEMENT, judgePassHumanFail: 0, judgeFailHumanPass: 0, bothFail: 0 }).kappa, 1)
  assert.deepEqual([strengthOf(-0.1), strengthOf(0.2), strengthOf(0.61), strengthOf(0.81)], ['worse than chance', 'slight', 'substantial', 'almost perfect'])
  // narrower interval with more cases
  const x10 = agreement({ ...DEFAULT_AGREEMENT, bothPass: 1620, judgePassHumanFail: 90, judgeFailHumanPass: 70, bothFail: 220 })
  assert.ok(x10.kappaHigh - x10.kappaLow < agreement(DEFAULT_AGREEMENT).kappaHigh - agreement(DEFAULT_AGREEMENT).kappaLow)
})

// --- escalation threshold
test('escalation: defaults price every threshold exactly and pick the top band only', () => {
  const r = thresholds(DEFAULT_ESCALATION)
  assert.equal(r.options.length, BANDS.length + 1)
  assert.ok(r.sharesOk)
  close(r.reviewCostPerCase, 4) // 6 min at $40/h
  // k = 0: review all 10,000; 1% residual human error
  const all = r.options[0]
  assert.deepEqual([all.autoRate, all.autoCases, all.reviewedCases], [0, 0, 10000])
  close(all.errors, 100, 1e-9)
  close(all.totalCost, 10000 * 4 + 100 * 150, 1e-6)
  // k = 1: auto 5,500 at 98.5%, review 4,500
  const one = r.options[1]
  close(one.autoRate, 0.55)
  close(one.autoErrors, 82.5, 1e-9)
  close(one.humanErrors, 45, 1e-9)
  close(one.reviewCost, 18000, 1e-6)
  close(one.errorCost, 127.5 * 150, 1e-6)
  close(one.totalCost, 37125, 1e-6)
  close(one.costPerCase, 3.7125, 1e-9)
  // k = 2 adds 2,000 cases at 95%: 100 more errors, 2,000 fewer reviews
  close(r.options[2].totalCost, 2500 * 4 + (82.5 + 100 + 25) * 150, 1e-6)
  // k = 5: nothing reviewed
  const none = r.options[5]
  assert.equal(none.reviewedCases, 0)
  close(none.errors, 10000 * (0.55 * 0.015 + 0.2 * 0.05 + 0.12 * 0.12 + 0.08 * 0.25 + 0.05 * 0.45), 1e-6)
  assert.equal(r.best.autoBands, 1)
  assert.equal(r.best.threshold, '0.95 and above')
  close(r.savingsVsAllReview, 55000 - 37125, 1e-6)
  assert.ok(r.savingsVsAllAuto > 0)
  assert.equal(r.uncalibrated, false)
  // the recommendation is the cheapest of the six
  assert.equal(Math.min(...r.options.map((o) => o.totalCost)), r.best.totalCost)
})

test('escalation: break-even accuracy and per-band verdicts', () => {
  // $150 error, $4 review, 99% reviewers: 1 - (4 + 1.5) / 150
  close(breakEven(150, 4, 0.99), 1 - 5.5 / 150)
  const r = thresholds(DEFAULT_ESCALATION)
  close(r.breakEvenAccuracy, 1 - 5.5 / 150)
  assert.deepEqual(r.bands.map((b) => b.autoCheaper), [true, false, false, false, false])
  // at exactly the break-even accuracy, both sides cost the same
  const be = r.breakEvenAccuracy
  close(150 * (1 - be), 4 + 150 * 0.01, 1e-9)
  close(r.bands[0].autoCostPerCase, 2.25, 1e-9)
  close(r.bands[0].reviewCostPerCase, 5.5, 1e-9)
  assert.equal(breakEven(0, 4, 0.99), null)
  assert.ok(breakEven(2, 4, 0.99) < 0) // errors cheaper than a review: auto always pays
  // dearer errors push the threshold up; cheaper reviews do too
  assert.equal(thresholds({ ...DEFAULT_ESCALATION, errorCost: 5000 }).best.autoBands, 0)
  assert.equal(thresholds({ ...DEFAULT_ESCALATION, errorCost: 20 }).best.autoBands, 3) // $4.20 a review beats $5 of error at 75%
  assert.equal(thresholds({ ...DEFAULT_ESCALATION, errorCost: 8 }).best.autoBands, 5)
  assert.ok(thresholds({ ...DEFAULT_ESCALATION, hourlyCost: 200 }).best.autoBands > 1)
})

test('escalation: shares that do not add up to 100 are normalised and flagged', () => {
  const doubled = thresholds({ ...DEFAULT_ESCALATION, bands: DEFAULT_ESCALATION.bands.map((b) => ({ ...b, sharePct: b.sharePct * 2 })) })
  assert.equal(doubled.sharesOk, false)
  assert.equal(doubled.sharesTotal, 200)
  const base = thresholds(DEFAULT_ESCALATION)
  doubled.options.forEach((o, k) => close(o.totalCost, base.options[k].totalCost, 1e-6))
  assert.equal(doubled.best.autoBands, base.best.autoBands)
  const short = thresholds({ ...DEFAULT_ESCALATION, bands: [{ sharePct: 50, accuracyPct: 99 }, { sharePct: 0, accuracyPct: 90 }, { sharePct: 0, accuracyPct: 80 }, { sharePct: 0, accuracyPct: 70 }, { sharePct: 0, accuracyPct: 50 }] })
  assert.equal(short.sharesOk, false)
  close(short.options[1].autoRate, 1) // the only band holds every case
  assert.ok(thresholds({ ...DEFAULT_ESCALATION, bands: DEFAULT_ESCALATION.bands.map((b, i) => ({ ...b, sharePct: i === 0 ? 55.01 : b.sharePct })) }).sharesOk)
})

test('escalation: zero volume, 0% and 100% accuracy, junk input', () => {
  const zero = thresholds({ ...DEFAULT_ESCALATION, casesPerMonth: 0 })
  assert.ok(zero.options.every((o) => o.totalCost === 0 && o.costPerCase === 0))
  assert.equal(zero.best.autoBands, 0) // a tie keeps the cautious option
  const perfect = thresholds({ ...DEFAULT_ESCALATION, bands: DEFAULT_ESCALATION.bands.map((b) => ({ ...b, accuracyPct: 100 })) })
  assert.equal(perfect.best.autoBands, 5)
  assert.equal(perfect.options[5].errors, 0)
  assert.equal(perfect.options[5].totalCost, 0)
  const hopeless = thresholds({ ...DEFAULT_ESCALATION, bands: DEFAULT_ESCALATION.bands.map((b) => ({ ...b, accuracyPct: 0 })) })
  assert.equal(hopeless.best.autoBands, 0)
  close(hopeless.options[5].errors, 10000)
  // perfect reviewers: reviewed cases carry no errors
  const humans = thresholds({ ...DEFAULT_ESCALATION, humanAccuracyPct: 100 })
  assert.equal(humans.options[0].errors, 0)
  close(humans.breakEvenAccuracy, 1 - 4 / 150)
  // accuracy above 100 is capped; negatives and NaN count as zero
  const junk = thresholds({ casesPerMonth: NaN, bands: [{ sharePct: -5, accuracyPct: 140 }], errorCost: -1, minutesPerReview: NaN, hourlyCost: 40, humanAccuracyPct: 120 })
  assert.equal(junk.sharesTotal, 0)
  assert.ok(junk.options.every((o) => o.totalCost === 0))
  assert.equal(junk.breakEvenAccuracy, null)
  assert.equal(thresholds({ ...DEFAULT_ESCALATION, bands: [] }).sharesOk, false)
})

test('escalation: flags bands whose accuracy rises as confidence falls', () => {
  const bands = DEFAULT_ESCALATION.bands.map((b, i) => (i === 2 ? { ...b, accuracyPct: 97 } : b))
  assert.equal(thresholds({ ...DEFAULT_ESCALATION, bands }).uncalibrated, true)
})

// --- RAG vs long context
test('rag vs long context: cache writes and reads priced on the default scenario', () => {
  const r = compareRag(DEFAULT_RAG) // Sonnet 5.5: input 2, output 10, cache write 2.5, cache read 0.1
  const lc = r.longContext
  assert.equal(lc.fits, true)
  assert.equal(lc.writes, 40 * 30)
  assert.equal(lc.reads, 20000 - 1200)
  close(lc.writeCost, 1200 * 300000 * 2.5 / 1e6, 1e-6) // 900
  close(lc.readCost, 18800 * 300000 * 0.1 / 1e6, 1e-6) // 564
  close(lc.monthly, 900 + 564 + 20000 * (1500 * 2 + 400 * 10) / 1e6, 1e-6) // 1604
  close(lc.perQuery, 1604 / 20000, 1e-9)
  const perQuery = (1500 + 8 * 800) * 2 / 1e6 + 400 * 10 / 1e6 + 1500 * 0.1 / 1e6
  close(r.rag.perQuery, perQuery, 1e-12)
  const fixed = 70 + 4 * 300000 * 0.1 / 1e6 + (300000 * 0.1 / 1e6 + 4000) / 12
  close(r.rag.monthly, fixed + 20000 * perQuery, 1e-6)
  assert.equal(r.verdict, 'rag')
  close(r.difference, lc.monthly - r.rag.monthly, 1e-6)
  // writes can't exceed queries: at 500 queries a month every one writes the cache
  const sparse = compareRag({ ...DEFAULT_RAG, queriesPerMonth: 500 }).longContext
  assert.equal(sparse.writes, 500)
  assert.equal(sparse.reads, 0)
})

test('rag vs long context: Haiku switches to its long-context rate over 100K tokens', () => {
  const small = compareRag({ ...DEFAULT_RAG, model: 'claude-haiku-5-5', corpusTokens: 90000 })
  assert.equal(small.longContext.price.id, 'claude-haiku-5-5')
  const big = compareRag({ ...DEFAULT_RAG, model: 'claude-haiku-5-5', corpusTokens: 150000, queriesPerMonth: 1000, cacheWritesPerDay: 0 })
  assert.equal(big.longContext.price.id, 'claude-haiku-5-5-long')
  close(big.longContext.monthly, 1000 * 150000 * 0.05 / 1e6 + 1000 * (1500 * 0.5 + 400 * 2.5) / 1e6, 1e-9) // 9.25
  assert.equal(big.rag.price.id, 'claude-haiku-5-5') // the short RAG prompt stays on the normal rate
  // the switch is on corpus + query: 98,500 + 1,500 = 100,000 is not over
  assert.equal(compareRag({ ...DEFAULT_RAG, model: 'claude-haiku-5-5', corpusTokens: 98500 }).longContext.price.id, 'claude-haiku-5-5')
  assert.equal(compareRag({ ...DEFAULT_RAG, model: 'claude-haiku-5-5', corpusTokens: 98501 }).longContext.price.id, 'claude-haiku-5-5-long')
})

test('rag vs long context: a corpus over the context window rules long context out', () => {
  const edge = CONTEXT_WINDOW - DEFAULT_RAG.queryTokens - DEFAULT_RAG.outputTokens
  assert.equal(compareRag({ ...DEFAULT_RAG, corpusTokens: edge }).longContext.fits, true)
  const over = compareRag({ ...DEFAULT_RAG, corpusTokens: edge + 1, queriesPerMonth: 10 })
  assert.equal(over.longContext.fits, false)
  assert.equal(over.verdict, 'rag') // even at a volume where it would otherwise be cheaper
  assert.deepEqual(over.breakEvens, [])
  assert.equal(over.breakEven, null)
})

test('rag vs long context: break-even volumes cost the same both ways', () => {
  // default: crosses while every query still writes the cache
  const r = compareRag(DEFAULT_RAG)
  assert.equal(r.breakEvens.length, 1)
  const a1 = 300000 * 2.5 / 1e6 + (1500 * 2 + 400 * 10) / 1e6
  close(r.breakEven, r.rag.fixedMonthly / (a1 - r.rag.perQuery), 1e-6)
  const at = compareRag({ ...DEFAULT_RAG, queriesPerMonth: r.breakEven })
  close(at.longContext.monthly, at.rag.monthly, 1e-6)
  assert.equal(compareRag({ ...DEFAULT_RAG, queriesPerMonth: 100 }).verdict, 'long-context')
  // always-warm cache: one line against another, crossing on the read piece
  const warm = compareRag({ ...DEFAULT_RAG, cacheWritesPerDay: 0 })
  assert.equal(warm.breakEvens.length, 1)
  const atWarm = compareRag({ ...DEFAULT_RAG, cacheWritesPerDay: 0, queriesPerMonth: warm.breakEven })
  close(atWarm.longContext.monthly, atWarm.rag.monthly, 1e-6)
  // a small corpus is cheaper per query than RAG and has no fixed cost: no break-even
  const tiny = compareRag({ ...DEFAULT_RAG, corpusTokens: 10000, cacheWritesPerDay: 0 })
  assert.deepEqual(tiny.breakEvens, [])
  assert.equal(tiny.verdict, 'long-context')
  // junk input doesn't throw or go negative
  const junk = compareRag({ ...DEFAULT_RAG, queriesPerMonth: NaN, corpusTokens: -5, amortiseMonths: 0 })
  assert.equal(junk.longContext.monthly, 0)
  assert.ok(junk.rag.monthly >= 0)
})

// --- agent reliability
test('agent reliability: one step matches the closed form', () => {
  // p = 0.9, d = 0.8, r = 2, independent retries: qd = 0.08
  const o = stepOutcome({ name: 'x', accuracyPct: 90, catchPct: 80, retries: 2 }, 1)
  const g = 1 + 0.08 + 0.0064
  close(o.success, 0.9 * g)
  close(o.silent, 0.1 * 0.2 * g)
  close(o.escalate, 0.08 ** 3)
  close(o.attempts, g)
  close(o.success + o.silent + o.escalate, 1)
  // no check: errors pass silently and nothing is retried
  const blind = stepOutcome({ name: 'x', accuracyPct: 90, catchPct: 0, retries: 3 })
  assert.deepEqual([blind.success, blind.escalate, blind.attempts], [0.9, 0, 1])
  close(blind.silent, 0.1)
  // a perfect check with no retries escalates every error
  const gate = stepOutcome({ name: 'x', accuracyPct: 90, catchPct: 100, retries: 0 })
  close(gate.escalate, 0.1); close(gate.silent, 0)
  // correlated retries are worth less: fix = 0.5 halves a retry's chance of success
  const half = stepOutcome({ name: 'x', accuracyPct: 90, catchPct: 100, retries: 1 }, 0.5)
  close(half.success, 0.9 + 0.1 * 0.45)
  close(half.escalate, 0.1 * 0.55)
})

test('agent reliability: chain without checks is the product of accuracies', () => {
  const steps = Array.from({ length: 8 }, (_, k) => ({ name: `s${k}`, accuracyPct: 95, catchPct: 0, retries: 0 }))
  const r = reliability({ ...DEFAULT_RELIABILITY, steps })
  close(r.straightThrough, 0.95 ** 8)
  close(r.noChecks, 0.95 ** 8)
  close(r.wrong, 1 - 0.95 ** 8)
  assert.equal(r.escalated, 0)
  close(r.callsPerCase, 8)
  close(perStepNeeded(90, 8), 0.9 ** (1 / 8) * 100)
})

test('agent reliability: outcomes add up, shares add up, money is priced', () => {
  const r = reliability(DEFAULT_RELIABILITY)
  close(r.straightThrough + r.escalated + r.wrong, 1, 1e-12)
  close(r.steps.reduce((s, x) => s + x.wrongShare, 0), 1, 1e-12)
  close(r.steps.reduce((s, x) => s + x.escalationShare, 0), 1, 1e-12)
  assert.ok(r.straightThrough > r.noChecks, 'checks and retries beat the bare chain')
  close(r.steps[0].reach, 1)
  assert.ok(r.steps[4].reach < 1)
  close(r.wrongPerMonth, r.wrong * 5000, 1e-9)
  close(r.reviewHours, r.escalatedPerMonth * 8 / 60, 1e-9)
  close(r.totalCostPerMonth, r.wrongPerMonth * 120 + r.reviewHours * 45, 1e-6)
  // "Decide" (92%, 60% caught) is the weakest step
  assert.equal(r.weakest, 3)
  // fixing its check lowers wrong outputs and raises escalations
  const better = withBetterCheck(DEFAULT_RELIABILITY, 3, 95)
  assert.ok(better.wrong < r.wrong)
  assert.ok(better.escalated > r.escalated)
  // the helper never lowers a check
  close(withBetterCheck(DEFAULT_RELIABILITY, 2, 10).wrong, r.wrong, 1e-12)
})

test('agent reliability: junk and empty input', () => {
  const empty = reliability({ ...DEFAULT_RELIABILITY, steps: [] })
  assert.deepEqual([empty.straightThrough, empty.wrong, empty.escalated, empty.weakest], [1, 0, 0, -1])
  const junk = reliability({ ...DEFAULT_RELIABILITY, casesPerMonth: NaN, errorCost: -1, steps: [{ name: '', accuracyPct: 140, catchPct: -20, retries: 99 }] })
  close(junk.straightThrough, 1)
  assert.equal(junk.totalCostPerMonth, 0)
  assert.equal(junk.weakest, -1)
})
