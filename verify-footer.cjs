const fs = require('fs')
const { chromium } = require('C:/Users/جهــازي/AppData/Roaming/npm/node_modules/playwright')

const BASE_APP = 'http://localhost:5199'
const OUT = 'C:/Users/جهــازي/AppData/Local/Temp/claude/footer-shots'
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
const results = []
function log(viewport, section, ok, note = '') {
  results.push({ viewport, section, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${viewport}] ${section} ${note ? '— ' + note : ''}`)
}
const browser = await chromium.launch()
async function newPage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log(`  [PAGEERROR ${w}x${h}]`, e.message))
  await page.route('**/*', (r) => /fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.abort() : r.continue())
  return { ctx, page }
}
async function demoLogin(page) {
  await page.goto(BASE_APP + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2200)
}

// Shrink Material Symbols to realistic size (test env aborts the icon font)
async function iconShim(page) {
  await page.evaluate(() => {
    for (const ic of document.querySelectorAll('footer .material-symbols-outlined')) {
      ic.style.fontSize = '18px'; ic.style.width = '18px'; ic.style.height = '18px'
      ic.style.overflow = 'hidden'; ic.style.whiteSpace = 'nowrap'; ic.style.display = 'inline-block'
    }
  })
}

const MOBILE = [[360, 800], [390, 844], [412, 915], [430, 932]]

// Mobile footer checks
for (const [w, h] of MOBILE) {
  const { ctx, page } = await newPage(w, h)
  await demoLogin(page)
  await iconShim(page)
  await page.waitForTimeout(300)
  const f = await page.evaluate(() => {
    const footer = document.querySelector('footer')
    if (!footer) return { found: false }
    const fr = footer.getBoundingClientRect()
    const copyright = [...document.querySelectorAll('footer span')].find(s => s.textContent?.includes('Belal Essam'))
    const cr = copyright?.getBoundingClientRect()
    return {
      found: true,
      noHScroll: footer.scrollWidth <= footer.clientWidth + 1,
      footerScrollW: footer.scrollWidth, footerClientW: footer.clientWidth,
      vw: window.innerWidth,
      copyrightVisible: cr ? cr.width > 0 && cr.height > 0 && cr.top < window.innerHeight : false,
      copyrightText: copyright ? copyright.textContent.trim() : null,
      copyrightFont: copyright ? getComputedStyle(copyright).fontSize : null,
      copyrightSingleLine: copyright ? copyright.clientHeight <= 14 : false,
      copyrightWithinViewport: cr ? cr.left >= 0 && cr.right <= window.innerWidth : false,
      footerHeight: Math.round(fr.height),
    }
  })
  log(`${w}x${h}`, 'Footer: no horizontal scrolling', f.found && f.noHScroll, `sw=${f.footerScrollW} cw=${f.footerClientW} vw=${f.vw}`)
  log(`${w}x${h}`, 'Footer: copyright visible', f.copyrightVisible)
  log(`${w}x${h}`, 'Footer: copyright text correct', f.copyrightText === '© First Lieutenant / Belal Essam', `"${f.copyrightText}"`)
  log(`${w}x${h}`, 'Footer: copyright small font + single line', f.copyrightFont === '9px' && f.copyrightSingleLine, `fs=${f.copyrightFont} oneLine=${f.copyrightSingleLine}`)
  log(`${w}x${h}`, 'Footer: copyright within viewport (no overflow)', f.copyrightWithinViewport)
  // Ensure clocks still present
  const clocks = await page.evaluate(() => {
    const t = document.querySelector('footer')?.textContent || ''
    return t.includes('EGYPT') && t.includes('KSA')
  })
  log(`${w}x${h}`, 'Footer: clocks intact', clocks)
  await page.screenshot({ path: `${OUT}/footer-${w}x${h}.png`, timeout: 10000, animations: 'disabled' })
  await ctx.close()
}

// Desktop/tablet — unchanged
for (const [w, h] of [[768, 1024], [1440, 900]]) {
  const { ctx, page } = await newPage(w, h)
  await demoLogin(page)
  await iconShim(page)
  await page.waitForTimeout(300)
  const f = await page.evaluate(() => {
    const footer = document.querySelector('footer')
    if (!footer) return { found: false }
    const fr = footer.getBoundingClientRect()
    const isRow = getComputedStyle(footer).flexDirection === 'row'
    const copyrights = [...document.querySelectorAll('footer span')].filter(s => {
      const r = s.getBoundingClientRect()
      return s.textContent?.includes('Belal Essam') && r.width > 0 && r.height > 0
    })
    return {
      found: true,
      noHScroll: footer.scrollWidth <= footer.clientWidth + 1,
      footerHeight: Math.round(fr.height),
      rowLayout: isRow,
      copyrightCount: copyrights.length,
      // desktop (>=1024) should show the right-section copyright; tablet (sm..lg) should have NO copyright
    }
  })
  const desktopCopyright = await page.evaluate(() => {
    const right = [...document.querySelectorAll('footer div')].find(d => d.className?.includes('hidden lg:flex'))
    if (!right) return false
    return right.textContent?.includes('Belal Essam') || false
  })
  if (w >= 1024) {
    log(`${w}x${h}`, 'Desktop: footer unchanged (row layout, h-12)', f.found && f.rowLayout && f.footerHeight === 48, `h=${f.footerHeight} row=${f.rowLayout}`)
    log(`${w}x${h}`, 'Desktop: copyright in right section (unchanged)', desktopCopyright)
  } else {
    // tablet 768: no copyright (unchanged), row layout, h-12
    log(`${w}x${h}`, 'Tablet: footer unchanged (row, h-12, no copyright)', f.found && f.rowLayout && f.footerHeight === 48 && f.copyrightCount === 0, `h=${f.footerHeight} row=${f.rowLayout} copyrights=${f.copyrightCount}`)
  }
  log(`${w}x${h}`, 'Desktop/Tablet: footer no horizontal scroll', f.found && f.noHScroll)
  await page.screenshot({ path: `${OUT}/footer-${w}x${h}.png`, timeout: 10000, animations: 'disabled' })
  await ctx.close()
}

await browser.close()
const fails = results.filter(r => !r.ok)
console.log('\n═══════════════════════════════')
console.log(`TOTAL: ${results.length}  PASS: ${results.length - fails.length}  FAIL: ${fails.length}`)
if (fails.length) { for (const f of fails) console.log(`  ✗ [${f.viewport}] ${f.section} ${f.note}`) }
else console.log('ALL CHECKS PASSED')
console.log('═══════════════════════════════')
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1) })
