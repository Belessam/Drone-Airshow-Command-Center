/**
 * Vercel serverless API route — proxy for ADS-B provider requests.
 *
 * In production, the Vite dev proxy is not available.
 * This function proxies requests to avoid CORS and hides API keys from the browser.
 *
 * Route: GET /api/aircraft/proxy?provider={provider}&path={path}
 *
 * Example:
 *   GET /api/aircraft/proxy?provider=adsbLol&path=/lat/28/lon/45.9/dist/250
 *   → https://api.adsb.lol/v2/lat/28/lon/45.9/dist/250
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const PROVIDER_MAP: Record<string, { origin: string; prefix: string }> = {
  adsbLol: {
    origin: 'https://api.adsb.lol',
    prefix: '/v2',
  },
  adsbFi: {
    origin: 'https://opendata.adsb.fi',
    prefix: '/api/v3',
  },
  openSky: {
    origin: 'https://opensky-network.org',
    prefix: '/api',
  },
  airplanesLive: {
    origin: 'https://airplanes.live',
    prefix: '/api',
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { provider, path } = req.query
  const providerName = String(provider || '')
  const pathStr = String(path || '')

  const mapped = PROVIDER_MAP[providerName]
  if (!mapped) {
    res.status(400).json({ error: `Unknown provider: ${providerName}` })
    return
  }

  const url = `${mapped.origin}${mapped.prefix}${pathStr}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SkyGuard-Airshow-Command/1.0',
      },
    })

    if (!response.ok) {
      res.status(response.status).json({
        error: `Upstream ${response.status}`,
        provider: providerName,
      })
      return
    }

    const data = await response.json()
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30')
    res.status(200).json(data)
  } catch (err: any) {
    console.error(`[PROXY] ${providerName} error:`, err?.message ?? err)
    res.status(502).json({
      error: 'Upstream fetch failed',
      provider: providerName,
    })
  }
}