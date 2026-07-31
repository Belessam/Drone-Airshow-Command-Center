/**
 * Timestamp utilities for ADS-B aircraft data.
 *
 * The ADSB.lol API returns timestamps as:
 *   - `seen`: seconds ago that a message was received (relative)
 *   - `seen_pos`: seconds ago that position was last updated (relative)
 *   - `t`: ISO 8601 timestamp string (e.g. "2024-01-15T12:34:56Z") — server time
 *   - The top-level `now` field in the response is the server's current epoch seconds
 *
 * We convert relative offsets to absolute epoch ms using a provided `serverNowMs`
 * (or Date.now() as fallback).
 *
 * Priority for position freshness:
 *   seen_pos (converted)  → most accurate "how old is the position"
 *   seen (converted)      → fallback: how old is the latest message
 *   t (parsed)            → ISO timestamp string
 *   Date.now()            → last resort
 */

import type { AdsbAircraft } from './types'

/**
 * Convert a relative `seen` or `seen_pos` value (seconds ago) to an absolute
 * epoch-millisecond timestamp.
 *
 * @param secondsAgo - Value from the API's `seen` or `seen_pos` field
 * @param serverNowMs - The server's "now" timestamp in ms epoch (from API's `now` field * 1000)
 * @returns Absolute epoch-ms timestamp
 */
export function relativeToAbsolute(
  secondsAgo: number | undefined | null,
  serverNowMs: number,
): number | undefined {
  if (secondsAgo == null || secondsAgo < 0) return undefined
  return Math.max(0, serverNowMs - secondsAgo * 1000)
}

/**
 * Parse the ISO timestamp `t` field from ADSB.lol API.
 */
function parseTField(t: string | undefined): number | undefined {
  if (!t) return undefined
  const parsed = Date.parse(t)
  return isNaN(parsed) ? undefined : parsed
}

/**
 * Compute the best position timestamp from an AdsbAircraft record.
 *
 * Priority:
 *   1. seen_pos converted to absolute (most accurate position age)
 *   2. seen converted to absolute (message age)
 *   3. t field parsed
 *   4. now (fallback)
 */
export function computePositionTimestamp(
  ac: AdsbAircraft,
  serverNowMs: number,
): number {
  return (
    relativeToAbsolute(ac.seen_pos, serverNowMs) ??
    relativeToAbsolute(ac.seen, serverNowMs) ??
    parseTField(ac.t) ??
    serverNowMs
  )
}

/**
 * Compute the best "last seen" timestamp (message-level, not just position).
 */
export function computeLastSeenTimestamp(
  ac: AdsbAircraft,
  serverNowMs: number,
): number {
  return (
    relativeToAbsolute(ac.seen, serverNowMs) ??
    computePositionTimestamp(ac, serverNowMs)
  )
}

/**
 * Old signature — for backwards compatibility outside the merge pipeline.
 * Uses Date.now() as fallback since the server `now` isn't available everywhere.
 */
export function getBestTimestamp(ac: AdsbAircraft): number {
  const now = Date.now()
  return (
    relativeToAbsolute(ac.seen_pos, now) ??
    relativeToAbsolute(ac.seen, now) ??
    parseTField(ac.t) ??
    now
  )
}

/**
 * Convert server API `now` field (epoch seconds) to epoch ms.
 */
export function parseServerNow(apiNow: number | undefined): number {
  return typeof apiNow === 'number' ? apiNow * 1000 : Date.now()
}