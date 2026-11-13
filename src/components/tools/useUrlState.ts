"use client"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

// useState that mirrors itself into one query parameter (JSON), so a tool's
// current inputs survive a reload and a copied link reopens the same result.
// The first render uses `initial` (matches the static HTML); the URL value is
// applied after mount. A value whose shape doesn't match `initial` is ignored.
function sameShape(a: unknown, b: unknown): boolean {
  if (Array.isArray(a)) return Array.isArray(b)
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object" || Array.isArray(b)) return false
    return Object.keys(a).every((k) => k in (b as object) && sameShape((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return typeof a === typeof b
}

export function useUrlState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  // State, not a ref: the write effect must wait for the render that already holds
  // the URL value. Writing earlier would put the defaults back into the URL, and a
  // remount (route transitions) would then read the defaults instead of the link.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key)
    if (raw != null) {
      try {
        const parsed = JSON.parse(raw)
        if (sameShape(initial, parsed)) setValue(parsed as T)
      } catch {
        /* malformed link: keep defaults */
      }
    }
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!loaded) return
    const q = new URLSearchParams(window.location.search)
    q.set(key, JSON.stringify(value))
    window.history.replaceState(null, "", `${window.location.pathname}?${q}${window.location.hash}`)
  }, [key, value, loaded])

  return [value, setValue]
}
