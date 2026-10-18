#!/usr/bin/env python3
"""End-to-end smoke test for Rhythme: serves the repo, drives the real pages in headless
Chromium at phone width and fails on anything a user would notice first. Network calls to the
Rhythme relay are blocked, so no model call is made and nothing leaves the machine.

Usage: python3 tools/e2e_smoke.py            (needs: pip install playwright; playwright install chromium)
Exit code 0 when every check passes. Used by .github/workflows/deploy.yml before Pages deploys."""
import asyncio, datetime, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close(); return port
PORT = free_port()
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
            await ctx.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB)))
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text else None)
            relay_calls, external = [], []
            async def gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url:
                    return await route.fulfill(status=200, content_type="text/css", body="")
                (relay_calls if "/functions/v1/" in url or ".supabase.co" in url else external).append(url)
                await route.abort()
            await page.route("**/*", gate)

            # 1. the room boots, the consent gate stays closed for a consenting person, hotspots and nav exist
            r = await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(1200)
            check("room.html loads", r and r.status == 200, r and r.status)
            info = await page.evaluate("()=>({consent: document.querySelector('#consent')?.hidden, welcome: !!document.querySelector('#welcome:not([hidden])'), hots: document.querySelectorAll('.hotspot').length, tabs: document.querySelectorAll('nav a[data-tab]').length, hearts: document.querySelector('#heartsVal')?.textContent, width: document.documentElement.scrollWidth})")
            check("consent overlay stays hidden for a consenting person", info["consent"] is True, info)
            check("eight or more hotspots and the five tabs render", info["hots"] >= 8 and info["tabs"] == 5, info)
            check("no sideways scroll at phone width", info["width"] <= 390, info["width"])

            # 2. the Cycle tab opens a sheet with the calendar
            await page.goto(BASE + "room.html#cycle", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] [data-date], #sheet[aria-hidden="false"] .rday', timeout=10000)
            cyc = await page.evaluate("()=>{var cells=document.querySelectorAll('#sheet [data-date], #sheet .rday'); return {sheet: document.querySelector('#sheet')?.getAttribute('aria-hidden') === 'false', title: document.querySelector('#sheetTitle')?.textContent.slice(0,13), days: cells.length, visible: (cells[0]?.getBoundingClientRect().height || 0) > 0};}")
            check("Cycle tab opens the calendar sheet with visible days", cyc["sheet"] and cyc["title"] == "Your calendar" and cyc["days"] >= 28 and cyc["visible"], cyc)

            # 3. Luna's on-phone rules read a note without any relay call (AI help is off)
            await page.goto(BASE + "room.html#luna", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector("#lunaIn", timeout=10000)
            await page.fill("#lunaIn", "slept 11pm to 7am, cramps 6/10")
            await page.click("#lunaSend"); await page.wait_for_timeout(500)
            luna = await page.evaluate("()=>({cards: document.querySelectorAll('.bub.confirm').length, text: [...document.querySelectorAll('.bub.confirm label span')].map(s=>s.textContent).join(' | ')})")
            check("Luna understood sleep and cramps on the phone", luna["cards"] >= 1 and "Sleep" in luna["text"] and "cramps" in luna["text"], luna)
            check("no relay call was made with AI help off", not relay_calls, relay_calls[:2])
            await page.click("#lunaSave"); await page.wait_for_timeout(400)
            await page.reload(wait_until="networkidle"); await page.wait_for_timeout(600)
            saved = await page.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1'));return db.events.filter(e=>e.date==='%s').map(e=>e.type).sort().join(',');}" % TODAY)
            check("saved entries survive a reload (sleep and symptom for today)", saved == "sleep,symptom", saved)

            # 4. the food diary opens with its tabs
            await page.goto(BASE + "room.html#food", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector(".foodmodes button", timeout=10000)
            food = await page.evaluate("()=>({modes: document.querySelectorAll('.foodmodes button').length, panes: document.querySelectorAll('.dtabs button, .dpane').length})")
            check("food diary opens with its modes and panes", food["modes"] >= 2 and food["panes"] >= 2, food)

            # 4b. the You tab shows the Your account row; a signed-out visitor makes no auth or data call
            await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] #youAccount .ygroup', timeout=10000)
            acct = await page.evaluate("()=>{var a=document.querySelector('#youAccount');return {label:a&&a.querySelector('.lbl')?a.querySelector('.lbl').textContent:null, email: !!(a&&a.querySelector('[data-ya=\"email-start\"]')), intro: ((a&&a.querySelector('.ya-intro')?a.querySelector('.ya-intro').textContent:'')||'').toLowerCase().indexOf('cloud backup')>=0};}")
            check("You tab shows the Your account row with email sign-in and the backup line", acct["label"] == "Your account" and acct["email"] and acct["intro"], acct)
            check("no sign-in or data request leaves the page for a signed-out person", not [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1" in u)], relay_calls[:3])

            # 5. journal: icon tiles, structured summary, the PDF downloads and is a PDF
            await page.goto(BASE + "journal.html", wait_until="networkidle"); await page.wait_for_timeout(900)
            jr = await page.evaluate("()=>({kpis: document.querySelectorAll('#shareKpis .kpi').length, pdfBtn: !!document.querySelector('#makePdf'), entries: document.querySelectorAll('#timeline .entry').length})")
            check("journal shows six tiles, the PDF button and the five entries", jr["kpis"] == 6 and jr["pdfBtn"] and jr["entries"] == 5, jr)
            async with page.expect_download() as dl:
                await page.click("#makePdf")
            d = await dl.value; path = os.path.join(ROOT, "tools", ".smoke.pdf"); await d.save_as(path)
            raw = open(path, "rb").read(); size = len(raw); os.remove(path)
            check("PDF export is a complete document with the clinician heading and the entries page", raw.startswith(b"%PDF-1.4") and raw.rstrip().endswith(b"%%EOF") and b"(Rhythme summary for your clinician)" in raw and b"/Count 2" in raw and size > 1500, (raw[:8], size))
            check("download is branded Rhythme-summary-<date>.pdf", d.suggested_filename == "Rhythme-summary-%s.pdf" % TODAY, d.suggested_filename)

            # 6. evidence page and a Learn page with the room header; old screens redirect into the room
            r = await page.goto(BASE + "evidence.html", wait_until="networkidle")
            ev = await page.evaluate("()=>document.body.innerText.includes('E49')")
            check("evidence page lists E49", r.status == 200 and ev)
            await page.goto(BASE + "hormones.html", wait_until="networkidle"); await page.wait_for_timeout(400)
            hd = await page.evaluate("()=>({brand: document.querySelector('.rh-brand')?.textContent, tabs: document.querySelectorAll('nav.nav a').length, fab: !!document.querySelector('.mapfab')})")
            check("Learn page carries the Rhythme header and tabs, no old launcher", hd["brand"] == "RHYTHME" and hd["tabs"] == 5 and not hd["fab"], hd)
            dests = {}
            for old_page, want_tab in [("home.html", "home"), ("cycle-log.html", "cycle"), ("diet.html", "food"), ("breathwork.html", "mind")]:
                await page.goto(BASE + old_page, wait_until="load")
                try: await page.wait_for_function("()=>location.pathname.endsWith('room.html') && document.querySelector('nav a.on')", timeout=10000)
                except Exception: pass
                if want_tab != "home":
                    try: await page.wait_for_selector('#sheet[aria-hidden="false"]', timeout=10000)
                    except Exception: pass
                dests[old_page] = await page.evaluate("()=>(location.pathname.endsWith('room.html') ? (document.querySelector('nav a.on')?.dataset.tab || 'home') : location.pathname)")
            check("old screens redirect into the room and open the right tab", all(dests[k] == v for k, v in [("home.html", "home"), ("cycle-log.html", "cycle"), ("diet.html", "food"), ("breathwork.html", "mind")]), dests)

            # 7. first launch without consent: the room shows the welcome, not the diary
            ctx2 = await browser.new_context(viewport={"width": 390, "height": 844})
            p2 = await ctx2.new_page(); await p2.route("**/*", gate)
            p2.on("pageerror", lambda e: errors.append("fresh pageerror: " + str(e)))
            p2.on("console", lambda m: errors.append("fresh console: " + m.text) if m.type == "error" and "favicon" not in m.text else None)
            await p2.goto(BASE + "room.html", wait_until="networkidle"); await p2.wait_for_timeout(900)
            fresh = await p2.evaluate("()=>({welcome: !!document.querySelector('#welcome:not([hidden])'), db: localStorage.getItem('ovumind_db_v1')})")
            check("fresh visitor sees the welcome and nothing is saved yet", fresh["welcome"] and (fresh["db"] is None or '"consent"' not in fresh["db"]), fresh)
            await p2.goto(BASE + "journal.html", wait_until="load"); await p2.wait_for_timeout(600)
            check("fresh visitor on another page is sent to the room first", p2.url.endswith("room.html"), p2.url)
            # the real consent controls: nothing optional pre-ticked, the button locked until the age tick
            await p2.goto(BASE + "room.html", wait_until="networkidle"); await p2.wait_for_timeout(700)
            await p2.click("#welcome .btn.primary"); await p2.wait_for_timeout(400)
            before = await p2.evaluate("()=>({shown: !document.querySelector('#consent').hidden, luna: document.querySelector('#cLuna').checked, improve: document.querySelector('#cImprove').checked, locked: document.querySelector('#cAgree').disabled})")
            check("consent notice opens with every optional choice unticked and the button locked", before["shown"] and not before["luna"] and not before["improve"] and before["locked"], before)
            await p2.check("#cAge"); await p2.click("#cAgree"); await p2.wait_for_timeout(500)
            after = await p2.evaluate("()=>{var c=JSON.parse(localStorage.getItem('ovumind_db_v1')).profile.consent; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); return {v:c&&c.v, luna:c&&c.luna, improve:c&&c.improve, age13:c&&c.age13, aiOn:!!ai.on, hidden: document.querySelector('#consent').hidden};}")
            check("agreeing stores consent v2 with Luna's AI help off and closes the notice", after == {"v": 2, "luna": False, "improve": False, "age13": True, "aiOn": False, "hidden": True}, after)
            await ctx2.close()
            # a person whose consent predates notice v2 is sent back to the room from any other page
            ctx3 = await browser.new_context(viewport={"width": 390, "height": 844})
            old = json.loads(json.dumps(DB)); old["profile"]["consent"] = {"v": 1, "at": NOW, "improve": True}
            await ctx3.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(old)))
            p3 = await ctx3.new_page(); await p3.route("**/*", gate)
            await p3.goto(BASE + "hormones.html", wait_until="load"); await p3.wait_for_timeout(700)
            check("a v1 consent is sent back to the room to be asked again", p3.url.endswith("room.html"), p3.url)
            await ctx3.close()
            check("no Supabase auth or data request was made anywhere in the signed-out run", not [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1" in u)], relay_calls[:3])
            check("nothing was requested from any third party during the run", not external, external[:3])

            check("no page errors or console errors across the run", not errors, errors[:3])
            await browser.close()
    finally:
        if server: server.terminate()
    failed = [r for r in results if not r[1]]
    print("\n%d passed, %d failed" % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)

asyncio.run(main())
