/**
 * Coordinate conversion utilities for site location input.
 *
 * Supports four formats:
 *   1. MGRS                     — e.g. "38R PU 12345 67890"
 *   2. Decimal Degrees (DD)     — e.g. "28.432800, 45.970800"
 *   3. Degrees Decimal Minutes  — e.g. "28°25.968'N, 45°58.248'E"
 *   4. Degrees Minutes Seconds  — e.g. "28°25'58.1\"N, 45°58'14.9\"E"
 *
 * All formats convert to Decimal Degrees internally.
 * The simulation engine, distance/bearing calculations all use DD exclusively.
 */

import * as mgrs from 'mgrs'

export type CoordFormat = 'mgrs' | 'dd' | 'ddm' | 'dms'

/**
 * Parse an MGRS string and return { lat, lng } in Decimal Degrees.
 * Uses the `mgrs` library.
 */
export function parseMgrs(input: string): { lat: number; lng: number } {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('MGRS coordinate is required.')
  try {
    const coords = mgrs.toPoint(trimmed) as [number, number]
    return { lng: coords[0], lat: coords[1] }
  } catch {
    throw new Error('Invalid MGRS coordinate format.')
  }
}

/**
 * Validate and parse a Decimal Degrees string like "28.432800, 45.970800"
 * or "28.4328, 45.9708". Accepts comma, space, or tab separated.
 */
export function parseDecimalDegrees(input: string): { lat: number; lng: number } {
  const cleaned = input.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ',')
  const parts = cleaned.split(/[, ]+/).filter(Boolean)
  if (parts.length < 2) throw new Error('Expected two numbers: latitude, longitude.')
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid numeric coordinates.')
  if (lat < -90 || lat > 90) throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`)
  if (lng < -180 || lng > 180) throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`)
  return { lat, lng }
}

/**
 * Regex for Degrees Decimal Minutes (DDM):
 *   28°25.968'N  or  28°25.968' S
 *   45°58.248'E  or  45°58.248' W
 */
const DDM_REGEX = /^\s*(\d{1,3})°\s*(\d{1,2}\.?\d*)'\s*([NSEWnsew])\s*$/

/**
 * Parse a Degrees Decimal Minutes string.
 * Accepts "28°25.968'N" or "28°25.968' N" (spaces tolerant).
 */
export function parseDdm(input: string): { lat: number; lng: number } {
  const parts = input.trim().split(/[,;/\s]+/).filter(Boolean)
  if (parts.length < 2) throw new Error('Expected two DDM values separated by comma or space.')

  const parseOne = (s: string): number => {
    const m = DDM_REGEX.exec(s)
    if (!m) throw new Error(`Invalid DDM format: "${s}". Expected e.g. "28°25.968'N"`)
    const degrees = parseInt(m[1], 10)
    const minutes = parseFloat(m[2])
    const hemisphere = m[3].toUpperCase()
    let dd = degrees + minutes / 60
    if (hemisphere === 'S' || hemisphere === 'W') dd = -dd
    return dd
  }

  const lat = parseOne(parts[0])
  const lng = parseOne(parts[1])

  if (lat < -90 || lat > 90) throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`)
  if (lng < -180 || lng > 180) throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`)
  return { lat, lng }
}

/**
 * Regex for Degrees Minutes Seconds (DMS):
 *   28°25'58.1"N  or  28° 25' 58.1" N
 */
const DMS_REGEX = /^\s*(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}\.?\d*)"\s*([NSEWnsew])\s*$/

/**
 * Parse a Degrees Minutes Seconds string.
 * Accepts "28°25'58.1\"N" or "28°25'58.1\" N".
 */
export function parseDms(input: string): { lat: number; lng: number } {
  const parts = input.trim().split(/[,;/\s]+/).filter(Boolean)
  if (parts.length < 2) throw new Error('Expected two DMS values separated by comma or space.')

  const parseOne = (s: string): number => {
    const m = DMS_REGEX.exec(s)
    if (!m) throw new Error(`Invalid DMS format: "${s}". Expected e.g. "28°25'58.1\"N"`)
    const degrees = parseInt(m[1], 10)
    const minutes = parseInt(m[2], 10)
    const seconds = parseFloat(m[3])
    const hemisphere = m[4].toUpperCase()
    let dd = degrees + minutes / 60 + seconds / 3600
    if (hemisphere === 'S' || hemisphere === 'W') dd = -dd
    return dd
  }

  const lat = parseOne(parts[0])
  const lng = parseOne(parts[1])

  if (lat < -90 || lat > 90) throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`)
  if (lng < -180 || lng > 180) throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`)
  return { lat, lng }
}

// ─── Conversion TO user-facing formats ───

/**
 * Convert Decimal Degrees to Degrees Decimal Minutes string.
 * lat: 28.4328 → "28°25.968'N"
 * lng: 45.9708 → "45°58.248'E"
 */
export function ddToDdm(lat: number, lng: number): { latStr: string; lngStr: string } {
  const latAbs = Math.abs(lat)
  const lngAbs = Math.abs(lng)
  const latDeg = Math.floor(latAbs)
  const latMin = (latAbs - latDeg) * 60
  const lngDeg = Math.floor(lngAbs)
  const lngMin = (lngAbs - lngDeg) * 60
  return {
    latStr: `${latDeg}°${latMin.toFixed(3)}'${lat >= 0 ? 'N' : 'S'}`,
    lngStr: `${lngDeg}°${lngMin.toFixed(3)}'${lng >= 0 ? 'E' : 'W'}`,
  }
}

/**
 * Convert Decimal Degrees to Degrees Minutes Seconds string.
 * lat: 28.4328 → "28°25'58.1\"N"
 * lng: 45.9708 → "45°58'14.9\"E"
 */
export function ddToDms(lat: number, lng: number): { latStr: string; lngStr: string } {
  const latAbs = Math.abs(lat)
  const lngAbs = Math.abs(lng)
  const latDeg = Math.floor(latAbs)
  const latMinFull = (latAbs - latDeg) * 60
  const latMin = Math.floor(latMinFull)
  const latSec = (latMinFull - latMin) * 60
  const lngDeg = Math.floor(lngAbs)
  const lngMinFull = (lngAbs - lngDeg) * 60
  const lngMin = Math.floor(lngMinFull)
  const lngSec = (lngMinFull - lngMin) * 60
  return {
    latStr: `${latDeg}°${latMin}'${latSec.toFixed(1)}"${lat >= 0 ? 'N' : 'S'}`,
    lngStr: `${lngDeg}°${lngMin}'${lngSec.toFixed(1)}"${lng >= 0 ? 'E' : 'W'}`,
  }
}

/**
 * Convert Decimal Degrees to DD string (comma separated).
 */
export function ddToDdString(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Try to auto-detect which format a raw input string is in.
 * Returns the guessed format or 'dd' as default.
 */
export function detectFormat(input: string): CoordFormat {
  const trimmed = input.trim()
  // Check DMS first (has °, ', ")
  if (/°.*'.*"/.test(trimmed)) return 'dms'
  // Check DDM (has °, ' but no ")
  if (/°.*'/.test(trimmed) && !/°.*'.*"/.test(trimmed)) return 'ddm'
  // Check MGRS (letters+numbers with spaces, typical grid)
  if (/^[\dA-Za-z]{2,}\s+[\dA-Za-z]+\s+\d+\s+\d+/.test(trimmed) || /^[\dA-Za-z]{2,}\s+\d{5}\s+\d{5}/.test(trimmed)) return 'mgrs'
  // Default: DD
  return 'dd'
}
