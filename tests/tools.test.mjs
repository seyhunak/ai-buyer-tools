// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODELS, modelById } from '../src/lib/tools/pricing.ts'
import { estimate, fromQuery, DEFAULT_INPUT } from '../src/lib/tools/token-cost.ts'
import { wilson, requiredSampleSize, zeroFailureTests, judgeClaim } from '../src/lib/tools/accuracy.ts'
import { classify, EMPTY_ANSWERS, toMarkdown } from '../src/lib/tools/eu-ai-act.ts'
import { scoreFit, DEFAULT_FIT } from '../src/lib/tools/workflow-fit.ts'
import { compare, DEFAULT_BVB } from '../src/lib/tools/build-vs-buy.ts'

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
