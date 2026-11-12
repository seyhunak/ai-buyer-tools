import { StrictMode, useEffect, useState, type ComponentType } from "react"
import { createRoot } from "react-dom/client"
import { tools, TOOLS_REPO } from "@/data/tools"
import TokenCostEstimator from "@/components/tools/TokenCostEstimator"
import EuAiActAuditor from "@/components/tools/EuAiActAuditor"
import WorkflowFitScorer from "@/components/tools/WorkflowFitScorer"
import BuildVsBuy from "@/components/tools/BuildVsBuy"
import AccuracyProof from "@/components/tools/AccuracyProof"
import ModelRouting from "@/components/tools/ModelRouting"
import ReviewStaffing from "@/components/tools/ReviewStaffing"
import VendorScorecard from "@/components/tools/VendorScorecard"
import DpiaScreener from "@/components/tools/DpiaScreener"
import AgentLoopCost from "@/components/tools/AgentLoopCost"
import JudgeAgreement from "@/components/tools/JudgeAgreement"
import "./theme.css"
import "@/components/tools/tools.css"

const UI: Record<string, ComponentType> = {
  "ai-token-cost-estimator": TokenCostEstimator,
  "eu-ai-act-compliance-auditor": EuAiActAuditor,
  "agent-workflow-fit-scorer": WorkflowFitScorer,
  "ai-build-vs-buy-calculator": BuildVsBuy,
  "ai-accuracy-proof-calculator": AccuracyProof,
  "ai-model-routing-calculator": ModelRouting,
  "human-review-staffing-calculator": ReviewStaffing,
  "ai-vendor-scorecard": VendorScorecard,
  "gdpr-dpia-screener": DpiaScreener,
  "agent-loop-cost-calculator": AgentLoopCost,
  "llm-judge-agreement-calculator": JudgeAgreement,
}

// Hash routes (#/ai-token-cost-estimator) so the build works on any static host.
const current = () => window.location.hash.replace(/^#\/?/, "").split("?")[0]

function App() {
  const [slug, setSlug] = useState(current())
  useEffect(() => {
    const on = () => { setSlug(current()); window.scrollTo(0, 0) }
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  const tool = tools.find((t) => t.slug === slug)
  const Tool = tool ? UI[tool.slug] : undefined
  useEffect(() => { document.title = tool ? tool.name : "Free AI tools" }, [tool])
  return (
    <div className="tl-wrap">
      {tool && Tool ? (
        <>
          <header className="tl-intro">
            <a href="#/" className="label tl-back">all tools</a>
            <h1 className="display-xl">{tool.name.toLowerCase()}</h1>
            <p className="tl-lead">{tool.intro}</p>
          </header>
          <Tool />
          <section className="tl-section">
            <h2 className="section-head">questions</h2>
            <div className="tl-faq">{tool.faqs.map((f) => <div key={f.q}><h3>{f.q.toLowerCase()}</h3><p>{f.a}</p></div>)}</div>
          </section>
        </>
      ) : (
        <>
          <header className="tl-intro">
            <h1 className="display-xl">free ai tools</h1>
            <p className="tl-lead">Each tool does one job, runs in the browser, and sends nothing anywhere.</p>
          </header>
          <ul className="tl-cards">
            {tools.map((t) => (
              <li key={t.slug}><a href={`#/${t.slug}`} className="well tl-card"><span className="tl-card-name">{t.name.toLowerCase()}</span><span className="tl-card-desc">{t.description}</span></a></li>
            ))}
          </ul>
        </>
      )}
      <p className="tl-note" style={{ marginTop: "var(--space-2xl)" }}>
        Open source (MIT): <a href={TOOLS_REPO}>{TOOLS_REPO.replace("https://", "")}</a> · hosted at <a href="https://seyhunakyurek.com/tools">seyhunakyurek.com/tools</a>
      </p>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
