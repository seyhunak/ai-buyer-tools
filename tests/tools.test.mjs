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
