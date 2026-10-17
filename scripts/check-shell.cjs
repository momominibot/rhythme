#!/usr/bin/env node
/* Real Chromium layout/interaction checks. Uses a fresh browser profile, never user storage.
 * Requires Playwright (installed externally or OVULUNA_PLAYWRIGHT_MODULE pointing to it).
 * Serve this checkout locally, then run:
 * OVULUNA_TEST_URL=http://localhost:4197 node scripts/check-shell.cjs
 * Optional OVULUNA_CHROME_PATH selects an existing Chrome executable.
 * This bounded shell suite is not a WCAG audit or physical iOS validation.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.OVULUNA_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = new URL(process.env.OVULUNA_TEST_URL || 'http://localhost:4197');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use an isolated local preview, not production.');
const chrome = process.env.OVULUNA_CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
const launchOptions = { headless: true };
if (chrome) launchOptions.executablePath = chrome;
const reports = [];
const twoFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function geometry(page) {
  return page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const content = document.querySelector('.app > .scroll, .app > .content');
    const controls = [...document.querySelectorAll('.top a, .top button, .nav a, .bottom-nav a')]
      .filter(element => element.getClientRects().length)
      .map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim(), ...element.getBoundingClientRect().toJSON() }));
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, top: box('.top'), nav: box('.nav, .bottom-nav'), app: box('.app'), content: content.getBoundingClientRect().toJSON(), controls, mode: document.documentElement.dataset.fontMode };
  });
}
function assertShell(g, label) {
  const tolerance = 1;
  assert.ok(g.content.top >= g.top.bottom + 7, label + ': content is hidden under top bar');
  for (const control of g.controls) {
    assert.ok(control.width >= 43.9 && control.height >= 43.9, label + ': small target ' + control.label);
    assert.ok(control.left >= -tolerance && control.right <= g.width + tolerance, label + ': off-screen target ' + control.label);
  }
  assert.ok(Math.abs(g.app.left - g.top.left) <= tolerance && Math.abs(g.app.right - g.top.right) <= tolerance, label + ': header alignment');
  assert.ok(Math.abs(g.app.left - g.nav.left) <= tolerance && Math.abs(g.app.right - g.nav.right) <= tolerance, label + ': bottom nav alignment');
}
(async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 320, height: 780 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Avoid external accounts, analytics and AI endpoints; browser uses local assets/fallback fonts.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  try {
    const pages = ['home.html', 'learn.html', 'tcm-hub.html', 'bio-age.html', 'ovarian-age.html', 'learn-biomarkers.html', 'profile.html'];
    for (const width of [320, 390, 768]) {
      for (const file of pages) {
        await page.setViewportSize({ width, height: 780 });
        await page.goto(new URL(file, base).href, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('html[data-shell-ready]');
        await page.evaluate(() => { localStorage.setItem('ovuluna_fontsize', 'xlarge'); localStorage.setItem('ovuluna_theme', 'dark'); });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('html[data-shell-ready]');
        await twoFrames(page);
        assert.ok((await page.locator('body').innerText()).length > 100, file + ': blank page');
        const g = await geometry(page);
        assertShell(g, file + ' @' + width);
        if (file === 'home.html') {
          const arcs = await page.locator('#mysticalRingSvg path').evaluateAll(elements => elements.map(element => ({ offset: getComputedStyle(element).strokeDashoffset, array: element.style.strokeDasharray })));
          assert.equal(arcs.length, 4, 'Home phase arcs missing');
          assert.ok(arcs.every(arc => parseFloat(arc.offset) === 0 && arc.array === ''), 'Home arcs were hidden by generic animation');
        }
        // This covers representative real pages, not every specialized chart/table in the app.
        assert.ok(g.documentWidth <= width + 1, file + ' @' + width + ': horizontal page overflow ' + g.documentWidth);
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await twoFrames(page);
        const clearance = await page.evaluate(() => {
          const content = document.querySelector('.app > .scroll, .app > .content');
          const children = [...content.children].filter(element => element.getClientRects().length);
          return { lastBottom: children.at(-1).getBoundingClientRect().bottom, navTop: document.querySelector('.nav, .bottom-nav').getBoundingClientRect().top };
        });
        assert.ok(clearance.lastBottom <= clearance.navTop - 7, file + ': final content is hidden under nav');
        reports.push({ page: file, width, text: 'A++', theme: 'dark', topHeight: g.top.height, navHeight: g.nav.height, mode: g.mode });
      }
    }
    console.log('PASS 21 real-page shell layouts: 320/390/768px, A++, dark, both nav/content variants.');

    // Test effective text geometry, rather than merely checking CSS declarations.
    for (const file of ['learn.html', 'tcm-hub.html', 'bio-age.html']) {
      await page.setViewportSize({ width: 390, height: 780 });
      await page.goto(new URL(file, base).href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('html[data-shell-ready]');
      while (await page.getAttribute('html', 'data-fontsize') !== 'medium') await page.locator('.font-toggle').click();
      await page.evaluate(() => {
        const probe = document.createElement('span'); probe.id = 'shell-type-probe'; probe.textContent = 'Ovuluna';
        probe.style.cssText = 'display:inline-block;line-height:1;white-space:nowrap';
        if (document.documentElement.dataset.fontMode === 'rem') probe.style.fontSize = '1rem';
        document.querySelector('.app > .scroll, .app > .content').append(probe);
      });
      const sizes = [];
      for (const level of ['medium', 'large', 'xlarge']) {
        await twoFrames(page);
        assert.equal(await page.getAttribute('html', 'data-fontsize'), level);
        sizes.push(await page.locator('#shell-type-probe').evaluate(element => element.getBoundingClientRect().height));
        assert.match(await page.locator('.font-toggle').getAttribute('aria-label'), /Text size:/);
        if (level !== 'xlarge') await page.locator('.font-toggle').click();
      }
      assert.ok(Math.abs(sizes[1] / sizes[0] - 1.15) < .02, file + ': A+ scaled more than once');
      assert.ok(Math.abs(sizes[2] / sizes[0] - 1.3) < .02, file + ': A++ scaled more than once');
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.getAttribute('html', 'data-fontsize'), 'xlarge');
      reports.push({ page: file, effectiveTextHeights: sizes });
    }
    console.log('PASS text grows once at100/115/130% in px, inherited and rem layouts; preference persists.');

    // Simulated CSS safe-area inputs test the spacing contract. This is not an iPhone-notch test.
    await page.goto(new URL('bio-age.html', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('html[data-shell-ready]');
    const before = await geometry(page);
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--shell-safe-top', '44px');
      document.documentElement.style.setProperty('--shell-safe-bottom', '34px');
    });
    await twoFrames(page); await twoFrames(page);
    const after = await geometry(page);
    assert.ok(Math.abs(after.top.height - before.top.height - 44) <= 1);
    assert.ok(Math.abs(after.nav.height - before.nav.height - 34) <= 1);
    assertShell(after, 'simulated safe areas');
    // Header wraps when narrow; its new height must also reserve space.
    await page.setViewportSize({ width: 280, height: 780 }); await twoFrames(page); await twoFrames(page);
    assertShell(await geometry(page), 'wrapped header');
    console.log('PASS safe-area reservation and responsive header remeasurement.');

    const theme = await page.getAttribute('html', 'data-theme');
    await page.locator('.theme-toggle').click();
    assert.notEqual(await page.getAttribute('html', 'data-theme'), theme);
    assert.equal(await page.locator('.theme-toggle').getAttribute('aria-pressed'), theme === 'dark' ? 'false' : 'true');
    // Keyboard navigation, not programmatic focus after a pointer click, activates :focus-visible.
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focus = await page.locator('.theme-toggle').evaluate(element => getComputedStyle(element).outlineStyle);
    assert.notEqual(focus, 'none');
    console.log('PASS theme toggle state and visible keyboard focus.');

    // Isolated real animation code: charts/counters are final immediately in reduced motion.
    const fixture = '<html><head></head><body><div class="app"><div class="brandline">Ovuluna</div><div class="scroll"><span class="count" data-to="42">0</span><span data-count="27.5">0</span><svg width="200" height="100"><path class="anim-line" d="M0 0 L100 100" stroke="purple" style="stroke-dashoffset:150"></path><circle class="progress-only" r="20" cx="50" cy="50" style="stroke-dashoffset:75"></circle><circle r="10" stroke-dasharray="30 60"></circle></svg><svg id="mysticalRingSvg"><path class="owned-chart" d="M0 0 L100 100" stroke="purple"></path><circle class="owned-ring" r="20" stroke-dasharray="30 60" style="stroke-dashoffset:37"></circle></svg><div id="hormone-plot"><svg><path class="owned-chart" d="M0 0 L100 100" stroke="purple"></path></svg></div><svg data-no-auto-animation><path class="owned-chart" d="M0 0 L100 100" stroke="purple"></path></svg></div></div></body></html>';
    await page.setContent(fixture);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'anim.css'), 'utf8') });
    // Exercise the actual PPG ring markup, with a simulated controller-owned offset.
    await page.evaluate(html => {
      const source = new DOMParser().parseFromString(html, 'text/html').querySelector('#countdownRing');
      if (!source) throw new Error('PPG progress selector changed; review its opt-out');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.append(document.importNode(source, true)); document.body.append(svg);
      document.getElementById('countdownRing').style.strokeDashoffset = '119';
    }, fs.readFileSync(path.join(root, 'ppg.html'), 'utf8'));
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'anim.js'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'appnav.js'), 'utf8') });
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
    assert.equal(await page.locator('.count').innerText(), '42');
    assert.equal(await page.locator('[data-count]').innerText(), '27.5');
    assert.equal(await page.locator('.anim-line').evaluate(element => parseFloat(getComputedStyle(element).strokeDashoffset)), 0);
    assert.equal(await page.locator('.progress-only').evaluate(element => parseFloat(getComputedStyle(element).strokeDashoffset)), 75);
    await page.locator('.brandline').click();
    assert.equal(await page.locator('body > i').count(), 0, 'Decorative Web Animations still created');
    assert.equal(await page.locator('circle[stroke-dasharray]:not(.owned-ring):not(#countdownRing)').evaluate(element => parseFloat(element.style.strokeDashoffset)), 0);
    assert.equal(await page.locator('.owned-chart').evaluateAll(elements => elements.some(element => element.classList.contains('anim-line') || element.style.strokeDasharray)), false);
    assert.equal(await page.locator('.owned-ring').evaluate(element => element.style.strokeDashoffset), '37');
    assert.equal(await page.locator('#countdownRing').evaluate(element => element.style.strokeDashoffset), '119');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0);
    console.log('PASS reduced-motion final charts/counts, unchanged progress/component-owned charts, no petal animation.');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setContent('<html><head></head><body><svg><path id="plain-chart" d="M0 0 L100 100" stroke="purple" fill="none"></path></svg></body></html>');
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'appnav.js'), 'utf8') });
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
    assert.equal(await page.locator('#plain-chart').evaluate(element => parseFloat(element.style.strokeDashoffset)), 0);
    console.log('PASS generic chart remains visible when anim.css is absent.');
    assert.deepEqual(errors, [], 'JavaScript errors in checked pages');
    console.log(JSON.stringify({ status: 'passed', observations: reports, limits: 'Chromium with local/fallback fonts; representative pages only; real iOS safe areas and full WCAG/native Dynamic Type review remain open.' }, null, 2));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
