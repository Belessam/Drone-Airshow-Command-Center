const { chromium } = require('C:/Users/جهــازي/AppData/Roaming/npm/node_modules/playwright')
;(async () => {
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } })
const page = await ctx.newPage()
await page.route('**/*', (r) => /fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.abort() : r.continue())
await page.goto('http://localhost:5199/dashboard', { waitUntil: 'domcontentloaded' })
await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(2200)
const info = await page.evaluate(() => {
  const footer = document.querySelector('footer')
  const spans = [...footer.querySelectorAll('span')].filter(s => s.textContent?.includes('Belal Essam'))
  return spans.map(s => {
    const cs = getComputedStyle(s)
    const r = s.getBoundingClientRect()
    return { display: cs.display, visible: r.width > 0 && r.height > 0, parentClass: (s.parentElement?.className||'').slice(0,40) }
  })
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
})().catch(e => { console.error('ERR', e); process.exit(1) })
