/**
 * Device Fingerprint — generates a persistent device identifier.
 *
 * Uses a hash of browser/OS/screen/cpu characteristics that survives
 * cookie deletion. The fingerprint is stable across sessions on the
 * same device but differs between devices.
 */

export interface DeviceFingerprint {
  deviceId: string
  browser: string
  browserVersion: string
  os: string
  platform: string
  language: string
  timezone: string
  screenResolution: string
  userAgent: string
}

/**
 * Normalize a User-Agent string to a concise browser name.
 */
function detectBrowser(ua: string): string {
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  if (ua.includes('Trident/') || ua.includes('MSIE')) return 'Internet Explorer'
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera'
  return 'Unknown'
}

/**
 * Extract browser version from User-Agent.
 */
function detectBrowserVersion(ua: string): string {
  const match = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/([\d.]+)/)
  if (match) return match[2]
  const ieMatch = ua.match(/(?:MSIE |rv:)([\d.]+)/)
  if (ieMatch) return ieMatch[1]
  return 'Unknown'
}

/**
 * Detect OS from User-Agent.
 */
function detectOS(ua: string): string {
  if (ua.includes('Windows NT 10')) return 'Windows 10'
  if (ua.includes('Windows NT 11')) return 'Windows 11'
  if (ua.includes('Windows NT 6.3')) return 'Windows 8.1'
  if (ua.includes('Windows NT 6.1')) return 'Windows 7'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    if (ua.includes('iPhone')) return 'iOS (iPhone)'
    return 'iOS (iPad)'
  }
  if (ua.includes('Mac OS X')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('CrOS')) return 'ChromeOS'
  return 'Unknown'
}

/**
 * Simple hash function for fingerprinting.
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Collect device fingerprint from browser environment.
 * The deviceId is a SHA-256 hash of stable characteristics.
 */
export async function collectDeviceFingerprint(): Promise<DeviceFingerprint> {
  const ua = navigator.userAgent || ''
  const browser = detectBrowser(ua)
  const browserVersion = detectBrowserVersion(ua)
  const os = detectOS(ua)
  const platform = navigator.platform || ''
  const language = navigator.language || ''
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const screenRes = `${screen.width}x${screen.height}x${screen.colorDepth}`

  // Raw fingerprint string — stable across sessions on same device
  const raw = [
    ua,
    platform,
    language,
    screenRes,
    timezone,
  ].join('|||')

  const deviceId = await hashString(raw)

  return {
    deviceId,
    browser,
    browserVersion,
    os,
    platform,
    language,
    timezone,
    screenResolution: screenRes,
    userAgent: ua,
  }
}
