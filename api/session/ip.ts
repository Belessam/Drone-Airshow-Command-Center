/**
 * Vercel serverless API route — resolve the caller's public IP address.
 *
 * Route: GET /api/session/ip
 *
 * Returns:
 *   { "ip": "1.2.3.4" }
 *
 * On Vercel the `x-real-ip` / `x-forwarded-for` headers are set by the edge
 * network. The client calls this once during session init and stores the
 * result on the active_sessions row (ip_address / country / city columns).
 *
 * NOTE: This route deliberately returns NO data about sessions or users —
 * it only reports the caller's own public IP so the session manager can
 * display where a session originates. It contains no privileged data.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Vercel sets x-real-ip; x-forwarded-for may contain a comma-separated list.
  const forwarded = req.headers['x-forwarded-for']
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim()

  const ip =
    (Array.isArray(req.headers['x-real-ip'])
      ? req.headers['x-real-ip'][0]
      : req.headers['x-real-ip']) ||
    forwardedIp ||
    ''

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ip })
}
