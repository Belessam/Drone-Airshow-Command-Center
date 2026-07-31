/**
 * Shared fetch utility with rate-limit handling, timeout, and health tracking.
 *
 * All providers use this function to make HTTP requests.
 * It handles:
 *   - 10s timeout via AbortController
 *   - 420/429 rate-limit detection (returns null, preserving cache)
 *   - Network error logging
 *   - Response time tracking for diagnostics
 */

export async function fetchJson(
  url: string,
  providerName: string,
  options?: { signal?: AbortSignal },
): Promise<any | null> {
  console.log(`[AIRCRAFT] [${providerName}] GET ${url}`)

  const startTime = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const combinedSignal = options?.signal
    ? combineSignals(options.signal, controller.signal)
    : controller.signal

  try {
    const res = await fetch(url, { signal: combinedSignal })
    clearTimeout(timeout)

    const elapsed = Math.round(performance.now() - startTime)

    if (res.status === 420 || res.status === 429) {
      console.warn(`[AIRCRAFT] [${providerName}] Rate limited (${res.status}) after ${elapsed}ms`)
      return null
    }
    if (!res.ok) {
      console.warn(`[AIRCRAFT] [${providerName}] HTTP ${res.status} after ${elapsed}ms`)
      return null
    }

    console.log(`[AIRCRAFT] [${providerName}] ${res.status} ${elapsed}ms`)
    return await res.json()
  } catch (err: any) {
    clearTimeout(timeout)
    if (err?.name === 'AbortError') {
      console.warn(`[AIRCRAFT] [${providerName}] Timeout after 12s`)
    } else {
      console.warn(`[AIRCRAFT] [${providerName}] Fetch failed:`, err?.message ?? err)
    }
    return null
  }
}

/**
 * Combine two AbortSignals — returns a signal that aborts when either does.
 */
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}