#!/usr/bin/env python3
"""End-to-end smoke test for Rhythme: serves the repo, drives the real pages in headless
Chromium at phone width and fails on anything a user would notice first. Network calls to the
Rhythme relay are blocked, so no model call is made and nothing leaves the machine.

Usage: python3 tools/e2e_smoke.py            (needs: pip install playwright; playwright install chromium)
Exit code 0 when every check passes. Used by .github/workflows/deploy.yml before Pages deploys."""
import asyncio, datetime, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 4399
BASE = "http://127.0.0.1:%d/" % PORT
TODAY = datetime.date.today().isoformat()
Y1 = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
Y2 = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
NOW = datetime.datetime.now().isoformat()

# a consenting, onboarded person with three entries; Luna's AI help off (the default)
DB = {"version": 1, "createdAt": NOW, "updatedAt": NOW,
      "profile": {"name": "Smoke", "outfit": "base", "lifeStage": "", "cycleLength": None, "periodLength": None, "onboarded": True,
                  "consent": {"v": 2, "at": NOW, "luna": False, "improve": False, "age13": True}},
      "events": [{"id": "s1", "type": "period", "date": Y1, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"flow": "medium"}},
                 {"id": "s2", "type": "sleep", "date": Y2, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"bedTime": "23:00", "wakeTime": "07:00", "quality": 4}},
                 {"id": "s3", "type": "food", "date": Y2, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"meal": "lunch", "foods": "chicken rice", "items": [], "tags": ["home-cooked"]}}],
      "summaries": [], "state": {"sleeping": None, "visited": {}, "tourDone": True}}

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  ok   " if ok else "  FAIL ") + name + (("  " + str(detail)[:160]) if detail and not ok else ""))

def serve():
    s = socket.socket(); s.settimeout(0.3)
    busy = s.connect_ex(("127.0.0.1", PORT)) == 0; s.close()
    if busy: return None
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        s = socket.socket(); s.settimeout(0.3)
        if s.connect_ex(("127.0.0.1", PORT)) == 0: s.close(); return p
        s.close(); time.sleep(0.1)
    raise SystemExit("static server did not start")

async def main():
    server = serve()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
            await ctx.add_init_script("localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB)))
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text else None)
            relay_calls = []
            async def block(route):
                relay_calls.append(route.request.url); await route.abort()
            await page.route("**/functions/v1/**", block)
            await page.route("**/*.supabase.co/**", block)

            # 1. the room boots, the consent gate stays closed for a consenting person, hotspots and nav exist
            r = await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(1200)
            check("room.html loads", r and r.status == 200, r and r.status)
            info = await page.evaluate("()=>({consent: document.querySelector('#consent')?.hidden, welcome: !!document.querySelector('#welcome:not([hidden])'), hots: document.querySelectorAll('.hotspot').length, tabs: document.querySelectorAll('nav a[data-tab]').length, hearts: document.querySelector('#heartsVal')?.textContent, width: document.documentElement.scrollWidth})")
            check("consent overlay stays hidden for a consenting person", info["consent"] is True, info)
            check("eight or more hotspots and the five tabs render", info["hots"] >= 8 and info["tabs"] == 5, info)
            check("no sideways scroll at phone width", info["width"] <= 390, info["width"])

            # 2. the Cycle tab opens a sheet with the calendar
            await page.goto(BASE + "room.html#cycle", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_timeout(900)
            cyc = await page.evaluate("()=>({sheet: !!document.querySelector('.sheet.on, .sheet:not([hidden])'), days: document.querySelectorAll('.rday, .rcal button, .rcal [data-date], [data-date], [data-day], .cal .day').length})")
            check("Cycle tab opens the calendar sheet", cyc["sheet"] and cyc["days"] >= 28, cyc)

            # 3. Luna's on-phone rules read a note without any relay call (AI help is off)
            await page.goto(BASE + "room.html#luna", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_timeout(900)
            await page.fill("#lunaIn", "slept 11pm to 7am, cramps 6/10")
            await page.click("#lunaSend"); await page.wait_for_timeout(500)
            luna = await page.evaluate("()=>({cards: document.querySelectorAll('.bub.confirm').length, text: [...document.querySelectorAll('.bub.confirm label span')].map(s=>s.textContent).join(' | ')})")
            check("Luna understood sleep and cramps on the phone", luna["cards"] >= 1 and "Sleep" in luna["text"] and "cramps" in luna["text"], luna)
            check("no relay call was made with AI help off", not relay_calls, relay_calls[:2])

            # 4. the food diary opens with its tabs
            await page.goto(BASE + "room.html#food", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_timeout(900)
            food = await page.evaluate("()=>({modes: document.querySelectorAll('.foodmodes button').length, panes: document.querySelectorAll('.dtabs button, .dpane').length})")
            check("food diary opens with its modes and panes", food["modes"] >= 2 and food["panes"] >= 2, food)

            # 5. journal: icon tiles, structured summary, the PDF downloads and is a PDF
            await page.goto(BASE + "journal.html", wait_until="networkidle"); await page.wait_for_timeout(900)
            jr = await page.evaluate("()=>({kpis: document.querySelectorAll('#shareKpis .kpi').length, pdfBtn: !!document.querySelector('#makePdf'), entries: document.querySelectorAll('#timeline .entry').length})")
            check("journal shows six tiles, the PDF button and the three entries", jr["kpis"] == 6 and jr["pdfBtn"] and jr["entries"] == 3, jr)
            async with page.expect_download() as dl:
                await page.click("#makePdf")
            d = await dl.value; path = os.path.join(ROOT, "tools", ".smoke.pdf"); await d.save_as(path)
            head = open(path, "rb").read(8); size = os.path.getsize(path); os.remove(path)
            check("PDF export starts with %PDF and has content", head.startswith(b"%PDF-1.4") and size > 1500, (head, size))
            check("download is branded Rhythme-summary-<date>.pdf", d.suggested_filename == "Rhythme-summary-%s.pdf" % TODAY, d.suggested_filename)

            # 6. evidence page and a Learn page with the room header; old screens redirect into the room
            r = await page.goto(BASE + "evidence.html", wait_until="networkidle")
            ev = await page.evaluate("()=>document.body.innerText.includes('E49')")
            check("evidence page lists E49", r.status == 200 and ev)
            await page.goto(BASE + "hormones.html", wait_until="networkidle"); await page.wait_for_timeout(400)
            hd = await page.evaluate("()=>({brand: document.querySelector('.rh-brand')?.textContent, tabs: document.querySelectorAll('nav.nav a').length, fab: !!document.querySelector('.mapfab')})")
            check("Learn page carries the Rhythme header and tabs, no old launcher", hd["brand"] == "RHYTHME" and hd["tabs"] == 5 and not hd["fab"], hd)
            await page.goto(BASE + "home.html", wait_until="load"); await page.wait_for_timeout(600)
            check("old home.html redirects into the room", page.url.endswith("room.html"), page.url)

            # 7. first launch without consent: the room shows the welcome, not the diary
            ctx2 = await browser.new_context(viewport={"width": 390, "height": 844})
            p2 = await ctx2.new_page(); await p2.route("**/functions/v1/**", lambda rt: rt.abort())
            await p2.goto(BASE + "room.html", wait_until="networkidle"); await p2.wait_for_timeout(900)
            fresh = await p2.evaluate("()=>({welcome: !!document.querySelector('#welcome:not([hidden])'), db: localStorage.getItem('ovumind_db_v1')})")
            check("fresh visitor sees the welcome and nothing is saved yet", fresh["welcome"] and (fresh["db"] is None or '"consent"' not in fresh["db"]), fresh)
            await p2.goto(BASE + "journal.html", wait_until="load"); await p2.wait_for_timeout(600)
            check("fresh visitor on another page is sent to the room first", p2.url.endswith("room.html"), p2.url)
            await ctx2.close()

            check("no page errors or console errors across the run", not errors, errors[:3])
            await browser.close()
    finally:
        if server: server.terminate()
    failed = [r for r in results if not r[1]]
    print("\n%d passed, %d failed" % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)

asyncio.run(main())
