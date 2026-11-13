"use client"
import { useState } from "react"

// Copies the current URL, which every tool keeps in sync with its inputs,
// so the link reopens the same numbers. Calls gtag directly rather than
// @/lib/analytics so the ai-buyer-tools mirror (no analytics) still builds.
const track = (tool: string) => (window as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "share_tool_result", { tool })
export default function ShareResult({ tool }: { tool: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      track(tool)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the address bar still holds the link */
    }
  }
  return (
    <div className="tl-share">
      <button type="button" className="btn btn--secondary" onClick={copy} aria-live="polite">
        {copied ? "link copied" : "copy link to this result"}
      </button>
      <span className="label">the link reopens these exact inputs. send it to whoever signs off.</span>
    </div>
  )
}
