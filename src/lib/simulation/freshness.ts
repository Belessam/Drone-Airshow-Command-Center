/**
 * Freshness — utilities for evaluating data freshness of drone positions.
 */

import type { FreshnessLevel, FreshnessInfo, FreshnessConfig } from './types'
import { DEFAULT_FRESHNESS_CONFIG } from './types'

/**
 * Evaluate the freshness level based on elapsed time since last confirmed update.
 */
export function evaluateFreshness(
  elapsedSeconds: number,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG,
): FreshnessInfo {
  let level: FreshnessLevel
  let color: string
  let positionConfidence: 'high' | 'medium' | 'low' | 'minimal'

  if (elapsedSeconds <= config.freshThreshold) {
    level = 'fresh'
    color = '#22c55e'
    positionConfidence = 'high'
  } else if (elapsedSeconds <= config.recentThreshold) {
    level = 'recent'
    color = '#eab308'
    positionConfidence = 'medium'
  } else if (elapsedSeconds <= config.staleThreshold) {
    level = 'stale'
    color = '#F2994A'
    positionConfidence = 'low'
  } else {
    level = 'critical'
    color = '#EF4444'
    positionConfidence = 'minimal'
  }

  const labels: Record<FreshnessLevel, string> = {
    fresh: 'Fresh',
    recent: 'Recent',
    stale: 'Stale',
    critical: 'Critical',
  }

  return {
    level,
    label: labels[level],
    color,
    elapsedSeconds,
    positionConfidence,
  }
}

/**
 * Format elapsed time into a human-readable string.
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s ago`
  }
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (minutes < 60) {
    return `${minutes}m ${secs}s ago`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m ago`
}

/**
 * Get a warning message based on freshness level.
 */
export function getFreshnessWarning(level: FreshnessLevel): string | null {
  switch (level) {
    case 'stale':
      return 'Estimated position may be inaccurate.'
    case 'critical':
      return 'Estimated position is significantly outdated. No recent confirmed updates.'
    default:
      return null
  }
}
