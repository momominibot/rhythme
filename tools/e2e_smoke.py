#!/usr/bin/env python3
"""End-to-end smoke test for Rhythme: serves the repo, drives the real pages in headless
Chromium at phone width and fails on anything a user would notice first. Network calls to the
Rhythme relay are blocked, so no model call is made and nothing leaves the machine.

Usage: python3 tools/e2e_smoke.py            (needs: pip install playwright; playwright install chromium)
Exit code 0 when every check passes. Used by .github/workflows/deploy.yml before Pages deploys."""
import asyncio, datetime, json, os, re, socket, subprocess, sys, time
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
SESS = {"access_token": "smoke-token", "refresh_token": "smoke-refresh", "expires_at": int(time.time()) + 86400, "user": {"id": "00000000-0000-4000-8000-0000000000aa", "email": "smoke@example.test"}}
SESSION_SEED = "if(!localStorage.getItem('smoke_signed_out')) localStorage.setItem('ovumind_auth_v1', %s);" % json.dumps(json.dumps(SESS))  # a context that signed out stays signed out across its own navigations
DB = {"version": 1, "createdAt": NOW, "updatedAt": NOW,
      "profile": {"name": "Smoke", "outfit": "base", "lifeStage": "", "cycleLength": None, "periodLength": None, "onboarded": True,
                  "consent": {"v": 4, "at": NOW, "luna": False, "improve": False}, "ageAttest": {"confirmed": True, "version": 1, "at": NOW},
                  "consentEvents": [{"id": "ce1", "purpose": "age_18", "action": "grant", "at": NOW, "notice": 4, "method": "sheet", "uid": None, "sent": False}, {"id": "ce2", "purpose": "health_tracking", "action": "grant", "at": NOW, "notice": 4, "method": "sheet", "uid": None, "sent": False}], "consentImportedAt": NOW},
      "events": [{"id": "s1", "type": "period", "date": Y1, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"flow": "medium"}},
                 {"id": "s2", "type": "sleep", "date": Y2, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"bedTime": "23:00", "wakeTime": "07:00", "quality": 4}},
                 {"id": "s3", "type": "food", "date": Y2, "createdAt": NOW, "updatedAt": NOW, "source": "room", "data": {"meal": "lunch", "foods": "chicken rice", "items": [], "tags": ["home-cooked"]}}],
      "summaries": [], "state": {"sleeping": None, "visited": {}, "tourDone": True, "tester": {"hearts": True}, "rewards": {"hearts": 200, "earned": 200, "log": [], "owned": ["dog"], "placed": {"dog": True}, "lastDay": None, "streak": 0}}}  # Peach the corgi lives on the room's rim, so her walks start from the nearest floor cell  # tester mode: Dream Street may be visited after hours, so the run does not depend on the clock

def png_rows(data):
    """RGB(A) rows of an 8-bit non-interlaced PNG (Playwright screenshots), with only the standard library."""
    import struct, zlib
    pos, idat, w, h, ct = 8, b"", 0, 0, 2
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]; tp = data[pos + 4:pos + 8]; body = data[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if tp == b"IHDR": w, h, _, ct = struct.unpack(">IIBB", body[:10])
        elif tp == b"IDAT": idat += body
        elif tp == b"IEND": break
    bpp = 4 if ct == 6 else 3; raw = zlib.decompress(idat); stride = w * bpp; prev = bytearray(stride); rows = []; i = 0
    for _ in range(h):
        f = raw[i]; i += 1; line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                pp = a + b - c; pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    return w, h, bpp, rows

def png_diff(a, b):
    wa, ha, ba, ra = png_rows(a); wb, hb, bb, rb = png_rows(b)
    if (wa, ha) != (wb, hb): return {"mean": 999, "n": 0, "size": [wa, ha, wb, hb]}
    tot, n, worst = 0, 0, 0
    for y in range(ha):
        for x in range(wa):
            d = sum(abs(ra[y][x * ba + k] - rb[y][x * bb + k]) for k in range(3)) / 3.0
            tot += d; n += 1; worst = max(worst, d)
    return {"mean": round(tot / max(1, n), 2), "max": round(worst, 1), "n": n}

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
            # Luna's AI help ships paused (ovu-config.js aiPaused); these runs unpause it so the AI paths stay tested.
            # One context below is opened with the real launch setting (paused) and checks the pause itself.
            _new_context = browser.new_context
            async def new_context_unpaused(*a, paused=False, **k):
                c = await _new_context(*a, **k)
                if not paused: await c.add_init_script("window.OVU_AI_PAUSE_OVERRIDE = false;")
                return c
            browser.new_context = new_context_unpaused
            ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, accept_downloads=True)
            await ctx.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctx.add_init_script(SESSION_SEED)
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
            def _loc(m):
                try: return (m.location or {}).get("url", "") if isinstance(m.location, dict) else str(m.location or "")
                except Exception: return ""
            page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text and not ("ERR_FAILED" in m.text and ".supabase.co" in _loc(m)) else None)  # the gate aborts the signed-in account calls on purpose; the browser logs each abort
            relay_calls, external = [], []
            async def gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url:
                    return await route.fulfill(status=200, content_type="text/css", body="")
                (relay_calls if "/functions/v1/" in url or ".supabase.co" in url else external).append(url)
                await route.abort()
            await page.route("**/*", gate)
            CAM = "()=>{var s=OvuCamera.state(), b=document.querySelector('#scene').getBoundingClientRect(), a=document.querySelector('#avatar').getBoundingClientRect(); return {z:s.z, held:s.held, running:s.running, tf:document.querySelector('#sceneInner').style.transform, zoomed:document.querySelector('#scene').classList.contains('zoomed'), sx:(a.left+a.width/2-b.left)/b.width, sy:(a.bottom-b.top)/b.height}}"
            async def tap_hot(hid):
                inside = await page.evaluate("(id)=>{var h=document.querySelector('.hotspot[data-id='+id+']'); if(!h) return false; var r=h.getBoundingClientRect(), b=document.querySelector('#scene').getBoundingClientRect(); return r.left>=b.left && r.right<=b.right && r.top>=b.top && r.bottom<=b.bottom}", hid)
                if not inside: await page.click("#camFit"); await page.wait_for_timeout(450)   # a person would do the same: see the whole scene, then tap
                inside = await page.evaluate("(id)=>{var h=document.querySelector('.hotspot[data-id='+id+']'); var r=h.getBoundingClientRect(), b=document.querySelector('#scene').getBoundingClientRect(); return r.left>=b.left && r.right<=b.right && r.top>=b.top && r.bottom<=b.bottom}", hid)
                if not inside: await page.focus(".hotspot[data-id=%s]" % hid); await page.wait_for_timeout(450)   # along the wide street fit is not enough: keyboard focus brings the pin into view
                await page.click(".hotspot[data-id=%s]" % hid)

            # 1. the room boots, the consent gate stays closed for a consenting person, hotspots and nav exist
            r = await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(1200)
            await page.evaluate("()=>{ if (window.OvuPetWalk && OvuPetWalk.auto) OvuPetWalk.auto(false); }")  # pets wander only when a check nudges them
            check("room.html loads", r and r.status == 200, r and r.status)
            info = await page.evaluate("()=>({consent: document.querySelector('#consent')?.hidden, welcome: !!document.querySelector('#welcome:not([hidden])'), hots: document.querySelectorAll('.hotspot').length, tabs: document.querySelectorAll('nav a[data-tab]').length, hearts: document.querySelector('#heartsVal')?.textContent, width: document.documentElement.scrollWidth})")
            check("consent overlay stays hidden for a consenting person", info["consent"] is True, info)
            check("eight or more hotspots and the five tabs render (the Cycle tab is back: Jamie, 21 Oct)", info["hots"] >= 8 and info["tabs"] == 5, info)
            check("no sideways scroll at phone width", info["width"] <= 390, info["width"])

            # 1b. garden, Dream Street and the plaza: the door walks her out, the joystick and keys move her, the mini-map jumps
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(1200)
            ctl = await page.evaluate("()=>({api: !!window.OvuRoom && !!window.OvuWalk && !!window.OvuGarden && !!window.OvuCommunity && !!window.OvuStreet, pad: !!document.querySelector('#walkpad'), stops: document.querySelectorAll('#minimap [data-scene],#minimap [data-sub]').length, door: !!document.querySelector('.hotspot[data-id=door]'), here: document.querySelector('#mapHere')?.textContent})")
            check("no joystick and no place shortcuts (Jamie, 20 Oct): a where-you-are pill says Home, and a door hotspot is in the room", ctl["api"] and not ctl["pad"] and ctl["stops"] == 0 and ctl["door"] and ctl["here"] == "Home", ctl)
            # tap to walk: a tap on empty floor plans a route around the furniture and walks there, with a ring at the spot
            async def floor_tap(px, py):
                r = await page.evaluate("()=>{var b=document.querySelector('#sceneInner').getBoundingClientRect(); return {l:b.left,t:b.top,w:b.width,h:b.height};}")
                await page.mouse.click(r["l"] + r["w"] * px / 100, r["t"] + r["h"] * py / 100)
            start = await page.evaluate("()=>({pos: OvuRoom.pos(), src: document.querySelector('#avatarImg').getAttribute('src')})")
            await page.wait_for_function("()=>{var w=window.OvuWalk; return w && w.cycle && document.querySelector('#avatarImg').complete;}", timeout=5000); await page.wait_for_timeout(700)
            await floor_tap(56, 66); await page.wait_for_timeout(60)
            mid = await page.evaluate("()=>({ring: !!document.querySelector('.tapring.on'), walking: OvuWalk.walking(), route: !!OvuWalk.route()})")
            frames = []
            for _ in range(5):
                await page.wait_for_timeout(90); frames.append(await page.evaluate("()=>({f: OvuWalk.cycle().frame, on: document.querySelector('#avatar').classList.contains('cycling'), hidden: getComputedStyle(document.querySelector('#avatarImg')).visibility})"))
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            end = await page.evaluate("()=>({pos: OvuRoom.pos(), tf: document.querySelector('#avatar').style.transform, idle: document.querySelector('#avatar').classList.contains('idle'), cycling: document.querySelector('#avatar').classList.contains('cycling'), vis: getComputedStyle(document.querySelector('#avatarImg')).visibility, src: document.querySelector('#avatarImg').getAttribute('src')})")
            check("a floor tap shows a ring, walks her across the room and lands within a cell of the tap", mid["ring"] and mid["walking"] and mid["route"] and abs(end["pos"]["x"] - 56) < 1.5 and abs(end["pos"]["y"] - 66) < 1.5 and end["tf"] == "" and end["idle"] and (abs(start["pos"]["x"] - 56) > 4 or abs(start["pos"]["y"] - 66) > 4), {"start": start, "mid": mid, "end": end})
            check("while she walks the walk cycle plays (frames change, the standing sprite is hidden) and afterwards she stands in the same outfit", all(f["on"] and f["hidden"] == "hidden" for f in frames) and len(set(f["f"] for f in frames)) >= 3 and not end["cycling"] and end["vis"] == "visible" and end["src"] == start["src"], {"frames": frames, "end": end})
            await floor_tap(20, 52)  # the pillows, away from the bed and clock pins: blocked, so the goal snaps beside the bed
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            bed = await page.evaluate("()=>({pos: OvuRoom.pos(), inBed: OvuWalk.blocked(OvuWalk.HOMES.room.solids, OvuRoom.pos().x, OvuRoom.pos().y) !== null, sheet: document.querySelector('#sheet').getAttribute('aria-hidden')})")
            check("a tap on the bed walks up beside it, never onto it, and opens nothing", not bed["inBed"] and abs(bed["pos"]["x"] - 20) < 10 and abs(bed["pos"]["y"] - 52) < 18 and bed["sheet"] == "true", bed)
            await page.click(".hotspot[data-id=bed]")
            try: await page.wait_for_function("()=>OvuWalk.walking() && !!OvuWalk.route() && OvuWalk.cycle().on", timeout=3000)  # the walk and its cycle start within a frame or two; under machine load the first frames can take longer than a fixed wait (collation smoke, 21 Oct)
            except Exception: pass
            routed = await page.evaluate("()=>({walking: OvuWalk.walking(), route: !!OvuWalk.route(), cyc: OvuWalk.cycle().on})")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #goodnight', timeout=8000)
            except Exception: pass
            hs = await page.evaluate("()=>({open: document.querySelector('#sheet').getAttribute('aria-hidden')==='false', btn: !!document.querySelector('#goodnight')})")
            check("the bed hotspot still walks her over and opens the bedtime sheet as before", hs["open"] and hs["btn"], hs)
            check("the bed walk is routed by the walk engine with her walk cycle, not a straight line", routed["walking"] and routed["route"] and routed["cyc"], routed)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            # a floor tap right after a sheet closes wins over the 1.4 s walk home, and taps still land while zoomed in
            await floor_tap(62, 66)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(1700)
            stay = await page.evaluate("()=>OvuRoom.pos()")
            check("a tap just after closing a sheet is not undone by the walk home", abs(stay["x"] - 62) < 2 and abs(stay["y"] - 66) < 2, stay)
            # life-sim slice: the day pill, low energy, the prompt near the bed, the action button, and sleep refilling energy
            await page.evaluate("()=>{OvuStore.setState({stamina: {v: 18, max: 100, day: OvuGameTime.dayKey()}, game: {firstDay: OvuStore.addDays(OvuGameTime.dayKey(), -11)}}); OvuStamina.value(); OvuHud.render();}")
            hud = await page.evaluate("()=>{var h=document.querySelector('#gameHud'); return {there: !!h, day: OvuGameTime.day(), text: h ? h.textContent : '', title: h ? h.title : '', low: h && h.classList.contains('low'), tired: document.querySelector('#scene').classList.contains('tired'), speed: OvuWalk.speedScale()}}")
            check("the pill shows the season and the hour with day 12 of play in its title, and low energy slows her and dims the scene", hud["there"] and hud["day"] == 12 and "day 12 of play" in hud["title"] and any(s in hud["text"] for s in ("Spring", "Summer", "Autumn", "Winter")) and "Day" not in hud["text"] and hud["low"] and hud["tired"] and abs(hud["speed"] - 0.72) < 0.01, hud)
            await page.evaluate("()=>{var h=OvuRoom.hotspot('bed'); OvuRoom.walkTo(h.wp, function(){});}")
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=9000); await page.wait_for_timeout(700)
            near = await page.evaluate("()=>({on: document.querySelector('#interactPrompt').classList.contains('on'), text: document.querySelector('#interactPrompt').textContent, btn: document.querySelector('#actBtn').classList.contains('on'), cur: OvuInteract.current() && OvuInteract.current().id})")
            await page.click('#actBtn')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #goodnight', timeout=8000)
            except Exception: pass
            opened = await page.evaluate("()=>document.querySelector('#sheet').getAttribute('aria-hidden')==='false' && !!document.querySelector('#goodnight')")
            await page.evaluate("()=>OvuRoom.closeSheet()"); await page.wait_for_timeout(300)
            check("standing by the bed raises a 'Tap to go to sleep' prompt and the action button opens the bedtime sheet", near["on"] and near["cur"] == "bed" and "sleep" in near["text"] and near["btn"] and opened, {"near": near, "opened": opened})
            await page.evaluate("()=>OvuStore.setState({sleeping: {at: new Date().toISOString()}})"); await page.wait_for_timeout(200)
            inbed = await page.evaluate("()=>OvuStamina.value()")
            await page.evaluate("()=>OvuStore.setState({sleeping: null})"); await page.wait_for_timeout(200)
            await page.evaluate("()=>OvuStamina.rested(new Date(Date.now() - 7*3600000).toISOString())"); await page.wait_for_timeout(200)  # what Save my sleep does after a real night
            rested = await page.evaluate("()=>({v: OvuStamina.value(), tired: document.querySelector('#scene').classList.contains('tired'), speed: OvuWalk.speedScale()})")
            check("getting into bed refills nothing; a saved night of real rest refills energy and lifts the tired look", inbed < 100 and rested["v"] == 100 and not rested["tired"] and rested["speed"] == 1, {"inbed": inbed, "rested": rested})
            await floor_tap(62, 66); await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(1700)  # off the home spot, so the zoomed tap below lands on floor
            pets = await page.evaluate("()=>OvuPetWalk.pets()")
            # the pets keep still at night and while she sleeps; this check is about walking, so the clock is held at daytime for it
            await page.evaluate("()=>{window.__dayReal={night: OvuRoom.isNight, asleep: OvuRoom.asleep}; OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}}")
            await page.evaluate("()=>OvuPetWalk.nudge('dog', 0.05)")
            PET = "()=>{var s=OvuPetWalk.state('dog'); var el=document.querySelector('.prop.owned.pet[data-id=dog]'); var w=OvuWalk.world(OvuRoom.layout(), []); return Object.assign(s, {onFloor: OvuWalk.inZones(w.zones, s.x, s.y) && !OvuWalk.blocked(w.solids, s.x, s.y), sitter: getComputedStyle(el.querySelector('.petbody>img')).visibility, quiet: {night: OvuRoom.isNight(), asleep: OvuRoom.asleep(), busy: OvuRoom.busy(), hidden: document.hidden}})}"
            # the trip starts on its own timer: wait for it to begin, then follow it to the end (a slow runner takes longer per frame)
            started = True
            try: await page.wait_for_function("()=>OvuPetWalk.state('dog').state === 'walk'", timeout=8000)
            except Exception: started = False
            pf = []
            for i in range(120):
                pf.append(await page.evaluate(PET))
                if pf[-1]["state"] == "rest" and (len(pf) > 1 or not started): break
                await page.wait_for_timeout(100)
            walked = [f for f in pf if f["walking"]]
            floor = [f["onFloor"] for f in walked]
            first_on = floor.index(True) if True in floor else None
            conds = {"started": started, "dog": "dog" in pets, "frames": len(walked) >= 3, "cycle": len(set(f["frame"] for f in walked if f["cycling"])) >= 3,
                     "reachesFloor": first_on is not None, "staysOnFloor": first_on is not None and all(floor[first_on:]),
                     "sitterHidden": any(f["sitter"] == "hidden" for f in walked), "restAgain": pf[-1]["state"] == "rest" and not pf[-1]["cycling"] and pf[-1]["onFloor"],
                     "moved": abs(pf[-1]["x"] - pf[0]["x"]) > 2 or abs(pf[-1]["y"] - pf[0]["y"]) > 1}
            check("nudged, the corgi steps off the rim and walks the room with her strip (frames change, the sitting sprite hides), reaches the floor and stays on it, and sits again", all(conds.values()), {"conds": conds, "n": len(pf), "walked": len(walked), "first": {k: pf[0].get(k) for k in ("x", "y", "state", "reason", "quiet")}, "last": {k: pf[-1].get(k) for k in ("x", "y", "state", "trips", "reason", "onFloor")}})
            await page.evaluate("()=>OvuPetWalk.nudge('dog', 0.05)"); await page.wait_for_timeout(500)
            await page.evaluate("()=>document.querySelector('.prop.owned.pet[data-id=dog]').click()"); await page.wait_for_timeout(300)
            held = await page.evaluate("()=>({held: OvuPetWalk.state('dog').held, state: OvuPetWalk.state('dog').state, bubble: document.querySelector('#bubble').classList.contains('petbub')})")
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            rel = await page.evaluate("()=>({held: OvuPetWalk.state('dog').held, bubble: document.querySelector('#bubble').classList.contains('on')})")
            check("a tap on the walking corgi stops her and holds her while her care bubble is up; Escape lets her go", held["held"] and held["state"] == "rest" and held["bubble"] and not rel["held"] and not rel["bubble"], {"held": held, "rel": rel})
            await page.evaluate("()=>{OvuRoom.isNight=window.__dayReal.night; OvuRoom.asleep=window.__dayReal.asleep; delete window.__dayReal}")
            await page.click("#camIn"); await page.wait_for_timeout(450)
            await page.wait_for_function("()=>{var b=document.querySelector('#sceneInner').getBoundingClientRect(), k=[b.left,b.top,b.width].map(Math.round).join(); var same = window.__zr === k; window.__zr = k; return same && OvuRoom.cam().z > 1.2;}", timeout=6000, polling=120) # the zoom has settled (two reads alike) before the tap is aimed, on a slow machine too
            await floor_tap(44, 76)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            zoomed = await page.evaluate("()=>({pos: OvuRoom.pos(), zoomed: document.querySelector('#scene').classList.contains('zoomed')})")
            check("a floor tap while the camera is zoomed in lands on the right spot of the plate", zoomed["zoomed"] and abs(zoomed["pos"]["x"] - 44) < 2 and abs(zoomed["pos"]["y"] - 76) < 2, zoomed)
            w0 = await page.evaluate("()=>({scene: document.querySelector('#scene').getBoundingClientRect().width, deck: document.querySelector('.deck h2').getBoundingClientRect().height})")
            await page.evaluate("()=>OvuTextSize.set('large')"); await page.wait_for_timeout(200)
            await floor_tap(52, 82)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            big = await page.evaluate("()=>({zoom: document.documentElement.style.zoom, tz: document.documentElement.style.getPropertyValue('--tz'), attr: document.documentElement.getAttribute('data-text'), saved: JSON.parse(localStorage.getItem('ovumind_db_v1')).profile.textSize, pos: OvuRoom.pos(), scene: document.querySelector('#scene').getBoundingClientRect().width, deck: document.querySelector('.deck h2').getBoundingClientRect().height, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1})")
            await page.evaluate("()=>OvuTextSize.set('default')")
            check("in the room the text size grows the cards and bars but never the plate (iOS put taps in the wrong place under a zoomed page), is saved, keeps the page from scrolling sideways, and a floor tap still lands on the right spot", big["zoom"] == "" and big["tz"] == "1.12" and big["attr"] == "large" and big["saved"] == "large" and abs(big["scene"] - w0["scene"]) < 1 and big["deck"] > w0["deck"] * 1.05 and abs(big["pos"]["x"] - 52) < 2 and abs(big["pos"]["y"] - 82) < 2 and big["scroll"], {"big": big, "before": w0})
            await page.click("#camFit"); await page.wait_for_timeout(450)
            nap = await page.evaluate("()=>{var real=OvuRoom.asleep; OvuRoom.asleep=function(){return true}; var went=OvuWalk.travel('garden'); var t=document.querySelector('#toast').textContent; OvuRoom.asleep=real; return {went: went, toast: t, layout: document.querySelector('#scene').dataset.layout}}")
            check("while she sleeps a door refuses in the room's own words", nap["went"] is False and "asleep" in nap["toast"] and nap["layout"] == "room", nap)
            home_tf = await page.evaluate("()=>document.querySelector('#sceneInner').style.transform")
            await page.click(".hotspot[data-id=door]")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='garden' && !document.querySelector('#scene').classList.contains('fading')", timeout=8000)
            except Exception: pass
            g = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, img: document.querySelector('#roomDay').getAttribute('src'), hots: [...document.querySelectorAll('.hotspot')].map(b=>b.dataset.id).join(','), plot: !!document.querySelector('#ownedProps .plot svg'), pos: OvuRoom.pos(), here: document.querySelector('#mapHere')?.textContent})")
            check("tapping the door walks her into the garden with its hotspots, the plot and the pill saying Garden", g["layout"] == "garden" and "garden-v1" in g["img"] and "plot" in g["hots"] and "bench" in g["hots"] and g["plot"] and g["here"] == "Garden", g)
            await page.click("#mapBtn")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .worldmap', timeout=8000)
            except Exception: pass
            mp = await page.evaluate("()=>({head: document.querySelector('.mapnow b')?.textContent, nodes: [...document.querySelectorAll('.mapnode')].map(n=>n.dataset.node), here: document.querySelector('.mapnode.here')?.dataset.node, exits: [...document.querySelectorAll('.mapexit')].map(e=>e.textContent), me: !!document.querySelector('.mapplate .mapme'), route: document.querySelector('#mapRoute')?.textContent, layout: document.querySelector('#scene').dataset.layout})")
            check("the map says where she is, pins the garden's ways out, shows every place and starts with the way home", mp["head"] == "You are in the garden" and mp["here"] == "garden" and len(mp["nodes"]) >= 8 and all(k in mp["nodes"] for k in ["home","garden","farm","street","plaza"]) and mp["me"] and any("Home" in e for e in mp["exits"]) and any("Dream Street" in e for e in mp["exits"]) and "The way home" in mp["route"] and "Gate · back home" in mp["route"], mp)
            await page.click('.mapnode[data-node=plaza]'); await page.wait_for_timeout(200)
            pr = await page.evaluate("()=>({steps: [...document.querySelectorAll('#mapRoute li')].map(l=>l.textContent), layout: document.querySelector('#scene').dataset.layout})")
            check("tapping the plaza on the map shows the way (the arch, then the street arch) and does not move her", pr["layout"] == "garden" and len(pr["steps"]) == 2 and "on to Dream Street" in pr["steps"][0] and "on to the plaza" in pr["steps"][1], pr)
            # the wider world (21 Oct, Jamie: "whatever we built will be at a corner of it, the rest ... just the field, the land unbuilt"):
            # land edge to edge, the places in the top-left corner, the view opening on them; no ??? and no mist (the box measured inside its border)
            GEO = "()=>{var e=document.querySelector('#worldZoom'), o=e.getBoundingClientRect(), v={left:o.left+e.clientLeft, top:o.top+e.clientTop, width:e.clientWidth, height:e.clientHeight}; v.right=v.left+v.width; v.bottom=v.top+v.height; var p=document.querySelector('#worldWide').getBoundingClientRect(), ns=[...document.querySelectorAll('.mapnode')].map(n=>{var r=n.getBoundingClientRect(); return {id:n.dataset.node, x:(r.left+r.width/2-p.left)/p.width, y:(r.top+r.height/2-p.top)/p.height, sx:r.left+r.width/2-v.left, sy:r.top+r.height/2-v.top}}); return {fog: document.querySelectorAll('.fog,[data-fog]').length, q: /\\?\\?\\?/.test(document.querySelector('#sheet').textContent), far: document.querySelector('#worldZoom').classList.contains('far'), z: OvuMap.zoomState(), vw: v.width, vh: v.height, cover: p.left<=v.left+0.5 && p.top<=v.top+0.5 && p.right>=v.right-0.5 && p.bottom>=v.bottom-0.5, ns: ns, nameShown: getComputedStyle(document.querySelector('.mapnode[data-node=plaza] b')).display}}"
            w0 = await page.evaluate(GEO)
            check("the wider world opens on the built corner: land under the whole box, every place on screen, names hidden until zoomed in, no ??? anywhere", w0["fog"] == 0 and not w0["q"] and w0["cover"] and w0["far"] and w0["nameShown"] == "none" and all(4 <= n["sx"] <= w0["vw"] - 4 and 4 <= n["sy"] <= w0["vh"] - 4 for n in w0["ns"]) and all(n["x"] < 0.45 and n["y"] < 0.45 for n in w0["ns"]) and 0.5 < w0["z"]["s"] < 1, {k: w0[k] for k in ("fog", "q", "cover", "far", "z")})
            await page.click('#mapZoomIn'); await page.click('#mapZoomIn'); await page.wait_for_timeout(150)
            wz = await page.evaluate(GEO)
            box = await page.query_selector('#worldZoom'); bb = await box.bounding_box()
            for _ in range(3):  # drag towards the far corner of the world, further than the land goes
                await page.mouse.move(bb["x"] + bb["width"] * 0.9, bb["y"] + bb["height"] * 0.9); await page.mouse.down(); await page.mouse.move(bb["x"] + bb["width"] * 0.05, bb["y"] + bb["height"] * 0.05, steps=6); await page.mouse.up(); await page.wait_for_timeout(80)
            wd = await page.evaluate(GEO)
            await page.evaluate("()=>{for(var i=0;i<8;i++) document.querySelector('#mapZoomOut').click()}"); await page.wait_for_timeout(200)
            wo = await page.evaluate(GEO)
            shot = await box.screenshot()
            bw, bh, bpp, rows = png_rows(shot); white = 0; tot = 0
            for yy in range(4, bh - 4, 3):
                r = rows[yy]
                for xx in range(4, bw - 4, 3):
                    c = r[xx * bpp:xx * bpp + 3]; tot += 1
                    if min(c) > 242 and max(c) - min(c) < 10: white += 1
            check("zoomed in twice the names show; zoomed all the way out the whole world fills the box with land (the places in its top-left corner, open country everywhere else, nothing near white); a drag never shows past the land", not wz["far"] and wz["nameShown"] != "none" and wz["z"]["s"] > 1 and wo["cover"] and abs(wo["z"]["s"] - 1 / 3) < 0.01 and all(n["sx"] < wo["vw"] * 0.45 and n["sy"] < wo["vh"] * 0.45 for n in wo["ns"]) and white / max(1, tot) < 0.01 and wd["cover"] and wd["z"]["tx"] < -wd["vw"] and wd["z"]["ty"] < -wd["vh"], {"in": wz["z"], "out": wo["z"], "white": round(white / max(1, tot), 4), "drag": wd["z"], "dragCover": wd["cover"]})
            await page.click('.mapnode[data-node=home]', force=True); await page.wait_for_timeout(150)
            wr = await page.evaluate("()=>({route: document.querySelector('#mapRoute').textContent, layout: document.querySelector('#scene').dataset.layout})")
            check("zoomed out, a tap on a place still shows the way and moves nobody", "The way home" in wr["route"] and wr["layout"] == "garden", wr)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            hidden = await page.evaluate("()=>{var p=document.querySelector('#walkpad'); return !p || getComputedStyle(p).display==='none'}")
            check("the joystick stays hidden (tap-to-walk replaces it)", hidden, hidden)
            before = g["pos"]; tf0 = await page.evaluate("()=>document.querySelector('#sceneInner').style.transform")
            await floor_tap(50, 52)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            after = await page.evaluate("()=>({pos: OvuRoom.pos(), layout: document.querySelector('#scene').dataset.layout, walking: OvuWalk.walking(), tf: document.querySelector('#avatar').style.transform})")
            check("a floor tap in the garden walks her from the gate to the lawn and commits the position", abs(after["pos"]["x"] - 50) < 1.5 and abs(after["pos"]["y"] - 52) < 1.5 and after["layout"] == "garden" and not after["walking"] and after["tf"] == "" and abs(before["x"] - 50) > 4, {"before": before, "after": after})
            cam = await page.evaluate(CAM)
            check("every scene keeps the whole view: the room and the garden both stay at zoom 1, fitted to the screen, while she walks", home_tf == "" and not cam["zoomed"] and abs(cam["z"] - 1) < 0.01 and cam["tf"] == "" and tf0 == "", {"home_tf": home_tf, "tf0": tf0, "cam": cam})
            await page.keyboard.down("ArrowLeft"); await page.wait_for_timeout(400); await page.keyboard.up("ArrowLeft"); await page.wait_for_timeout(150)
            key = await page.evaluate("()=>({pos: OvuRoom.pos(), flip: document.querySelector('#avatar').classList.contains('flip')})")
            check("the left arrow key walks her back from the lawn and turns her around", key["pos"]["x"] < after["pos"]["x"] - 1 and key["flip"], key)
            fit = await page.evaluate("()=>Object.assign((" + CAM + ")(), {fitOff: document.querySelector('#camFit').disabled})")
            await page.click("#camIn"); await page.wait_for_timeout(900); zin = await page.evaluate(CAM)
            check("the garden already shows the whole scene (fit has nothing to do); + brings a closer window around her", fit["tf"] == "" and not fit["zoomed"] and fit["fitOff"] and zin["zoomed"] and zin["z"] > 1.4 and 0.25 < zin["sx"] < 0.72 and 0.35 < zin["sy"] < 0.8, {"fit": fit, "zin": zin})
            box = await page.evaluate("()=>{var b=document.querySelector('#scene').getBoundingClientRect(); return {l:b.left,t:b.top,w:b.width,h:b.height}}")
            await page.mouse.move(box["l"] + box["w"] * 0.15, box["t"] + box["h"] * 0.22); await page.mouse.down()
            for k in range(1, 9):
                await page.mouse.move(box["l"] + box["w"] * 0.15 + k * 12, box["t"] + box["h"] * 0.22 + k * 6); await page.wait_for_timeout(16)
            await page.mouse.up(); await page.wait_for_timeout(300); held = await page.evaluate(CAM)
            await floor_tap(38, 57); await page.wait_for_timeout(1600); resumed = await page.evaluate(CAM)
            check("a drag holds the camera where the person put it; her next floor tap brings it back onto her", held["held"] and not resumed["held"] and 0.3 < resumed["sx"] < 0.72 and 0.35 < resumed["sy"] < 0.8, {"held": held, "resumed": resumed})
            await tap_hot("plot")
            try: await page.wait_for_selector("#plotWater", timeout=5000)
            except Exception: pass
            await page.click("#plotWater"); await page.wait_for_timeout(700)
            hud = await page.evaluate("()=>{var h=document.querySelector('#hud'), st=document.querySelector('#hudStop'), b=document.querySelector('#scene').getBoundingClientRect(), r=st.getBoundingClientRect(); return {on: h.classList.contains('on'), z: OvuCamera.state().z, screenSpace: !document.querySelector('#sceneInner').contains(h), inside: r.width>0 && r.left>=b.left && r.right<=b.right && r.top>=b.top && r.bottom<=b.bottom}}")
            t1 = await page.evaluate("()=>document.querySelector('#hudTime').textContent"); await page.wait_for_timeout(1300)
            t2 = await page.evaluate("()=>({t: document.querySelector('#hudTime').textContent, hidden: document.querySelector('#hudTime').getAttribute('aria-hidden'), shown: getComputedStyle(document.querySelector('#hudTime')).display !== 'none'})")
            check("the session bar shows a running clock that counts up while the minute goes on, kept out of the spoken status", bool(re.match(r"^0:0[0-9]$", t1)) and bool(re.match(r"^0:0[0-9]$", t2["t"])) and t2["t"] > t1 and t2["hidden"] == "true" and t2["shown"], {"t1": t1, "t2": t2})
            await page.click("#hudMute"); await page.wait_for_timeout(200)
            mu = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), pressed: document.querySelector('#hudMute').getAttribute('aria-pressed'), flag: OvuVoice.muted(), saved: localStorage.getItem('rhythme_voice_muted'), probe: (function(){ var a=new Audio('assets/audio/guide-interim/garden-water-0.mp3'); a.play().catch(function(){}); var m=a.muted; a.pause(); return m; })()})")
            await page.click("#hudMute"); await page.wait_for_timeout(150)
            unmu = await page.evaluate("()=>({pressed: document.querySelector('#hudMute').getAttribute('aria-pressed'), flag: OvuVoice.muted()})")
            check("the mute button silences Erin's voice without stopping the watering minute, is remembered, and turns her back on", mu["on"] and mu["pressed"] == "true" and mu["flag"] and mu["saved"] == "1" and mu["probe"] and unmu["pressed"] == "false" and not unmu["flag"], {"mu": mu, "unmu": unmu})
            await page.click("#hudStop"); await page.wait_for_timeout(500)
            stopped = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), toast: document.querySelector('#toast').textContent, clock: document.querySelector('#hudTime').textContent})")
            check("Stop clears the session clock", stopped["clock"] == "", stopped)
            check("watering at zoom keeps the HUD and its Stop button on screen (lifted out of the plate), and Stop ends the minute", hud["on"] and hud["z"] > 1.4 and hud["screenSpace"] and hud["inside"] and not stopped["on"] and "Stopped" in stopped["toast"], {"hud": hud, "stopped": stopped})
            # a pose is drawn in what she is wearing; the shower keeps its robe
            ps = await page.evaluate("()=>({plants: OvuRoom.poseSrc('plants','sundress'), base: OvuRoom.poseSrc('plants','base'), shower: OvuRoom.poseSrc('shower','sundress')})")
            okfile = await page.evaluate("(u)=>fetch(u).then(r=>r.ok)", ps["plants"])
            check("watering in the sundress uses the sundress watering sprite (it exists), the base outfit the original, and the shower keeps its robe", ps["plants"].endswith("avatar-act-plants-sundress.webp") and okfile and ps["base"].endswith("avatar-act-plants.webp") and ps["shower"].endswith("avatar-act-shower.webp"), {"ps": ps, "ok": okfile})
            # at night the calendar keeps period days pink (the night card colour once flattened every day)
            calnight = await page.evaluate("""()=>{ var g=document.createElement('div'); g.className='cal-grid'; var d=document.createElement('button'); d.className='cal-day p-heavy'; g.appendChild(d); document.querySelector('#sheet').appendChild(g);
              var root=document.documentElement, was=root.getAttribute('data-sky'); root.setAttribute('data-sky','night'); var night=getComputedStyle(d).backgroundColor; root.setAttribute('data-sky', was || ''); g.remove(); return night; }""")
            check("at night a heavy period day on the calendar is still deep pink, not the dark card colour", calnight == "rgb(176, 67, 110)", calnight)
            # walking together: a tap on the corgi offers a walk; she says so, the corgi hops with hearts, then follows her
            await page.evaluate("()=>document.querySelector('.prop.owned.pet[data-id=dog]').click()"); await page.wait_for_timeout(250)
            offer = await page.evaluate("()=>{var b=document.querySelector('#bubble [data-petwalk]'); return b ? {kind: b.dataset.petwalk, text: b.textContent} : null}")
            await page.evaluate("()=>document.querySelector('#bubble [data-petwalk]').click()"); await page.wait_for_timeout(900)
            hi = await page.evaluate("()=>({line: document.querySelector('#thought').textContent, on: document.querySelector('#thought').classList.contains('on'), hop: document.querySelector('.prop.owned.pet[data-id=dog]').classList.contains('hop'), hearts: document.querySelectorAll('.palheart').length, pal: OvuPetWalk.pal(), bubble: document.querySelector('#bubble').classList.contains('on')})")
            check("the corgi's bubble offers Walk together; she says she would like a walk, the corgi hops with hearts and the bubble closes", offer and offer["kind"] == "start" and "Walk together" in offer["text"] and hi["on"] and "walk" in hi["line"] and hi["hop"] and hi["hearts"] >= 3 and hi["pal"] and hi["pal"]["id"] == "dog" and not hi["bubble"], {"offer": offer, "hi": hi})
            await page.wait_for_timeout(1300)
            await floor_tap(32, 74)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(2600)
            fol = await page.evaluate("()=>{var p=OvuPetWalk.pal(), h=OvuRoom.pos(), w=OvuWalk.world(OvuRoom.layout(), []); return {pal: p, her: h, d: Math.hypot(p.x-h.x, (p.y-h.y)/0.5), onFloor: OvuWalk.inZones(w.zones, p.x, p.y) && !OvuWalk.blocked(w.solids, p.x, p.y), walking: document.querySelector('.prop.owned.pet[data-id=dog]').classList.contains('walking')}}")
            check("after she walks across the garden the corgi has followed her trail and sits a few steps behind her, on the lawn", fol["pal"]["ready"] and fol["pal"]["state"] == "follow" and 3 < fol["d"] < 10 and fol["onFloor"] and not fol["walking"], fol)
            await tap_hot("arch")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=12000)
            except Exception: pass
            st = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, stores: [...document.querySelectorAll('.hotspot')].map(b=>b.dataset.id).filter(i=>['petshop','furniture','homes'].includes(i)).length, here: document.querySelector('#mapHere')?.textContent})")
            check("the garden arch takes her to Dream Street with its three storefronts, and the pill says Dream Street", st["layout"] == "street" and st["stores"] == 3 and st["here"] == "Dream Street", st)
            await page.wait_for_timeout(400)
            pst = await page.evaluate("()=>{var el=document.querySelector('.prop.owned.pet.palclone[data-id=dog]'), p=OvuPetWalk.pal(), h=OvuRoom.pos(); return {el: !!el, pal: p, d: p ? Math.hypot(p.x-h.x, (p.y-h.y)/0.5) : null}}")
            check("the corgi comes along to Dream Street, which never draws your pets, and stands just behind her", pst["el"] and pst["pal"] and pst["pal"]["clone"] and pst["d"] is not None and pst["d"] < 9, pst)
            await page.evaluate("()=>document.querySelector('.prop.owned.pet.palclone[data-id=dog]').click()"); await page.wait_for_timeout(250)
            home = await page.evaluate("()=>{var b=document.querySelector('#bubble [data-petwalk]'); return b ? {kind: b.dataset.petwalk, text: b.textContent} : null}")
            await page.evaluate("()=>document.querySelector('#bubble [data-petwalk]').click()"); await page.wait_for_timeout(900)
            gone = await page.evaluate("()=>({pal: OvuPetWalk.pal(), el: !!document.querySelector('.prop.owned.pet[data-id=dog]'), toast: document.querySelector('#toast').textContent})")
            check("a tap on the corgi out walking offers Home time, which ends the walk and sends her home from the street", home and home["kind"] == "end" and "Home time" in home["text"] and gone["pal"] is None and not gone["el"] and "breath" in gone["toast"], {"home": home, "gone": gone})
            closed = await page.evaluate("()=>{var real=OvuStreet.openNow; OvuStreet.openNow=function(){return false}; var went=OvuWalk.travel('shop-pet'); var sheet=document.querySelector('#sheet'); var r={went: went, open: sheet && sheet.getAttribute('aria-hidden')==='false', title: (document.querySelector('#sheetTitle')||{}).textContent||'', body: (sheet||{}).textContent||'', hours: [OvuStreet.hoursText('pet'), OvuStreet.hoursText('furniture'), OvuStreet.hoursText('home')], at8: OvuStreet.openAt('pet', new Date(2026,9,19,8,30)), at12: OvuStreet.openAt('pet', new Date(2026,9,19,12,0)), plaques: document.querySelectorAll('#ownedProps .closedsign').length}; OvuStreet.openNow=real; return r}")
            check("trying a shut store shows that store's own hours card (named, not Dream Street), the three stores keep different hours, and no plaques sit on the street", closed["went"] is False and closed["open"] and "Whisker" in closed["title"] and "10 am to 7 pm" in closed["body"] and len(set(closed["hours"])) == 3 and not closed["at8"] and closed["at12"] and closed["plaques"] == 0, closed)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await tap_hot("petshop")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='shop-pet' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            inside = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, props: document.querySelectorAll('#ownedProps .shopprop').length, pets: document.querySelectorAll('#ownedProps .shopprop.kind-pet').length, treats: document.querySelectorAll('#ownedProps .shopprop.kind-treat').length, acc: document.querySelectorAll('#ownedProps .shopprop.kind-accessory').length, mat: !!document.querySelector('.hotspot[data-id=mat]'), here: document.querySelector('#mapHere')?.textContent})")
            check("the pet shop door leads into a walkable interior with kittens, puppies, treats and accessories on the shelves", inside["layout"] == "shop-pet" and inside["pets"] >= 5 and inside["treats"] >= 3 and inside["acc"] >= 4 and inside["mat"] and inside["here"] == "Whisker & Paw", inside)
            await page.click('#ownedProps .shopprop[data-item=cat]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .itemcard', timeout=10000)
            except Exception: pass
            card = await page.evaluate("()=>({open: document.querySelector('#sheet').getAttribute('aria-hidden')==='false', title: document.querySelector('#sheetTitle')?.textContent.slice(0,16), adopt: document.querySelector('#sheet [data-act=buy]')?.textContent.trim(), layout: document.querySelector('#scene').dataset.layout})")
            check("tapping a kitten walks over and opens her adopt card with the price", card["open"] and card["title"].startswith("Mochi") and card["adopt"] and "Adopt" in card["adopt"] and "150" in card["adopt"] and card["layout"] == "shop-pet", card)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await tap_hot("mat")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            back = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, pos: OvuRoom.pos(), here: document.querySelector('#mapHere')?.textContent})")
            check("the door mat puts her back on the street outside the pet shop, and the pill says Dream Street", back["layout"] == "street" and abs(back["pos"]["x"] - 23) < 1 and back["here"] == "Dream Street", back)
            # 1c. the wide street (docs/design/2026-10-19-wide-street.md): a 2:1 plate 2.5 boxes wide, walked with real taps, the camera following
            STREET = "()=>{var sc=document.querySelector('#scene'), b=sc.getBoundingClientRect(), im=document.querySelector('#roomDay').getBoundingClientRect(), nv=document.querySelector('.night-veil').getBoundingClientRect(), a=document.querySelector('#avatar').getBoundingClientRect(), s=OvuCamera.state(); return {layout: sc.dataset.layout, aspect: b.width/b.height, plate: im.width/(b.width*s.z), veil: nv.width/im.width, z: s.z, x: s.x, held: s.held, minX: b.width-b.width*2.5*s.z, pos: OvuRoom.pos(), sx: (a.left+a.width/2-b.left)/b.width, sy: (a.bottom-b.top)/b.height, scrollL: sc.scrollLeft, walking: OvuWalk.walking()}}"
            ws = await page.evaluate(STREET)
            check("Dream Street is one screen again (Jamie, 20 Oct): the whole street in view at zoom 1, no sideways camera", ws["layout"] == "street" and abs(ws["aspect"] - 0.8) < 0.01 and abs(ws["plate"] - 1) < 0.01 and abs(ws["z"] - 1) < 0.01 and abs(ws["x"]) < 1, ws)
            await page.evaluate("()=>OvuWalk.tapWalk(70, 62)")
            try: await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000)
            except Exception: pass
            await page.wait_for_timeout(400); we = await page.evaluate(STREET)
            check("a floor tap walks her across the street while the view stays still", we["pos"]["x"] > 50 and abs(we["x"]) < 1 and we["scrollL"] == 0 and we["layout"] == "street", we)
            await page.click("#avatar"); await page.wait_for_timeout(350)
            bub = await page.evaluate("()=>({on: document.querySelector('#bubble').classList.contains('on'), joy: document.querySelector('#avatar').classList.contains('joy'), layout: document.querySelector('#scene').dataset.layout})")
            check("at the far end of the street a tap on her is a little hop, and no menu opens over her head", not bub["on"] and bub["layout"] == "street", bub)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)
            await tap_hot("arch2")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            pz = await page.evaluate("()=>document.querySelector('#scene').dataset.layout")
            await page.evaluate("()=>OvuWalk.travel('street')")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            await page.wait_for_timeout(700); wr = await page.evaluate(STREET)
            check("the plaza arch takes her to the plaza, and coming back she stands in that arch on the one-screen street", pz == "plaza" and wr["layout"] == "street" and abs(wr["pos"]["x"] - 84) < 1 and abs(wr["x"]) < 1, {"plaza": pz, "back": wr})
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('homes'))"); await page.wait_for_timeout(250)
            await page.evaluate("()=>{var p=OvuRoom.pos(); return OvuWalk.tapWalk(p.x-14, p.y-1)}")
            try: await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000)
            except Exception: pass
            await page.wait_for_timeout(900)
            rt = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, sheet: document.querySelector('#sheet').getAttribute('aria-hidden'), pos: OvuRoom.pos()})")
            check("a floor tap that replaces a walk to Moonrise Homes leaves her where she tapped, without opening the store", rt["layout"] == "street" and rt["sheet"] != "false" and rt["pos"]["x"] < 76, rt)
            await page.focus(".hotspot[data-id=petshop]"); await page.wait_for_timeout(600)
            fo = await page.evaluate("()=>{var h=document.querySelector('.hotspot[data-id=petshop]').getBoundingClientRect(), b=document.querySelector('#scene').getBoundingClientRect(); return {inside: h.left>=b.left && h.right<=b.right && h.top>=b.top && h.bottom<=b.bottom, held: OvuCamera.state().held, scrollL: document.querySelector('#scene').scrollLeft}}")
            check("keyboard focus on a storefront keeps it in view (the box itself never scrolls)", fo["inside"] and fo["scrollL"] == 0, fo)
            await page.evaluate("()=>document.activeElement && document.activeElement.blur()")
            t0 = await page.evaluate("()=>Date.now()")
            await tap_hot("arch")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='garden' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            gl = await page.evaluate("(t0)=>({layout: document.querySelector('#scene').dataset.layout, ms: Date.now()-t0})", t0)
            check("the street arch takes her back to the garden", gl["layout"] == "garden" and gl["ms"] < 15000, gl)
            gocc = await page.evaluate("()=>document.querySelectorAll('.plate-occ').length")
            check("leaving the street takes its cutouts with it: the garden draws none", gocc == 0, gocc)
            await tap_hot("arch")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            await page.wait_for_timeout(600); wl = await page.evaluate(STREET)
            check("from the garden she arrives through the garden arch on the left of the one-screen street", wl["layout"] == "street" and abs(wl["pos"]["x"] - 16) < 1 and abs(wl["x"]) < 1, wl)
            await tap_hot("homes")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='shop-homes' && !document.querySelector('#scene').classList.contains('fading')", timeout=12000)
            except Exception: pass
            sr = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, models: document.querySelectorAll('#ownedProps .shopprop.kind-home').length})")
            check("the Moonrise Homes door walks her into the showroom with the three house models", sr["layout"] == "shop-homes" and sr["models"] == 3, sr)
            await page.click('#ownedProps .shopprop[data-item=house]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .itemcard', timeout=10000)
            except Exception: pass
            hc = await page.evaluate("()=>({visit: !!document.querySelector('#sheet [data-act=visit]'), buy: document.querySelector('#sheet [data-act=buy]')?.textContent.trim()})")
            check("a house model offers Visit first and Move in", hc["visit"] and hc["buy"] and "Move in" in hc["buy"], hc)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await page.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump: she would walk out, along the street and through the arch
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            pz = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, nbs: document.querySelectorAll('#ownedProps .nbperson').length, pets: document.querySelectorAll('#ownedProps .nbpet').length, board: !!document.querySelector('.hotspot[data-id=board]'), stall: !!document.querySelector('.hotspot[data-id=stall]')})")
            po = await page.evaluate("()=>{var p=document.querySelector('#plazaPill'); return {shown: !!p && !p.hidden, text: p ? p.textContent : ''}}")
            await page.click('#plazaPill'); await page.wait_for_timeout(400)
            po['signin'] = await page.evaluate("()=>!!document.querySelector('#plazaSignIn') && !document.querySelector('#plazaList')")
            await page.evaluate("()=>OvuRoom.closeSheet()"); await page.wait_for_timeout(300)
            check("signed in (the room opens to nobody else now), the pill offers a group to choose and its sheet lists groups rather than a sign-in", po["shown"] and "Choose a group" in po["text"] and not po["signin"], po)
            check("the plaza shows four sample neighbours with their pets, a noticeboard and a tea stall", pz["layout"] == "plaza" and pz["nbs"] == 4 and pz["pets"] == 4 and pz["board"] and pz["stall"], pz)
            await tap_hot("board")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .notice.today', timeout=8000)
            except Exception: pass
            bd = await page.evaluate("()=>({prompt: document.querySelector('#sheet .notice.today p')?.textContent.length, samples: document.querySelectorAll('#sheet .notice:not(.today)').length})")
            check("the noticeboard shows today's prompt and the sample notes", bd["prompt"] and bd["prompt"] > 10 and bd["samples"] >= 3, bd)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await page.click('#ownedProps .nbperson[data-nb=mei]')
            try: await page.wait_for_selector('#nbVisit', timeout=5000)
            except Exception: pass
            await page.click('#nbVisit')
            try: await page.wait_for_function("()=>document.querySelector('#scene').classList.contains('nbvisit') && !!document.querySelector('#nbBack')", timeout=10000)
            except Exception: pass
            vs = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, visit: document.querySelector('#scene').classList.contains('nbvisit'), back: !!document.querySelector('#nbBack'), nb: document.querySelectorAll('#ownedProps .nbperson').length, own: document.querySelectorAll('#ownedProps .prop.owned').length, inert: getComputedStyle(document.querySelector('.hotspot[data-id=bed]')).pointerEvents, minimapHidden: !!document.querySelector('#minimap.hidden')})")
            check("visiting Mei opens her cottage read-only: she is there, your props are not, hotspots are inert, a Back button shows", vs["layout"] == "house" and vs["visit"] and vs["back"] and vs["nb"] == 1 and vs["own"] == 0 and vs["inert"] == "none" and vs["minimapHidden"], vs)
            await page.click('#nbBack')
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && !document.querySelector('#scene').classList.contains('nbvisit')", timeout=10000)
            except Exception: pass
            bk = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, visit: document.querySelector('#scene').classList.contains('nbvisit'), nbs: document.querySelectorAll('#ownedProps .nbperson').length})")
            check("Back returns to the plaza and the neighbours", bk["layout"] == "plaza" and not bk["visit"] and bk["nbs"] == 4, bk)
            await page.evaluate("()=>OvuWalk.travel('home')")  # a test jump
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='room' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            hm = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, hots: document.querySelectorAll('.hotspot').length, garden: JSON.parse(localStorage.getItem('ovumind_db_v1')).state.garden})")
            check("home again with the room's hotspots; the plot already credits the seeded diary days", hm["layout"] == "room" and hm["hots"] >= 9 and hm["garden"] and len(hm["garden"]["credited"]) >= 2, hm)

            # 1d. today's check-in: six tiles, a calm count, quick answers that tick and untick, tiles that open their editor
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(900)
            ci = await page.evaluate("()=>({tiles: document.querySelectorAll('#tiles .citile').length, status: document.querySelector('#ciStatus').innerText, bleed: document.querySelector('#tiles [data-ci=bleeding] b').textContent, chip: !!document.querySelector('#ciQuick [data-qa=bleeding][data-qv=none]'), red: getComputedStyle(document.querySelector('#ciStatus')).color})")
            check("today's check-in shows six tiles and a plain count of the four that count, with a No bleeding quick answer", ci["tiles"] == 6 and "of 4 check-ins recorded today" in ci["status"] and ci["bleed"] == "Add" and ci["chip"], ci)
            await page.click("#ciQuick [data-qa=bleeding][data-qv=none]"); await page.wait_for_timeout(200)
            ci2 = await page.evaluate("()=>({bleed: document.querySelector('#tiles [data-ci=bleeding] b').textContent, done: document.querySelector('#tiles [data-ci=bleeding]').classList.contains('s-done'), undo: !!document.querySelector('#ciQuick .undo[data-qa=bleeding]'), events: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.type==='period'&&e.date===OvuStore.today()).length})")
            check("No bleeding today ticks the bleeding tile without making a period entry, and can be taken back", ci2["bleed"] == "None" and ci2["done"] and ci2["undo"] and ci2["events"] == 0, ci2)
            await page.click("#ciQuick .undo[data-qa=bleeding]"); await page.wait_for_timeout(200)
            check("taking the answer back reopens the tile", await page.evaluate("()=>document.querySelector('#tiles [data-ci=bleeding] b').textContent") == "Add")
            await page.click("#ciChoose"); await page.click("#tiles [data-ci-key=food]"); await page.click("#ciChoose"); await page.wait_for_timeout(150)
            ch = await page.evaluate("()=>({status: document.querySelector('#ciStatus').innerText, food: document.querySelector('#tiles [data-ci=food]').classList.contains('key'), saved: OvuStore.state().checkinChoice})")
            await page.reload(wait_until="networkidle"); await page.wait_for_timeout(700)
            ch2 = await page.evaluate("()=>({status: document.querySelector('#ciStatus').innerText, food: document.querySelector('#tiles [data-ci=food]').classList.contains('key')})")
            check("choosing what counts takes food out of the tick, saves only that change, and is still so after a reload", "of 3 check-ins" in ch["status"] and not ch["food"] and ch["saved"] == {"food": False} and "of 3 check-ins" in ch2["status"] and not ch2["food"], {"before": ch, "after": ch2})
            # a new day: yesterday's tick and answers do not stay on screen
            await page.click("#ciQuick [data-qa=bleeding][data-qv=none]"); await page.wait_for_timeout(200)
            nd = await page.evaluate("()=>{var real=OvuStore.today, t=OvuStore.addDays(real(),1); OvuStore.today=function(){return t}; document.dispatchEvent(new Event('visibilitychange')); var r={bleed: document.querySelector('#tiles [data-ci=bleeding] b').textContent, chip: !!document.querySelector('#ciQuick [data-qa=bleeding][data-qv=none]')}; OvuStore.today=real; document.dispatchEvent(new Event('visibilitychange')); r.back=document.querySelector('#tiles [data-ci=bleeding] b').textContent; return r}")
            check("when the day changes the check-in redraws for the new day, and back again", nd["bleed"] == "Add" and nd["chip"] and nd["back"] == "None", nd)
            await page.evaluate("()=>OvuStore.setCheckinAnswer(OvuStore.today(),'bleeding',null)")
            await page.evaluate("()=>OvuStore.commit({checkinChoice: null})")
            await page.click("#tiles [data-ci=sleep]"); await page.wait_for_selector('#sheet[aria-hidden="false"] #slDate', timeout=8000)
            check("the Sleep tile opens the night record straight away", await page.evaluate("()=>document.querySelector('#sheetTitle').textContent.indexOf('Bedside clock')===0"))
            await page.evaluate("()=>OvuRoom.closeSheet()"); await page.wait_for_timeout(300)

            # 2. the Cycle tab opens a sheet with the calendar
            await page.goto(BASE + "room.html#cycle", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] [data-date], #sheet[aria-hidden="false"] .rday', timeout=10000)
            cyc = await page.evaluate("()=>{var cells=document.querySelectorAll('#sheet [data-date], #sheet .rday'); return {sheet: document.querySelector('#sheet')?.getAttribute('aria-hidden') === 'false', title: document.querySelector('#sheetTitle')?.textContent.slice(0,13), days: cells.length, visible: (cells[0]?.getBoundingClientRect().height || 0) > 0};}")
            check("room.html#cycle (old links and the Cycle hash) still opens the calendar sheet with visible days", cyc["sheet"] and cyc["title"] == "Your calendar" and cyc["days"] >= 28 and cyc["visible"], cyc)
            ib = await page.evaluate("()=>{var b=document.querySelector('#sheet .ibtn'); if(!b) return null; b.click(); var p=document.querySelector('#sheet .guide[data-guide-panel='+b.dataset.guide+']'); return {topic: b.dataset.guide, on: !!(p && p.classList.contains('on'))}}")
            check("an (i) button in the calendar sheet opens its guide panel, made on the spot if the sheet forgot it", ib is None or ib["on"], ib)
            await page.evaluate("()=>{var b=document.querySelector('#calTabs [data-tab=symptom]'); if(b) b.click();}"); await page.wait_for_timeout(400)
            mc0 = await page.evaluate("()=>{var m=document.querySelector('#moodCare'); return m?getComputedStyle(m).display:'missing'}")
            await page.evaluate("()=>{var b=document.querySelector('#moodFaces [data-mood=good]'); if(b) b.click();}"); await page.wait_for_timeout(150)
            mc1 = await page.evaluate("()=>getComputedStyle(document.querySelector('#moodCare')).display")
            await page.evaluate("()=>{var b=document.querySelector('#moodFaces [data-mood=low]'); if(b) b.click();}"); await page.wait_for_timeout(150)
            mc2 = await page.evaluate("()=>getComputedStyle(document.querySelector('#moodCare')).display")
            await page.evaluate("()=>{var b=document.querySelector('#calTabs [data-tab=period]'); if(b) b.click();}"); await page.wait_for_timeout(200)
            check("the low-mood support note stays hidden with no mood or a good mood and shows when she picks Low", mc0 == "none" and mc1 == "none" and mc2 == "flex", {"none": mc0, "good": mc1, "low": mc2})

            # 3. Luna's on-phone rules read a note without any relay call (AI help is off)
            await page.goto(BASE + "room.html#luna", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector("#lunaIn", timeout=10000)
            await page.fill("#lunaIn", "slept 11pm to 7am, cramps 6/10")
            await page.click("#lunaSend"); await page.wait_for_timeout(500)
            luna = await page.evaluate("()=>({cards: document.querySelectorAll('.bub.confirm').length, text: [...document.querySelectorAll('.bub.confirm label span')].map(s=>s.textContent).join(' | ')})")
            check("Luna understood sleep and cramps on the phone", luna["cards"] >= 1 and "Sleep" in luna["text"] and "cramps" in luna["text"], luna)
            check("no relay call was made with AI help off (account calls to the database are the only thing that leaves)", not [u for u in relay_calls if "/functions/v1/" in u], relay_calls[:2])
            await page.click("#lunaSave"); await page.wait_for_timeout(400)
            await page.reload(wait_until="networkidle"); await page.wait_for_timeout(600)
            saved = await page.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1'));return db.events.filter(e=>e.date==='%s').map(e=>e.type).sort().join(',');}" % TODAY)
            check("saved entries survive a reload (sleep and symptom for today)", saved == "sleep,symptom", saved)
            # 3b. the safety rules read before anything is parsed (docs/debate/2026-10-18-persona-safety-recheck.md)
            await page.goto(BASE + "room.html#luna", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector("#lunaIn", timeout=10000)
            await page.fill("#lunaIn", "I want to hurt myself"); await page.click("#lunaSend"); await page.wait_for_timeout(400)
            sh = await page.evaluate("()=>{var c=[...document.querySelectorAll('.bub.urgent.emergency')].pop(); return c ? {text: c.textContent, hrefs: [...c.querySelectorAll('a')].map(a=>a.getAttribute('href'))} : null}")
            check("a self-harm note shows the 995 and SOS card with its own call links", bool(sh) and "If you have thoughts of harming yourself, you need help now." in sh["text"] and "your baby" not in sh["text"] and "SOS is available 24 hours on 1767, or WhatsApp 9151 1767." in sh["text"] and sh["hrefs"] == ["tel:995", "tel:1767", "https://wa.me/6591511767"], sh)
            await page.fill("#lunaIn", "My period has not returned."); await page.click("#lunaSend"); await page.wait_for_timeout(400)
            np = await page.evaluate("()=>{var b=[...document.querySelectorAll('.bub.from-luna')].pop(); var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); return {text: b ? b.textContent : '', periodsToday: db.events.filter(e=>e.type==='period'&&e.date==='%s').length, confirm: document.querySelectorAll('.bub.confirm').length}}" % TODAY)
            check("'My period has not returned.' is acknowledged as no bleeding and adds no period day", "no bleeding" in np["text"] and np["periodsToday"] == 0 and np["confirm"] == 0, np)
            check("still no relay call after the safety notes", not [u for u in relay_calls if "/functions/v1/" in u], relay_calls[:2])

            # 4. the food diary opens with its tabs
            await page.goto(BASE + "room.html#food", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector(".foodmodes button", timeout=10000)
            food = await page.evaluate("()=>({modes: document.querySelectorAll('.foodmodes button').length, panes: document.querySelectorAll('.dtabs button, .dpane').length})")
            check("food diary opens with its modes and panes", food["modes"] >= 2 and food["panes"] >= 2, food)

            # 4b. the You tab shows the Your account row for the signed-in person: who she is, backup off, sign out and delete on offer
            await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] #youAccount .ygroup', timeout=10000)
            acct = await page.evaluate("()=>{var a=document.querySelector('#youAccount');return {label:a&&a.querySelector('.lbl')?a.querySelector('.lbl').textContent:null, who: (a&&a.querySelector('.ya-who b')||{}).textContent||'', sub: (a&&a.querySelector('.ya-who small')||{}).textContent||'', signout: !!(a&&a.querySelector('[data-ya=\"signout\"]')), del: !!(a&&a.querySelector('[data-ya=\"delete-account\"]')), enable: !!(a&&a.querySelector('[data-ya=\"enable-cloud\"]'))};}")
            check("You tab shows the Your account row with her email, backup off, and sign out, turn on backup and delete account on offer", acct["label"] == "Your account" and acct["who"] == "smoke@example.test" and "backup off" in acct["sub"] and acct["signout"] and acct["del"] and acct["enable"], acct)
            check("no sign-in request leaves the page for a signed-in person with a live session, and no diary row is sent with backup off", not [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1/entries" in u)], relay_calls[:3])
            # Your choices: every use of the data as a switch, the required one locked on, a receipt; a change is recorded with where it was made
            await page.evaluate("()=>document.querySelector('[data-yact=choices]').click()"); await page.wait_for_selector("#y_health_tracking", timeout=8000); await page.wait_for_timeout(300)
            ch = await page.evaluate("()=>({title: document.querySelector('#sheetTitle').textContent, n: document.querySelectorAll('.c-choice input').length, req: document.querySelector('#y_health_tracking').checked && document.querySelector('#y_health_tracking').disabled, anyOn: Array.from(document.querySelectorAll('.c-choice input:not(#y_health_tracking)')).some(i=>i.checked), receipt: (document.body.textContent||'').indexOf('Your consent receipt')>-1 && (document.body.textContent||'').indexOf('Notice version 4')>-1})")
            check("Your choices lists six switches with health tracking locked on, the rest off, and the receipt at notice 4", ch["title"].startswith("Your choices") and ch["n"] == 6 and ch["req"] and not ch["anyOn"] and ch["receipt"], ch)
            await page.check("#y_ai_reading"); await page.wait_for_timeout(400)
            c1 = await page.evaluate("()=>{var ev=JSON.parse(localStorage.getItem('ovumind_db_v1')).profile.consentEvents; var e=ev[ev.length-1]; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); return {p:e.purpose, a:e.action, m:e.method, aiOn:!!ai.on, on: document.querySelector('#y_ai_reading').checked};}")
            await page.uncheck("#y_ai_reading"); await page.wait_for_timeout(400)
            c2 = await page.evaluate("()=>{var ev=JSON.parse(localStorage.getItem('ovumind_db_v1')).profile.consentEvents; var e=ev[ev.length-1]; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); return {p:e.purpose, a:e.action, m:e.method, aiOn:!!ai.on};}")
            check("a switch in You records a grant and then a withdrawal, each marked as made in You, and Luna's mirror follows", c1 == {"p": "ai_reading", "a": "grant", "m": "you", "aiOn": True, "on": True} and c2 == {"p": "ai_reading", "a": "withdraw", "m": "you", "aiOn": False}, {"c1": c1, "c2": c2})
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)

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

            # 5b. cycles over time and the month calendars; the encrypted share carries them, and no meal photos
            hp = await page.evaluate("()=>({rows: document.querySelectorAll('#historyBody .prows li').length, chips: Array.from(document.querySelectorAll('#histRange button')).map(b=>b.textContent+':'+b.getAttribute('aria-pressed')).join(','), months: document.querySelectorAll('#patternBody .pmonth').length, open: document.querySelectorAll('#patternBody .pmonth[open]').length, verdict: /irregular|abnormal/i.test(document.querySelector('#historyCard').innerText), sw: document.documentElement.scrollWidth})")
            check("journal shows cycles over time (6 months picked, no normal or irregular verdict) and four month calendars with the newest open, no sideways scroll", hp["rows"] == 1 and "6 months:true" in hp["chips"] and hp["months"] == 4 and hp["open"] == 1 and not hp["verdict"] and hp["sw"] <= 390, hp)
            await page.click("#histRange [data-months='12']"); await page.wait_for_timeout(150)
            await page.evaluate("(d)=>{var b=document.querySelector('#patternBody .pday[data-pday=\"'+d+'\"]'); b.closest('details').open=true;}", Y1)
            await page.click("#patternBody .pday[data-pday='%s']" % Y1); await page.wait_for_timeout(150)
            dd = await page.evaluate("(d)=>{var b=document.querySelector('#patternBody .pday[data-pday=\"'+d+'\"]'), det=b.closest('details').querySelector('.pdetail'); return {pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), shown: !det.hidden, text: det.innerText, twelve: document.querySelector('#histRange [data-months=\"12\"]').getAttribute('aria-pressed')}}", Y1)
            check("a day in the calendar speaks its marks and opens its details; the 12-month range can be picked", dd["pressed"] == "true" and "Medium bleeding" in dd["text"] and "medium bleeding" in dd["label"] and dd["shown"] and dd["twelve"] == "true", dd)
            await page.evaluate("()=>OvuStore.add('food', OvuStore.today(), {meal:'dinner', foods:'laksa', items:[], tags:[], photo:'data:image/jpeg;base64,AAAA'}, 'room')")
            await page.click("#makeShare"); await page.select_option("#weeksSel", "m12"); await page.click("#doShare")
            await page.wait_for_selector("#saveShare", timeout=15000)
            async with page.expect_download() as dl2:
                await page.click("#saveShare")
            d2 = await dl2.value; spath = os.path.join(ROOT, "tools", ".smoke-share.json"); await d2.save_as(spath)
            stext = open(spath, encoding="utf-8").read(); spass = await page.evaluate("()=>document.querySelector('#passInput').value")
            sb = await page.evaluate("async (t)=>{var b=await OvuStore.crypto.decrypt(JSON.parse(t), document.querySelector('#passInput').value); var food=b.events.filter(e=>e.type==='food'); return {kind:b.kind, hist: !!(b.history&&b.history.rows), rows: b.history.rows.length, pats: (b.patterns||[]).length, exp: OvuStore.diffDays(OvuAgents.monthsBack(OvuStore.today(),12), OvuStore.today())+1, months: (b.months||[]).length, inc: b.included, photo: JSON.stringify(b).indexOf('data:image')>-1, had: food.some(f=>f.data.hadPhoto), msg: document.querySelector('#shareHolds').innerText}}", stext)
            await page.evaluate("()=>OvuStore.list('food').filter(e=>e.data.foods==='laksa').forEach(e=>OvuStore.remove(e.id))")
            check("a 12-month encrypted share holds cycles over time and a year of month marks, says what it holds, and leaves meal photos on the phone", sb["kind"] == "ovumind-share" and sb["hist"] and sb["rows"] == 1 and sb["pats"] == sb["exp"] and sb["months"] in (12, 13) and sb["inc"]["olderEntries"] and not sb["photo"] and sb["had"] and "Meal photos stay on this phone" in sb["msg"], {k: sb[k] for k in ("photo", "had", "msg", "rows", "pats", "exp", "months")})
            # the same file opens in the Doctor view: cycles over time, month by month and the month calendars
            await page.goto(BASE + "doctor.html", wait_until="networkidle")
            await page.set_input_files("#shareFile", spath); await page.fill("#passInput", spass); await page.wait_for_timeout(300); await page.click("#openBtn")
            await page.wait_for_selector("#dash", state="visible", timeout=10000); await page.wait_for_timeout(300)
            dv = await page.evaluate("()=>({hist: getComputedStyle(document.querySelector('#histCard')).display!=='none', rows: document.querySelectorAll('#histBody .prows li').length, months: document.querySelectorAll('#monthTable tr').length-1, cal: document.querySelectorAll('#patBody .pmonth').length, open: document.querySelectorAll('#patBody .pmonth[open]').length, sw: document.documentElement.scrollWidth})")
            os.remove(spath)
            check("the 12-month share opens in the Doctor view with cycles over time, every month in the table and every month's calendar (the newest open)", dv["hist"] and dv["rows"] == 1 and dv["months"] == sb["months"] and dv["cal"] == sb["months"] and dv["open"] == 1 and dv["sw"] <= 390, dv)

            # 6. evidence page and a Learn page with the room header; old screens redirect into the room
            r = await page.goto(BASE + "evidence.html", wait_until="networkidle")
            ev = await page.evaluate("()=>document.body.innerText.includes('E49')")
            check("evidence page lists E49", r.status == 200 and ev)
            await page.goto(BASE + "hormones.html", wait_until="networkidle"); await page.wait_for_timeout(400)
            hd = await page.evaluate("()=>({brand: document.querySelector('.rh-brand')?.textContent, tabs: document.querySelectorAll('nav.nav a').length, fab: !!document.querySelector('.mapfab')})")
            check("Learn page carries the Rhythme header and tabs, no old launcher", hd["brand"] == "RHYTHME" and hd["tabs"] == 4 and not hd["fab"], hd)
            dests = {}
            for old_page, want_tab in [("home.html", "home"), ("cycle-log.html", "cycle"), ("diet.html", "food"), ("breathwork.html", "mind")]:
                await page.goto(BASE + old_page, wait_until="load")
                try: await page.wait_for_function("()=>location.pathname.endsWith('room.html') && document.querySelector('nav a.on')", timeout=10000)
                except Exception: pass
                if want_tab != "home":
                    try: await page.wait_for_selector('#sheet[aria-hidden="false"]', timeout=10000)
                    except Exception: pass
                dests[old_page] = await page.evaluate("()=>(location.pathname.endsWith('room.html') ? (document.querySelector('#sheet[aria-hidden=false]') && /calendar/i.test(document.querySelector('#sheetTitle').textContent) ? 'calendar' : (document.querySelector('nav a.on')?.dataset.tab || 'home')) : location.pathname)")
            check("old screens redirect into the room and open the right place (the old cycle pages open the calendar now that there is no Cycle tab)", all(dests[k] == v for k, v in [("home.html", "home"), ("cycle-log.html", "calendar"), ("diet.html", "food"), ("breathwork.html", "mind")]), dests)

            # 6b. health data: a tiny Apple Health export.xml and a Takeout Fit zip are read on the phone, every kind found is listed
            # with nothing ticked, only the ticked kinds come in, the journal marks them, and one kind (then all) can be removed
            await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle")
            await page.wait_for_selector('#sheet[aria-hidden="false"] [data-yact="import"]', timeout=10000)
            await page.click('[data-yact="import"]'); await page.wait_for_selector("#impApple", state="attached", timeout=10000)
            imp0 = await page.evaluate("()=>({title: document.querySelector('#sheetTitle')?.textContent, cards: document.querySelectorAll('.imp-card').length, have: document.querySelectorAll('.imp-have').length, bar: !!document.querySelector('#impBar')})")
            check("health data sheet opens from You with the two sources, a progress bar and nothing brought in yet", imp0["cards"] == 2 and imp0["have"] == 0 and imp0["bar"] and "health data" in (imp0["title"] or ""), imp0)
            await page.set_input_files("#impApple", os.path.join(ROOT, "tools", "fixtures", "apple-export-mini.xml"))
            await page.wait_for_selector("#impGo", timeout=15000)
            pk = await page.evaluate("()=>({kinds: [...document.querySelectorAll('.imp-kind input')].map(i=>i.dataset.kind).join(','), ticked: document.querySelectorAll('.imp-kind input:checked').length, go: document.querySelector('#impGo').disabled, later: document.querySelector('.imp-later summary')?.textContent || '', db: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.source==='apple-health').length})")
            check("the picker lists every kind found with nothing ticked, Bring in locked, kinds with no place yet named, nothing written yet", pk["kinds"] == "sleep,period,spotting,symptoms,weight,mindful" and pk["ticked"] == 0 and pk["go"] and "4 other kinds" in pk["later"] and pk["db"] == 0, pk)
            await page.click('.imp-kind input[data-kind="sleep"]'); await page.wait_for_function("()=>document.querySelector('.imp-kind input[data-kind=\"sleep\"]')?.checked")
            await page.click('.imp-kind input[data-kind="weight"]'); await page.wait_for_function("()=>!document.querySelector('#impGo').disabled && /2 kinds/.test(document.querySelector('#impGo').textContent)")
            await page.click("#impGo"); await page.wait_for_function("()=>document.querySelector('#impSummary')?.dataset.run === '1'", timeout=15000)
            imp = await page.evaluate("()=>({text: document.querySelector('#impSummary').innerText, have: [...document.querySelectorAll('.imp-have')].map(c=>c.dataset.kind).join(','), bars: document.querySelectorAll('.imp-have[data-kind=\"sleep\"] .ibars i').length, db: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.source==='apple-health').map(e=>e.type).sort().join(',')})")
            check("only the ticked kinds come in: 2 nights and 1 weigh-in, the rest left out by her choice, the file never left the phone", "2 nights" in imp["text"] and "1 weigh-in" in imp["text"] and "Left out by your choice" in imp["text"] and "never left" in imp["text"] and imp["db"] == "sleep,sleep,weight", imp)
            check("the Brought in so far cards show sleep and weight (two nights get a sentence, not bars)", imp["have"] == "sleep,weight" and imp["bars"] == 0, imp)
            await page.set_input_files("#impGoogle", os.path.join(ROOT, "tools", "fixtures", "takeout-fit-mini.zip"))
            await page.wait_for_selector("#impGo", timeout=20000)
            await page.click('.imp-kind input[data-kind="sleep"]'); await page.wait_for_function("()=>!document.querySelector('#impGo').disabled")
            await page.click("#impGo"); await page.wait_for_function("()=>document.querySelector('#impSummary')?.dataset.run === '2'", timeout=15000)
            tk = await page.evaluate("()=>({text: document.querySelector('#impSummary').innerText, db: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.source==='google-fit').map(e=>e.type).sort().join(','), src: document.querySelector('.imp-have[data-kind=\"sleep\"] .imp-srcs')?.innerText || '', bars: document.querySelectorAll('.imp-have[data-kind=\"sleep\"] .ibars i').length})")
            check("the Takeout zip is read on the phone and only its nights come in, shown with both sources", "2 nights" in tk["text"] and tk["db"] == "sleep,sleep" and "GOOGLE" in tk["src"].upper() and "APPLE" in tk["src"].upper() and tk["bars"] == 4, tk)
            # an imported symptom day edited on the calendar keeps "pain not stated" and becomes hers (Codex review, 19 Oct)
            await page.set_input_files("#impApple", os.path.join(ROOT, "tools", "fixtures", "apple-export-mini.xml"))
            await page.wait_for_selector("#impGo", timeout=15000)
            await page.click('.imp-kind input[data-kind="symptoms"]'); await page.wait_for_function("()=>!document.querySelector('#impGo').disabled")
            await page.click("#impGo"); await page.wait_for_function("()=>document.querySelector('#impSummary')?.dataset.run === '3'", timeout=15000)
            await page.click('[data-impact="calendar"][data-kind="symptoms"]'); await page.wait_for_selector("#saveSym", timeout=10000)
            note = await page.evaluate("()=>({note: document.querySelector('.imp-note')?.innerText || '', on: [...document.querySelectorAll('#symChips .on')].map(b=>b.dataset.sym).join(',')})")
            await page.fill("#symNotes", "felt fine by lunch"); await page.click("#saveSym"); await page.wait_for_timeout(400)
            sym = await page.evaluate("()=>{var e=JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(x=>x.type==='symptom'&&x.date==='2025-06-04')[0]; return e?{pain: e.data.pain, source: e.source, notes: e.data.notes, syms: e.data.symptoms.join(',')}:null;}")
            check("a brought-in symptom day says where it came from, and a note added on the calendar keeps pain unstated and makes the day hers", "Apple Health" in note["note"] and note["on"] == "cramps,headache" and sym and sym["pain"] is None and sym["source"] == "room" and sym["syms"] == "cramps,headache", {"note": note, "sym": sym})
            await page.goto(BASE + "journal.html#weight", wait_until="networkidle"); await page.wait_for_timeout(500)
            jw = await page.evaluate("()=>({on: document.querySelector('#filters .on')?.dataset.f, entry: document.querySelector('#timeline .entry b')?.innerText || ''})")
            check("the journal opens on Weight and marks the weigh-in as from Apple Health", jw["on"] == "weight" and "58.1 kg" in jw["entry"] and "APPLE HEALTH" in jw["entry"].upper(), jw)
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle")
            await page.wait_for_selector('#sheet[aria-hidden="false"] [data-yact="import"]', timeout=10000); await page.click('[data-yact="import"]')
            await page.wait_for_selector('[data-impact="remove"][data-kind="weight"]', timeout=10000); await page.click('[data-impact="remove"][data-kind="weight"]')
            await page.wait_for_selector('[data-impact="remove-yes"][data-kind="weight"]', timeout=5000); await page.click('[data-impact="remove-yes"][data-kind="weight"]'); await page.wait_for_timeout(400)
            one = await page.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); return {weight: db.events.filter(e=>e.type==='weight').length, sleepImported: db.events.filter(e=>e.type==='sleep'&&(e.source==='apple-health'||e.source==='google-fit')).length, have: [...document.querySelectorAll('.imp-have')].map(c=>c.dataset.kind).join(',')};}")
            check("removing one kind takes only that kind; the nights stay", one["weight"] == 0 and one["sleepImported"] == 4 and one["have"] == "sleep", one)
            await page.click('[data-impact="remove"][data-kind="all"]'); await page.wait_for_selector('[data-impact="remove-yes"][data-kind="all"]', timeout=5000); await page.click('[data-impact="remove-yes"][data-kind="all"]'); await page.wait_for_timeout(500)
            left = await page.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); return {imported: db.events.filter(e=>e.source==='apple-health'||e.source==='google-fit').length, own: db.events.filter(e=>['s1','s2','s3'].includes(e.id)).length, total: db.events.length, have: document.querySelectorAll('.imp-have').length};}")
            check("Remove everything brought in takes out only imported entries and keeps the seeded ones and the symptom day she edited", left["imported"] == 0 and left["own"] == 3 and left["total"] == 6 and left["have"] == 0, left)
            # Movement: from the mat, log a brisk walk; the week, the entry, the hearts, the period note, the guide and the old page line up
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.click("nav a[data-tab=mind]"); await page.wait_for_selector("#mindMove", timeout=8000); await page.click("#mindMove"); await page.wait_for_selector("#mvActs", timeout=8000)
            mv0 = await page.evaluate("()=>({week: document.querySelector('.mvhead b').textContent, period: !!document.querySelector('#mvPeriod'), logged: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.some(e=>e.date==='%s'&&((e.type==='period'&&e.data.flow&&e.data.flow!=='none')||(e.type==='symptom'&&(e.data.symptoms||[]).indexOf('cramps')>-1))), acts: document.querySelectorAll('.mvact').length, fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, aura: document.querySelector('#aura').classList.contains('on')})" % TODAY)
            check("Movement opens from the mat: 19 activities, an empty week, the period note only when today has a logged period day or cramps, no sideways scroll, Erin's mat closed", mv0["acts"] == 19 and mv0["week"] == "0" and mv0["period"] == mv0["logged"] and mv0["fits"] and not mv0["aura"], mv0)
            await page.click("[data-mact=walk]"); await page.click("[data-mvar=brisk]"); await page.click("#mvQuick [data-min='45']")
            pv = await page.text_content("#mvPreview")
            await page.click("#mvSave"); await page.wait_for_timeout(600)
            mv = await page.evaluate("()=>{var d=JSON.parse(localStorage.getItem('ovumind_db_v1')); var e=d.events.filter(x=>x.type==='exercise'); return {n:e.length, d:e.length?e[e.length-1].data:null, week: document.querySelector('.mvhead b')&&document.querySelector('.mvhead b').textContent, list: document.querySelectorAll('#mvList li').length, hearts: (d.state.rewards.log||[]).filter(l=>l.type==='exercise').map(l=>l.points)}}")
            check("a 45-minute brisk walk saves code 17200 at 4.8 MET (216 MET-minutes), the week reads 45, the list shows it and it earns 6 hearts", mv["n"] == 1 and mv["d"]["code"] == "17200" and mv["d"]["met"] == 4.8 and mv["d"]["minutes"] == 45 and mv["week"] == "45" and mv["list"] == 1 and mv["hearts"] == [6] and "216 MET-minutes" in (pv or ""), {"mv": mv, "pv": pv})
            await page.click("[data-mact=strength]"); await page.click("[data-mvar=reps]"); strd = await page.evaluate("()=>({on: document.querySelector('#mvStr').checked, locked: document.querySelector('#mvStr').disabled})")
            await page.fill("#mvMin", "0"); await page.click("#mvSave"); await page.wait_for_timeout(200)
            bad = await page.evaluate("()=>({msg: document.querySelector('#mvMsg').textContent, n: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(x=>x.type==='exercise').length})")
            check("strength or weights pre-ticks the strength day but leaves it yours to change, and zero minutes is refused with a plain message", strd["on"] and not strd["locked"] and bad["n"] == 1 and "minutes" in bad["msg"], {"str": strd, "bad": bad})
            await page.evaluate("()=>OvuStore.add('symptom', OvuStore.today(), {symptoms:['cramps'], pain:4, mood:'', notes:''})")
            await page.goto(BASE + "room.html#move", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] #mvActs', timeout=10000)
            pc = await page.evaluate("()=>{var p=document.querySelector('#mvPeriod'); return {there: !!p, text: p?p.innerText:'', nav: document.querySelector('nav a.on')&&document.querySelector('nav a.on').dataset.tab}}")
            check("logged cramps today bring the gentle period note with its red flags, and room.html#move opens Movement under the Mind tab", pc["there"] and "Listen to your body" in pc["text"] and "low certainty" in pc["text"] and pc["nav"] == "mind", pc)
            await page.click("#mvGuide"); await page.wait_for_selector(".mvsec", timeout=8000)
            gd = await page.evaluate("()=>({secs: document.querySelectorAll('.mvsec').length, refs: Array.from(document.querySelectorAll('.mvsec .evrefs a')).map(a=>a.getAttribute('href').split('#')[1]).sort().join(','), text: document.querySelector('#sheet').innerText})")
            check("the Movement guide has its seven sections and cites E9 and E67 to E72, with no fixed cycle days or avoid-HIIT rule", gd["secs"] == 8 and gd["refs"] == "E67,E68,E69,E70,E71,E72,E9" and "Day 1" not in gd["text"] and "HIIT" not in gd["text"], {"secs": gd["secs"], "refs": gd["refs"]})
            await page.goto(BASE + "exercise.html", wait_until="load")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #mvActs', timeout=10000); old_ok = True
            except Exception: old_ok = False
            check("the old exercise page now opens Movement in the room", old_ok and page.url.endswith("room.html"), page.url)
            await page.goto(BASE + "journal.html", wait_until="networkidle"); await page.wait_for_timeout(700)
            jm = await page.evaluate("()=>Array.from(document.querySelectorAll('#timeline .entry b')).map(b=>b.textContent).filter(t=>t.indexOf('Movement')===0)")
            check("the journal lists the walk as Movement with its minutes", jm == ["Movement · Walking · 45 min"], jm)

            # sleep details and the two-week check (21 Oct, "write our own based on evidence"): optional chips on Record a night,
            # a check whose answers raise care notes, one a day, no hearts; the patterns in the journal and the doctor view
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_timeout(900)
            await page.click("[data-ci=sleep]"); await page.wait_for_timeout(400)
            sq0 = await page.evaluate("()=>({sheet: document.querySelector('#sheetTitle').textContent, toggle: !!document.querySelector('#sqToggle'), hidden: document.querySelector('#sqBody').hidden, expanded: document.querySelector('#sqToggle').getAttribute('aria-expanded')})")
            await page.click("#sqToggle"); await page.wait_for_timeout(200)
            await page.evaluate("()=>{document.querySelector('#slBed').value='23:30'; document.querySelector('#slWake').value='06:40';}")
            for k, v in (("latency", "gt60"), ("wakeups", "2"), ("awake", "31-60"), ("woke", "flush"), ("woke", "toilet"), ("rested", "2")):
                await page.click(".sqf[data-sq=%s] .chipbtn[data-v='%s']" % (k, v)); await page.wait_for_timeout(80)
            sq1 = await page.evaluate("()=>({open: !document.querySelector('#sqBody').hidden, awakeShown: !document.querySelector('.sqf[data-sq=awake]').hidden, woke: [...document.querySelectorAll('.sqf[data-sq=woke] .chipbtn.on')].map(b=>b.dataset.v), pressed: document.querySelector('.sqf[data-sq=latency] .chipbtn[data-v=gt60]').getAttribute('aria-pressed')})")
            await page.click("#sqToggle"); await page.wait_for_timeout(150)  # folded away: the answers must survive (Codex, 21 Oct)
            fold = await page.evaluate("()=>({hidden: document.querySelector('#sqBody').hidden, label: document.querySelector('#sqToggle').textContent})")
            await page.click("#saveSleep"); await page.wait_for_timeout(500)
            sv = await page.evaluate("()=>{var e=OvuStore.list('sleep').filter(x=>x.data&&x.data.details).slice(-1)[0]; var lab=OvuAgents.SLEEP_LABELS.latency.opts.filter(o=>o[0]==='gt60')[0][1].toLowerCase(); return {msg: document.querySelector('#sleepMsg').textContent, det: e && e.data.details, listHasDetail: document.querySelector('#sleepList').textContent.toLowerCase().indexOf(lab)>-1}}")
            check("Record a night: the details box starts closed and opens on its toggle, the awake question appears once wakings are chosen, two wakers can be ticked, folding the box keeps the answers and says so, and the saved night carries them and shows them in the list", sq0["toggle"] and sq0["hidden"] and sq0["expanded"] == "false" and sq1["open"] and sq1["awakeShown"] and sq1["woke"] == ["flush", "toilet"] and sq1["pressed"] == "true" and fold["hidden"] and "answered, kept" in fold["label"] and "Saved" in sv["msg"] and bool(sv["det"]) and sv["det"]["latency"] == "gt60" and sv["det"]["wakeups"] == "2" and sv["det"]["awake"] == "31-60" and sorted(sv["det"]["woke"]) == ["flush", "toilet"] and sv["listHasDetail"], {"sq0": sq0, "sq1": sq1, "fold": fold, "sv": sv})
            await page.click("#openSleepCheck"); await page.wait_for_timeout(400)
            ck0 = await page.evaluate("()=>({title: document.querySelector('#sheetTitle').textContent, groups: [...document.querySelectorAll('.sqf')].map(f=>f.dataset.sq).join(','), save: !!document.querySelector('#saveSleepCheck')})")
            for k, v in (("w1", "4"), ("w2", "3"), ("chance", "usually"), ("impact", "lot"), ("since", "3m+"), ("breathing", "yes"), ("legs", "no"), ("driving", "yes")):
                await page.click(".sqf[data-sq=%s] .chipbtn[data-v='%s']" % (k, v)); await page.wait_for_timeout(60)
            h0 = await page.evaluate("()=>OvuRewards.ledger().hearts")
            await page.click("#saveSleepCheck"); await page.wait_for_timeout(500)
            ck = await page.evaluate("(h0)=>{var ev=OvuStore.list('sleepcheck').slice(-1)[0]; var card=ev && OvuOrb.entryUrgent(ev, OvuStore.profile()); var notes=[...document.querySelectorAll('#sqResult .sqnote')].map(n=>n.className.replace('sqnote','').trim()+':'+n.querySelector('b').textContent); return {saved: !!ev, n: OvuStore.list('sleepcheck').length, notes: notes, text: document.querySelector('#sqResult').textContent, card: card ? card.code + ':' + card.level : null, back: !!document.querySelector('#sqBack'), hearts: OvuRewards.ledger().hearts - h0}}", h0)
            check("the two-week check: eight groups, saved once; the notes put drowsy driving first (today), name breathing signs and persistent trouble with CBT-I (prompt), say Rhythme cannot assess, pay no hearts, and Luna's card for the check is the driving one", ck0["groups"] == "w1,w2,chance,impact,since,breathing,legs,driving" and ck0["save"] and ck["saved"] and ck["n"] == 1 and len(ck["notes"]) >= 3 and ck["notes"][0].startswith("today:") and "cannot assess" in ck["text"] and "CBT" in ck["text"] and ck["card"] == "SLEEP_DROWSY_DRIVING:today" and ck["back"] and ck["hearts"] == 0, {"ck0": ck0, "ck": ck})
            await page.click("#sqBack"); await page.wait_for_timeout(300); await page.click("#openSleepCheck"); await page.wait_for_timeout(300)
            await page.click(".sqf[data-sq=driving] .chipbtn[data-v=no]"); await page.click("#saveSleepCheck"); await page.wait_for_timeout(400)
            ck2 = await page.evaluate("()=>{var l=OvuStore.list('sleepcheck'); return {n: l.length, driving: l[0].data.driving}}")
            check("a second check on the same day replaces the first: one a day", ck2["n"] == 1 and ck2["driving"] == "no", ck2)
            await page.evaluate("()=>OvuRoom.closeSheet()")
            await page.goto(BASE + "journal.html", wait_until="networkidle"); await page.wait_for_timeout(900)
            jn = await page.evaluate("()=>{var c=document.querySelector('#sleepNotesCard'); var t=c?c.textContent:''; return {shown: !!c && !c.hidden && c.offsetParent !== null, rows: document.querySelectorAll('#sleepNotesBody .sndl').length, of: / of /.test(t), checks: /Notes raised/.test(t), notScore: /not a score/.test(t)}}")
            check("the journal's Sleep details card shows the four-week rows with their denominators, the notes the check raised, and says it is not a score", jn["shown"] and jn["rows"] >= 1 and jn["of"] and jn["checks"] and jn["notScore"], jn)
            await page.goto(BASE + "doctor.html", wait_until="networkidle"); await page.wait_for_timeout(600); await page.click("#demoBtn"); await page.wait_for_timeout(900)
            dn = await page.evaluate("()=>{var b=document.querySelector('#sleepNotesBox'); return {rows: b ? b.querySelectorAll('.sndl').length : 0, check: !!b && /Notes raised/.test(b.textContent)}}")
            check("the doctor view's sample carries the sleep details rows and the sample two-week check", dn["rows"] >= 1 and dn["check"], dn)
            # 7. first launch: the sign-in wall (Jamie, 21 Oct: an account before anything), never the diary
            ctx2 = await browser.new_context(viewport={"width": 390, "height": 844})
            p2 = await ctx2.new_page()
            async def auth_gate(route):
                url = route.request.url
                if "/auth/v1/authorize" in url: return await route.fulfill(status=400, content_type="application/json", body='{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}')
                if "/auth/v1/otp" in url: return await route.fulfill(status=200, content_type="application/json", body="{}")
                if "/auth/v1/verify" in url:
                    body = json.loads(route.request.post_data or "{}")
                    if body.get("token") != "246810": return await route.fulfill(status=403, content_type="application/json", body='{"error_code":"otp_expired","msg":"Token has expired or is invalid"}')
                    return await route.fulfill(status=200, content_type="application/json", body=json.dumps({"access_token": "smoke-token", "refresh_token": "smoke-refresh", "expires_in": 3600, "user": SESS["user"]}))
                return await gate(route)
            await p2.route("**/*", auth_gate)
            p2.on("pageerror", lambda e: errors.append("fresh pageerror: " + str(e)))
            p2.on("console", lambda m: errors.append("fresh console: " + m.text) if m.type == "error" and "favicon" not in m.text and ".supabase.co" not in _loc(m) else None)  # the deliberate 400 from the provider probe, and the gate's aborts of the new account's own calls
            await p2.goto(BASE + "room.html", wait_until="networkidle"); await p2.wait_for_timeout(900)
            fresh = await p2.evaluate("()=>({welcome: !!document.querySelector('#welcome:not([hidden])'), moon: !!document.querySelector('#welcome .w-moon'), logo: (document.querySelector('#welcome .w-hero img')||{}).naturalWidth||0, buttons: [...document.querySelectorAll('#welcome .w-auth .btn')].map(b=>[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()), begin: !!document.querySelector('#wBegin'), consent: document.querySelector('#consent').hidden, db: localStorage.getItem('ovumind_db_v1'), note: document.querySelector('#wNote').textContent})")
            check("a fresh visitor meets the sign-in wall: the logo where the moon was, Apple, Google and email, no Let's begin, the notice not yet shown, nothing saved", fresh["welcome"] and not fresh["moon"] and fresh["logo"] == 512 and fresh["buttons"] == ["Sign in with Apple", "Sign in with Google", "Sign in with email"] and not fresh["begin"] and fresh["consent"] and (fresh["db"] is None or '"consent"' not in fresh["db"]) and "Sign in to open it" in fresh["note"], fresh)
            foc = await p2.evaluate("()=>({inert: document.querySelector('#main').inert === true && document.querySelector('nav.nav').inert === true && document.querySelector('#sheet').inert === true, focusIn: !!(document.activeElement && document.activeElement.closest('#welcome')), role: document.querySelector('#welcome').getAttribute('role'), modal: document.querySelector('#welcome').getAttribute('aria-modal'), loading: document.querySelector('#loading').classList.contains('hidden')})")
            check("while the wall is up the room behind it is inert to keys and screen readers, focus sits in the wall, the wall is a modal dialog, and the loading veil has lifted", foc["inert"] and foc["focusIn"] and foc["role"] == "dialog" and foc["modal"] == "true" and foc["loading"], foc)
            wn = await p2.evaluate("()=>{var h=document.documentElement,was=h.getAttribute('data-sky');h.setAttribute('data-sky','night');var c=getComputedStyle(document.querySelector('#wSignIn')).color, g=getComputedStyle(document.querySelector('#wGoogle')).backgroundColor;if(was===null)h.removeAttribute('data-sky');else h.setAttribute('data-sky',was);return {c:c,g:g}}")
            check("after sunset the wall's lighter buttons keep dark plum text and the Google button stays white", wn["c"] == "rgb(90, 66, 116)" and wn["g"] == "rgb(255, 255, 255)", wn)
            await p2.goto(BASE + "journal.html", wait_until="load"); await p2.wait_for_timeout(600)
            check("a fresh visitor on another page is sent to the room first", p2.url.endswith("room.html"), p2.url)
            await p2.goto(BASE + "room.html", wait_until="networkidle"); await p2.wait_for_timeout(700)
            await p2.click("#wGoogle"); await p2.wait_for_timeout(900)
            gp = await p2.evaluate("()=>({toast: document.querySelector('#toast').textContent, url: location.pathname, wall: !!document.querySelector('#welcome:not([hidden])'), enabled: !document.querySelector('#wGoogle').disabled})")
            check("a provider that is not switched on in Supabase says so in a toast and leaves the wall where it was, with the button usable again", "still being set up" in gp["toast"] and gp["url"].endswith("room.html") and gp["wall"] and gp["enabled"], gp)
            await p2.click("#wSignIn"); await p2.wait_for_timeout(300)
            await p2.fill("#wEmail", "not-an-address"); await p2.click("#wEmailGo"); await p2.wait_for_timeout(300)
            bad = await p2.evaluate("()=>document.querySelector('#wMsg').textContent")
            await p2.fill("#wEmail", "friend@example.test"); await p2.click("#wEmailGo"); await p2.wait_for_timeout(600)
            sent = await p2.evaluate("()=>({code: !document.querySelector('#wCodeWrap').hidden, msg: document.querySelector('#wMsg').textContent, ro: document.querySelector('#wEmail').readOnly, go: document.querySelector('#wEmailGo').textContent})")
            check("the email form asks for a real address, then sends a code and asks for it", "real email" in bad and sent["code"] and "six-digit code to friend@example.test" in sent["msg"] and sent["ro"] and "Verify" in sent["go"], {"bad": bad, "sent": sent})
            await p2.fill("#wCode", "111111"); await p2.click("#wEmailGo"); await p2.wait_for_timeout(600)
            wrong = await p2.evaluate("()=>({msg: document.querySelector('#wMsg').textContent, wall: !!document.querySelector('#welcome:not([hidden])'), session: localStorage.getItem('ovumind_auth_v1')})")
            check("a wrong code keeps the wall up with the server's reason, and no session is written", wrong["wall"] and wrong["session"] is None and ("expired" in wrong["msg"] or "invalid" in wrong["msg"]), wrong)
            await p2.fill("#wCode", "246810"); await p2.click("#wEmailGo"); await p2.wait_for_timeout(900)
            signed = await p2.evaluate("()=>({wall: !!document.querySelector('#welcome:not([hidden])'), consent: !document.querySelector('#consent').hidden, email: JSON.parse(localStorage.getItem('ovumind_auth_v1')||'{}').user?.email, cloudSheet: !!document.querySelector('#ovuCloudSheet'), inert: document.querySelector('#main').inert === true})")
            check("the right code signs her in: the wall closes, the room is no longer inert, the data notice opens next, and the cloud prompt waits because the notice carries that choice", not signed["wall"] and signed["consent"] and signed["email"] == "smoke@example.test" and not signed["cloudSheet"] and not signed["inert"], signed)
            # the real consent controls: nothing optional pre-ticked, the button locked until the age tick
            before = await p2.evaluate("()=>({shown: !document.querySelector('#consent').hidden, n: document.querySelectorAll('#cChoices input[type=checkbox]').length, anyOn: Array.from(document.querySelectorAll('#cChoices input')).some(i=>i.checked), age: document.querySelector('#cAge').checked, locked: document.querySelector('#cAgree').disabled, under: !!document.querySelector('#cUnder')})")
            check("the notice opens with five separate choices all off, the 18+ tick unticked, the button locked and an under-18 way out", before["shown"] and before["n"] == 5 and not before["anyOn"] and not before["age"] and before["locked"] and before["under"], before)
            lockedStill = await p2.evaluate("()=>document.querySelector('#cAgree').disabled"); await p2.check("#cAge"); await p2.click("#cAgree"); await p2.wait_for_timeout(600)
            check("the 18+ tick is the one tick: the button stays locked until it is ticked", lockedStill)
            after = await p2.evaluate("()=>{var p=JSON.parse(localStorage.getItem('ovumind_db_v1')).profile; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); return {v:p.consent&&p.consent.v, age:p.ageAttest&&p.ageAttest.confirmed===true?p.ageAttest.version:null, purposes:(p.consentEvents||[]).map(e=>e.purpose+':'+e.action+':'+e.method).sort(), aiOn:!!ai.on, cloud:p.cloud&&p.cloud.v, hidden: document.querySelector('#consent').hidden};}")
            check("agreeing records the 18+ attestation and health tracking at notice 4, nothing else, and closes the notice", after["v"] == 4 and after["age"] == 1 and after["purposes"] == ["age_18:grant:sheet", "health_tracking:grant:sheet"] and not after["aiOn"] and not after["cloud"] and after["hidden"], after)
            await ctx2.close()
            # the notice itself: no under-18 note for an ordinary visitor; a withdrawal that does not reach the account keeps the sheet
            ctxw = await browser.new_context(viewport={"width": 390, "height": 844}); await ctxw.add_init_script(SESSION_SEED); pw = await ctxw.new_page(); await pw.route("**/*", gate)
            await pw.goto(BASE + "room.html", wait_until="networkidle"); await pw.wait_for_timeout(900)
            minor = await pw.evaluate("()=>getComputedStyle(document.querySelector('#cMinor')).display")
            await pw.evaluate("()=>{OvuStore.setProfile({analysis:{on:true}}); window.OvuAuth.setImprove=function(){return Promise.resolve({ok:false,error:'offline'})};}")
            await pw.check("#cAge"); await pw.click("#cAgree"); await pw.wait_for_timeout(500)
            wd = await pw.evaluate("()=>({open: !document.querySelector('#consent').hidden, err: (document.querySelector('#cImproveErr')||{}).textContent||'', agree: !document.querySelector('#cAgree').disabled, saved: !!(OvuStore.profile().consent && OvuStore.profile().consent.v >= 4)})")
            await pw.reload(wait_until="networkidle"); await pw.wait_for_timeout(900)
            wd["afterReload"] = await pw.evaluate("()=>!document.querySelector('#consent').hidden || !document.querySelector('#welcome').hidden")
            await ctxw.close()
            check("an ordinary visitor's notice has no under-18 note, and a withdrawal of Help improve logging that does not reach the account saves nothing, keeps the notice open, says so, and the notice is still due after a reload", minor == "none" and wd["open"] and "still on" in wd["err"] and wd["agree"] and not wd["saved"] and wd["afterReload"], {"minor": minor, "wd": wd})
            # a person whose consent predates notice v2 is sent back to the room from any other page
            ctx3 = await browser.new_context(viewport={"width": 390, "height": 844})
            old = json.loads(json.dumps(DB)); old["profile"]["consent"] = {"v": 1, "at": NOW, "improve": True}
            await ctx3.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(old))); await ctx3.add_init_script(SESSION_SEED)
            p3 = await ctx3.new_page(); await p3.route("**/*", gate)
            await p3.goto(BASE + "hormones.html", wait_until="load"); await p3.wait_for_timeout(700)
            check("a v1 consent is sent back to the room to be asked again", p3.url.endswith("room.html"), p3.url)
            await ctx3.close()
            # a person who agreed to notice v2 reads v3: the switches show today's settings, 18+ is asked afresh, the diary is kept
            ctx4 = await browser.new_context(viewport={"width": 390, "height": 844})
            v2 = json.loads(json.dumps(DB)); v2["profile"]["consent"] = {"v": 2, "at": NOW, "luna": True, "improve": False, "age13": True}
            for k in ("ageAttest", "consentEvents", "consentImportedAt"): v2["profile"].pop(k, None)
            await ctx4.add_init_script("if(!localStorage.getItem('ovumind_db_v1')){ localStorage.setItem('ovumind_db_v1', %s); localStorage.setItem('ovumind_ai_v1', JSON.stringify({on:false, insights:false, photos:true})); }" % json.dumps(json.dumps(v2))); await ctx4.add_init_script(SESSION_SEED)
            p4 = await ctx4.new_page(); await p4.route("**/*", gate)
            p4.on("pageerror", lambda e: errors.append("v2 pageerror: " + str(e)))
            await p4.goto(BASE + "room.html", wait_until="networkidle"); await p4.wait_for_timeout(900)
            rc = await p4.evaluate("()=>({shown: !document.querySelector('#consent').hidden, title: document.querySelector('#cTitle').textContent, photos: document.querySelector('#c_food_photo_ai').checked, reading: document.querySelector('#c_ai_reading').checked, cloud: document.querySelector('#c_cloud_sync').checked, age: document.querySelector('#cAge').checked, locked: document.querySelector('#cAgree').disabled, fine: document.querySelector('#cFine').textContent, welcome: !!document.querySelector('#welcome:not([hidden])')})")
            check("a v2 consent reads the changed notice: the photo switch mirrors her setting, the rest are off, 18+ is asked afresh", rc["shown"] and rc["title"] == "Your data choices" and rc["photos"] and not rc["reading"] and not rc["cloud"] and not rc["age"] and rc["locked"] and rc["fine"] == "Your diary on this phone is kept as it is." and not rc["welcome"], rc)
            await p4.check("#c_ai_reading"); await p4.check("#cAge"); await p4.click("#cAgree"); await p4.wait_for_timeout(700)
            rd = await p4.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); var p=db.profile; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); var ev=p.consentEvents||[]; return {v:p.consent.v, age:p.ageAttest&&p.ageAttest.confirmed, imports: ev.filter(e=>e.method==='import').map(e=>e.purpose).sort(), sheet: ev.filter(e=>e.method==='sheet').map(e=>e.purpose+':'+e.action).sort(), aiOn: ai.on, aiPhotos: ai.photos, events: db.events.length, hidden: document.querySelector('#consent').hidden};}")
            check("agreeing again keeps the earlier choices as imports, records the sheet's choices at notice 4 and keeps every entry", rd["v"] == 4 and rd["age"] is True and rd["imports"] == ["food_photo_ai", "health_tracking"] and rd["sheet"] == ["age_18:grant", "ai_reading:grant", "food_photo_ai:grant", "health_tracking:grant"] and rd["aiOn"] is True and rd["aiPhotos"] is True and rd["events"] == 3 and rd["hidden"], rd)
            await ctx4.close()
            # under 18: the room does not open, nothing is saved, and the notice is back on the next visit
            ctx5 = await browser.new_context(viewport={"width": 390, "height": 844}); await ctx5.add_init_script(SESSION_SEED)
            p5 = await ctx5.new_page(); await p5.route("**/*", gate)
            await p5.goto(BASE + "room.html", wait_until="networkidle"); await p5.wait_for_timeout(900)
            await p5.click("#cUnder"); await p5.wait_for_timeout(400)
            u1 = await p5.evaluate("()=>({msg: (document.querySelector('#consent h2')||{}).textContent, agree: !!document.querySelector('#cAgree'), open: !document.querySelector('#consent').hidden, exportLink: !!document.querySelector('#cExport') && !!document.querySelector('#cWipe') && !!document.querySelector('#cSignOut'), db: localStorage.getItem('ovumind_db_v1')})")
            await p5.reload(wait_until="networkidle"); await p5.wait_for_timeout(700)
            u2 = await p5.evaluate("()=>({welcome: !!document.querySelector('#welcome:not([hidden])'), consent: !document.querySelector('#consent').hidden, db: localStorage.getItem('ovumind_db_v1')})")
            check("under 18: a plain message, export, delete and sign out right there, no agree button, nothing written at all, and the doorway is back on reload", "18 and over" in (u1["msg"] or "") and not u1["agree"] and u1["open"] and u1["exportLink"] and '"consent":{' not in (u1["db"] or "") and 'under18' not in (u1["db"] or "") and (u2["welcome"] or u2["consent"]) and '"ageAttest"' not in (u2["db"] or ""), {"u1": {k: u1[k] for k in ("msg", "agree", "open", "exportLink")}, "u2": {k: u2[k] for k in ("welcome", "consent")}})
            await ctx5.close()
            # bleeding after menopause: the journal note stays until she hides it, and hiding it holds after a reload
            ctx6 = await browser.new_context(viewport={"width": 390, "height": 844})
            pm = json.loads(json.dumps(DB)); pm["profile"]["lifeStage"] = "post"
            pm["events"].append({"id": "pm1", "type": "symptom", "date": TODAY, "createdAt": NOW, "updatedAt": NOW, "source": "luna", "data": {"symptoms": ["spotting"], "pain": None, "mood": "", "notes": ""}})
            await ctx6.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(pm))); await ctx6.add_init_script(SESSION_SEED)
            p6 = await ctx6.new_page(); await p6.route("**/*", gate)
            p6.on("pageerror", lambda e: errors.append("postmeno pageerror: " + str(e)))
            p6.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            await p6.goto(BASE + "journal.html", wait_until="networkidle"); await p6.wait_for_timeout(700)
            f1 = await p6.evaluate("()=>({text: document.querySelector('#flags').textContent, btn: !!document.querySelector('#flags [data-dismiss=POSTMENO_BLEED]')})")
            check("spotting logged as a symptom after menopause shows the bleeding note in the journal with a hide button", "Bleeding after menopause" in f1["text"] and f1["btn"], f1)
            await p6.click("#flags [data-dismiss=POSTMENO_BLEED]"); await p6.wait_for_timeout(400)
            await p6.reload(wait_until="networkidle"); await p6.wait_for_timeout(600)
            f2 = await p6.evaluate("()=>({text: document.querySelector('#flags').textContent, st: JSON.parse(localStorage.getItem('ovumind_db_v1')).state.postmenoBleed})")
            check("hiding the note holds after a reload and is remembered with the bleed date", "Bleeding after menopause" not in f2["text"] and (f2["st"] or {}).get("dismissedThrough") == TODAY, f2)
            await ctx6.close()
            # Moon Tap: open from the mat sheet, begin, three blooms, stop after the minimum, the entry is saved
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.click("nav a[data-tab=mind]"); await page.wait_for_selector("#mindTap", timeout=8000); await page.click("#mindTap"); await page.wait_for_selector("#btapBegin", timeout=8000)
            kh = await page.evaluate("()=>({how: !!document.querySelector('#btapCard details.btap-how'), steps: document.querySelectorAll('#btapCard details.btap-how li').length, open: document.querySelector('#btapCard details.btap-how').open})")
            check("Koi Pond: the card carries a folded How to practise list of five steps", kh["how"] and kh["steps"] == 5 and not kh["open"], kh)
            await page.click("#btapBegin"); await page.wait_for_timeout(5600)
            for _ in range(3): await page.mouse.click(195, 300); await page.wait_for_timeout(150)
            f0 = await page.evaluate("()=>{var f=OvuBreathTap.koi()[0], r=document.querySelector('#btap').getBoundingClientRect(); return {x: f.x + r.left, y: f.y + r.top, fx: f.x, fy: f.y}}")
            await page.mouse.click(f0["x"], f0["y"]); await page.wait_for_timeout(120)
            k1 = await page.evaluate("()=>OvuBreathTap.koi()[0]")
            await page.wait_for_timeout(900)
            k2 = await page.evaluate("()=>({fish: OvuBreathTap.koi(), moon: !document.querySelector('#btapPet') || document.querySelector('#btapPet').hidden, title: document.querySelector('#btap h2').textContent, big: OvuBreathTap.koi()[0].len >= 130})")
            gone = ((k2["fish"][0]["x"] - f0["fx"]) ** 2 + (k2["fish"][0]["y"] - f0["fy"]) ** 2) ** 0.5
            check("Koi Pond: no moon, three big koi; a tap on one startles it and it darts away from the tap", k2["moon"] and k2["title"] == "Koi Pond" and len(k2["fish"]) == 3 and k2["big"] and k1["fleeing"] and gone > 40, {"k1": k1, "k2": k2, "gone": gone})
            petals = await page.evaluate("()=>{var c=document.querySelector('#btapWater'); return c && c.width > 30 ? 3 : 0}")
            await page.click("#btapStop"); await page.wait_for_timeout(600)
            tap = await page.evaluate("()=>{var d=JSON.parse(localStorage.getItem('ovumind_db_v1')); var e=d.events.filter(x=>x.type==='mindfulness'&&x.data.kind==='breathtap'); return {n:e.length, secs:e.length?e[e.length-1].data.seconds:0, taps:e.length?e[e.length-1].data.taps:0, done:!document.querySelector('#btapDone').hidden, text:document.querySelector('#btapDone').innerText}}")
            check("Koi Pond ripples the water on taps and saves practice time on Stop", petals >= 3 and tap["n"] == 1 and tap["secs"] >= 5 and tap["taps"] == 4 and tap["done"] and "Your pause is saved" in tap["text"], tap)
            # Light Flower (Jamie and Codex, 20 Oct): a flower of light; a tap lights one petal and one soft note; Stop saves only time
            await page.click("#btapDoneClose"); await page.wait_for_timeout(400)
            await page.click("nav a[data-tab=mind]"); await page.wait_for_selector("#mindFlower", timeout=8000); await page.click("#mindFlower"); await page.wait_for_selector("#lfBegin", timeout=8000)
            lfh = await page.evaluate("()=>({how: !!document.querySelector('#lfCard details.btap-how'), steps: document.querySelectorAll('#lfCard details.btap-how li').length, paces: [...document.querySelectorAll('#lfPaces [data-pace]')].map(b=>b.dataset.pace).join(), own: (document.querySelector('#lfPaces .on')||{}).dataset.pace, safeHidden: document.querySelector('.lf-pacesafe').hidden})")
            await page.click("#lfPaces [data-pace=longout]"); await page.wait_for_timeout(100)
            lfh2 = await page.evaluate("()=>({safeHidden: document.querySelector('.lf-pacesafe').hidden, on: document.querySelector('#lfPaces .on').dataset.pace})")
            check("Light Flower: a How to practise list of five steps, four breathing paces with the flower's own rhythm chosen, and the gentle-breathing line only once a pace with words is picked", lfh["how"] and lfh["steps"] == 5 and lfh["paces"] == "own,easy,steady,longout" and lfh["own"] == "own" and lfh["safeHidden"] and not lfh2["safeHidden"] and lfh2["on"] == "longout", {"lfh": lfh, "lfh2": lfh2})
            lf0 = await page.evaluate("()=>({title: document.querySelector('#lflower h2').textContent, air: !document.querySelector('.lf-air').hidden, open: !document.querySelector('#lflower').hidden, sound: OvuSound.enabled()})")
            await page.click("#lfBegin"); await page.wait_for_timeout(700)
            box = await page.evaluate("()=>{var r=document.querySelector('#lfFlower').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height*0.2, w: r.width}}")
            for _ in range(4): await page.mouse.click(box["x"], box["y"]); await page.wait_for_timeout(60)
            lf1 = await page.evaluate("()=>{var c=document.querySelector('#lfCanvas'); return {running: OvuLightFlower.running(), canvas: c.width > 200 && c.height > 300, flower: document.querySelector('#lfFlower').getBoundingClientRect().width > 120}}")
            await page.wait_for_timeout(1500)
            await page.click("#lfStop"); await page.wait_for_timeout(500)
            lf2 = await page.evaluate("()=>{var d=JSON.parse(localStorage.getItem('ovumind_db_v1')); var e=d.events.filter(x=>x.type==='mindfulness'&&x.data.kind==='lightflower'); var last=e[e.length-1]; return {n: e.length, secs: last ? last.data.seconds : 0, taps: last ? ('taps' in last.data) : null, done: !document.querySelector('#lfDone').hidden, text: document.querySelector('#lfDone b').textContent, sub: (document.querySelector('#toast .toastsub')||{}).textContent || ''}}")
            check("Light Flower opens from the Mind hub with the soft-air choice, sound on by default, and lights petals on a drawn flower", lf0["title"] == "Light Flower" and lf0["open"] and lf0["air"] and lf0["sound"] and lf1["running"] and lf1["canvas"] and lf1["flower"], {"lf0": lf0, "lf1": lf1})
            check("Stop saves only the practice time (no tap count), says the pause is saved, and the mindful line follows", lf2["n"] == 1 and lf2["secs"] >= 2 and lf2["taps"] is False and lf2["done"] and "Your pause is saved" in lf2["text"] and ("quiet detail" in lf2["sub"] or "note has faded" in lf2["sub"]), lf2)
            lfp = await page.evaluate("()=>{var d=JSON.parse(localStorage.getItem('ovumind_db_v1')); var e=d.events.filter(x=>x.type==='mindfulness'&&x.data.kind==='lightflower'); return {pace: e[e.length-1].data.pace, word: (document.querySelector('#lfBreath')||{}).textContent}}")
            check("Light Flower: the saved practice carries the Long out pace, and the breath word was shown on the stage", lfp["pace"] == "longout" and lfp["word"] in ("in", "out"), lfp)
            await page.click("#lfDoneClose"); await page.wait_for_timeout(300)
            # Erin's own teeth scripts: the hour picks morning or evening, eight steps each inside four minutes, the clips exist
            late = await page.evaluate("()=>OvuMindful.nextVariation(OvuMindful.byId('teeth'), new Date(2026,9,20,0,40)).when")
            check("just after midnight Erin's teeth script is the evening one, never good morning", late == "evening", late)
            teeth = await page.evaluate("()=>{var a=OvuMindful.byId('teeth'); var am=OvuMindful.nextVariation(a, new Date(2026,9,19,8,0)), pm=OvuMindful.nextVariation(a, new Date(2026,9,19,21,0)); return {am:am.when, pm:pm.when, amSteps:am.steps.length, pmSteps:pm.steps.length, amSecs:OvuMindful.totalSecs(am), pmSecs:OvuMindful.totalSecs(pm), author:am.author, firstLine:am.steps[0].text.slice(0,12)}}")
            r0 = await page.request.get(BASE + "assets/audio/guide-interim/teeth-0-0.mp3"); r7 = await page.request.get(BASE + "assets/audio/guide-interim/teeth-1-7.mp3")
            check("Erin's own teeth scripts: morning before 3 pm, evening after, eight steps each inside four minutes, clips present", teeth["am"] == "morning" and teeth["pm"] == "evening" and teeth["amSteps"] == 8 and teeth["pmSteps"] == 8 and 180 <= teeth["amSecs"] <= 240 and 180 <= teeth["pmSecs"] <= 240 and teeth["author"] == "erin" and teeth["firstLine"] == "Good morning" and r0.status == 200 and r7.status == 200, teeth)
            # Morning start (Jamie, 20 Oct; presentation agreed with a Codex review): an invitation in Today, a choice sheet, two
            # quiet captioned steps, brushing only after Ready, one honest save; asleep never offers it; sleep stops it without a prompt
            await page.evaluate("()=>{if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); window.__mwin = OvuMorning.inWindow; OvuMorning.inWindow = function(){return true}; OvuStore.setState({morningStart:null}); OvuRoom.renderDeck();}")
            await page.wait_for_timeout(200)
            inv = await page.evaluate("()=>{var e=document.querySelector('#morningInvite'); return {shown: !!e && !e.hidden, begin: !!document.querySelector('#miBegin'), later: !!document.querySelector('#miLater')}}")
            check("Morning start: the invitation shows in Today in the morning, with Begin and Not today", inv["shown"] and inv["begin"] and inv["later"], inv)
            h0 = await page.evaluate("()=>OvuRewards.ledger().hearts"); out0 = await page.evaluate("()=>OvuStore.profile().outfit")
            await page.click("#miBegin"); await page.wait_for_selector("#mBegin", timeout=5000)
            ch0 = await page.evaluate("()=>({first: document.querySelector('input[name=mver]:checked').value, names: [...document.querySelectorAll('.mopt b')].map(b=>b.textContent), sub: document.querySelector('.mopt small').textContent, credit: /Erin Lee/.test(document.querySelector('#sheet').textContent)})")
            check("the choice offers Erin's morning first (wake, brush, sip) with its three parts and minutes, then the short pause, and credits Erin by name", ch0["first"] == "erin" and ch0["names"][0].startswith("Erin") and "Waking up with breath and body" in ch0["sub"] and "A mindful sip" in ch0["sub"] and "between parts" in ch0["sub"] and ch0["credit"], ch0)
            await page.evaluate("()=>{document.querySelector('#mQuiet').checked = true; document.querySelector('input[name=mver][value=yourway]').checked = true;}")
            await page.click("#mBegin"); await page.wait_for_timeout(300)
            a = await page.evaluate("()=>({panel: !document.querySelector('#mpanel').hidden, title: document.querySelector('#mpTitle').textContent, text: document.querySelector('#mpText').textContent, src: document.querySelector('#avatarImg').getAttribute('src'), acting: document.querySelector('#avatar').classList.contains('acting'), busy: OvuRoom.busy(), btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim()), live: document.querySelector('.mp-say').getAttribute('aria-live'), h: document.querySelector('#mpNext').getBoundingClientRect().height})")
            check("Morning start begins with Arrive: Good morning in the morning, captions in a polite live region, Pause, Next, Voice and Stop at 44 px, her own outfit standing still, no pulse", a["panel"] and a["title"] == "Arrive" and a["text"].startswith("Good morning. Sit") and "eyes can be open" in a["text"] and "act-" not in a["src"] and not a["acting"] and a["busy"] and a["btns"] == ["Pause", "Next", "Voice off", "Stop"] and a["live"] == "polite" and a["h"] >= 44, a)
            await page.click("#mpPause"); await page.wait_for_timeout(100)
            pz = await page.evaluate("()=>({st: OvuMorning.state(), count: document.querySelector('#mpCount').textContent, btn: document.querySelector('#mpPause').textContent})")
            await page.click("#mpPause"); await page.click("#mpNext"); await page.wait_for_timeout(150)
            n = await page.evaluate("()=>document.querySelector('#mpTitle').textContent")
            await page.click("#mpNext"); await page.wait_for_timeout(150)
            g = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim())})")
            check("Pause holds the step, Next moves on, and brushing waits at the sink for Ready to brush or Skip brushing", pz["st"]["paused"] and "paused" in pz["count"] and pz["btn"] == "Resume" and n == "Notice" and g["title"] == "Brushing" and g["btns"][:2] == ["Ready to brush", "Skip brushing"], {"pz": pz, "n": n, "g": g})
            await page.click("#mpReady"); await page.wait_for_timeout(500)
            b = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, src: document.querySelector('#avatarImg').getAttribute('src'), btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim())})")
            check("Ready to brush: she brushes her teeth in her own outfit, at her own pace until Done", b["title"] == "Brush your way" and "act-teeth" in b["src"] and b["btns"][0] == "Done", b)
            await page.evaluate("()=>{window.__dn = Date.now; var n0 = window.__dn; Date.now = function(){return n0() + 45000};}")
            await page.click("#mpDone"); await page.wait_for_selector("#mdYes", timeout=5000)
            await page.evaluate("()=>{Date.now = window.__dn}")
            await page.click("#mdYes"); await page.wait_for_timeout(500)
            sv = await page.evaluate("()=>{var e=OvuStore.list('mindfulness').filter(x=>x.data.activity==='morning'); var last=e[e.length-1]; return {n:e.length, d:last&&last.data, inv: document.querySelector('#morningInvite').hidden, done: (OvuStore.state().morningStart||{}).done, panel: document.querySelector('#mpanel').hidden, src: document.querySelector('#avatarImg').getAttribute('src'), outfit: OvuStore.profile().outfit, hearts: OvuRewards.ledger().hearts}}")
            check("Done, then Yes: one honest entry, the practice thank-you, the invitation put away for today, her outfit unchanged", sv["n"] == 1 and sv["d"]["kind"] == "informal" and sv["d"]["brushed"] == "yourway" and sv["d"]["finished"] and sv["d"]["seconds"] >= 30 and sv["inv"] and sv["done"] and sv["panel"] and "act-" not in sv["src"] and sv["outfit"] == out0 and sv["hearts"] - h0 in (0, 2), {"sv": sv, "h0": h0})
            await page.evaluate("()=>{if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuStore.setState({morningStart:null, sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}}); OvuRoom.renderDeck(); OvuMorning.open();}")
            await page.wait_for_timeout(300)
            sl = await page.evaluate("()=>({inv: document.querySelector('#morningInvite').hidden, sheet: !!document.querySelector('#mBegin'), toast: document.querySelector('#toast').textContent})")
            check("asleep: no invitation, and Morning start will not open", sl["inv"] and not sl["sheet"] and "asleep" in sl["toast"], sl)
            await page.evaluate("()=>{OvuStore.setState({sleeping:null}); OvuMorning.begin('erin', true);}"); await page.wait_for_timeout(200)
            w1 = await page.evaluate("()=>({count: document.querySelector('#mpCount').textContent, title: document.querySelector('#mpTitle').textContent, care: (document.querySelector('#mpCare')||{}).textContent||'', skip: !!document.querySelector('#mpSkipPart'), src: document.querySelector('#avatarImg').getAttribute('src')})")
            await page.click("#mpSkipPart"); await page.wait_for_timeout(150)
            g1 = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim()), care: !!document.querySelector('#mpCare')})")
            check("Erin's morning opens on part 1, her wake-up, with the adaptation line and Skip this part, still in her own clothes; skipping it lands on the brushing gate with Ready to brush and Skip this part", w1["count"].startswith("Part 1 of 3") and w1["title"] == "Waking up with breath and body" and "wheelchair" in w1["care"] and w1["skip"] and "act-" not in w1["src"] and g1["title"] == "Brushing" and g1["btns"][:2] == ["Ready to brush", "Skip this part"] and not g1["care"], {"w1": w1, "g1": g1})
            await page.click("#mpReady"); await page.wait_for_timeout(250)
            er = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, text: document.querySelector('#mpText').textContent, voice: document.querySelector('#mpQuiet') && document.querySelector('#mpQuiet').textContent})")
            await page.evaluate("()=>OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}})"); await page.wait_for_timeout(1400)
            cx = await page.evaluate("()=>{var y=document.querySelector('#mdYes'); return {active: OvuMorning.active(), panel: document.querySelector('#mpanel').hidden, prompt: OvuRoom.sheetOpen()}}")
            check("with Erin: her own first line and a voice switch; falling asleep stops it at once with no save prompt", er["title"] == "Brushing with Erin" and er["text"].startswith("Good morning") and er["voice"] == "Voice off" and not cx["active"] and cx["panel"] and not cx["prompt"], {"er": er, "cx": cx})
            await page.evaluate("()=>{OvuStore.setState({sleeping:null, morningStart:null}); OvuRoom.renderDeck();}"); await page.wait_for_timeout(200)
            # a part finished line by line must not crash (persona walk, 21 Oct: a duplicate done:false overwrote the completion map)
            await page.evaluate("()=>{OvuStore.setState({sleeping:null, morningStart:null}); OvuMorning.begin('erin', true)}"); await page.wait_for_timeout(120)
            for _ in range(6): await page.click("#mpNext"); await page.wait_for_timeout(60)
            wk6 = await page.evaluate("()=>({st: OvuMorning.state(), title: document.querySelector('#mpTitle').textContent, btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim())})")
            await page.evaluate("()=>{OvuMorning.cancel(); OvuStore.setState({morningStart:null});}")
            check("walking through all six wake-up lines reaches the brushing gate without a crash", wk6["st"] is not None and wk6["st"]["key"] == "ready" and wk6["btns"][:2] == ["Ready to brush", "Skip this part"], wk6)
            # the full routine (21 Oct): Skip this part skips to the sip gate; Ready to sip shows her with the cup; Stop after 40 seconds saves the sip alone, stopped early; a repeat pays nothing more
            h0 = await page.evaluate("()=>{OvuMorning.begin('erin', true); return OvuRewards.ledger().hearts}"); await page.wait_for_timeout(150)
            await page.click("#mpSkipPart"); await page.click("#mpSkipBrush"); await page.wait_for_timeout(150)
            g2 = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, count: document.querySelector('#mpCount').textContent, btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim()), text: document.querySelector('#mpText').textContent})")
            await page.click("#mpReady"); await page.wait_for_timeout(250)
            s1 = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, src: document.querySelector('#avatarImg').getAttribute('src'), st: OvuMorning.state()})")
            await page.evaluate("()=>{window.__dn3 = Date.now; var n0 = window.__dn3; Date.now = function(){return n0() + 40000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            await page.evaluate("()=>{Date.now = window.__dn3}")
            ask = await page.evaluate("()=>document.querySelector('#sheet .mintro').textContent")
            await page.click("#mdYes"); await page.wait_for_timeout(500)
            r1 = await page.evaluate("(h0)=>{var e=OvuStore.list('mindfulness').filter(x=>x.data.routine==='morning'); return {n: e.length, acts: e.map(x=>x.data.activity), early: e.map(x=>x.data.stoppedEarly), hearts: OvuRewards.ledger().hearts - h0, done: (OvuStore.state().morningStart||{}).done}}", h0)
            check("Skip this part skips to the sip gate (part 3, Ready to sip or Skip this part, water welcome); Ready to sip shows A mindful sip with the cup; Stop after 40 s offers one honest save, and Yes saves the sip alone, stopped early, for the practice thank-you", g2["title"] == "A mindful sip" and g2["count"].startswith("Part 3 of 3") and g2["btns"][:2] == ["Ready to sip", "Skip this part"] and "water" in g2["text"] and s1["title"] == "A mindful sip" and "act-coffee" in s1["src"] and s1["st"]["key"] == "sip0" and "took a mindful sip" in ask and "(stopped early)" not in ask and r1["n"] == 1 and r1["acts"] == ["coffee"] and r1["early"] == [True] and r1["hearts"] == 2 and r1["done"], {"g2": g2, "s1": s1, "ask": ask, "r1": r1})
            h1 = await page.evaluate("()=>{OvuStore.setState({morningStart:null}); OvuMorning.begin('erin', true); return OvuRewards.ledger().hearts}"); await page.wait_for_timeout(150)
            await page.click("#mpSkipPart"); await page.click("#mpSkipBrush"); await page.click("#mpReady"); await page.wait_for_timeout(150)
            await page.evaluate("()=>{window.__dn4 = Date.now; var n0 = window.__dn4; Date.now = function(){return n0() + 40000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000); await page.evaluate("()=>{Date.now = window.__dn4}"); await page.click("#mdYes"); await page.wait_for_timeout(400)
            r2 = await page.evaluate("(h1)=>({hearts: OvuRewards.ledger().hearts - h1, n: OvuStore.list('mindfulness').filter(x=>x.data.routine==='morning').length})", h1)
            check("the same part again the same day is saved honestly but pays no more hearts", r2["hearts"] == 0 and r2["n"] == 2, r2)
            await page.evaluate("()=>{OvuStore.setState({morningStart:null}); OvuRoom.renderDeck();}"); await page.wait_for_timeout(200)
            await page.click("#miLater"); await page.wait_for_timeout(200)
            lt = await page.evaluate("()=>({inv: document.querySelector('#morningInvite').hidden, dis: (OvuStore.state().morningStart||{}).dismissed})")
            check("Not today puts the invitation away for the day", lt["inv"] and lt["dis"], lt)
            # after the Codex diff review: focus, pause then next, no walking, sleep then stop, no overlap, the invitation comes back
            await page.evaluate("()=>{OvuStore.setState({morningStart:null}); OvuRoom.renderDeck();}"); await page.wait_for_timeout(150)
            await page.click("#miBegin"); await page.wait_for_selector("#mBegin", timeout=5000); await page.evaluate("()=>{document.querySelector('#mQuiet').checked = true; document.querySelector('input[name=mver][value=yourway]').checked = true;}")
            await page.click("#mBegin"); await page.wait_for_timeout(250)
            f1 = await page.evaluate("()=>document.activeElement && document.activeElement.id")
            await page.click("#mpPause"); await page.click("#mpNext"); await page.wait_for_timeout(100)
            pn = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpPause"); await page.wait_for_timeout(100)
            rs = await page.evaluate("()=>({st: OvuMorning.state(), inPanel: document.querySelector('#mpanel').contains(document.activeElement)})")
            check("focus moves into the panel and stays there; Pause, then Next, keeps the next step's full time for Resume", f1 == "mpanel" and pn["key"] == "notice" and pn["paused"] and rs["st"]["key"] == "notice" and not rs["st"]["paused"] and rs["st"]["left"] == 55000 and rs["inPanel"], {"f1": f1, "pn": pn, "rs": rs})
            pos0 = await page.evaluate("()=>OvuRoom.pos()")
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('wardrobe') || OvuRoom.hotspot('clock'))"); await page.wait_for_timeout(1200)
            wk = await page.evaluate("()=>({pos: OvuRoom.pos(), sheet: OvuRoom.sheetOpen(), toast: document.querySelector('#toast').textContent, active: OvuMorning.active()})")
            check("during Morning start a hotspot tap does not walk her or open anything", wk["pos"] == pos0 and not wk["sheet"] and "Morning start is running" in wk["toast"] and wk["active"], {"pos0": pos0, "wk": wk})
            await page.evaluate("()=>{window.__dn2 = Date.now; var n0 = window.__dn2; Date.now = function(){return n0() + 40000}; OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}});}")
            try: await page.click("#mpStop", timeout=1500) # the routine's own one-second watch may have ended it first: either way the outcome below must hold
            except Exception: pass
            await page.wait_for_timeout(300)
            ss = await page.evaluate("()=>{Date.now = window.__dn2; return {active: OvuMorning.active(), sheet: OvuRoom.sheetOpen(), n: OvuStore.list('mindfulness').filter(x=>x.data.activity==='morning').length}}")
            check("asleep, even 40 seconds in: Stop ends it with no save prompt and nothing saved", not ss["active"] and not ss["sheet"] and ss["n"] == 1, ss)
            await page.evaluate("()=>{OvuStore.setState({sleeping:null}); OvuRoom.restorePose(); OvuRoom.runSession('breathe', 2);}"); await page.wait_for_timeout(300)
            ov = await page.evaluate("()=>{OvuMorning.begin('yourway', true); return {active: OvuMorning.active(), session: OvuRoom.sessionOn()}}")
            await page.click("#hudStop"); await page.wait_for_timeout(400)
            if await page.evaluate("()=>OvuRoom.sheetOpen()"): await page.evaluate("()=>OvuRoom.closeSheet()")
            check("Morning start never starts on top of a running session", ov["session"] and not ov["active"], ov)
            await page.evaluate("()=>{OvuMorning.inWindow = function(){return false}; OvuStore.setState({morningStart:null}); OvuRoom.renderDeck(); OvuMorning.inWindow = function(){return true}; OvuRoom.renderDeck();}"); await page.wait_for_timeout(150)
            back = await page.evaluate("()=>({shown: !document.querySelector('#morningInvite').hidden, begin: !!document.querySelector('#miBegin')})")
            check("the invitation comes back whole after it was hidden (noon, then the next morning)", back["shown"] and back["begin"], back)
            # Codex re-check: the bed still works during Morning start and Good night ends it with no prompt; nothing else starts on top
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(200)
            rf = await page.evaluate("()=>{OvuRoom.runSession('breathe', 2); return {session: OvuRoom.sessionOn(), active: OvuMorning.active(), toast: document.querySelector('#toast').textContent}}")
            check("during Morning start a breathing session will not start on top of it", not rf["session"] and rf["active"] and "Morning start is running" in rf["toast"], rf)
            pos1 = await page.evaluate("()=>OvuRoom.pos()")
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bed'))"); await page.wait_for_timeout(400)
            bd = await page.evaluate("()=>({gn: !!document.querySelector('#goodnight'), open: OvuRoom.sheetOpen(), pos: OvuRoom.pos()})")
            await page.click("#goodnight"); await page.wait_for_timeout(500)
            gn = await page.evaluate("()=>({active: OvuMorning.active(), asleep: OvuRoom.asleep(), sheet: OvuRoom.sheetOpen(), panel: document.querySelector('#mpanel').hidden})")
            check("the bed still opens during Morning start without walking her, and Good night ends it with no save prompt", bd["gn"] and bd["open"] and bd["pos"] == pos1 and not gn["active"] and gn["asleep"] and not gn["sheet"] and gn["panel"], {"bd": bd, "gn": gn})
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bed'))"); await page.wait_for_selector("#cancelSleep", timeout=8000); await page.click("#cancelSleep"); await page.wait_for_timeout(400)
            await page.evaluate("()=>OvuMorning.begin('erin', false)"); await page.wait_for_timeout(200)
            await page.click("#mpSkipPart"); await page.click("#mpReady"); await page.wait_for_timeout(200)
            v0 = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpPause"); await page.click("#mpNext"); await page.wait_for_timeout(100)
            v1 = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpQuiet"); await page.click("#mpQuiet"); await page.click("#mpPause"); await page.wait_for_timeout(150)
            v2 = await page.evaluate("()=>OvuMorning.state()")
            await page.evaluate("()=>OvuMorning.cancel()")
            check("Erin's guide: Pause, Next, voice off and on, then Resume never plays an older line under a newer caption", v0["audioKey"] == "erin0" and v1["key"] == "erin1" and v1["pending"] and v2["key"] == "erin1" and not v2["paused"] and v2["audioKey"] is None and v2["pending"] is None, {"v0": v0, "v1": v1, "v2": v2})
            # DeepSeek and Doubao review (20 Oct): with the voice on, Arrive plays its own clip in Erin's voice and the caption matches;
            # opened outside the morning it says Hello; Quiet plays nothing; the sink step waits with its own line
            await page.evaluate("()=>{OvuMorning.inWindow = function(){return false}; OvuMorning.begin('yourway', false)}"); await page.wait_for_timeout(300)
            va = await page.evaluate("()=>({st: OvuMorning.state(), text: document.querySelector('#mpText').textContent, voice: document.querySelector('#mpQuiet') && document.querySelector('#mpQuiet').textContent})")
            await page.evaluate("()=>{OvuMorning.cancel(); OvuMorning.inWindow = function(){return true}}")
            clip = await page.evaluate("async()=>{var r = await fetch('assets/audio/guide-interim/mstart-arrive-1.mp3'); return {ok: r.ok, type: r.headers.get('content-type'), n: (await r.arrayBuffer()).byteLength}}")
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(150)
            vq = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpNext"); await page.click("#mpNext"); await page.wait_for_timeout(120)
            vg = await page.evaluate("()=>({st: OvuMorning.state(), text: document.querySelector('#mpText').textContent, btns: [...document.querySelectorAll('#mpBtns button')].map(b=>b.textContent.trim())})")
            await page.evaluate("()=>OvuMorning.cancel()")
            check("voice on: Arrive plays its own clip and says Hello outside the morning; Quiet plays nothing; the sink step allows any sink and prayer first", va["st"]["audioKey"] == "arrive" and va["text"].startswith("Hello. Sit") and va["voice"] == "Voice on" and clip["ok"] and clip["n"] > 20000 and vq["audioKey"] is None and vg["st"]["key"] == "ready" and not vg["st"]["paused"] and "prayer" in vg["text"] and vg["btns"][:2] == ["Ready to brush", "Skip brushing"] and "Voice off" in vg["btns"], {"va": va, "clip": clip, "vq": vq, "vg": vg})
            # Codex follow-up check: a finished line is not said again on Resume; a refused voice shows Voice off and says so, and
            # Voice on readies it inside the tap; stopping in Arrive says only what she reached
            fa = await page.evaluate("()=>{window.__RealAudio = window.Audio; window.Audio = function(){ var o = {muted:false, src:'', currentTime:0, ended:false, plays:0, paused:true, play: function(){ o.plays++; o.paused = false; if (window.__rejectUnmuted && !o.muted) { var e = new Error('held'); e.name = 'NotAllowedError'; return Promise.reject(e); } return Promise.resolve(); }, pause: function(){ o.paused = true; } }; window.__fa = o; return o; }; OvuMorning.begin('yourway', false); var p0 = window.__fa.plays, k = OvuMorning.state().audioKey; window.__fa.ended = true; return {p0: p0, k: k}}")
            await page.click("#mpPause"); await page.click("#mpPause"); await page.wait_for_timeout(100)
            fe = await page.evaluate("()=>{var r = {plays: window.__fa.plays, st: OvuMorning.state()}; OvuMorning.cancel(); window.__rejectUnmuted = true; OvuMorning.begin('yourway', false); return r}")
            await page.wait_for_timeout(200)
            fh = await page.evaluate("()=>({st: OvuMorning.state(), voice: document.querySelector('#mpQuiet').textContent, toast: document.querySelector('#toast').textContent})")
            await page.click("#mpQuiet"); await page.wait_for_timeout(200)
            fu = await page.evaluate("()=>{var r = {st: OvuMorning.state(), muted: window.__fa.muted, paused: window.__fa.paused, plays: window.__fa.plays, voice: document.querySelector('#mpQuiet').textContent}; OvuMorning.cancel(); window.__rejectUnmuted = false; window.Audio = window.__RealAudio; return r}")
            check("a finished line is not replayed on Resume; a refused voice shows Voice off and says so; Voice on readies it silently in the tap", fa["k"] == "arrive" and fe["plays"] == fa["p0"] and not fe["st"]["paused"] and fh["st"]["quiet"] and fh["voice"] == "Voice off" and "held the voice back" in fh["toast"] and not fu["st"]["quiet"] and fu["voice"] == "Voice on" and fu["plays"] >= 2 and not fu["muted"] and fu["paused"], {"fa": fa, "fe": fe, "fh": fh, "fu": fu})
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dn3 = Date.now; var n0 = window.__dn3; Date.now = function(){return n0() + 31000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            sa = await page.evaluate("()=>{Date.now = window.__dn3; return document.querySelector('.sheet .mintro, #sheet .mintro, .mintro') && [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            check("stopping 31 seconds into Arrive says only what she reached: arrived, not noticed", "You arrived." in sa and "noticed" not in sa, sa)
            # Codex second check: the warm-up is silent through the app's shared voice mute (the real wrapper, not a fake), a
            # remembered mute makes Quiet the default and choosing the voice lifts it, and brushing is claimed only when it happened
            wm = await page.evaluate("()=>{var m0 = OvuVoice.muted(); window.__plays = []; var proto = HTMLMediaElement.prototype, prev = proto.play; window.__prevPlay = prev; proto.play = function(){ var r = prev.apply(this, arguments); window.__plays.push({src: String(this.src).slice(0, 22), ours: String(this.src).indexOf('assets/audio/') > -1, muted: this.muted}); if (r && r.catch) r.catch(function(){}); return r; }; OvuVoice.set(false); OvuMorning.begin('yourway', true); var quietStart = window.__plays.slice(); OvuMorning.cancel(); OvuVoice.set(true); OvuMorning.open(); var box = document.querySelector('#mQuiet'); var dflt = !!(box && box.checked); OvuRoom.closeSheet(); window.__plays = []; OvuMorning.begin('yourway', false); var voiced = window.__plays.slice(), lifted = !OvuVoice.muted(); OvuMorning.cancel(); proto.play = prev; OvuVoice.set(m0); return {quietStart: quietStart, dflt: dflt, voiced: voiced, lifted: lifted}}")
            check("the warm-up is a muted silent sound the voice mute leaves alone; a remembered mute makes Quiet the default and choosing the voice lifts it", len(wm["quietStart"]) == 1 and wm["quietStart"][0]["src"].startswith("data:audio/wav") and wm["quietStart"][0]["muted"] and not wm["quietStart"][0]["ours"] and wm["dflt"] and wm["lifted"] and len(wm["voiced"]) >= 1 and wm["voiced"][0]["ours"] and not wm["voiced"][0]["muted"], wm)
            await page.evaluate("()=>{if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuMorning.begin('erin', true)}"); await page.wait_for_timeout(100)
            await page.click("#mpSkipPart"); await page.click("#mpReady"); await page.wait_for_timeout(100)
            await page.evaluate("()=>{window.__dn4 = Date.now; var n0 = window.__dn4; Date.now = function(){return n0() + 40000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            se = await page.evaluate("()=>{Date.now = window.__dn4; return {key: 'erin0', text: [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(100)
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(100)
            await page.evaluate("()=>{window.__dn5 = Date.now; var n0 = window.__dn5; Date.now = function(){return n0() + 40000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            sy = await page.evaluate("()=>{Date.now = window.__dn5; return [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>{OvuMorning.begin('erin', true); window.__dn6 = Date.now; var n0 = window.__dn6; Date.now = function(){return n0() + 40000};}"); await page.wait_for_timeout(80)
            await page.click("#mpSkipPart"); await page.click("#mpReady"); await page.click("#mpPause")
            for _ in range(3): await page.click("#mpNext")
            pk = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            sp = await page.evaluate("()=>{Date.now = window.__dn6; return [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>OvuMorning.begin('erin', true)"); await page.wait_for_timeout(80)
            await page.click("#mpSkipPart"); await page.click("#mpReady")
            for _ in range(3): await page.click("#mpNext")
            await page.evaluate("()=>{window.__dn7 = Date.now; var n0 = window.__dn7; Date.now = function(){return n0() + 40000};}")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            sb = await page.evaluate("()=>{Date.now = window.__dn7; return [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            check("Codex third check: paused, then Next three times onto a brushing line, is not brushing; 40 seconds on a running brushing line is", pk["key"] == "erin3" and pk["paused"] and "brushed" not in sp and "You brushed." in sb, {"pk": pk, "paused": sp, "running": sb})
            # Codex fourth check: time actually spent decides the summary; a late line is not cut off; a failed save keeps the sheet
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dn8 = Date.now; var n0 = window.__dn8; Date.now = function(){return n0() + 31000};}"); await page.wait_for_timeout(80)
            await page.click("#mpPause"); await page.click("#mpNext"); await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            pn2 = await page.evaluate("()=>{Date.now = window.__dn8; return [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            lw = await page.evaluate("()=>{window.__RealAudio = window.Audio; window.Audio = function(){ var o = {muted:false, src:'', currentTime:0, ended:false, paused:true, play: function(){ o.paused = false; return Promise.resolve(); }, pause: function(){ o.paused = true; } }; window.__fa = o; return o; }; OvuMorning.begin('yourway', false); OvuMorning._due(); var waiting = OvuMorning.state().key; window.__fa.ended = true; OvuMorning._due(); var after = OvuMorning.state().key; window.__fa.ended = false; window.__fa.paused = false; OvuMorning.state(); for (var i = 0; i < 9; i++) { if (OvuMorning.state().key !== 'notice') break; OvuMorning._due(); } var capped = OvuMorning.state().key; OvuMorning.cancel(); window.Audio = window.__RealAudio; return {waiting: waiting, after: after, capped: capped}}")
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dn9 = Date.now; var n0 = window.__dn9; Date.now = function(){return n0() + 40000};}"); await page.wait_for_timeout(80)
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            fs0 = await page.evaluate("()=>{Date.now = window.__dn9; window.__realSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k){ if (k === OvuStore.KEY) throw new Error('storage full'); return window.__realSetItem.apply(this, arguments); }; return OvuStore.list('mindfulness').length}")
            await page.click("#mdYes"); await page.wait_for_timeout(200)
            fs1 = await page.evaluate("()=>{var r = {sheet: OvuRoom.sheetOpen(), yes: !!document.querySelector('#mdYes'), n: OvuStore.list('mindfulness').length, toast: document.querySelector('#toast').textContent}; Storage.prototype.setItem = window.__realSetItem; return r}")
            await page.click("#mdYes"); await page.wait_for_timeout(400)
            fs2 = await page.evaluate("()=>({sheet: OvuRoom.sheetOpen() && !!document.querySelector('#mdYes'), n: OvuStore.list('mindfulness').length})")
            await page.evaluate("()=>{if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuStore.setState({morningStart:null});}")
            check("Codex fourth check: Pause then Next claims nothing for an untouched step; a late line is waited for (at most eight seconds); a failed save keeps the sheet for a retry that saves once", "You arrived." in pn2 and "noticed" not in pn2 and lw["waiting"] == "arrive" and lw["after"] == "notice" and lw["capped"] == "ready" and fs1["sheet"] and fs1["yes"] and fs1["n"] == fs0 and "could not be saved" in fs1["toast"] and not fs2["sheet"] and fs2["n"] == fs0 + 1, {"pn2": pn2, "lw": lw, "fs0": fs0, "fs1": fs1, "fs2": fs2})
            # Codex fifth check: a storage failure before Stop still asks about saving; the save prompt never replaces another open form
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnA = Date.now; var n0 = window.__dnA; Date.now = function(){return n0() + 31000}; window.__realSetItem2 = Storage.prototype.setItem; Storage.prototype.setItem = function(){ throw new Error('storage full'); };}"); await page.wait_for_timeout(80)
            await page.click("#mpStop"); await page.wait_for_timeout(250)
            sf = await page.evaluate("()=>{Storage.prototype.setItem = window.__realSetItem2; Date.now = window.__dnA; return {yes: !!document.querySelector('#mdYes') && OvuRoom.sheetOpen(), active: OvuMorning.active()}}")
            if sf["yes"]: await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnB = Date.now; var n0 = window.__dnB; Date.now = function(){return n0() + 40000}; OvuRoom.openSheet('draftTest', 'Symptoms', 'test', 'info', '<textarea id=\"draftX\"></textarea>');}"); await page.wait_for_timeout(150)
            await page.fill("#draftX", "cramps since morning")
            await page.evaluate("()=>document.querySelector('#mpStop').click()"); await page.wait_for_timeout(300)
            df = await page.evaluate("()=>({draft: document.querySelector('#draftX') && document.querySelector('#draftX').value, yes: !!document.querySelector('#mdYes'), toast: document.querySelector('#toast').textContent, active: OvuMorning.active()})")
            await page.evaluate("()=>{Date.now = window.__dnB; OvuRoom.closeSheet();}"); await page.wait_for_timeout(1000)
            dl = await page.evaluate("()=>({yes: !!document.querySelector('#mdYes') && OvuRoom.sheetOpen()})")
            if dl["yes"]: await page.click("#mdNo"); await page.wait_for_timeout(200)
            check("Codex fifth check: a storage failure before Stop still asks about saving; finishing over another form keeps her draft and asks once it closes", sf["yes"] and not sf["active"] and df["draft"] == "cramps since morning" and not df["yes"] and "when you close this" in df["toast"] and not df["active"] and dl["yes"], {"sf": sf, "df": df, "dl": dl})
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(80)
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(150)
            mm = await page.evaluate("()=>{var before = document.querySelector('#avatarImg').getAttribute('src'); OvuRoom.moment('symptom'); var after = document.querySelector('#avatarImg').getAttribute('src'); OvuMorning.cancel(); return {before: before, after: after}}")
            check("Codex sixth check: a log saved while she brushes does not take over her brushing pose", "act-teeth" in mm["before"] and mm["after"] == mm["before"], mm)
            # Codex seventh check: garden watering is let finish first; picking another outfit while brushing keeps the brushing pose
            gw = await page.evaluate("()=>{var w = OvuGarden.watering; OvuGarden.watering = function(){return true}; OvuMorning.begin('yourway', true); var r = {active: OvuMorning.active(), toast: document.querySelector('#toast').textContent}; OvuGarden.watering = w; return r}")
            o0 = await page.evaluate("async()=>{var cur = OvuStore.profile().outfit || 'base'; var ids = [...new Set([...document.querySelectorAll('.outfit')].map(e=>e.dataset.id))]; return cur}")
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(80)
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(150)
            await page.evaluate("()=>{var a=document.querySelector('.nav a[data-tab=you]'); a.click();}"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{var b=document.querySelector('[data-yact=wardrobe]'); if (b) b.click();}"); await page.wait_for_timeout(300)
            pick = await page.evaluate("async()=>{var cur = OvuStore.profile().outfit || 'base'; var ids = [...document.querySelectorAll('.outfit')].map(e=>e.dataset.id).filter(id=>id!==cur); for (var id of ids) { var r = await fetch(OvuRoom.poseSrc('teeth', id)); if (r.ok) return id; } return null}")
            if pick: await page.click(".outfit[data-id='%s']" % pick)
            await page.wait_for_timeout(1200)
            ow = await page.evaluate("()=>({src: document.querySelector('#avatarImg').getAttribute('src'), outfit: OvuStore.profile().outfit, active: OvuMorning.active()})")
            await page.evaluate("(o)=>{OvuMorning.cancel(); if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuStore.setProfile({outfit: o}); OvuRoom.restorePose(); var a=document.querySelector('.nav a[data-tab=home]') || document.querySelector('.nav a'); if (a) a.click();}", o0); await page.wait_for_timeout(400)
            check("Codex seventh check: garden watering is let finish first; a new outfit while brushing shows her brushing in it", not gw["active"] and "watering" in gw["toast"] and pick and ow["active"] and ow["outfit"] == pick and "teeth" in ow["src"] and pick in ow["src"], {"gw": gw, "pick": pick, "ow": ow})
            # Codex full sweep (eighth check): a waiting prompt comes before a new run and never pops over a session; away from the
            # app pauses; the day is the day she practised; other audio waits; a sheet over the panel pauses it; off the bench;
            # not mid-doorway; the app's sound rule
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnC = Date.now; var n0 = window.__dnC; Date.now = function(){return n0() + 40000}; OvuRoom.openSheet('draftTest2', 'Food', 'test', 'info', '<p>x</p>');}"); await page.wait_for_timeout(100)
            await page.evaluate("()=>document.querySelector('#mpStop').click()"); await page.wait_for_timeout(150)
            await page.evaluate("()=>{Date.now = window.__dnC; window.__sOn = OvuRoom.sessionOn; OvuRoom.sessionOn = function(){return true}; OvuRoom.closeSheet();}"); await page.wait_for_timeout(1000)
            p1 = await page.evaluate("()=>({yes: !!document.querySelector('#mdYes') && OvuRoom.sheetOpen()})")
            await page.evaluate("()=>{OvuRoom.sessionOn = window.__sOn; OvuMorning.begin('yourway', true);}"); await page.wait_for_timeout(300)
            p2 = await page.evaluate("()=>({yes: !!document.querySelector('#mdYes') && OvuRoom.sheetOpen(), active: OvuMorning.active()})")
            if p2["yes"]: await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(100)
            bg = await page.evaluate("async()=>{Object.defineProperty(document, 'hidden', {configurable: true, get: function(){return true}}); document.dispatchEvent(new Event('visibilitychange')); var a = OvuMorning.state(); Object.defineProperty(document, 'hidden', {configurable: true, get: function(){return false}}); document.dispatchEvent(new Event('visibilitychange')); var b = OvuMorning.state(), t = document.querySelector('#toast').textContent; delete document.hidden; var el = new Audio('assets/audio/guide-interim/mstart-ready.mp3'); try { await el.play(); } catch (e) { } await new Promise(r=>setTimeout(r, 200)); var pod = {paused: el.paused, toast: document.querySelector('#toast').textContent}; el.pause(); return {awayPaused: a.paused, stillPaused: b.paused, toast: t, pod: pod}}")
            await page.evaluate("()=>{OvuMorning.cancel(); OvuMorning.begin('yourway', true); OvuRoom.openSheet('draftTest3', 'Cycle', 'test', 'info', '<p>x</p>');}"); await page.wait_for_timeout(1400)
            sh = await page.evaluate("()=>{var r = {paused: OvuMorning.state() && OvuMorning.state().paused, toast: document.querySelector('#toast').textContent}; OvuRoom.closeSheet(); OvuMorning.cancel(); return r}")
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnD = Date.now; var n0 = window.__dnD; Date.now = function(){return n0() + 31000};}"); await page.wait_for_timeout(80)
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            day0 = await page.evaluate("()=>{Date.now = window.__dnD; window.__today = OvuStore.today; var real = OvuStore.today(); OvuStore.today = function(){return '2099-01-01'}; return real}")
            await page.click("#mdYes"); await page.wait_for_timeout(400)
            dd = await page.evaluate("()=>{OvuStore.today = window.__today; var e = OvuStore.list('mindfulness').filter(x=>x.data.activity==='morning'); return {date: e[e.length-1].date, mark: (OvuStore.state().morningStart||{}).date}}")
            await page.evaluate("()=>{if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuStore.setState({morningStart:null});}")
            bt = await page.evaluate("()=>{var g = OvuGarden.sitting, u = OvuGarden.standUp, stood = false; OvuGarden.sitting = function(){return !stood}; OvuGarden.standUp = function(){stood = true}; OvuMorning.begin('yourway', true); var r1 = {stood: stood, active: OvuMorning.active()}; OvuMorning.cancel(); OvuGarden.sitting = g; OvuGarden.standUp = u; var t = OvuWalk.travelling; OvuWalk.travelling = function(){return true}; OvuMorning.begin('yourway', true); var r2 = {active: OvuMorning.active(), toast: document.querySelector('#toast').textContent}; OvuWalk.travelling = t; return {bench: r1, door: r2}}")
            sd = await page.evaluate("()=>{var st = OvuStore.state(), keep = st.sound, vm = OvuVoice.muted(); OvuStore.setState({sound: null}); OvuVoice.set(false); OvuMorning.open(); var q = document.querySelector('#mQuiet').checked; OvuRoom.closeSheet(); OvuStore.setState({sound: keep}); OvuVoice.set(vm); return {soundOn: OvuSound.enabled(), quiet: q}}")
            check("sweep: a waiting save prompt never pops over a session, and comes first when she begins again", not p1["yes"] and p2["yes"] and not p2["active"], {"p1": p1, "p2": p2})
            check("sweep: away from the app pauses it and says so on return", bg["awayPaused"] and bg["stillPaused"] and "while you were away" in bg["toast"], {k: bg[k] for k in ("awayPaused", "stillPaused")})
            check("sweep: other audio started during Morning start is paused", bg["pod"]["paused"] and "Other audio waits" in bg["pod"]["toast"], bg["pod"])
            check("sweep: a sheet over the panel pauses it", sh["paused"] and "paused while this is open" in sh["toast"], sh)
            check("sweep: confirming later still files it under the day she practised", dd["date"] == day0 and dd["mark"] == day0, {"day0": day0, "dd": dd})
            check("sweep: off the bench before brushing; never mid-doorway", bt["bench"]["stood"] and bt["bench"]["active"] and not bt["door"]["active"] and "on her way" in bt["door"]["toast"], bt)
            check("sweep: sound never chosen is on, so Quiet is not the default", sd["soundOn"] and not sd["quiet"], sd)
            # Codex ninth check: the camera still plays; ownership before a waiting prompt; the mat's entrance; game overlays; the sink
            # line stops when away; the wake greeting stops; an older save never undoes today's choice; an unplayable clip says so
            n1 = await page.evaluate("async()=>{OvuMorning.begin('yourway', true); var c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8); var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = c.captureStream(5); var ok = true; try { await v.play(); } catch (e) { ok = e.name; } var r = {played: ok, paused: v.paused}; v.pause(); v.srcObject = null; OvuMorning.cancel(); return r}")
            check("ninth: a muted camera preview (barcode scanning) still plays during Morning start", n1["played"] is True and not n1["paused"], n1)
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnE = Date.now; var n0 = window.__dnE; Date.now = function(){return n0() + 40000}; OvuRoom.openSheet('draftTest4', 'Calendar', 'test', 'info', '<p>x</p>');}"); await page.wait_for_timeout(100)
            await page.evaluate("()=>document.querySelector('#mpStop').click()"); await page.wait_for_timeout(150)
            n2 = await page.evaluate("()=>{Date.now = window.__dnE; OvuRoom.closeSheet(); window.__sOn2 = OvuRoom.sessionOn; OvuRoom.sessionOn = function(){return true}; OvuMorning.begin('yourway', true); var r = {yes: !!document.querySelector('#mdYes') && OvuRoom.sheetOpen(), toast: document.querySelector('#toast').textContent}; OvuRoom.sessionOn = window.__sOn2; return r}")
            await page.wait_for_timeout(700)
            if await page.evaluate("()=>!!document.querySelector('#mdYes') && OvuRoom.sheetOpen()"): await page.click("#mdNo"); await page.wait_for_timeout(200)
            check("ninth: a waiting save prompt never opens over another activity, even when she presses Begin", not n2["yes"] and "Finish or stop" in n2["toast"], n2)
            n3 = await page.evaluate("async()=>{OvuRoom.enterMeditation(); OvuMorning.begin('yourway', true); await new Promise(r=>setTimeout(r, 700)); var r = {meditating: OvuRoom.meditating(), hidden: document.querySelector('#avatar').classList.contains('hidden'), on: OvuRoom.els.meditator.classList.contains('on'), active: OvuMorning.active()}; OvuMorning.cancel(); return r}")
            check("ninth: beginning during the mat's entrance stands her up and shows her", not n3["meditating"] and not n3["hidden"] and not n3["on"] and n3["active"], n3)
            n4 = await page.evaluate("()=>{document.body.classList.add('btap-open'); OvuMorning.begin('yourway', true); var r = {active: OvuMorning.active(), toast: document.querySelector('#toast').textContent}; document.body.classList.remove('btap-open'); return r}")
            check("ninth: not while Light Flower or Moon Tap is open", not n4["active"] and "Light Flower" in n4["toast"], n4)
            n5 = await page.evaluate("async()=>{var g = new Audio('assets/audio/erin-tts/greeting_morning.mp3'); try { await g.play(); } catch (e) { } var was = !g.paused; OvuMorning.begin('yourway', false); var stopped = g.paused; document.querySelector('#mpNext').click(); document.querySelector('#mpNext').click(); await new Promise(r=>setTimeout(r, 200)); var atGate = OvuMorning.state().audioKey; Object.defineProperty(document, 'hidden', {configurable: true, get: function(){return true}}); document.dispatchEvent(new Event('visibilitychange')); var after = OvuMorning.state(); delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); OvuMorning.cancel(); return {greetingWasPlaying: was, greetingStopped: stopped, atGate: atGate, after: {key: after.key, audioKey: after.audioKey}}}")
            check("ninth: Begin stops a greeting still playing; at the sink, leaving the app stops the line", n5["greetingStopped"] and n5["atGate"] == "ready" and n5["after"]["key"] == "ready" and n5["after"]["audioKey"] is None, n5)
            await page.evaluate("()=>{OvuMorning.begin('yourway', true); window.__dnF = Date.now; var n0 = window.__dnF; Date.now = function(){return n0() + 31000}; window.__today2 = OvuStore.today; var real = OvuStore.today(); window.__real = real; var y = new Date(real + 'T12:00:00'); y.setDate(y.getDate() - 1); window.__yday = y.toISOString().slice(0, 10); OvuStore.today = function(){return window.__yday};}"); await page.wait_for_timeout(80)
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            await page.evaluate("()=>{Date.now = window.__dnF; OvuStore.today = window.__today2; OvuStore.setState({morningStart: {date: window.__real, dismissed: true}});}")
            await page.click("#mdYes"); await page.wait_for_timeout(400)
            n7 = await page.evaluate("()=>{var e = OvuStore.list('mindfulness').filter(x=>x.data.activity==='morning' && x.date===window.__yday); var r = {entry: e.length === 1 ? e[0].date : 'found ' + e.length, yday: window.__yday, mark: OvuStore.state().morningStart}; if (OvuRoom.sheetOpen()) OvuRoom.closeSheet(); OvuStore.setState({morningStart: null}); return r}")
            check("ninth: saving yesterday's practice files it under yesterday and leaves today's Not today alone", n7["entry"] == n7["yday"] and n7["mark"]["dismissed"] and n7["mark"]["date"] != n7["yday"], n7)
            n8 = await page.evaluate("async()=>{window.__RA = window.Audio; window.Audio = function(){ var o = {muted:false, src:'', currentTime:0, ended:false, paused:true, play: function(){ if (o.muted) return Promise.resolve(); var e = new Error('no'); e.name = 'NotSupportedError'; return Promise.reject(e); }, pause: function(){ o.paused = true; } }; return o; }; OvuMorning.begin('yourway', false); await new Promise(r=>setTimeout(r, 150)); var r = {st: OvuMorning.state(), voice: document.querySelector('#mpQuiet').textContent, toast: document.querySelector('#toast').textContent}; OvuMorning.cancel(); window.Audio = window.__RA; return r}")
            check("ninth: a clip that cannot play turns the voice off and says captions only", n8["st"]["quiet"] and n8["voice"] == "Voice off" and "captions only" in n8["toast"], {"quiet": n8["st"]["quiet"], "voice": n8["voice"], "toast": n8["toast"]})
            # Codex tenth check (the last round): closing Morning start's choice from the mat lets her up; the journal names it
            t1 = await page.evaluate("async()=>{OvuRoom.enterMeditation(); await new Promise(r=>setTimeout(r, 500)); OvuMorning.open(); OvuRoom.closeSheet(); await new Promise(r=>setTimeout(r, 500)); return {meditating: OvuRoom.meditating(), hidden: document.querySelector('#avatar').classList.contains('hidden')}}")
            check("tenth: closing Morning start's choice opened from the mat lets her up and walk again", not t1["meditating"] and not t1["hidden"], t1)
            jp = await ctx.new_page(); await jp.goto(BASE + "journal.html", wait_until="networkidle"); await jp.wait_for_timeout(700)
            jt = await jp.evaluate("()=>document.body.innerText")
            await jp.close()
            check("tenth: the journal names a saved Morning start, not the breathing orb", "Morning start, your way" in jt, "")
            check("stopping during Erin's opening, or before Done in her own way, never says she brushed", "brushed" not in se["text"] and "Save this pause" in se["text"] and "brushed" not in sy and "Save this pause" in sy, {"erin": se, "yourway": sy})
            gh = await page.evaluate("()=>{var c = OvuGreenhouse.caring; OvuGreenhouse.caring = function(){return 'chamomile'}; OvuMorning.begin('yourway', true); var r = {active: OvuMorning.active(), toast: document.querySelector('#toast').textContent}; OvuGreenhouse.caring = c; return r}")
            check("Morning start waits for a greenhouse plant minute instead of running on top of it", not gh["active"] and "plant first" in gh["toast"], gh)
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(150)
            await page.evaluate("()=>{var a=document.querySelector('.nav a[data-tab=mind]'); a.click();}"); await page.wait_for_timeout(300)
            mt = await page.evaluate("()=>({mindOn: document.querySelector('.nav a[data-tab=mind]').classList.contains('on'), sheet: OvuRoom.sheetOpen(), active: OvuMorning.active()})")
            await page.evaluate("()=>OvuMorning.cancel()")
            check("the Mind tab is refused during Morning start and is not left selected", not mt["mindOn"] and not mt["sheet"] and mt["active"], mt)
            await page.evaluate("()=>{var h=OvuRoom.hotspot('wardrobe')||OvuRoom.hotspot('clock'); OvuRoom.walkTo(h.wp);}"); await page.wait_for_timeout(120)
            await page.evaluate("()=>OvuMorning.begin('yourway', true)"); await page.wait_for_timeout(80)
            p1 = await page.evaluate("()=>OvuRoom.pos()"); await page.wait_for_timeout(1300)
            p2 = await page.evaluate("()=>({pos: OvuRoom.pos(), walking: document.querySelector('#avatar').classList.contains('walking'), sheet: OvuRoom.sheetOpen()})")
            await page.evaluate("()=>OvuMorning.cancel()")
            check("a walk under way when Morning start begins stops where she is, and its sheet never opens", abs(p2["pos"]["x"] - p1["x"]) < 1.5 and abs(p2["pos"]["y"] - p1["y"]) < 1.5 and not p2["walking"] and not p2["sheet"], {"p1": p1, "p2": p2})
            await page.evaluate("()=>{OvuStore.setState({morningStart:null}); OvuMorning.inWindow = window.__mwin; OvuRoom.restorePose(); OvuRoom.renderDeck(); if (OvuRoom.sheetOpen()) OvuRoom.closeSheet();}")
            # the pets sleep: at night a pet walks home (or is already there) and curls up with z z; the morning wakes it
            await page.evaluate("()=>{OvuPetWalk.auto(false); window.__night=true; window.__dayReal2={night: OvuRoom.isNight, asleep: OvuRoom.asleep}; OvuRoom.isNight=function(){return window.__night}; OvuRoom.asleep=function(){return false}; OvuPetWalk.bedtime();}")
            try: await page.wait_for_function("()=>{var s=OvuPetWalk.state('dog'); return s && s.sleeping && s.state==='rest'}", timeout=15000)
            except Exception: pass
            asleep = await page.evaluate("()=>{var s=OvuPetWalk.state('dog'); var el=document.querySelector('.prop.owned.pet[data-id=dog]'); return {sleeping:s.sleeping, state:s.state, home:Math.abs(s.x-s.home.x)<1.5&&Math.abs(s.y-s.home.y)<1, napping:el.classList.contains('napping')}}")
            await page.evaluate("()=>{window.__night=false; OvuPetWalk.bedtime();}"); await page.wait_for_timeout(300)
            awake = await page.evaluate("()=>{var s=OvuPetWalk.state('dog'); var el=document.querySelector('.prop.owned.pet[data-id=dog]'); return {sleeping:s.sleeping, napping:el.classList.contains('napping')}}")
            await page.evaluate("()=>{OvuRoom.isNight=window.__dayReal2.night; OvuRoom.asleep=window.__dayReal2.asleep; delete window.__dayReal2;}")
            check("at night the corgi goes home and curls up with z z; the morning wakes her", asleep["sleeping"] and asleep["state"] == "rest" and asleep["home"] and asleep["napping"] and not awake["sleeping"] and not awake["napping"], {"asleep": asleep, "awake": awake})
            # sitting on a bench shows her seated in her own clothes (hips on the seat), never the cross-legged mat pose
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuWalk.travel('garden');}"); await page.wait_for_timeout(1800)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bench'))")
            try: await page.wait_for_selector('#benchSit', timeout=9000); await page.click('#benchSit'); await page.wait_for_timeout(900)
            except Exception: pass
            seat = await page.evaluate("()=>{var el=document.querySelector('.nb.sitter'); var img=el&&el.querySelector('img'); return {there: !!el, src: img&&img.getAttribute('src'), seated: !!(img&&img.classList.contains('seated')), layout: document.querySelector('#scene').dataset.layout}}")
            check("on the garden bench she sits in her own clothes (avatar-sit-base), not in the cross-legged mat pose", seat["there"] and seat["seated"] and seat["src"] == "assets/room/dream/avatar-sit-base.webp" and seat["layout"] == "garden", seat)
            await page.click('.cihead h2'); await page.wait_for_timeout(400)  # a plain tap outside the scene (it used to land on empty deck space; a check-in tile sits there now)
            # the street bench: on the wide plate the seated width comes from the box's aspect, not the plate's
            went = await page.evaluate("()=>({went: OvuWalk.travel('street'), toast: (document.querySelector('#toast')||{}).textContent, cls: document.querySelector('#scene').className})")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            onst = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, bench: !!document.querySelector('.hotspot[data-id=bench]'), cls: document.querySelector('#scene').className})")
            ST = "()=>({layout: document.querySelector('#scene').dataset.layout, pos: OvuRoom.pos(), sitting: OvuGarden.sitting(), walking: OvuWalk.walking(), cls: document.querySelector('#scene').className, toast: (document.querySelector('#toast')||{}).textContent})"
            if onst["layout"] == "street" and onst["bench"]:
                b0 = await page.evaluate(ST)
                await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bench'))")
                try: await page.wait_for_selector('#seatSit', timeout=12000); await page.click('#seatSit'); await page.wait_for_timeout(900)  # since 21 Oct the street bench sheet is its own seat (ovu-seats.js): Just sit a while is #seatSit
                except Exception: print("street bench card did not open:", b0, await page.evaluate(ST))
            else: print("street bench skipped:", went, onst)
            sb = await page.evaluate("()=>{var el=document.querySelector('.nb.sitter'), b=document.querySelector('#scene').getBoundingClientRect(), r=el&&el.getBoundingClientRect(); return {there: !!el, w: el&&parseFloat(el.style.width), left: el&&parseFloat(el.style.left), inside: !!r && r.left>=b.left && r.right<=b.right && r.bottom<=b.bottom, layout: document.querySelector('#scene').dataset.layout}}")
            check("on the street bench she sits on its seat, on screen", sb["there"] and sb["layout"] == "street" and abs(sb["left"] - 53) < 0.5 and sb["w"] > 5 and sb["inside"], sb)
            await page.click('.cihead h2'); await page.wait_for_timeout(400)  # a plain tap outside the scene (it used to land on empty deck space; a check-in tile sits there now)
            # teas and herbs live in the garden greenhouse; every source list sits behind a small (i)
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuWalk.travel('garden');}")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='garden' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            # since 20 Oct the greenhouse is a room: the garden door walks her in, every tea grows inside, the tea table opens the list
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('greenhouse'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='greenhouse' && !document.querySelector('#scene').classList.contains('fading')", timeout=15000)
            except Exception: pass
            await page.wait_for_timeout(500)
            gin = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, plants: document.querySelectorAll('.ghplant').length, taps: document.querySelectorAll('.ghplant.tappable').length, pos: OvuRoom.pos(), map: (document.querySelector('#mapHere')||{}).textContent})")
            check("the garden greenhouse door walks her into a glass greenhouse: every tea and houseplant on the bench, table and shelf, the map pill names it", gin["layout"] == "greenhouse" and gin["plants"] >= 27 and gin["taps"] >= 25 and abs(gin["pos"]["x"] - 49.5) < 1 and gin["map"] == "Greenhouse", gin)
            await page.evaluate("()=>document.querySelector('.ghplant[data-plant=monstera]').click()")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .petsafe', timeout=15000)
            except Exception: pass
            mc = await page.evaluate("()=>({title: (document.querySelector('#sheetTitle')||{}).textContent, pets: (document.querySelector('#sheet .petsafe')||{}).className, link: (document.querySelector('#sheet .petsafe a')||{}).href, care: !!document.querySelector('#sheetBody [data-act=care]'), pos: OvuRoom.pos()})")
            check("tapping the variegated monstera walks her to it and opens its card with a sourced pet warning and a mindful minute", "monstera" in (mc["title"] or "").lower() and "warn" in (mc["pets"] or "") and (mc["link"] or "").startswith("https://www.aspca.org/") and mc["care"] and abs(mc["pos"]["x"] - 42) < 1.5, mc)
            # the minute runs on its own timers (a test pace of 0.25 s a line): in her own outfit, it finishes by itself, saves once,
            # a stopped one saves nothing, and finishing again adds nothing
            await page.evaluate("()=>{OvuStore.setProfile({outfit:'sundress'}); OvuRoom.restorePose(); OvuGreenhouse.setPace(250);}"); await page.wait_for_timeout(300)
            await page.click('#sheetBody [data-act=care]'); await page.wait_for_timeout(350)
            cr = await page.evaluate("()=>({caring: OvuGreenhouse.caring(), img: document.querySelector('#avatarImg').getAttribute('src'), hud: document.querySelector('#hud').classList.contains('on'), line: document.querySelector('#hudLine').textContent, ours: OvuGreenhouse.careLines(OvuGreenhouse.plant('monstera')).indexOf(document.querySelector('#hudLine').textContent) > -1})")
            await page.wait_for_timeout(1400)
            after = await page.evaluate("()=>({caring: OvuGreenhouse.caring(), hud: document.querySelector('#hud').classList.contains('on'), img: document.querySelector('#avatarImg').getAttribute('src')})")
            await page.evaluate("()=>OvuGreenhouse.finishCare(true)")
            await page.evaluate("()=>{OvuRoom.closeSheet && OvuRoom.closeSheet(); OvuGreenhouse.startCare('hoya');}"); await page.wait_for_timeout(200)
            await page.click('#hudStop'); await page.wait_for_timeout(300)
            stopped = await page.evaluate("()=>({caring: OvuGreenhouse.caring(), hud: document.querySelector('#hud').classList.contains('on')})")
            saved = await page.evaluate("()=>OvuStore.list('mindfulness').filter(function(e){return e.data && e.data.practice==='greenhouse'}).map(function(e){return {plant: e.data.plant, minutes: e.data.minutes}})")
            # Erin's practice started mid-minute (from the Mind tab, say): the minute steps aside and her practice keeps the HUD;
            # a minute cannot start over a practice (Codex review, 20 Oct)
            await page.evaluate("()=>{OvuGreenhouse.setPace(1500); OvuGreenhouse.startCare('hoya');}"); await page.wait_for_timeout(300)
            await page.evaluate("()=>OvuRoom.openEveryday('coffee')"); await page.wait_for_selector('#actStart', timeout=10000)
            ov = await page.evaluate("()=>{document.querySelector('#actStart').click(); return {care: OvuGreenhouse.caring(), practice: OvuRoom.practiceOn(), hud: document.querySelector('#hud').classList.contains('on'), title: document.querySelector('#hudTitle').textContent}}")
            await page.evaluate("()=>OvuGreenhouse.startCare('monstera')"); await page.wait_for_timeout(200)
            ov["refused"] = await page.evaluate("()=>OvuGreenhouse.caring()===null")
            await page.evaluate("()=>{OvuRoom.stopEverything && OvuRoom.stopEverything(); OvuRoom.closeSheet && OvuRoom.closeSheet();}"); await page.wait_for_timeout(500)
            await page.wait_for_timeout(6500) # past the hoya minute's own end at the test pace: nothing may save
            ov["savedAfter"] = await page.evaluate("()=>OvuStore.list('mindfulness').filter(function(e){return e.data && e.data.practice==='greenhouse'}).length")
            check("Erin's practice started mid-minute takes over at once: the minute steps aside, her HUD stays, nothing saves later, and no minute starts over it", ov["care"] is None and ov["practice"] and ov["hud"] and ov["title"] == "Morning coffee or tea" and ov["refused"] and ov["savedAfter"] == 1, ov)
            # a breathing session started mid-minute: the hand-over is synchronous, and Stop then stops the session, not the minute
            await page.evaluate("()=>{OvuRoom.closeSheet && OvuRoom.closeSheet(); OvuGreenhouse.setPace(1500); OvuGreenhouse.startCare('calathea');}"); await page.wait_for_timeout(200)
            se = await page.evaluate("()=>{OvuRoom.runSession('breathe', 1); return {care: OvuGreenhouse.caring(), session: OvuRoom.sessionOn(), hud: document.querySelector('#hud').classList.contains('on')}}")
            await page.click('#hudStop'); await page.wait_for_timeout(400)
            se["after"] = await page.evaluate("()=>({session: OvuRoom.sessionOn(), care: OvuGreenhouse.caring()})")
            await page.evaluate("()=>{OvuRoom.stopEverything && OvuRoom.stopEverything(); OvuRoom.closeSheet && OvuRoom.closeSheet();}"); await page.wait_for_timeout(6500)
            se["saved"] = await page.evaluate("()=>OvuStore.list('mindfulness').filter(function(e){return e.data && e.data.practice==='greenhouse'}).length")
            check("a session started mid-minute takes the HUD at once, Stop stops the session, and the minute never saves", se["care"] is None and se["session"] and se["hud"] and not se["after"]["session"] and se["after"]["care"] is None and se["saved"] == 1, se)
            # the session clock: counts up, stops the moment Stop is tapped (even with the save prompt open), and a new activity starts at 0:00
            await page.evaluate("()=>{OvuRoom.stopEverything && OvuRoom.stopEverything(); OvuRoom.closeSheet && OvuRoom.closeSheet();}"); await page.wait_for_timeout(400)
            await page.evaluate("()=>OvuRoom.openEveryday('coffee')"); await page.wait_for_selector('#actStart', timeout=10000)
            await page.click('#actStart'); await page.wait_for_timeout(1300)
            c1 = await page.evaluate("()=>document.querySelector('#hudTime').textContent")
            await page.evaluate("()=>{window.__realNow=Date.now; var off=65000; Date.now=function(){return window.__realNow()+off;};}")
            await page.wait_for_timeout(1100); c2 = await page.evaluate("()=>document.querySelector('#hudTime').textContent")
            await page.click('#hudStop'); await page.wait_for_timeout(150)
            c3 = await page.evaluate("()=>({clock: document.querySelector('#hudTime').textContent, prompt: !!document.querySelector('#pdNo')})")
            await page.wait_for_timeout(1200); c3["later"] = await page.evaluate("()=>document.querySelector('#hudTime').textContent")
            await page.evaluate("()=>{Date.now=window.__realNow; var b=document.querySelector('#pdNo'); if(b) b.click();}"); await page.wait_for_timeout(300)
            await page.evaluate("()=>OvuRoom.runSession('breathe', 1)"); await page.wait_for_timeout(1200)
            await page.click('#hudStop'); await page.wait_for_timeout(100)
            await page.evaluate("()=>OvuRoom.runSession('breathe', 1)"); await page.wait_for_timeout(300)
            c4 = await page.evaluate("()=>document.querySelector('#hudTime').textContent")
            await page.click('#hudStop'); await page.wait_for_timeout(300)
            # a session saved after a minute fades for 2.5 s; one started inside that fade must stay on screen and keep its clock
            await page.evaluate("()=>OvuRoom.runSession('breathe', 1)"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{window.__realNow=Date.now; var off=65000; Date.now=function(){return window.__realNow()+off;};}")
            await page.click('#hudStop'); await page.wait_for_timeout(100)
            await page.evaluate("()=>{Date.now=window.__realNow; OvuRoom.runSession('breathe', 1);}"); await page.wait_for_timeout(3000)
            c5 = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), session: OvuRoom.sessionOn(), clock: document.querySelector('#hudTime').textContent})")
            await page.click('#hudStop'); await page.wait_for_timeout(300)
            await page.evaluate("()=>OvuStore.list('mindfulness').filter(function(e){return e.data && e.data.kind==='breathe' && !e.data.completed}).forEach(function(e){OvuStore.remove(e.id)})")
            check("a session started while the last one fades stays on screen with its own clock running", c5["on"] and c5["session"] and bool(re.match(r"^0:0[2-4] of 1 min$", c5["clock"])), c5)
            # the same for an activity from another module (a watering minute) started inside the fade
            await page.evaluate("()=>OvuRoom.runSession('breathe', 1)"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{window.__realNow=Date.now; var off=65000; Date.now=function(){return window.__realNow()+off;};}")
            await page.click('#hudStop'); await page.wait_for_timeout(100)
            await page.evaluate("()=>{Date.now=window.__realNow; OvuRoom.hudOn(true, 'Watering');}"); await page.wait_for_timeout(3000)
            c6 = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), clock: document.querySelector('#hudTime').textContent})")
            await page.evaluate("()=>OvuRoom.hudOn(false)"); await page.wait_for_timeout(200)
            c6["after"] = await page.evaluate("()=>document.querySelector('#hudTime').textContent")
            await page.evaluate("()=>OvuStore.list('mindfulness').filter(function(e){return e.data && e.data.kind==='breathe' && !e.data.completed}).forEach(function(e){OvuStore.remove(e.id)})")
            check("a watering minute started while a saved session fades keeps the bar and its clock, and the clock clears when it ends", c6["on"] and bool(re.match(r"^0:0[2-4]$", c6["clock"])) and c6["after"] == "", c6)
            check("the clock shows the planned length, keeps counting, stops the moment Stop is tapped with the save prompt open, and a new session starts again from 0:00", bool(re.match(r"^0:0[0-9] of [0-9]+ min$", c1)) and c2.startswith("1:0") and c3["clock"] == "" and c3["prompt"] and c3["later"] == "" and bool(re.match(r"^0:00 of 1 min$", c4)), {"c1": c1, "c2": c2, "c3": c3, "c4": c4})
            await page.evaluate("()=>{OvuGreenhouse.setPace(0); OvuStore.setProfile({outfit:'base'}); OvuRoom.restorePose();}")
            check("a mindful minute with the monstera: she mists it in her own outfit with the HUD guiding, it ends by itself and saves one minute", cr["caring"] == "monstera" and "act-plants-sundress" in (cr["img"] or "") and cr["hud"] and cr["ours"] and after["caring"] is None and not after["hud"], [cr, after])
            check("a stopped minute saves nothing and finishing twice saves once", stopped["caring"] is None and not stopped["hud"] and len(saved) == 1 and saved[0]["plant"] == "monstera" and saved[0]["minutes"] == 1, [stopped, saved])
            await page.evaluate("()=>OvuRoom.closeSheet && OvuRoom.closeSheet()"); await page.wait_for_timeout(400)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('teatable'))")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .teacare .ibtn.evi', timeout=12000)
            except Exception: pass
            gh = await page.evaluate("""()=>({teas: document.querySelectorAll('#sheet .tea').length, cautions: document.querySelectorAll('#sheet .teacare p b').length,
                shownChips: [...document.querySelectorAll('#sheet .evrefs a')].filter(a=>a.offsetParent).length, infos: document.querySelectorAll('#sheet .ibtn.evi').length,
                label: (document.querySelector('#sheet .teacare .ibtn.evi')||{}).getAttribute && document.querySelector('#sheet .teacare .ibtn.evi').getAttribute('aria-label')})""")
            await page.click('#sheet .teacare .ibtn.evi')
            await page.wait_for_timeout(200)
            op = await page.evaluate("()=>{var b=document.querySelector('#sheet .teacare .ibtn.evi'); var r=document.getElementById(b.getAttribute('aria-controls')); var a=r.querySelector('a'); return {expanded: b.getAttribute('aria-expanded'), shown: !!r.offsetParent, href: a && a.getAttribute('href'), text: a && a.textContent}}")
            await page.click('#sheet .teacare .ibtn.evi'); await page.wait_for_timeout(150)
            shut = await page.evaluate("()=>{var b=document.querySelector('#sheet .teacare .ibtn.evi'); return !document.getElementById(b.getAttribute('aria-controls')).offsetParent}")
            cup = await page.evaluate("()=>!!document.getElementById('ghCup')")
            await page.evaluate("()=>OvuRoom.closeSheet()"); await page.wait_for_timeout(300)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('ghdoor'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='garden' && !document.querySelector('#scene').classList.contains('fading')", timeout=15000)
            except Exception: pass
            await page.wait_for_timeout(400)
            back = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, pos: OvuRoom.pos()})")
            check("the tea table offers a mindful cup with Erin, and the door takes her back out to stand by the greenhouse in the garden", cup and back["layout"] == "garden" and abs(back["pos"]["x"] - 62) < 1.5 and abs(back["pos"]["y"] - 49) < 1.5, [cup, back])
            check("the garden greenhouse lists every tea and the doctor-or-pharmacist cautions, with all sources folded behind small (i) buttons", gh["teas"] >= 15 and gh["cautions"] >= 5 and gh["shownChips"] == 0 and gh["infos"] >= 20 and gh["label"] == "Source for St John’s wort", gh)
            check("an (i) opens its sources (a link into the evidence register) and closes them again", op["expanded"] == "true" and op["shown"] and (op["href"] or "").startswith("evidence.html#E") and shut, op)

            # the greenhouse herbs (21 Oct): four planters by the door; a start from Hay & Harvest, planted, watered and picked into
            # the basket; a cup brewed from it for one minute (Stop keeps the herb), no diary entry, only the flat practice thank-you
            await page.evaluate("()=>{OvuStore.setState({greenhouse: null, stamina: null}); var f=OvuFarm.farmState(OvuStore); f.harvest={}; OvuStore.setState({farm: f}); OvuWalk.travel('greenhouse');}")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='greenhouse' && !document.querySelector('#scene').classList.contains('fading')", timeout=15000)
            except Exception: pass
            await page.wait_for_timeout(500)
            hb0 = await page.evaluate("()=>({beds: document.querySelectorAll('#ownedProps .ghbed').length, label: (document.querySelector('.ghbed[data-bed=hb1]')||{getAttribute:()=>''}).getAttribute('aria-label'), diary: OvuStore.list().length})")
            await page.evaluate("()=>OvuLane.openGrocer()"); await page.wait_for_timeout(250)
            hbuy = await page.evaluate("()=>{var n=document.querySelectorAll('#grocerHerbs [data-herbstart]').length, b=document.querySelector('#grocerHerbs [data-herbstart=ginger]'), freeBefore=/free/.test(b?b.textContent:''); if(b) b.click(); var after=document.querySelector('#grocerHerbs [data-herbstart=ginger]'); return {n: n, freeBefore: freeBefore, claimed: !OvuGreenhouse.freeStartOpen(OvuStore), priced: after ? /♥/.test(after.textContent) && !/free/.test(after.textContent) : false, seeds: OvuGreenhouse.herbState(OvuStore).seeds.ginger||0, lemongrassFarm: !!document.querySelector('#grocerBuy [data-unlock=lemongrass]')}}")
            check("Hay & Harvest sells the four greenhouse herbs, the first one free; a free ginger start lands in the greenhouse bag and the shelf shows prices after, and lemongrass is not a farm unlock any more", hb0["beds"] == 4 and "empty" in (hb0["label"] or "") and hbuy["n"] == 4 and hbuy["freeBefore"] and hbuy["claimed"] and hbuy["priced"] and hbuy["seeds"] == 1 and not hbuy["lemongrassFarm"], [hb0, hbuy])
            await page.evaluate("()=>{OvuRoom.closeSheet(); OvuGreenhouse.slowMs = 0; document.querySelector('.ghbed[data-bed=hb1]').click();}")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #herbActs [data-herb=plant][data-kind=ginger]', timeout=15000)
            except Exception: pass
            hp = await page.evaluate("()=>{var pos=OvuRoom.pos(), b=document.querySelector('#herbActs [data-herb=plant][data-kind=ginger]'); if(!b) return {btn:false, pos:pos}; b.click(); var bed=OvuGreenhouse.herbState(OvuStore).beds.hb1; var w=document.querySelector('#herbActs [data-herb=water]'); if(w) w.click(); bed=OvuGreenhouse.herbState(OvuStore).beds.hb1; return {btn:true, pos:pos, herb: bed&&bed.herb, days: OvuGreenhouse.herbDays(bed), stam: OvuStamina.value(), again: !!document.querySelector('#herbActs [data-herb=water]'), seeds: OvuGreenhouse.herbState(OvuStore).seeds.ginger||0}}")
            check("tapping a planter walks her to its stand point; planting the ginger and watering it once costs energy and counts one day", hp["btn"] and abs(hp["pos"]["x"] - 39) < 1.5 and abs(hp["pos"]["y"] - 68.6) < 1.5 and hp["herb"] == "ginger" and hp["days"] == 1 and hp["stam"] == 100 - 2 - 6 and not hp["again"] and hp["seeds"] == 0, hp)
            await page.evaluate("()=>{var g=OvuGreenhouse.herbState(OvuStore), b=g.beds.hb1, d=b.watered[0]; b.watered=['2020-01-01','2020-01-02','2020-01-03','2020-01-04','2020-01-05',d]; OvuStore.setState({greenhouse:g}); OvuGreenhouse.renderBeds(); OvuGreenhouse.openHerbBed('hb1');}"); await page.wait_for_timeout(200)
            hk = await page.evaluate("()=>{var ripe=document.querySelector('.ghbed[data-bed=hb1]').classList.contains('ripe'), b=document.querySelector('#herbActs [data-herb=pick]'); if(!b) return {btn:false}; b.click(); var bed=OvuGreenhouse.herbState(OvuStore).beds.hb1; return {btn:true, ripe:ripe, basket: OvuFarm.farmState(OvuStore).harvest.ginger||0, stays: bed&&bed.herb, cuts: bed&&bed.cuts, brew: !!document.querySelector('#herbActs [data-herb=brew]')}}")
            await page.evaluate("()=>OvuFarm.openBasket()"); await page.wait_for_timeout(150)
            hk["listed"] = await page.evaluate("()=>/Ginger/.test(document.querySelector('#sheet .basketlist')?.textContent||'')")
            check("a ripe planter sparkles; picking puts two pieces of ginger in the farm basket, the ginger stays to grow again, and the basket lists it", hk["btn"] and hk["ripe"] and hk["basket"] == 2 and hk["stays"] == "ginger" and hk["cuts"] == 1 and hk["brew"] and hk["listed"], hk)
            await page.evaluate("()=>{OvuRoom.closeSheet(); OvuRoom.tap(OvuRoom.hotspot('teatable'))}")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .ghbrewrow [data-brew=ginger]', timeout=12000)
            except Exception: pass
            tt = await page.evaluate("()=>({row: !!document.querySelector('.ghbrewrow [data-brew=ginger]'), teas: document.querySelectorAll('#sheet .tea').length})")
            await page.click('.ghbrewrow [data-brew=ginger]'); await page.wait_for_timeout(250)
            bs = await page.evaluate("()=>({id: OvuRoom.sheetId(), card: !!document.getElementById('brewCard'), go: !!document.getElementById('brewGo')})")
            await page.click('#brewCard'); await page.wait_for_timeout(250)
            bs["research"] = await page.evaluate("()=>({id: OvuRoom.sheetId(), title: document.querySelector('#sheetTitle').textContent, says: /What research says/.test(document.querySelector('#sheet').textContent)})")
            check("the tea table offers a cup from the basket beside the full tea list; the ginger cup links to its existing research card", tt["row"] and tt["teas"] >= 15 and bs["id"] == "ghbrew" and bs["card"] and bs["go"] and bs["research"]["id"] == "ghcard" and "Ginger" in bs["research"]["title"] and bs["research"]["says"], [tt, bs])
            await page.evaluate("()=>{OvuRoom.closeSheet(); OvuStore.setProfile({outfit:'sundress'}); OvuRoom.restorePose(); OvuGreenhouse.setPace(250);}"); await page.wait_for_timeout(300)
            b0 = await page.evaluate("()=>{var l=OvuRewards.ledger(), d=OvuStore.today(); return {hearts: l.hearts, room: (l.mindDay && l.mindDay.day===d) ? l.mindDay.pts < OvuRewards.PRACTICE.cap : true, diary: OvuStore.list().length}}")
            await page.evaluate("()=>OvuGreenhouse.openBrew('ginger')"); await page.wait_for_timeout(200)
            await page.click('#brewGo'); await page.wait_for_timeout(350)
            bw = await page.evaluate("()=>({brewing: OvuGreenhouse.brewing(), hud: document.querySelector('#hud').classList.contains('on'), img: document.querySelector('#avatarImg').getAttribute('src'), line: document.querySelector('#hudLine').textContent, ours: OvuGreenhouse.brewLines('ginger').indexOf(document.querySelector('#hudLine').textContent) > -1})")
            try: await page.wait_for_function("()=>OvuGreenhouse.brewing()===null", timeout=8000)
            except Exception: pass
            await page.wait_for_timeout(150)
            ba = await page.evaluate("()=>({brewing: OvuGreenhouse.brewing(), hud: document.querySelector('#hud').classList.contains('on'), basket: OvuFarm.farmState(OvuStore).harvest.ginger||0, hearts: OvuRewards.ledger().hearts, diary: OvuStore.list().length})")
            check("a cup of ginger tea: one minute in her own outfit with the cup, warmth then steam then the first sip; it uses one ginger, writes no diary entry and earns only the flat practice thank-you", bw["brewing"] == "ginger" and bw["hud"] and "act-coffee-sundress" in (bw["img"] or "") and bw["ours"] and ba["brewing"] is None and not ba["hud"] and ba["basket"] == 1 and ba["diary"] == b0["diary"] and ba["hearts"] - b0["hearts"] == (2 if b0["room"] else 0), [b0, bw, ba])
            await page.evaluate("()=>{OvuGreenhouse.setPace(1500); OvuGreenhouse.startBrew('ginger');}"); await page.wait_for_timeout(300)
            await page.click('#hudStop'); await page.wait_for_timeout(300)
            st_ = await page.evaluate("()=>({brewing: OvuGreenhouse.brewing(), basket: OvuFarm.farmState(OvuStore).harvest.ginger||0, hearts: OvuRewards.ledger().hearts, diary: OvuStore.list().length})")
            check("Stop at any time: a stopped cup keeps the ginger, earns nothing and writes nothing", st_["brewing"] is None and st_["basket"] == 1 and st_["hearts"] == ba["hearts"] and st_["diary"] == b0["diary"], st_)
            await page.evaluate("()=>{OvuGreenhouse.setPace(0); OvuGreenhouse.slowMs = null; OvuStore.setProfile({outfit:'base'}); OvuRoom.restorePose(); OvuRoom.closeSheet && OvuRoom.closeSheet();}")

            # the farm: the garden path leads there, twelve beds draw on the plate, the shed gives seeds, a bed is planted and
            # watered, and a harvest offers to log a meal without writing one
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuStore.setState({farm: null, stamina: null}); OvuWalk.travel('garden');}"); await page.wait_for_timeout(1800)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('farmpath'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'farm'", timeout=12000)
            except Exception: pass
            await page.wait_for_timeout(900)
            farm = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, beds: document.querySelectorAll('#ownedProps .bed').length, hots: [...document.querySelectorAll('.hotspot')].map(h=>h.dataset.id).join(','), here: document.querySelector('#mapHere')?.textContent, zone: document.querySelector('#zoneName')?.textContent})")
            check("the garden path walks her onto the farm: twelve beds on the plate, six hotspots (the barn path and the harbour steps too), the pill saying Farm", farm["layout"] == "farm" and farm["beds"] == 12 and farm["hots"] == "farmgate,shed,well,basket,barnpath,harboursteps" and farm["here"] == "Farm" and farm["zone"] == "Your farm", farm)
            # the first visit explains the four steps once (Jamie, 20 Oct: "it's confusing")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .farmsteps', timeout=6000)
            except Exception: pass
            guide = await page.evaluate("()=>({steps: document.querySelectorAll('#sheet[aria-hidden=\"false\"] .farmsteps li').length, can: !!document.querySelector('#farmCan'), seen: !!(OvuStore.state().farm||{}).guided})")
            check("the first farm visit shows the four steps once, and the can sits on screen", guide["steps"] == 4 and guide["can"] and guide["seen"], guide)
            await page.click('#guideGo'); await page.wait_for_timeout(300)
            await page.evaluate("()=>{OvuFarm.slowMs = 0}")
            foods_before = await page.evaluate("()=>OvuStore.list('food').length")
            # the shed's hearts shelf (Phase 1, 20 Oct): its two tools for hearts beside the free seeds; since 21 Oct seed packs and new crops are at Hay & Harvest on Harbour Lane
            sh = await page.evaluate("()=>{OvuFarm.openShed(); var b=document.querySelector('#shedBuy'); return {shelf: !!b, packs: document.querySelectorAll('#sheet [data-pack]').length, unlocks: document.querySelectorAll('#sheet [data-unlock]').length, tools: b ? b.querySelectorAll('[data-tool]').length : 0, free: document.querySelectorAll('#shedActs [data-seed]').length, grocer: /Hay & Harvest/.test((document.querySelector('#shedGrocer')||{}).textContent||'')}}")
            check("the shed has its two tools for hearts beside the free seeds, and points to Hay & Harvest for seed packs and new crops", sh["shelf"] and sh["packs"] == 0 and sh["unlocks"] == 0 and sh["tools"] == 2 and sh["free"] >= 5 and sh["grocer"], sh)
            await page.evaluate("()=>OvuRoom.hideSheet()"); await page.wait_for_timeout(200)
            direct = await page.evaluate("()=>{var d=OvuGameTime.dayKey(); var b=OvuFarm.BEDS.filter(x=>!OvuFarm.hasWeeds(null,x.id,d))[1]; OvuFarm.openBed(b.id); var btn=document.querySelector('#bedActs [data-bed=shedplant][data-crop=radish]'); if(!btn) return {btn:false}; btn.click(); var bb=OvuFarm.bed(OvuStore,b.id); var r={btn:true, crop: bb&&bb.crop, left: OvuFarm.seedsLeftToday(OvuStore,d)}; var f=OvuStore.state().farm; delete f.beds[b.id]; f.seedsByDay={}; f.seeds={}; OvuStore.setState({farm:f, stamina:null}); OvuRoom.closeSheet(); return r}")
            check("an empty bed plants straight from the shed's seeds for today, no trip to the shed", direct["btn"] and direct["crop"] == "radish" and direct["left"] == 2, direct)
            seeds = await page.evaluate("()=>{var d=OvuGameTime.dayKey(); var a=OvuFarm.takeSeed(OvuStore,'radish',d), b=OvuFarm.takeSeed(OvuStore,'radish',d), c=OvuFarm.takeSeed(OvuStore,'carrot',d), x=OvuFarm.takeSeed(OvuStore,'carrot',d); return {a:a.ok,b:b.ok,c:c.ok,x:x.ok,left:OvuFarm.seedsLeftToday(OvuStore,d)}}")
            check("the shed gives three seeds a day", seeds["a"] and seeds["b"] and seeds["c"] and not seeds["x"] and seeds["left"] == 0, seeds)
            # a clean bed: tap it, she walks to its stand point and the bed sheet opens with the seeds to plant
            bed = await page.evaluate("()=>{var d=OvuGameTime.dayKey(); var b=OvuFarm.BEDS.filter(x=>!OvuFarm.hasWeeds(null,x.id,d))[0]; document.querySelector('#ownedProps .bed[data-id='+b.id+']').click(); return b.id}")
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #bedActs', timeout=12000)
            except Exception: pass
            planted = await page.evaluate("(id)=>{var b=document.querySelector('#bedActs [data-bed=plant][data-crop=radish]'); if(!b) return {btn:false}; b.click(); return {btn:true, crop: OvuFarm.bed(OvuStore,id) && OvuFarm.bed(OvuStore,id).crop}}", bed)
            await page.wait_for_timeout(500)
            # the can starts empty: the bed sends her to the well, the well fills the can, and Back returns her to the bed
            empty = await page.evaluate("()=>({water: !!document.querySelector('#bedActs [data-bed=water]'), well: !!document.querySelector('#bedActs [data-bed=well]')})")
            await page.click('#bedActs [data-bed=well]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #wellActs [data-well=draw]', timeout=12000)
            except Exception: pass
            await page.click('#wellActs [data-well=draw]'); await page.wait_for_timeout(200)
            filled = await page.evaluate("()=>({can: OvuFarm.canLevel(OvuStore), back: !!document.querySelector('#wellActs [data-well=back]'), gauge: document.querySelectorAll('#farmCan .cdots i.on').length})")
            check("an empty can sends her from the bed to the well; drawing water fills three pours and offers the way back", not empty["water"] and empty["well"] and filled["can"] == 3 and filled["back"] and filled["gauge"] == 3, {"empty": empty, "filled": filled})
            await page.click('#wellActs [data-well=back]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] #bedActs [data-bed=water]', timeout=12000)
            except Exception: pass
            # a slow pour stopped halfway changes nothing
            stopped = await page.evaluate("async (id)=>{OvuFarm.slowMs = 1500; document.querySelector('#bedActs [data-bed=water]').click(); await new Promise(r=>setTimeout(r,300)); var bar=!!document.querySelector('#bedActs .slowbar'); document.querySelector('#bedActs [data-slow=stop]').click(); await new Promise(r=>setTimeout(r,1600)); OvuFarm.slowMs = 0; return {bar: bar, days: OvuFarm.growthDays(OvuFarm.bed(OvuStore,id)), can: OvuFarm.canLevel(OvuStore), stam: OvuStamina.value(), again: !!document.querySelector('#bedActs [data-bed=water]')}}", bed)
            check("a slow pour shows its bar, and Stop waters nothing, keeps the water and costs no energy", stopped["bar"] and stopped["days"] == 0 and stopped["can"] == 3 and stopped["stam"] == 100 - 2 and stopped["again"], stopped)
            # closing the sheet mid-step frees the farm at once; sleep starting mid-step saves nothing
            freed = await page.evaluate("async (id)=>{OvuFarm.slowMs = 1500; document.querySelector('#bedActs [data-bed=water]').click(); await new Promise(r=>setTimeout(r,200)); OvuRoom.hideSheet(); await new Promise(r=>setTimeout(r,100)); OvuFarm.openBed(id); var ok=!!document.querySelector('#bedActs [data-bed=water]'); await new Promise(r=>setTimeout(r,1600)); var days=OvuFarm.growthDays(OvuFarm.bed(OvuStore,id)); document.querySelector('#bedActs [data-bed=water]').click(); await new Promise(r=>setTimeout(r,200)); OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}}); await new Promise(r=>setTimeout(r,1600)); var slept={days: OvuFarm.growthDays(OvuFarm.bed(OvuStore,id)), can: OvuFarm.canLevel(OvuStore), stam: OvuStamina.value()}; OvuStore.setState({sleeping:null}); OvuFarm.slowMs = 0; OvuFarm.openBed(id); return {reopened: ok, days: days, slept: slept}}", bed)
            check("closing a bed mid-pour frees the farm at once and saves nothing; sleep starting mid-pour saves nothing either", freed["reopened"] and freed["days"] == 0 and freed["slept"]["days"] == 0 and freed["slept"]["can"] == 3 and freed["slept"]["stam"] == 100 - 2, freed)
            watered = await page.evaluate("(id)=>{var b=document.querySelector('#bedActs [data-bed=water]'); if(!b) return {btn:false}; b.click(); var bb=OvuFarm.bed(OvuStore,id); return {btn:true, days: OvuFarm.growthDays(bb), stam: OvuStamina.value(), stage: OvuFarm.stage(bb), can: OvuFarm.canLevel(OvuStore)}}", bed)
            check("tapping a bed walks her over and opens it; planting a radish and watering it costs energy and counts one day", planted["btn"] and planted["crop"] == "radish" and watered["btn"] and watered["days"] == 1 and 1 <= watered["stage"] <= 2 and watered["stam"] == 100 - 2 - 6 and watered["can"] == 2, {"planted": planted, "watered": watered})
            await page.evaluate("()=>OvuRoom.closeSheet()"); await page.wait_for_timeout(300)
            # ripen it by hand (two watered days) and harvest through the sheet: the basket fills, the meal prompt asks, no entry is written
            await page.evaluate("(id)=>{var f=OvuStore.state().farm; f.beds[id].watered=[OvuStore.addDays(OvuGameTime.dayKey(),-1), OvuGameTime.dayKey()]; OvuStore.setState({farm:f}); OvuFarm.openBed(id);}", bed)
            await page.wait_for_timeout(400)
            harvested = await page.evaluate("()=>{var b=document.querySelector('#bedActs [data-bed=harvest]'); if(!b) return {btn:false}; b.click(); return {btn:true}}")
            try: await page.wait_for_selector('#harvestLog', timeout=8000)
            except Exception: pass
            hv = await page.evaluate("()=>({prompt: !!document.querySelector('#harvestLog'), basket: (OvuStore.state().farm.harvest||{}).radish, foods: OvuStore.list('food').length})")
            await page.click('#harvestNo'); await page.wait_for_timeout(300)
            check("harvest fills the basket and asks before any meal is logged; Not now writes nothing", harvested["btn"] and hv["prompt"] and hv["basket"] == 2 and hv["foods"] == foods_before, hv)
            # a logged sleep stops the game: a bed tap, a hotspot and a journey all answer with the wake-her-first line and nothing opens
            await page.evaluate("()=>{OvuRoom.asleep=function(){return !!OvuStore.state().sleeping}; OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}});}"); await page.wait_for_timeout(400)
            slept = await page.evaluate("(id)=>{var out={}; document.querySelector('#ownedProps .bed[data-id='+id+']').click(); out.bedSheet=document.querySelector('#sheet').getAttribute('aria-hidden')==='false'; OvuRoom.tap(OvuRoom.hotspot('shed')); out.shedSheet=document.querySelector('#sheet').getAttribute('aria-hidden')==='false'; out.travel=OvuWalk.travel('garden'); out.walk=OvuWalk.tapWalk(60,60); out.prompt=!document.querySelector('#actBtn').hidden; out.toast=(document.querySelector('#toast')||{}).textContent||''; return out}", bed)
            await page.wait_for_timeout(300)
            check("while she sleeps the farm, the shed, a journey and a tap-walk all stop with the wake-her-first line, and no prompt shows", not slept["bedSheet"] and not slept["shedSheet"] and slept["travel"] is False and slept["walk"] is False and not slept["prompt"] and "asleep" in slept["toast"], slept)
            await page.evaluate("()=>{OvuStore.setState({sleeping:null}); OvuRoom.asleep=function(){return false};}"); await page.wait_for_timeout(300)
            # the barn and the hidden spring (21 Oct): the farm path, Clover inside the barn, the hens inside the hen house, the
            # crack that is secret on the map until found, pretend onsen eggs that change no energy, and sitting by the water
            async def go_to(t):
                await page.evaluate("(t)=>OvuWalk.travel(t)", t)
                try: await page.wait_for_function("(t)=>document.querySelector('#scene').dataset.layout===t && !document.querySelector('#scene').classList.contains('fading')", arg=t, timeout=12000)
                except Exception: pass
                await page.wait_for_timeout(600)
            await page.evaluate("()=>{OvuCare.slowMs = 0; OvuStore.setState({stamina: null})}")
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('barnpath'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'barn'", timeout=15000)
            except Exception: pass
            yard = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, hots: [...document.querySelectorAll('.hotspot')].map(h=>h.dataset.id).join(','), cave: !!OvuMap.graph(OvuRoom.LAYOUTS, OvuRoom.homeId()).nodes.cave})")
            check("the farm path leads to the barn yard: the barn door, the hen house, the crack and the way back; the cave is not on the map yet", yard["layout"] == "barn" and yard["hots"] == "barnexit,barndoor,hendoor,crack" and not yard["cave"], yard)
            await go_to('barninside')
            cl = await page.evaluate("()=>{OvuBarn.openClover(); var b=document.querySelector('#cloverActs [data-act=milk]'); var cow=!!document.querySelector('#ownedProps .a-clover'); if(b) b.click(); return {cow: cow, milk: OvuFarm.farmState(OvuStore).pantry.milk, stam: OvuStamina.value()}}")
            check("inside the barn Clover stands in her stall; milking puts a pail in the pantry for a little energy", cl["cow"] and cl["milk"] == 1 and cl["stam"] == 100 - 2, cl)
            tr = await page.evaluate("()=>{var f=OvuFarm.farmState(OvuStore); f.harvest={carrot:1}; OvuStore.setState({farm:f}); OvuBarn.openClover(); var b=document.querySelector('#cloverActs [data-act=treat][data-crop=carrot]'); var had=!!b; if(b) b.click(); var f2=OvuFarm.farmState(OvuStore); return {had: had, left: f2.harvest.carrot||0, today: OvuBarn.treatedToday(OvuStore,'clover',OvuGameTime.dayKey()), toast: document.querySelector('#toast').textContent, line: /had a treat/.test(document.querySelector('#sheet').textContent), stam: OvuStamina.value()}}")
            check("a carrot from the basket is a treat for Clover: offered only while the basket has one, taken slowly, the basket one lighter, no energy spent", tr["had"] and tr["left"] == 0 and tr["today"] and "took the carrot" in tr["toast"] and tr["line"] and tr["stam"] == 100 - 2, tr)
            await page.evaluate("()=>OvuRoom.hideSheet()"); await go_to('barn'); await go_to('heninside')
            hn = await page.evaluate("()=>{var eggs=document.querySelectorAll('#ownedProps .nestegg').length, hens=document.querySelectorAll('#ownedProps .animal').length; OvuBarn.openNests(); var b=document.querySelector('#nestActs [data-act=eggs]'); if(b) b.click(); return {eggs: eggs, hens: hens, pantry: OvuFarm.farmState(OvuStore).pantry.egg, left: document.querySelectorAll('#ownedProps .nestegg').length}}")
            check("inside the hen house two hens and two eggs; collecting takes both into the pantry and empties the nests", hn["hens"] == 2 and hn["eggs"] == 2 and hn["pantry"] == 2 and hn["left"] == 0, hn)
            await page.evaluate("()=>OvuRoom.hideSheet()"); await go_to('barn')
            await page.evaluate("()=>OvuBarn.openCrack()"); await page.wait_for_timeout(200)
            await page.click('#crackGo')
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'cave'", timeout=12000)
            except Exception: pass
            await page.wait_for_timeout(600)
            cv = await page.evaluate("()=>{var st=JSON.stringify(OvuStore.state().stamina), d=OvuStore.list().length; OvuBarn.openBasket(); var b=document.querySelector('#basketActs [data-act=cook]'); if(b) b.click(); var p=OvuFarm.farmState(OvuStore).pantry; return {layout: document.querySelector('#scene').dataset.layout, map: !!OvuMap.graph(OvuRoom.LAYOUTS, OvuRoom.homeId()).nodes.cave, onsen: p.onsenegg, eggs: p.egg, sameEnergy: JSON.stringify(OvuStore.state().stamina) === st, sameDiary: OvuStore.list().length === d, done: !!document.querySelector('#cookDone'), primary: (document.querySelector('#cookDone')||{}).className||''}}")
            check("stepping through the crack finds the hidden spring, which then shows on the map; onsen eggs change no energy or diary, and Done comes first", cv["layout"] == "cave" and cv["map"] and cv["onsen"] == 2 and cv["eggs"] == 0 and cv["sameEnergy"] and cv["sameDiary"] and cv["done"] and "primary" in cv["primary"], cv)
            await page.click('#cookDone')
            # the hidden spring (21 Oct): sitting by the water is the tone; one Stop for both; no diary, no hearts, no energy
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('warmstone'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId && OvuRoom.sheetId()==='cavetones'", timeout=12000)
            except Exception: pass
            t0 = await page.evaluate("()=>({sheet: OvuRoom.sheetId && OvuRoom.sheetId(), chips: document.querySelectorAll('#toneHz .chipbtn').length, claim: /love|repair|DNA|heal/i.test(document.querySelector('#sheet').textContent), btn: document.querySelector('#toneActs .btn').textContent.trim(), hearts: OvuRewards.ledger().hearts, e: OvuStamina.value(), d: OvuStore.list().length})")
            await page.click("#toneHz .chipbtn[data-hz='396']"); await page.click("#toneMin .chipbtn[data-min='10']"); await page.click("#toneActs [data-tone=start]"); await page.wait_for_timeout(300)
            try: await page.wait_for_function("()=>OvuSeats.fxKind()==='crystals' && document.querySelectorAll('#seatfx .glint').length === 7", timeout=4000)
            except Exception: pass
            t1 = await page.evaluate("(t0)=>({playing: OvuTones.playing(), rem: OvuTones.remaining(), sitting: OvuTones.sitting(), stop: document.querySelector('#springStop') && document.querySelector('#springStop').textContent.trim(), sheet: OvuRoom.sheetOpen(), fx: OvuSeats.fxKind(), glints: document.querySelectorAll('#seatfx .glint').length, pill: !!document.querySelector('#tonePill'), hearts: OvuRewards.ledger().hearts - t0.hearts, e: OvuStamina.value() - t0.e, d: OvuStore.list().length - t0.d})", t0)
            await page.click('#springStop'); await page.wait_for_timeout(300)
            t2 = await page.evaluate("()=>({playing: OvuTones.playing(), sitting: OvuTones.sitting(), stop: !!document.querySelector('#springStop'), fx: OvuSeats.fxKind()})")
            check("the warm stone offers nine pitches and a length with no promises; Sit by the water hums at the chosen pitch for the chosen time with her seated and crystal glints; one Stop sound and stand up ends both; nothing is written, paid or spent", t0["sheet"] == "cavetones" and t0["chips"] == 9 and not t0["claim"] and t0["btn"].endswith("Sit by the water") and t1["playing"] == 396 and 590 <= t1["rem"] <= 600 and t1["sitting"] and t1["stop"].endswith("Stop sound and stand up") and not t1["sheet"] and t1["fx"] == "crystals" and t1["glints"] == 7 and not t1["pill"] and t1["hearts"] == 0 and t1["e"] >= 0 and t1["d"] == 0 and t2["playing"] is None and not t2["sitting"] and not t2["stop"] and t2["fx"] is None, {"t0": t0, "t1": t1, "t2": t2})
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('crystals'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId && OvuRoom.sheetId()==='cavetones'", timeout=12000)
            except Exception: pass
            await page.click("#toneActs [data-tone=start]"); await page.wait_for_timeout(300)
            tc = await page.evaluate("()=>({playing: OvuTones.playing(), sitting: OvuTones.sitting()})")
            check("the crystals open the same seat, and she sits with the sound again", tc["playing"] == 396 and tc["sitting"], tc)
            await page.evaluate("()=>{OvuCare.slowMs = null}")
            tb = await page.evaluate("()=>OvuTones.playing()")
            await go_to('barn'); await go_to('farm')
            ta = await page.evaluate("()=>({playing: OvuTones.playing(), sitting: OvuTones.sitting()})")
            check("a tone left humming stops, and she is up, as soon as she leaves the spring", tb == 396 and ta["playing"] is None and not ta["sitting"], {"before": tb, "after": ta})
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('farmgate'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'garden'", timeout=12000)
            except Exception: pass
            back = await page.evaluate("()=>document.querySelector('#scene').dataset.layout")
            check("the farm gate leads back to the garden", back == "garden", back)
            # the harbour (21 Oct): steps down from the farm; catch-and-release fishing with no clock; a catch book; a bench
            await go_to('farm')
            await page.evaluate("()=>{OvuCare.slowMs = 0; window.__rnd = Math.random; Math.random = function(){ return 0; }; OvuRoom.tap(OvuRoom.hotspot('harboursteps'))}")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'harbour'", timeout=15000)
            except Exception: pass
            await page.wait_for_timeout(600)
            hb = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, hots: [...document.querySelectorAll('.hotspot')].map(h=>h.dataset.id).join(','), map: !!OvuMap.graph(OvuRoom.LAYOUTS, OvuRoom.homeId()).nodes.harbour, img: document.querySelector('#roomDay').getAttribute('src')||''})")
            check("the farm's steps lead down to the harbour: the jetty, the rocks, the bench, the hut, the signpost to Harbour Lane and the way back; the harbour is on the map", hb["layout"] == "harbour" and hb["hots"] == "harbourexit,hbjetty,hbrocks,hbbench,hbhut,hblane" and hb["map"] and "harbour-v1" in hb["img"], hb)
            base = await page.evaluate("()=>({e: OvuStamina.value(), d: OvuStore.list().length})")
            await page.evaluate("()=>{OvuHarbour.openSpot('jetty'); document.querySelector('#spotActs [data-act=cast]').click();}"); await page.wait_for_timeout(400)
            bt = await page.evaluate("()=>({bite: document.querySelector('#scene').classList.contains('bite'), line: !!document.querySelector('#ownedProps .castline'), lift: !!document.querySelector('#spotActs [data-bite=lift]'), leave: !!document.querySelector('#spotActs [data-bite=leave]'), casts: OvuHarbour.harbourState(OvuStore).casts})")
            check("a cast puts a line and a float on the water; when a fish comes, Lift gently and Let it be wait with no clock, and nothing is written yet", bt["bite"] and bt["line"] and bt["lift"] and bt["leave"] and bt["casts"] == 0, bt)
            await page.click("#spotActs [data-bite=lift]"); await page.wait_for_timeout(400)
            rv = await page.evaluate("(b)=>({first: /First time/.test(document.querySelector('#sheet').textContent), fact: !!document.querySelector('#sheet .fishfact'), src: !!document.querySelector('#sheet .fishsrc'), img: (document.querySelector('#sheet .fishcard img')||{}).naturalWidth||0, line: !!document.querySelector('#ownedProps .castline'), book: Object.keys(OvuHarbour.harbourState(OvuStore).book), spent: b.e - OvuStamina.value(), diary: OvuStore.list().length - b.d, go: !!document.querySelector('#fishGo')})", base)
            check("lifting shows the fish with its fact and source, writes a first meeting in the book, charges one cast of energy, takes the line in, and writes no diary entry", rv["first"] and rv["fact"] and rv["src"] and rv["img"] > 0 and not rv["line"] and len(rv["book"]) == 1 and rv["spent"] == 3 and rv["diary"] == 0 and rv["go"], rv)
            await page.click("#fishGo"); await page.wait_for_timeout(300)
            await page.evaluate("()=>document.querySelector('#spotActs [data-act=cast]').click()"); await page.wait_for_timeout(300)
            await page.click("#spotActs [data-bite=leave]"); await page.wait_for_timeout(300)
            lv = await page.evaluate("()=>({casts: OvuHarbour.harbourState(OvuStore).casts, cast: !!document.querySelector('#spotActs [data-act=cast]'), line: !!document.querySelector('#ownedProps .castline'), e: OvuStamina.value()})")
            check("Let it be reels in nothing: no cast counted, no energy spent, the line in, and Cast back on offer", lv["casts"] == 1 and lv["cast"] and not lv["line"] and lv["e"] == base["e"] - 3, lv)
            await page.evaluate("()=>OvuHarbour.openBook(null)"); await page.wait_for_timeout(300)
            bk = await page.evaluate("()=>({met: document.querySelectorAll('.bookrow:not(.unseen)').length, unseen: document.querySelectorAll('.bookrow.unseen').length, sub: document.querySelector('#sheet .sheet-head').textContent, complete: /complete/.test(document.querySelector('#sheet').textContent)})")
            check("the catch book shows one kind met and five not met, says 1 of 6, and says there is nothing to complete", bk["met"] == 1 and bk["unseen"] == 5 and "1 of 6" in bk["sub"] and bk["complete"], bk)
            await page.evaluate("()=>{OvuRoom.hideSheet(); OvuHarbour.sitDown()}"); await page.wait_for_timeout(300)
            sb = await page.evaluate("()=>({sitting: OvuHarbour.sitting(), stop: !!document.querySelector('#benchStop')})")
            await page.click('#benchStop'); await page.wait_for_timeout(200)
            sb["after"] = await page.evaluate("()=>OvuHarbour.sitting()")
            check("the bench watches the water with a real Stop watching button, and Stop stands her up", sb["sitting"] and sb["stop"] and not sb["after"], sb)
            # Harbour Lane (21 Oct): the signpost opens the lane; the grocer sells seeds and swaps, Bait & Fin sells floats, the gym opens the movement log, the post box keeps letters sealed
            lane_base = await page.evaluate("()=>({d: OvuStore.list().length, farm: JSON.stringify(OvuStore.state().farm||null), lane: JSON.stringify(OvuStore.state().lane||null)})")
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('hblane'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='lane'", timeout=12000)
            except Exception: pass
            ln = await page.evaluate("()=>({id: OvuRoom.sheetId(), places: [...document.querySelectorAll('#sheet .lane [data-place]')].map(b=>b.dataset.place).join(','), post: /Always open/.test(document.querySelector('#sheet .lane [data-place=post]').textContent)})")
            check("the signpost by the hut opens Harbour Lane: the grocer, the boutique, the gym, the fish store and the post box, which is always open", ln["id"] == "lane" and ln["places"] == "grocer,boutique,gym,fish,post" and ln["post"], ln)
            await page.evaluate("()=>{var f=OvuFarm.farmState(OvuStore); f.harvest={}; OvuStore.setState({farm:f})}")
            await page.click("#sheet .lane [data-place=grocer]"); await page.wait_for_timeout(300)
            gr = await page.evaluate("()=>{var f0=OvuFarm.farmState(OvuStore), r0=f0.seeds.radish||0; var p=document.querySelector('#grocerBuy [data-pack=radish]'); var packs=document.querySelectorAll('#grocerBuy [data-pack]').length, unlocks=document.querySelectorAll('#grocerBuy [data-unlock]').length; if(p) p.click(); return {id: OvuRoom.sheetId(), packs: packs, unlocks: unlocks, gained: (OvuFarm.farmState(OvuStore).seeds.radish||0) - r0, empty: /Nothing to swap yet/.test(document.querySelector('#sheet').textContent)}}")
            check("Hay & Harvest sells a pack for every crop she grows and four local crops (lemongrass moved to the greenhouse); a radish pack puts three seeds in the shed; an empty basket has nothing to swap", gr["id"] == "lane-grocer" and gr["packs"] >= 5 and gr["unlocks"] == 4 and gr["gained"] == 3 and gr["empty"], gr)
            await page.evaluate("()=>{var f=OvuFarm.farmState(OvuStore); f.harvest={radish:3}; OvuStore.setState({farm:f}); OvuLane.openGrocer()}"); await page.wait_for_timeout(200)
            await page.click("#swapGive [data-give=radish]"); await page.wait_for_timeout(200)
            sw = await page.evaluate("()=>{var c0=OvuFarm.farmState(OvuStore).seeds.carrot||0, h0=OvuRewards.ledger().hearts; var t=document.querySelector('#swapTake [data-take=carrot]'); if(t) t.click(); var f=OvuFarm.farmState(OvuStore); return {take: !!t, carrot: (f.seeds.carrot||0) - c0, radish: f.harvest.radish||0, hearts: OvuRewards.ledger().hearts - h0}}")
            check("the seed swap: choose three radishes, take a carrot seed; the basket gives three, the shed gains one, no hearts change hands", sw["take"] and sw["carrot"] == 1 and sw["radish"] == 0 and sw["hearts"] == 0, sw)
            await page.evaluate("()=>{var f=OvuFarm.farmState(OvuStore); f.harvest={ginger:3}; OvuStore.setState({farm:f}); OvuLane.openGrocer()}"); await page.wait_for_timeout(200)
            await page.click("#swapGive [data-give=ginger]"); await page.wait_for_timeout(200)
            hsw = await page.evaluate("()=>{var p0=OvuGreenhouse.herbState(OvuStore).seeds.pandan||0, h0=OvuRewards.ledger().hearts; var t=document.querySelector('#swapTake [data-take=pandan]'); if(t) t.click(); return {take: !!t, pandan: (OvuGreenhouse.herbState(OvuStore).seeds.pandan||0) - p0, ginger: OvuFarm.farmState(OvuStore).harvest.ginger||0, hearts: OvuRewards.ledger().hearts - h0}}")
            check("herbs count at the swap: three ginger for a pandan start for the greenhouse, no hearts", hsw["take"] and hsw["pandan"] == 1 and hsw["ginger"] == 0 and hsw["hearts"] == 0, hsw)
            await page.click("#sheet [data-lane=back]"); await page.wait_for_timeout(200)
            await page.click("#sheet .lane [data-place=fish]"); await page.wait_for_timeout(300)
            await page.click("#floatList [data-float=mint]"); await page.wait_for_timeout(300)
            fs_ = await page.evaluate("()=>({id: OvuRoom.sheetId(), floats: document.querySelectorAll('#floatList [data-float]').length, using: OvuLane.floatOf(OvuStore).id, on: (document.querySelector('#floatList [data-float=mint]')||{}).getAttribute && document.querySelector('#floatList [data-float=mint]').getAttribute('aria-pressed'), aquarium: !!document.querySelector('#sheet [data-rail=aquarium][disabled]')})")
            await page.evaluate("()=>{OvuHarbour.openSpot('jetty'); document.querySelector('#spotActs [data-act=cast]').click();}"); await page.wait_for_timeout(400)
            fs_["line"] = await page.evaluate("()=>{var f=document.querySelector('#ownedProps .castline .float'); return f ? f.style.getPropertyValue('--floatc') : ''}")
            await page.evaluate("()=>{var b=document.querySelector('#spotActs [data-bite=leave]'); if(b) b.click()}"); await page.wait_for_timeout(200)
            check("Bait & Fin: five floats, a mint one bought goes on the line at once and the float on the water is mint; the aquarium waits for its art", fs_["id"] == "lane-fish" and fs_["floats"] == 5 and fs_["using"] == "mint" and fs_["on"] == "true" and fs_["aquarium"] and fs_["line"].strip() == "#8fd1b5", fs_)
            await page.evaluate("()=>OvuLane.openPlace('boutique')"); await page.wait_for_timeout(200)
            bq = await page.evaluate("()=>({id: OvuRoom.sheetId(), rail: document.querySelectorAll('#railList [data-rail][disabled]').length})")
            await page.click("#fitRoom"); await page.wait_for_timeout(200)
            bq["fit"] = await page.evaluate("()=>OvuRoom.sheetId()")
            check("Petal & Thread: the new rail waits for its art and cannot be bought; the fitting room is her wardrobe", bq["id"] == "lane-boutique" and bq["rail"] == 2 and bq["fit"] == "wardrobe", bq)
            await page.evaluate("()=>OvuLane.openPlace('gym')"); await page.wait_for_timeout(200)
            gy = await page.evaluate("()=>({id: OvuRoom.sheetId(), st: document.querySelectorAll('#gymList [data-station]').length})")
            await page.click("#gymList [data-station=treadmill]"); await page.wait_for_timeout(300)
            gy.update(await page.evaluate("(b)=>({move: OvuRoom.sheetId(), walk: !!document.querySelector('#mvActs .mvact.on[data-mact=walk]'), diary: OvuStore.list().length - b.d})", lane_base))
            check("Tideline Gym: four free stations; the treadmill opens the movement log with walking chosen, and nothing is logged for her", gy["id"] == "lane-gym" and gy["st"] == 4 and gy["move"] == "move" and gy["walk"] and gy["diary"] == 0, gy)
            await page.evaluate("()=>OvuLane.openPlace('post')"); await page.wait_for_timeout(200)
            await page.fill("#letterText", "Dear me, be gentle."); await page.click("#letterSend"); await page.wait_for_timeout(300)
            pb = await page.evaluate("()=>{var st=OvuLane.laneState(OvuStore), L=st.letters[0]; return {id: OvuRoom.sheetId(), n: st.letters.length, opens: L && L.opens, want: OvuStore.addDays(OvuStore.today(), 7), sealed: document.querySelectorAll('#lettersOut .letterrow.sealed').length, readBtn: document.querySelectorAll('#lettersOut [data-read]').length, hidden: !/be gentle/.test(document.querySelector('#lettersOut').textContent)}}")
            check("the post box: a letter to future you is posted for a week on, listed sealed with no Read button and its words hidden", pb["id"] == "lane-post" and pb["n"] == 1 and pb["opens"] == pb["want"] and pb["sealed"] == 1 and pb["readBtn"] == 0 and pb["hidden"], pb)
            await page.evaluate("()=>{var st=OvuLane.laneState(OvuStore); st.letters.push({id:'larrived', written: OvuStore.addDays(OvuStore.today(), -7), opens: OvuStore.today(), text:'Hello from last week.'}); OvuStore.setState({lane: st}); OvuLane.openPost()}"); await page.wait_for_timeout(200)
            pr = await page.evaluate("()=>({due: OvuLane.unread(OvuStore, OvuStore.today()).length, read: !!document.querySelector('#lettersIn [data-read=larrived]')})")
            await page.evaluate("()=>{OvuRoom.hideSheet(); OvuLane.openLane()}"); await page.wait_for_timeout(200)
            pr["badge"] = await page.evaluate("()=>!!document.querySelector('#sheet .lane [data-place=post] .postnew')")
            await page.evaluate("()=>OvuLane.openPost()"); await page.wait_for_timeout(200)
            await page.click("#lettersIn [data-read=larrived]"); await page.wait_for_timeout(300)
            pr.update(await page.evaluate("()=>({id: OvuRoom.sheetId(), text: (document.querySelector('#sheet .letterbody')||{}).textContent||'', after: OvuLane.unread(OvuStore, OvuStore.today()).length})"))
            check("a letter on its day is post for her (the lane says so); Read opens it and it is no longer new", pr["due"] == 1 and pr["read"] and pr["badge"] and pr["id"] == "lane-letter" and pr["text"] == "Hello from last week." and pr["after"] == 0, pr)
            await page.evaluate("()=>OvuLane.openPost()"); await page.wait_for_timeout(200)
            await page.click("#lettersIn [data-del=larrived]"); await page.click("#lettersIn [data-del=larrived]"); await page.wait_for_timeout(300)
            dl = await page.evaluate("(b)=>({left: OvuLane.laneState(OvuStore).letters.map(x=>x.id), diary: OvuStore.list().length - b.d})", lane_base)
            check("Delete takes two taps and removes the letter; nothing on the lane wrote a diary entry", "larrived" not in dl["left"] and len(dl["left"]) == 1 and dl["diary"] == 0, dl)
            await page.evaluate("(b)=>{OvuRoom.hideSheet(); OvuStore.setState({farm: JSON.parse(b.farm), lane: JSON.parse(b.lane)})}", lane_base); await page.wait_for_timeout(200)
            await page.evaluate("()=>{Math.random = window.__rnd; OvuCare.slowMs = null; OvuRoom.tap(OvuRoom.hotspot('harbourexit'))}")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'farm'", timeout=12000)
            except Exception: pass
            hx = await page.evaluate("()=>document.querySelector('#scene').dataset.layout")
            check("the harbour path leads back up to the farm", hx == "farm", hx)
            # the farm kitchen (21 Oct): the basket offers Cook a dish; four guided steps with Stop; the dish asks "Did you eat something like this today?"; Yes fills the food diary in and saves nothing, No opens nothing; the grocer sells staples
            kc_base = await page.evaluate("()=>({d: OvuStore.list().length, farm: JSON.stringify(OvuStore.state().farm||null), stamina: JSON.stringify(OvuStore.state().stamina||null), hearts: OvuRewards.ledger().hearts})")
            await page.evaluate("()=>{var f=OvuFarm.farmState(OvuStore); f.harvest={tomato:4}; f.pantry.egg=2; f.kitchen={rice:2}; OvuStore.setState({farm:f}); OvuRoom.tap(OvuRoom.hotspot('basket'))}")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='farmbasket'", timeout=12000)
            except Exception: pass
            kb = await page.evaluate("()=>({id: OvuRoom.sheetId(), cook: !!document.querySelector('#basketCook')})")
            await page.click("#basketCook"); await page.wait_for_timeout(200)
            kl = await page.evaluate("()=>({id: OvuRoom.sheetId(), n: document.querySelectorAll('#kitchenList [data-recipe]').length, ready: [...document.querySelectorAll('#kitchenList [data-recipe]:not([disabled])')].map(b=>b.dataset.recipe).join(','), herb: /greenhouse/.test((document.querySelector('#kitchenList [data-recipe=pandanrice]')||{}).textContent||'') && !!document.querySelector('#kitchenList [data-recipe=pandanrice][disabled]'), fish: /fish/i.test(document.querySelector('#kitchenList').textContent)})")
            check("the farm basket offers Cook a dish; the kitchen lists ten dishes, tomato and egg ready, pandan rice waiting for pandan from the greenhouse, and no fish", kb["id"] == "farmbasket" and kb["cook"] and kl["id"] == "kitchen" and kl["n"] == 10 and kl["ready"] == "tomatoegg" and kl["herb"] and not kl["fish"], [kb, kl])
            await page.evaluate("()=>{OvuCare.slowMs = 4000}")
            await page.click("#kitchenList [data-recipe=tomatoegg]"); await page.wait_for_timeout(200)
            await page.click("#cookBegin"); await page.wait_for_timeout(300)
            ks = await page.evaluate("()=>({id: OvuRoom.sheetId(), on: (document.querySelector('#cookSteps li.on b')||{}).textContent, stop: !!document.querySelector('#cookActs [data-slow=stop]'), line: (document.querySelector('#cookActs .mindline')||{}).textContent||''})")
            await page.click("#cookActs [data-slow=stop]"); await page.wait_for_timeout(200)
            ks.update(await page.evaluate("(b)=>{var f=OvuFarm.farmState(OvuStore); return {after: OvuRoom.sheetId(), begin: !!document.querySelector('#cookBegin'), tomato: f.harvest.tomato, egg: f.pantry.egg, rice: f.kitchen.rice}}", kc_base))
            check("cooking begins with Wash, a mindful line and Stop; Stop goes back to the recipe and uses nothing", ks["id"] == "kitchen-recipe" and ks["on"] == "Wash" and ks["stop"] and len(ks["line"]) > 10 and ks["after"] == "kitchen-recipe" and ks["begin"] and ks["tomato"] == 4 and ks["egg"] == 2 and ks["rice"] == 2, ks)
            await page.evaluate("()=>{OvuCare.slowMs = 0}")
            await page.click("#cookBegin"); await page.wait_for_timeout(300)
            kd = await page.evaluate("(b)=>{var f=OvuFarm.farmState(OvuStore); return {id: OvuRoom.sheetId(), ask: /Did you eat something like this today[?]/.test(document.querySelector('#sheet').textContent), line: (document.querySelector('#sheet .mindline')||{}).textContent||'', tomato: f.harvest.tomato, egg: f.pantry.egg, rice: f.kitchen.rice, diary: OvuStore.list().length - b.d, hearts: OvuRewards.ledger().hearts - b.hearts, stamina: JSON.stringify(OvuStore.state().stamina||null) === b.stamina}}", kc_base)
            check("the four steps end with the dish and the question; the dish used two tomatoes, an egg and the rice in one save; no hearts, no energy, no diary entry", kd["id"] == "kitchen-dish" and kd["ask"] and len(kd["line"]) > 10 and kd["tomato"] == 2 and kd["egg"] == 1 and kd["rice"] == 1 and kd["diary"] == 0 and kd["hearts"] == 0 and kd["stamina"], kd)
            await page.click("#dishNo"); await page.wait_for_timeout(200)
            kn = await page.evaluate("(b)=>({open: OvuRoom.sheetOpen(), diary: OvuStore.list().length - b.d})", kc_base)
            check("No opens nothing and logs nothing", not kn["open"] and kn["diary"] == 0, kn)
            await page.evaluate("()=>{OvuKitchen.openRecipe('tomatoegg')}"); await page.wait_for_timeout(200)
            await page.click("#cookBegin"); await page.wait_for_timeout(300)
            await page.click("#dishYes"); await page.wait_for_timeout(400)
            ky = await page.evaluate("(b)=>({id: OvuRoom.sheetId(), notes: (document.querySelector('#fdFoods')||{}).value, tag: !!document.querySelector('#tagChips [data-tag=home-cooked].on'), diary: OvuStore.list().length - b.d})", kc_base)
            check("Yes opens the food diary with the dish and Home-cooked filled in, and nothing is saved until she saves it", ky["id"] == "diary" and ky["notes"] == "Tomato and egg, cooked at home" and ky["tag"] and ky["diary"] == 0, ky)
            await page.evaluate("()=>{OvuRoom.hideSheet(); OvuCare.slowMs = null; OvuLane.openPlace('grocer')}"); await page.wait_for_timeout(300)
            kg = await page.evaluate("()=>{var g0=OvuFarm.farmState(OvuStore).kitchen.garlic||0, e0=OvuFarm.farmState(OvuStore).pantry.egg; var n=document.querySelectorAll('#grocerStaples [data-staple]').length; var b=document.querySelector('#grocerStaples [data-staple=garlic]'); if(b) b.click(); var e=document.querySelector('#grocerStaples [data-staple=egg]'); if(e) e.click(); var f=OvuFarm.farmState(OvuStore); return {id: OvuRoom.sheetId(), n: n, garlic: (f.kitchen.garlic||0) - g0, egg: f.pantry.egg - e0}}")
            check("Hay & Harvest sells eight kitchen staples; garlic goes to the kitchen and an egg to the barn's pantry", kg["id"] == "lane-grocer" and kg["n"] == 8 and kg["garlic"] == 1 and kg["egg"] == 1, kg)
            await page.evaluate("()=>{OvuRoom.hideSheet(); OvuWalk.travel('familyhome', {visit: true})}")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='familyhome' && !document.querySelector('#scene').classList.contains('fading')", timeout=12000)
            except Exception: pass
            await page.wait_for_timeout(400)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('stove'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='kitchen'", timeout=12000)
            except Exception: pass
            kh = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, id: OvuRoom.sheetId(), other: ['room','house','bathhouse'].some(id=>OvuRoom.LAYOUTS[id].hotspots.some(x=>x.id==='stove'))})")
            check("in the family home a tap on the stove walks her over and opens the kitchen; no other home has a stove", kh["layout"] == "familyhome" and kh["id"] == "kitchen" and not kh["other"], kh)
            await page.evaluate("(b)=>{OvuRoom.hideSheet(); OvuStore.setState({farm: JSON.parse(b.farm)})}", kc_base); await page.wait_for_timeout(200)
            await go_to('farm')
            # seats (21 Oct): each bench its own practice in Erin's voice and its own small weather; a minute before anything is saved; one thank-you a day per seat
            await go_to('street')
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bench'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-street'", timeout=12000)
            except Exception: pass
            sh = await page.evaluate("()=>({id: OvuRoom.sheetId(), name: document.querySelector('#sheet .erin b').textContent, sit: document.querySelector('#seatSit').textContent.trim(), help: document.querySelector('#sheet .help').textContent, hearts: OvuRewards.ledger().hearts, n: OvuStore.list('mindfulness').length, pts: (function(){var m = OvuRewards.ledger().mindDay; return m && m.day === OvuStore.today() ? m.pts : 0})()})")
            exp_hearts = min(2, max(0, 20 - sh["pts"]))  # the flat practice points inside the day's cap of twenty (22 Oct), however much earlier checks already earned
            await page.click('#seatBegin'); await page.wait_for_timeout(500)
            sb1 = await page.evaluate("()=>({st: OvuSeats.state(), panel: !document.querySelector('#spanel').hidden, count: document.querySelector('#spCount').textContent, btns: [...document.querySelectorAll('#spBtns button')].map(b=>b.textContent.trim()), sitter: !!document.querySelector('.seatsitter img'), hidden: document.querySelector('#avatar').classList.contains('hidden'), busy: OvuRoom.busy(), fx: OvuSeats.fxKind(), motes: document.querySelectorAll('#seatfx .mote').length, focus: document.activeElement && document.activeElement.id, pos: OvuRoom.pos()})")
            check("the street bench offers Sounds of the street in Erin's voice or just sitting, with the once-a-day note and her credit; Begin seats her on the bench with the panel (Pause, Next, Voice off, Stop), the room busy and lantern motes drifting", sh["id"] == "seat-street" and sh["name"] == "Sounds of the street" and sh["sit"].endswith("Just sit a while") and "once a day" in sh["help"] and "Erin Lee" in sh["help"] and sb1["st"]["key"] == "street0" and sb1["panel"] and sb1["count"].startswith("Step 1 of 7") and sb1["btns"] == ["Pause", "Next", "Voice off", "Stop"] and sb1["sitter"] and sb1["hidden"] and sb1["busy"] and sb1["fx"] == "lanterns" and sb1["motes"] == 12 and sb1["focus"] == "spanel", {"sh": sh, "sb1": sb1})
            await page.click('#spPause'); await page.wait_for_timeout(150)
            sp = await page.evaluate("()=>({st: OvuSeats.state(), btn: document.querySelector('#spPause').textContent})")
            await page.click('#spPause'); await page.click('#spNext'); await page.wait_for_timeout(150)
            sn = await page.evaluate("()=>OvuSeats.state()")
            await page.evaluate("()=>{OvuRoom.tap(OvuRoom.hotspot('arch'))}"); await page.wait_for_timeout(700)
            st2 = await page.evaluate("(p)=>({moved: Math.abs(OvuRoom.pos().x - p.x) + Math.abs(OvuRoom.pos().y - p.y), layout: OvuRoom.layout().id, toast: document.querySelector('#toast').textContent, run: !!OvuSeats.state()})", sb1["pos"])
            check("Pause holds the step (Resume), Next moves to the second line, and a hotspot tap while she practises moves nothing and says Stop to get up first", sp["st"]["paused"] and sp["btn"] == "Resume" and not sn["paused"] and sn["key"] == "street1" and st2["moved"] == 0 and st2["layout"] == "street" and "Stop to get up first" in st2["toast"] and st2["run"], {"sp": sp, "sn": sn, "st2": st2})
            await page.evaluate("()=>{window.__dnS = Date.now; var n0 = window.__dnS; Date.now = function(){return n0() + 70000};}")
            await page.click('#spStop'); await page.wait_for_selector('#sdYes', timeout=5000)
            ask1 = await page.evaluate("()=>({sheet: OvuRoom.sheetId(), intro: document.querySelector('.mintro').textContent, sat: OvuGarden.sitting(), fx: OvuSeats.fxKind(), panel: document.querySelector('#spanel').hidden, hidden: document.querySelector('#avatar').classList.contains('hidden'), sitter: !!document.querySelector('.seatsitter')})")
            await page.click('#sdYes'); await page.wait_for_timeout(500)
            sv1 = await page.evaluate("(a)=>{Date.now = window.__dnS; var e = OvuStore.list('mindfulness'), last = e[e.length-1]; return {n: e.length - a.n, hearts: OvuRewards.ledger().hearts - a.hearts, d: last && last.data, toast: document.querySelector('#toast').textContent}}", sh)
            check("Stop after a minute leaves her seated as on any bench and asks once, Save this minute; Yes saves one seat entry, stopped early, with the credit and the flat thank-you", ask1["sheet"] == "seatDone" and "Save this minute" in ask1["intro"] and ask1["sat"] and ask1["fx"] == "lanterns" and ask1["panel"] and not ask1["hidden"] and not ask1["sitter"] and sv1["n"] == 1 and sv1["hearts"] == exp_hearts and sv1["d"]["activity"] == "seat" and sv1["d"]["seat"] == "street" and sv1["d"]["stoppedEarly"] and sv1["d"]["seconds"] >= 70 and "Erin Lee" in sv1["d"]["guide"] and "Saved" in sv1["toast"], {"ask1": ask1, "sv1": sv1})
            await page.evaluate("()=>{OvuGarden.standUp(); OvuRoom.tap(OvuRoom.hotspot('bench'))}")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-street' && /already said today/.test(document.querySelector('#sheet .help').textContent)", timeout=12000)
            except Exception: pass
            h1 = await page.evaluate("()=>OvuRewards.ledger().hearts")
            await page.click('#seatBegin'); await page.wait_for_timeout(300)
            await page.evaluate("()=>{window.__dnS2 = Date.now; var n0 = window.__dnS2; Date.now = function(){return n0() + 65000};}")
            await page.click('#spStop'); await page.wait_for_selector('#sdYes', timeout=5000); await page.click('#sdYes'); await page.wait_for_timeout(400)
            ag = await page.evaluate("(h)=>{Date.now = window.__dnS2; return {hearts: OvuRewards.ledger().hearts - h, n: OvuStore.list('mindfulness').filter(x=>x.data.seat==='street').length}}", h1)
            await page.evaluate("()=>{OvuGarden.standUp(); OvuRoom.tap(OvuRoom.hotspot('bench'))}")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-street'", timeout=12000)
            except Exception: pass
            await page.click('#seatBegin'); await page.wait_for_timeout(300); await page.click('#spStop'); await page.wait_for_timeout(300)
            shrt = await page.evaluate("()=>({toast: document.querySelector('#toast').textContent, sat: OvuGarden.sitting(), sheet: OvuRoom.sheetId(), run: !!OvuSeats.state()})")
            check("the same bench again today says so, saves again and pays nothing more; a stop under a minute records nothing and leaves her sitting", ag["hearts"] == 0 and ag["n"] == 2 and "Nothing under a minute" in shrt["toast"] and shrt["sat"] and not shrt["sheet"] and not shrt["run"], {"ag": ag, "shrt": shrt})
            await page.evaluate("()=>OvuGarden.standUp()")
            # the plaza: a bench of its own, and sleep ends a practice with nothing asked
            await go_to('plaza')
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bench2'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-tree'", timeout=12000)
            except Exception: pass
            pzname = await page.evaluate("()=>document.querySelector('.sheet .erin b') && document.querySelector('.sheet .erin b').textContent")
            await page.click('#seatBegin'); await page.wait_for_timeout(400)
            pz = await page.evaluate("()=>({st: OvuSeats.state(), fx: OvuSeats.fxKind(), flecks: document.querySelectorAll('#seatfx .fleck').length, sparks: document.querySelectorAll('#seatfx .spark').length})")
            await page.evaluate("()=>OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}})"); await page.wait_for_timeout(400)
            pz2 = await page.evaluate("()=>({run: !!OvuSeats.state(), sitter: !!document.querySelector('.seatsitter'), hidden: document.querySelector('#avatar').classList.contains('hidden'), panel: document.querySelector('#spanel').hidden, sheet: OvuRoom.sheetOpen(), fx: OvuSeats.fxKind()})")
            await page.evaluate("()=>OvuStore.setState({sleeping:null})"); await page.wait_for_timeout(200)
            check("the bench by the tree is a seat of its own with In the shade and flecks of light, not the board bench's words; falling asleep ends the practice at once with nothing asked and nothing left behind", pzname == "In the shade" and pz["st"]["seat"] == "plaza:bench2" and pz["st"]["key"] == "tree0" and pz["fx"] == "shade" and pz["flecks"] == 14 and pz["sparks"] == 0 and not pz2["run"] and not pz2["sitter"] and not pz2["hidden"] and pz2["panel"] and not pz2["sheet"] and pz2["fx"] is None, {"pz": pz, "pz2": pz2})
            # the harbour bench with reduced motion: Just watch, still water, and the colour line instead of the ripple
            await page.emulate_media(reduced_motion="reduce")
            await go_to('harbour')
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('hbbench'))")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-harbour'", timeout=12000)
            except Exception: pass
            hs = await page.evaluate("()=>({name: document.querySelector('#sheet .erin b').textContent, sit: document.querySelector('#seatSit').textContent.trim()})")
            await page.click('#seatSit'); await page.wait_for_timeout(400)
            hw = await page.evaluate("()=>({hb: OvuHarbour.sitting(), fx: OvuSeats.fxKind(), rings: [...document.querySelectorAll('#seatfx .ring')].filter(b=>getComputedStyle(b).display!=='none').length, anim: document.querySelector('#seatfx .streak') && getComputedStyle(document.querySelector('#seatfx .streak')).animationName})")
            await page.evaluate("()=>{OvuHarbour.standUp(); OvuRoom.tap(OvuRoom.hotspot('hbbench'))}")
            try: await page.wait_for_function("()=>OvuRoom.sheetOpen() && OvuRoom.sheetId()==='seat-harbour'", timeout=12000)
            except Exception: pass
            await page.click('#seatBegin'); await page.wait_for_timeout(300); await page.click('#spNext'); await page.wait_for_timeout(200)
            hr = await page.evaluate("()=>({st: OvuSeats.state(), text: document.querySelector('#spText').textContent})")
            await page.click('#spStop'); await page.wait_for_timeout(300)
            hr2 = await page.evaluate("()=>({hb: OvuHarbour.sitting(), run: !!OvuSeats.state(), stop: !!document.querySelector('#benchStop')})")
            await page.evaluate("()=>OvuHarbour.standUp()"); await page.emulate_media(reduced_motion="no-preference")
            check("the harbour bench offers Watching the water or just watching; with reduced motion the water lies still (no rings, no streak animation) and the second line asks for a colour; a short stop leaves her watching", hs["name"] == "Watching the water" and hs["sit"].endswith("Just watch the water") and hw["hb"] and hw["fx"] == "water" and hw["rings"] == 0 and hw["anim"] == "none" and hr["st"]["key"] == "harbour1" and hr["text"].startswith("Notice a colour") and hr2["hb"] and not hr2["run"] and hr2["stop"], {"hs": hs, "hw": hw, "hr": hr, "hr2": hr2})
            await go_to('farm')
            await go_to('garden')
            # plaza servers, signed in: a fake session and a small fake plaza server answer the four plaza calls here;
            # nothing leaves the machine. 23 in PCOS, 2 in Everyone, Menopause full.
            seed_signed_in = "if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s); localStorage.setItem('ovumind_auth_v1', %s);" % (json.dumps(json.dumps(DB)), json.dumps(json.dumps(SESS)))
            fake = {"servers": [{"id": "pcos", "name": "PCOS", "blurb": "Living with polycystic ovary syndrome", "capacity": 24, "open": True, "people": 23}, {"id": "everyone", "name": "Everyone", "capacity": 24, "open": True, "people": 2}, {"id": "menopause", "name": "Menopause", "capacity": 24, "open": True, "people": 24}], "mine": None, "visit": None, "seq": 0}
            pcalls, pauth, p_other, p_errors, pvisits = [], [], [], [], []
            def fsrv(i): return [s for s in fake["servers"] if s["id"] == i][0]
            async def plaza_gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url: return await route.fulfill(status=200, content_type="text/css", body="")
                m = re.search(r"/rest/v1/rpc/(plaza_[a-z]+)", url)
                if not m:
                    p_other.append(url); return await route.fulfill(status=200, content_type="application/json", body="{}")
                name = m.group(1); body = json.loads(route.request.post_data or "{}"); pcalls.append((name, body.get("p_server"))); pauth.append(route.request.headers.get("authorization", ""))
                if name == "plaza_list": out = {"servers": fake["servers"], "mine": fake["mine"], "beat_seconds": 25}
                elif name == "plaza_join":
                    s = fsrv(body["p_server"])
                    if fake["mine"] == s["id"]: out = {"ok": True, "server": s["id"], "name": s["name"], "capacity": 24, "people": s["people"], "visit": fake["visit"], "beat_seconds": 25}
                    elif s["people"] >= s["capacity"]: out = {"ok": False, "why": "full", "server": s["id"], "name": s["name"], "capacity": 24, "people": s["people"], "suggest": {"id": "everyone", "name": "Everyone"}}
                    else:
                        if fake["mine"]: fsrv(fake["mine"])["people"] -= 1
                        s["people"] += 1; fake["mine"] = s["id"]; fake["seq"] += 1; fake["visit"] = "v%d" % fake["seq"]
                        out = {"ok": True, "server": s["id"], "name": s["name"], "capacity": 24, "people": s["people"], "visit": fake["visit"], "beat_seconds": 25}
                elif name == "plaza_beat":
                    if fake["mine"] == body.get("p_server") and fake["visit"] == body.get("p_visit"): out = {"ok": True, "server": body["p_server"], "visit": body["p_visit"], "people": fsrv(body["p_server"])["people"]}
                    elif fake["mine"]: out = {"ok": False, "displaced": True}
                    else: out = {"ok": False, "rejoin": True}
                else:
                    pvisits.append(body.get("p_visit"))
                    if fake["mine"] and body.get("p_server") in (None, fake["mine"]) and body.get("p_visit") in (None, fake["visit"]):
                        fsrv(fake["mine"])["people"] -= 1; fake["mine"] = None; fake["visit"] = None
                    out = {"ok": True}
                if name == "plaza_join" and fake.get("delay"): await asyncio.sleep(fake["delay"])
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps(out))
            ctx4 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx4.add_init_script(seed_signed_in)
            p4 = await ctx4.new_page(); await p4.route("**/*", plaza_gate)
            p4.on("pageerror", lambda e: p_errors.append("pageerror: " + str(e)))
            p4.on("console", lambda m: p_errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text else None)
            await p4.goto(BASE + "room.html", wait_until="networkidle"); await p4.wait_for_selector(".hotspot"); await p4.wait_for_timeout(600)
            await p4.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return !!OvuStore.state().sleeping}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuRoom.closeSheet && OvuRoom.closeSheet();}")
            await p4.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump
            try: await p4.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && /online/.test((document.querySelector('#plazaPill')||{}).textContent||'')", timeout=12000)
            except Exception: pass
            pa = await p4.evaluate("()=>({text: document.querySelector('#plazaPill').textContent, shown: !document.querySelector('#plazaPill').hidden})")
            check("signed in, the plaza pill counts everyone online across the three plazas", pa["shown"] and "Choose a group · 49 online" in pa["text"] and ("plaza_list", None) in pcalls, {"pill": pa, "calls": pcalls[:4]})
            await p4.click('#plazaPill')
            try: await p4.wait_for_selector('#plazaList .plazarow', timeout=6000)
            except Exception: pass
            rows = await p4.evaluate("()=>[...document.querySelectorAll('#plazaList .plazarow')].map(r=>({t:r.querySelector('.pn').textContent, b:r.querySelector('button').textContent, d:r.querySelector('button').disabled}))")
            check("the chooser lists PCOS 23 of 24, Everyone 2 of 24 and Menopause full (its button off)", len(rows) == 3 and "23 of 24" in rows[0]["t"] and not rows[0]["d"] and "2 of 24" in rows[1]["t"] and rows[2]["b"] == "Full" and rows[2]["d"], rows)
            await p4.click('#plazaList [data-join=pcos]')
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='pcos'", timeout=6000)
            except Exception: pass
            jn = await p4.evaluate("()=>({st: OvuPlaza.state(), pill: document.querySelector('#plazaPill').textContent, saved: (OvuStore.state().plaza||{}).server, here: !!document.querySelector('#plazaList .plazarow.here')})")
            check("joining PCOS counts her (24 now), remembers the choice and starts checking in; the row says she is here", jn["st"]["joined"] and jn["st"]["joined"]["people"] == 24 and jn["st"]["beating"] and "PCOS · 24 people here" in jn["pill"] and jn["saved"] == "pcos" and jn["here"], jn)
            check("every plaza call carries her own sign-in token, not the shared key alone", pauth and all(a == "Bearer smoke-token" for a in pauth), pauth[:3])
            await p4.evaluate("()=>OvuRoom.closeSheet()"); await p4.wait_for_timeout(300)
            await p4.evaluate("()=>OvuPlaza.join('menopause')")
            try: await p4.wait_for_function("()=>/Menopause is full/.test(document.querySelector('#toast').textContent) && !OvuPlaza.state().inflight", timeout=6000)
            except Exception: pass
            full = await p4.evaluate("()=>({toast: document.querySelector('#toast').textContent, st: OvuPlaza.state()})")
            check("a full plaza refuses kindly, names one with room, and she stays where she was", "Menopause is full right now. Everyone has room." in full["toast"] and full["st"]["joined"]["id"] == "pcos" and full["st"]["want"] == "pcos", full)
            await p4.evaluate("()=>OvuPlaza.tick()"); await p4.wait_for_timeout(400)
            check("a check-in reaches the plaza server for PCOS", ("plaza_beat", "pcos") in pcalls, pcalls[-3:])
            await p4.click('#plazaPill'); await p4.wait_for_selector('#plazaLeave'); await p4.click('#plazaLeave'); await p4.wait_for_timeout(500)
            lv = await p4.evaluate("()=>({st: OvuPlaza.state(), saved: OvuStore.state().plaza, pill: document.querySelector('#plazaPill').textContent})")
            check("Leave takes her out of PCOS by name and forgets the choice; she can still walk around", ("plaza_leave", "pcos") in pcalls and not lv["st"]["joined"] and not lv["st"]["want"] and not lv["saved"] and "Choose a group" in lv["pill"], lv)
            await p4.evaluate("()=>OvuRoom.closeSheet()"); await p4.wait_for_timeout(300)
            await p4.evaluate("()=>OvuPlaza.join('everyone')")
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='everyone'", timeout=6000)
            except Exception: pass
            n_leave = len([c for c in pcalls if c[0] == "plaza_leave"])
            await p4.evaluate("()=>OvuWalk.travel('home')")  # a test jump
            try: await p4.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='room'", timeout=10000)
            except Exception: pass
            await p4.wait_for_timeout(400)
            hm = await p4.evaluate("()=>({st: OvuPlaza.state(), saved: (OvuStore.state().plaza||{}).server, pill: document.querySelector('#plazaPill').hidden})")
            check("walking home takes her out of Everyone (she is not counted) but keeps her choice, and the pill goes away", len([c for c in pcalls if c[0] == "plaza_leave"]) == n_leave + 1 and not hm["st"]["joined"] and hm["saved"] == "everyone" and hm["pill"], hm)
            n_join = len([c for c in pcalls if c == ("plaza_join", "everyone")])
            await p4.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='everyone'", timeout=12000)
            except Exception: pass
            back = await p4.evaluate("()=>OvuPlaza.state()")
            check("walking back into the plaza rejoins the plaza she chose", back["joined"] and back["joined"]["id"] == "everyone" and len([c for c in pcalls if c == ("plaza_join", "everyone")]) == n_join + 1, back)
            await p4.evaluate("()=>OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}})"); await p4.wait_for_timeout(500)
            sl = await p4.evaluate("()=>({st: OvuPlaza.state(), pill: document.querySelector('#plazaPill').hidden})")
            check("a logged sleep takes her out of the plaza and hides the pill", not sl["st"]["joined"] and sl["pill"], sl)
            await p4.evaluate("()=>OvuStore.setState({sleeping:null})")
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='everyone'", timeout=8000)
            except Exception: pass
            check("waking up in the plaza brings her back to the plaza she chose", (await p4.evaluate("()=>(OvuPlaza.state().joined||{}).id")) == "everyone", pcalls[-3:])
            # putting the app away: a keepalive leave for Everyone, and coming back rejoins it
            n_leave = len([c for c in pcalls if c == ("plaza_leave", "everyone")])
            await p4.evaluate("()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}"); await p4.wait_for_timeout(500)
            hid = await p4.evaluate("()=>OvuPlaza.state()")
            await p4.evaluate("()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}")
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='everyone'", timeout=8000)
            except Exception: pass
            check("putting the app away takes her out (a leave naming the plaza), and coming back rejoins it", len([c for c in pcalls if c == ("plaza_leave", "everyone")]) == n_leave + 1 and not hid["joined"] and (await p4.evaluate("()=>(OvuPlaza.state().joined||{}).id")) == "everyone", {"hidden": hid, "calls": pcalls[-4:]})
            # a race: she asks for PCOS and walks out before the reply lands; once it lands the phone leaves PCOS again
            fake["delay"] = 1.2
            await p4.evaluate("()=>OvuPlaza.join('pcos')"); await p4.wait_for_timeout(150)
            await p4.evaluate("()=>OvuWalk.travel('home')")  # a test jump
            await p4.wait_for_timeout(2600); fake["delay"] = 0
            race = await p4.evaluate("()=>OvuPlaza.state()")
            seq = [c for c in pcalls if c[0] in ("plaza_join", "plaza_leave")][-3:]
            check("walking out while a join is on its way: the join lands, then a leave for that plaza follows, and the server ends with her nowhere", seq[-2:] == [("plaza_join", "pcos"), ("plaza_leave", "pcos")] and not race["joined"] and not race["inflight"] and fake["mine"] is None, {"seq": seq, "st": race, "server": fake["mine"]})
            # signing out in the plaza: the phone still says she left, with the token she last used
            await p4.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='pcos'", timeout=12000)
            except Exception: pass
            # the same account joins Menopause from another phone: this phone's next check-in is told it was displaced and it
            # steps out without taking the row back
            fsrv("pcos")["people"] -= 1; fake["mine"] = "menopause"; fake["seq"] += 1; fake["visit"] = "v%d" % fake["seq"]  # the other phone's join moves the row
            other_visit = fake["visit"]; n_join = len([c for c in pcalls if c[0] == "plaza_join"])
            await p4.evaluate("()=>OvuPlaza.tick()"); await p4.wait_for_timeout(500)
            await p4.evaluate("()=>OvuPlaza.tick()"); await p4.wait_for_timeout(400)
            dis = await p4.evaluate("()=>({st: OvuPlaza.state(), toast: document.querySelector('#toast').textContent})")
            check("two phones: the displaced phone steps out, says why, and does not take the account back", not dis["st"]["joined"] and not dis["st"]["want"] and "another device" in dis["toast"] and len([c for c in pcalls if c[0] == "plaza_join"]) == n_join and fake["mine"] == "menopause" and fake["visit"] == other_visit, {"st": dis["st"], "toast": dis["toast"], "server": [fake["mine"], fake["visit"]]})
            # a stalled request cannot leave the loop waiting: one deadline, then the next tick asks again and gets the same visit
            fake["mine"] = None; fake["visit"] = None; fsrv("menopause")["people"] -= 1
            await p4.evaluate("()=>{OvuPlaza.TIMEOUT=400;}"); fake["delay"] = 1.5
            await p4.evaluate("()=>OvuPlaza.join('everyone')"); await p4.wait_for_timeout(900)
            stall = await p4.evaluate("()=>OvuPlaza.state()")
            fake["delay"] = 0; await p4.wait_for_timeout(900)
            await p4.evaluate("()=>{OvuPlaza.TIMEOUT=10000; OvuPlaza.tick();}")
            try: await p4.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='everyone'", timeout=6000)
            except Exception: pass
            after = await p4.evaluate("()=>OvuPlaza.state()")
            check("a stalled join is cut off by the deadline (the loop is free, marked offline), and the next tick joins with the visit the server already gave", not stall["inflight"] and stall["offline"] and after["joined"] and after["joined"]["visit"] == fake["visit"] and fake["mine"] == "everyone", {"stalled": stall, "after": after, "server": [fake["mine"], fake["visit"]]})
            n_auth = len(pauth)
            await p4.evaluate("()=>OvuAuth.signOut(false)"); await p4.wait_for_timeout(800)
            so = await p4.evaluate("()=>({st: OvuPlaza.state(), pill: document.querySelector('#plazaPill').textContent, saved: OvuStore.state().plaza})")
            check("signing out takes her out of the plaza (a leave for that visit, sent with her last token) and the pill asks her to sign in", pcalls[-1][0] == "plaza_leave" and pvisits[-1] and pauth[-1] == "Bearer smoke-token" and not so["st"]["joined"] and not so["saved"] and "sign in to join" in so["pill"] and fake["mine"] is None, {"st": so, "last": pcalls[-2:]})
            # signing out while a join is on its way: once it lands, the phone undoes it with the token it went out with
            await p4.goto(BASE + "room.html", wait_until="networkidle"); await p4.wait_for_selector(".hotspot"); await p4.wait_for_timeout(500)
            await p4.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return !!OvuStore.state().sleeping}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuRoom.closeSheet && OvuRoom.closeSheet(); OvuWalk.travel('plaza');}")
            try: await p4.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && OvuPlaza.state().servers", timeout=12000)
            except Exception: pass
            fake["delay"] = 1.2
            await p4.evaluate("()=>OvuPlaza.join('everyone')"); await p4.wait_for_timeout(200)
            await p4.evaluate("()=>OvuAuth.signOut(false)"); await p4.wait_for_timeout(2500); fake["delay"] = 0
            seq2 = [c for c in pcalls if c[0] in ("plaza_join", "plaza_leave")][-2:]
            check("signing out while a join is on its way: the join lands, then a leave for exactly that visit follows with her token, and the server ends with her nowhere", seq2 == [("plaza_join", "everyone"), ("plaza_leave", "everyone")] and pvisits[-1] and pauth[-1] == "Bearer smoke-token" and fake["mine"] is None, {"seq": seq2, "server": fake["mine"], "visit": pvisits[-1:]})
            # (Codex pre-merge blocker 1) A joins PCOS, puts the tab away, another tab signs in B; coming back must not put B
            # in PCOS: the old visit is ended with A's token, the remembered group is forgotten, B joins nothing it did not choose
            fake.update({"mine": None, "visit": None, "delay": 0}); fsrv("pcos")["people"] = 23
            ctx6 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx6.add_init_script(seed_signed_in)
            p6 = await ctx6.new_page(); await p6.route("**/*", plaza_gate)
            p6.on("pageerror", lambda e: p_errors.append("cross-tab pageerror: " + str(e)))
            await p6.goto(BASE + "room.html", wait_until="networkidle"); await p6.wait_for_selector(".hotspot"); await p6.wait_for_timeout(500)
            await p6.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return !!OvuStore.state().sleeping}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuRoom.closeSheet && OvuRoom.closeSheet(); OvuWalk.travel('plaza');}")
            try: await p6.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && OvuPlaza.state().servers", timeout=12000)
            except Exception: pass
            await p6.evaluate("()=>OvuPlaza.join('pcos')")
            try: await p6.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='pcos'", timeout=6000)
            except Exception: pass
            savedA = await p6.evaluate("()=>OvuStore.state().plaza")
            await p6.evaluate("()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}"); await p6.wait_for_timeout(500)
            n_calls = len(pcalls)
            B = dict(SESS); B["access_token"] = "smoke-token-b"; B["user"] = {"id": "00000000-0000-4000-8000-0000000000bb", "email": "b@example.test"}
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(B))  # the other tab signs in B; no storage event reaches this hidden tab here
            await p6.evaluate("()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));}"); await p6.wait_for_timeout(1500)
            after_b = await p6.evaluate("()=>({st: OvuPlaza.state(), saved: OvuStore.state().plaza})")
            new_calls = list(zip(pcalls[n_calls:], pauth[n_calls:]))
            joins_b = [c for c, a in new_calls if c[0] == "plaza_join" and a == "Bearer smoke-token-b"]
            check("A's chosen group is saved with A's account on it", savedA and savedA.get("server") == "pcos" and savedA.get("uid") == SESS["user"]["id"], savedA)
            check("another tab signing in B: coming back puts B in no group, forgets A's choice, and nothing goes out for B but the group list", not joins_b and not after_b["st"]["joined"] and not after_b["st"]["want"] and not after_b["saved"] and all(c[0] == "plaza_list" for c, a in new_calls if a == "Bearer smoke-token-b"), {"calls": new_calls, "st": after_b})
            # the same with a storage event delivered (the usual case for a visible tab): A's open visit ends with A's own token
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS)); await p6.evaluate("()=>window.dispatchEvent(new StorageEvent('storage',{key:'ovumind_auth_v1'}))"); await p6.wait_for_timeout(600)
            await p6.evaluate("()=>OvuPlaza.join('pcos')")
            try: await p6.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='pcos'", timeout=6000)
            except Exception: pass
            n_calls = len(pcalls)
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(B)); await p6.evaluate("()=>window.dispatchEvent(new StorageEvent('storage',{key:'ovumind_auth_v1'}))"); await p6.wait_for_timeout(1200)
            new_calls = list(zip(pcalls[n_calls:], pauth[n_calls:]))
            st_b = await p6.evaluate("()=>OvuPlaza.state()")
            check("a visible tab hearing the switch ends A's visit with A's own token and puts B nowhere", (("plaza_leave", "pcos"), "Bearer smoke-token") in new_calls and not [c for c, a in new_calls if c[0] == "plaza_join"] and not st_b["joined"] and fake["mine"] is None, {"calls": new_calls, "st": st_b})
            await ctx6.close()
            check("no page errors or console errors in the signed-in plaza run", not p_errors, p_errors[:3])
            await ctx4.close()

            # Plaza friends, signed in, against a fake friends server (nothing leaves the machine): make a card, see the
            # people in her group, ask one, accept another, send a kind note, report a note with a block, turn it off
            FR = {"me": {"card": None, "on": False, "adult": False, "paused_until": None, "phrases": []},
                  "people": [{"handle": "h-nadia", "name": "Nadia", "look": "kebaya-green", "friend": False, "asked": False, "asks": False},
                             {"handle": "h-priya", "name": "Priya", "look": "cozy", "friend": False, "asked": False, "asks": True}],
                  "friends": [], "asks": [{"handle": "h-priya", "name": "Priya", "look": "cozy", "hello": "hello", "at": NOW}], "asked": [],
                  "notes": [{"id": 7, "handle": "h-priya", "name": "Priya", "look": "cozy", "phrase": "gentle", "at": NOW, "read": False}], "blocked": []}
            fcalls, fauth, f_errors = [], [], []
            def fcall(n): return [b for (m, b) in fcalls if m == n]
            async def friends_gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url: return await route.fulfill(status=200, content_type="text/css", body="")
                m = re.search(r"/rest/v1/rpc/([a-z_]+)", url)
                name = m.group(1) if m else ""; body = json.loads(route.request.post_data or "{}")
                if name.startswith("social_"): fcalls.append((name, body)); fauth.append(route.request.headers.get("authorization", ""))
                me = FR["me"]
                if route.request.headers.get("authorization", "") == "Bearer smoke-token-b":  # another account: no card of her own
                    out = {"card": None, "on": False, "adult": True, "paused_until": None} if name == "social_me" else {"ok": False, "why": "off", "card": None}
                    return await route.fulfill(status=200, content_type="application/json", body=json.dumps(out))
                def inbox(): return {"ok": True, "card": me["card"], "friends": FR["friends"], "asks": FR["asks"], "asked": FR["asked"], "notes": FR["notes"], "blocked": FR["blocked"]} if me["card"] else {"ok": False, "why": "off", "card": None}
                if name == "plaza_list": out = {"servers": [{"id": "pcos", "name": "PCOS", "capacity": 24, "open": True, "people": 3}, {"id": "everyone", "name": "Everyone", "capacity": 24, "open": True, "people": 1}], "mine": None, "beat_seconds": 25}
                elif name == "plaza_join": out = {"ok": True, "server": body["p_server"], "name": "PCOS" if body["p_server"] == "pcos" else "Everyone", "capacity": 24, "people": 3, "visit": "v1" if body["p_server"] == "pcos" else "v2", "beat_seconds": 25}
                elif name == "plaza_beat": out = {"ok": True, "server": body["p_server"], "visit": body.get("p_visit"), "people": 3}
                elif name == "plaza_leave": out = {"ok": True}
                elif name == "social_me": out = me
                elif name == "social_people" and FR.get("people_fail"): return await route.fulfill(status=503, content_type="application/json", body='{"message":"unavailable"}')
                elif name == "social_card_save":
                    if FR.get("save_delay"): await asyncio.sleep(FR["save_delay"])
                    me["card"] = {"handle": "h-me", "name": body["p_name"], "look": body["p_look"], "hidden": body["p_hidden"], "paused_until": None}; me["on"] = True; me["adult"] = True
                    out = {"ok": True, "card": me["card"], "recorded": ["age_18", "social"]}
                elif name == "social_people":
                    if FR.get("people_delay"): await asyncio.sleep(FR["people_delay"])
                    out = {"ok": True, "people": FR["people"] if body.get("p_visit") == "v1" else []} if me["card"] and not me["card"]["hidden"] else {"ok": False, "why": "off"}
                elif name == "social_inbox": out = inbox()
                elif name == "social_ask":
                    for x in FR["people"]:
                        if x["handle"] == body["p_handle"]: x["asked"] = True; FR["asked"].append({"handle": x["handle"], "name": x["name"], "look": x["look"], "at": NOW})
                    out = {"ok": True, "status": "asked"}
                elif name == "social_answer":
                    FR["asks"] = [a for a in FR["asks"] if a["handle"] != body["p_handle"]]
                    if body["p_accept"]:
                        FR["friends"].append({"handle": "h-priya", "name": "Priya", "look": "cozy", "since": NOW})
                        for x in FR["people"]:
                            if x["handle"] == body["p_handle"]: x["friend"] = True; x["asks"] = False
                    out = {"ok": True, "status": "friends" if body["p_accept"] else "declined"}
                elif name == "social_note": out = {"ok": True, "id": 99}
                elif name == "social_read":
                    for n in FR["notes"]:
                        if n["id"] <= body["p_upto"]: n["read"] = True
                    out = {"ok": True}
                elif name == "social_report":
                    if body.get("p_block"):
                        FR["people"] = [x for x in FR["people"] if x["handle"] != body["p_handle"]]; FR["friends"] = [x for x in FR["friends"] if x["handle"] != body["p_handle"]]
                        FR["notes"] = [n for n in FR["notes"] if n["handle"] != body["p_handle"]]; FR["blocked"].append({"id": "b1", "name": "Priya", "look": "cozy", "at": NOW})
                    out = {"ok": True}
                elif name == "social_off": me["card"] = None; me["on"] = False; out = {"ok": True}
                else: out = {}
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps(out))
            ctx6 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx6.add_init_script(seed_signed_in)
            p6 = await ctx6.new_page(); await p6.route("**/*", friends_gate)
            p6.on("pageerror", lambda e: f_errors.append("pageerror: " + str(e)))
            p6.on("console", lambda m: f_errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text and not (FR.get("people_fail") and "503" in m.text) else None)  # the deliberate failure below logs its 503
            shots = os.environ.get("SMOKE_SHOTS")
            async def shot(name):
                if shots: await p6.screenshot(path=os.path.join(shots, name + ".png"))
            await p6.goto(BASE + "room.html", wait_until="networkidle"); await p6.wait_for_selector(".hotspot"); await p6.wait_for_timeout(600)
            await p6.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return !!OvuStore.state().sleeping}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuRoom.closeSheet && OvuRoom.closeSheet();}")
            check("signed in, Plaza friends asks the server who she is once, with her own token, and nothing more without a card", fcall("social_me") and not fcall("social_inbox") and not fcall("social_people") and all(a == "Bearer smoke-token" for a in fauth), [c[0] for c in fcalls])
            await p6.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump
            try: await p6.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && /online/.test((document.querySelector('#plazaPill')||{}).textContent||'')", timeout=12000)
            except Exception: pass
            await p6.click('#plazaPill'); await p6.wait_for_selector('#plazaList [data-join=pcos]'); await p6.click('#plazaList [data-join=pcos]')
            try: await p6.wait_for_function("()=>OvuPlaza.state().joined && /Make a plaza card/.test((document.querySelector('#plazaFriendsRow')||{}).textContent||'')", timeout=8000)
            except Exception: pass
            pr = await p6.evaluate("()=>({row: (document.querySelector('#plazaFriendsRow')||{}).textContent||'', help: (document.querySelector('#sheetBody, .sheet')||document.body).textContent.indexOf('Unless you turn on Plaza friends') > -1, samples: document.querySelectorAll('.nbperson:not(.nbreal)').length, real: document.querySelectorAll('.nbreal').length})")
            check("in a group without a card: the plaza sheet offers a plaza card, says who sees what, and only the samples stand about", "Make a plaza card" in pr["row"] and pr["help"] and pr["samples"] == 4 and pr["real"] == 0 and not fcall("social_people"), pr)
            await p6.click('#plazaFriendsRow [data-frp=open]'); await p6.wait_for_selector('#frName')
            await p6.fill('#frName', 'Staff'); await p6.wait_for_timeout(100)
            bad = await p6.evaluate("()=>({msg: document.querySelector('#frNameMsg').textContent, dis: document.querySelector('#frSave').disabled, cue: /Pick a name that feels like you/.test(document.querySelector('#frSheet').textContent), words: /Your diary, your cycle, your account name and your email are never shown/.test(document.querySelector('#frSheet').textContent)})")
            await p6.fill('#frName', 'Fern'); await p6.wait_for_timeout(100)
            gate18 = await p6.evaluate("()=>document.querySelector('#frSave').disabled")
            await p6.check('#frAdult'); await p6.check('#frOn'); await p6.click('.frlook[data-look=kebaya-red]')
            ready = await p6.evaluate("()=>!document.querySelector('#frSave').disabled")
            check("the card form: the consent words and the cue are shown, a reserved name is refused at once, and Make my card waits for 18+ and Plaza friends to be ticked", bad["msg"].startswith("That name belongs to Rhythme") and bad["dis"] and bad["cue"] and bad["words"] and gate18 and ready, bad)
            await shot("friends-card-form")
            await p6.click('#frSave')
            try: await p6.wait_for_function("()=>/Asked to be friends/.test((document.querySelector('#frSheet')||{}).textContent||'')", timeout=8000)
            except Exception: pass
            cs = fcall("social_card_save")
            fs = await p6.evaluate("()=>({text: (document.querySelector('#frSheet')||{}).textContent||'', dot: document.querySelector('#plazaPill').classList.contains('frnew')})")
            check("Make my card sends the name, the look, the two ticked boxes (18+ and Plaza friends), no expected card and the notice version, and the sheet shows her card, Priya's ask with its hello and the note from her", cs and cs[0]["p_name"] == "Fern" and cs[0]["p_look"] == "kebaya-red" and cs[0]["p_adult"] is True and cs[0]["p_opt_in"] is True and cs[0]["p_expect"] is None and cs[0]["p_hidden"] is False and cs[0]["p_notice"] == 4 and "Fern" in fs["text"] and "Hello, nice to see you here." in fs["text"] and "Hope today is gentle with you." in fs["text"] and "Welcome her in." in fs["text"], {"save": cs, "text": fs["text"][:200]})
            check("opening the sheet marks the note read (the sender is never told), and the pill still shows a dot for the ask", fcall("social_read") and fcall("social_read")[0]["p_upto"] == 7 and fs["dot"], fcall("social_read"))
            await shot("friends-sheet")
            await p6.evaluate("()=>OvuRoom.closeSheet()")
            try: await p6.wait_for_function("()=>document.querySelectorAll('.nbreal').length===2", timeout=8000)
            except Exception: pass
            on = await p6.evaluate("()=>({real: [...document.querySelectorAll('.nbreal')].map(e=>e.textContent), samples: document.querySelectorAll('.nbperson:not(.nbreal)').length, label: (document.querySelector('.nbreal')||{getAttribute:()=>''}).getAttribute('aria-label')})")
            pp = fcall("social_people")
            check("with a card, the two people in PCOS stand on the plaza by name and the samples step aside; the call names her group and visit", on["real"] == ["Nadia", "Priya"] and on["samples"] == 0 and "in your group" in on["label"] and pp and pp[-1] == {"p_server": "pcos", "p_visit": "v1"}, {"on": on, "people": pp[-1:]})
            await shot("plaza-people")
            # a failed fetch clears the plate (never yesterday's group) and holds every automatic request until she acts
            FR["people_fail"] = True
            await p6.evaluate("()=>OvuFriends.loadPeople()"); await p6.wait_for_timeout(400)
            fl = await p6.evaluate("()=>({real: document.querySelectorAll('.nbreal').length, samples: document.querySelectorAll('.nbperson:not(.nbreal)').length, held: OvuFriends.state().held})")
            FR["people_fail"] = False
            n_auto = len([c for c in fcalls if c[0] in ("social_people", "social_inbox", "social_me")])
            await p6.evaluate("()=>{OvuPlaza.tick(); OvuFriends.poll(); document.dispatchEvent(new Event('visibilitychange'));}"); await p6.wait_for_timeout(900)
            quiet = len([c for c in fcalls if c[0] in ("social_people", "social_inbox", "social_me")]) - n_auto
            await p6.click('#plazaPill')
            try: await p6.wait_for_function("()=>document.querySelectorAll('.nbreal').length===2", timeout=6000)
            except Exception: pass
            back2 = await p6.evaluate("()=>({real: document.querySelectorAll('.nbreal').length, held: OvuFriends.state().held})")
            await p6.evaluate("()=>OvuRoom.closeSheet()"); await p6.wait_for_timeout(300)
            check("a failed people check clears the plate at once; check-ins, timers and returning to the app ask nothing more; tapping the group pill tries again", fl["real"] == 0 and fl["samples"] == 4 and fl["held"] is True and quiet == 0 and back2["real"] == 2 and back2["held"] is False, {"fail": fl, "automatic calls while held": quiet, "after tap": back2})
            await p6.evaluate("()=>document.querySelector('.nbreal[data-nb=r0]').click()")
            await p6.wait_for_selector('#frSheet [data-fr=ask]')
            pc6 = await p6.evaluate("()=>document.querySelector('#frSheet').textContent")
            await p6.click('#frSheet .frhello[data-hello=wave]'); await p6.click('#frSheet [data-fr=ask]')
            try: await p6.wait_for_function("()=>/She can answer in her own time/.test((document.querySelector('#frSheet')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            ak = fcall("social_ask")
            check("tapping Nadia opens her card with the asking cue, Block and Report; Ask sends her handle, the group, the visit and the chosen hello, then shows Asked", "share a bench" in pc6 and "Block" in pc6 and "Report" in pc6 and ak and ak[0] == {"p_handle": "h-nadia", "p_server": "pcos", "p_visit": "v1", "p_hello": "wave"}, {"ask": ak, "text": pc6[:120]})
            await shot("person-card")
            await p6.evaluate("()=>{OvuRoom.closeSheet(); document.querySelector('nav a[data-tab=you]').click();}")
            await p6.wait_for_selector('[data-yact=friends]')
            yr = await p6.evaluate("()=>document.querySelector('[data-yact=friends]').textContent")
            await p6.click('[data-yact=friends]'); await p6.wait_for_selector('#frSheet [data-fr=accept]')
            await p6.click('#frSheet [data-fr=accept]')
            try: await p6.wait_for_function("()=>!!document.querySelector('#frSheet [data-fr=note][data-h=h-priya]')", timeout=6000)
            except Exception: pass
            an = fcall("social_answer")
            check("You has a Plaza friends row; Accept on Priya's ask makes her a friend with a Send a kind note button", "Plaza friends" in yr and an and an[0] == {"p_handle": "h-priya", "p_accept": True} and await p6.evaluate("()=>!!document.querySelector('#frSheet [data-fr=note][data-h=h-priya]')"), {"you": yr, "answer": an})
            await p6.click('#frSheet [data-fr=note][data-h=h-priya]'); await p6.wait_for_selector('#frSend')
            nb = await p6.evaluate("()=>({dis: document.querySelector('#frSend').disabled, cue: /Before you send, one slow breath/.test(document.querySelector('#frSheet').textContent), n: document.querySelectorAll('.frphrase').length})")
            await p6.click('.frphrase[data-phrase=tea]'); await p6.click('#frSend')
            try: await p6.wait_for_function("()=>!!document.querySelector('#frSheet [data-fr=off]')", timeout=6000)
            except Exception: pass
            nt = fcall("social_note")
            check("a kind note: the breath cue, twelve set phrases and no text box; Send waits for a pick and sends only the phrase id", nb["cue"] and nb["dis"] and nb["n"] == 12 and nt and nt[0] == {"p_handle": "h-priya", "p_phrase": "tea"} and not await p6.evaluate("()=>!!document.querySelector('#frSheet textarea')"), {"before": nb, "note": nt})
            await shot("kind-note")
            await p6.click('#frSheet .frrow [data-fr=report][data-note="7"]'); await p6.wait_for_selector('#frSendReport')
            await p6.click('.frreason[data-reason=unkind]'); await p6.check('#frAlsoBlock'); await p6.click('#frSendReport')
            try: await p6.wait_for_function("()=>!!document.querySelector('#frSheet [data-fr=off]')", timeout=6000)
            except Exception: pass
            rp = fcall("social_report")
            bl = await p6.evaluate("()=>({text: document.querySelector('#frSheet').textContent, real: [...document.querySelectorAll('.nbreal')].map(e=>e.textContent)})")
            check("reporting a note sends her handle, the reason, the note and the block; afterwards she is under Blocked and off the plate", rp and rp[0] == {"p_handle": "h-priya", "p_reason": "unkind", "p_note": 7, "p_block": True} and "Blocked" in bl["text"] and "Unblock" in bl["text"] and "Priya" not in bl["real"], {"report": rp, "real": bl["real"]})
            await p6.click('#frSheet [data-fr=off]')
            armed = await p6.evaluate("()=>document.querySelector('#frSheet [data-fr=off]').textContent")
            n_off = len(fcall("social_off"))
            await p6.click('#frSheet [data-fr=off]')
            try: await p6.wait_for_function("()=>!!document.querySelector('#frName')", timeout=6000)
            except Exception: pass
            await p6.evaluate("()=>OvuRoom.closeSheet()"); await p6.wait_for_timeout(300)
            of = await p6.evaluate("()=>({real: document.querySelectorAll('.nbreal').length, samples: document.querySelectorAll('.nbperson:not(.nbreal)').length})")
            check("turning Plaza friends off takes two taps, calls the server once, and the plaza goes back to the samples", n_off == 0 and "Tap again" in armed and len(fcall("social_off")) == 1 and of["real"] == 0 and of["samples"] == 4, {"armed": armed, "plate": of})
            # a paused account still sees how to turn Plaza friends off
            FR["me"]["card"] = {"handle": "h-me2", "name": "Fern", "look": "base", "hidden": False, "paused_until": "2030-01-01T00:00:00Z"}; FR["me"]["on"] = True; FR["me"]["paused_until"] = "2030-01-01T00:00:00Z"
            await p6.evaluate("()=>OvuFriends.open()")
            try: await p6.wait_for_function("()=>/Paused for now/.test((document.querySelector('#frSheet')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            pz6 = await p6.evaluate("()=>({text: (document.querySelector('#frSheet')||{}).textContent||'', off: !!document.querySelector('#frSheet [data-fr=off]')})")
            check("a paused account sees the pause and can still turn Plaza friends off", "Paused for now" in pz6["text"] and pz6["off"], pz6["text"][:120])
            FR["me"]["card"] = None; FR["me"]["on"] = False; FR["me"]["paused_until"] = None
            await p6.evaluate("()=>OvuRoom.closeSheet()")
            # a change in the people in her group follows her visit: moving to Everyone clears PCOS's people before any reply
            FR["me"]["card"] = {"handle": "h-me", "name": "Fern", "look": "kebaya-red", "hidden": False, "paused_until": None}; FR["me"]["on"] = True
            FR["people"] = [{"handle": "h-nadia", "name": "Nadia", "look": "kebaya-green", "friend": False, "asked": True, "asks": False}]
            await p6.evaluate("()=>OvuFriends.refresh()")
            try: await p6.wait_for_function("()=>document.querySelectorAll('.nbreal').length===1", timeout=6000)
            except Exception: pass
            FR["people_delay"] = 2
            await p6.evaluate("()=>OvuPlaza.join('everyone')"); await p6.wait_for_timeout(700)
            mv = await p6.evaluate("()=>({real: document.querySelectorAll('.nbreal').length, joined: (OvuPlaza.state().joined||{}).id})")
            await p6.wait_for_timeout(2300); FR["people_delay"] = 0
            mv2 = await p6.evaluate("()=>document.querySelectorAll('.nbreal').length")
            check("moving to another group clears the last group's people at once, and the new group's answer (nobody) keeps it clear", mv["joined"] == "everyone" and mv["real"] == 0 and mv2 == 0, {"during": mv, "after": mv2})
            # another tab signs into another account: this tab closes the sheet and forgets the last account at once
            FR["me"]["card"] = {"handle": "h-me", "name": "Fern", "look": "kebaya-red", "hidden": False, "paused_until": None}; FR["me"]["on"] = True
            await p6.evaluate("()=>OvuFriends.open()")
            try: await p6.wait_for_function("()=>/Fern/.test((document.querySelector('#frSheet')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            tab2 = await ctx6.new_page(); await tab2.route("**/*", friends_gate)
            await tab2.goto(BASE + "privacy.html", wait_until="domcontentloaded")
            SESS_B2 = {"access_token": "smoke-token-b", "refresh_token": "r-b", "expires_at": int(time.time()) + 86400, "user": {"id": "00000000-0000-4000-8000-0000000000bb", "email": "b@example.test"}}
            n_before = len(fcalls)
            await tab2.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS_B2)); await p6.wait_for_timeout(700)
            xt = await p6.evaluate("()=>({open: OvuRoom.sheetOpen() && !!document.querySelector('#frSheet'), me: OvuFriends.state().me && OvuFriends.state().me.card ? OvuFriends.state().me.card.name : null, wall: !!document.querySelector('#welcome:not([hidden])'), note: (document.querySelector('#wNote')||{}).textContent||'', sess: localStorage.getItem('ovumind_auth_v1')})")
            b_calls = [a for a in fauth[n_before:]]
            await tab2.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS)); await p6.wait_for_timeout(700)
            await tab2.close()
            # round five (21 Oct): this phone's diary belongs to the first account, so the other account is refused at once: the wall with its note, the session gone before any network answer, and nothing asked under either token
            check("signing into another account in another tab closes the friends sheet here, drops the last account's card, shows the other-account wall and signs that account out at once; nothing is asked under either token", not xt["open"] and xt["me"] is None and xt["wall"] and "another account" in xt["note"] and xt["sess"] is None and not any(a in ("Bearer smoke-token", "Bearer smoke-token-b") for a in b_calls), {"tab": {k: xt[k] for k in ("open", "me", "wall", "note", "sess")}, "calls after": b_calls})
            fauth[:] = [a for a in fauth if a != "Bearer smoke-token-b"]  # the other account's own calls are not this account's
            # two accounts on one phone: a form opened by one account never sends for another, and a late reply is dropped
            FR["me"]["card"] = None; FR["me"]["on"] = False; FR["me"]["adult"] = False
            await p6.evaluate("()=>OvuFriends.open()"); await p6.wait_for_selector('#frName')
            await p6.fill('#frName', 'Fern'); await p6.check('#frAdult'); await p6.check('#frOn')
            SESS_B = {"access_token": "smoke-token-b", "refresh_token": "r-b", "expires_at": int(time.time()) + 86400, "user": {"id": "00000000-0000-4000-8000-0000000000bb", "email": "b@example.test"}}
            n_save = len(fcall("social_card_save"))
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS_B))
            await p6.click('#frSave'); await p6.wait_for_timeout(600)
            sw1 = {"sent": len(fcall("social_card_save")) - n_save}
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS))
            await p6.evaluate("()=>{OvuRoom.closeSheet(); OvuFriends.open();}"); await p6.wait_for_selector('#frName')
            await p6.fill('#frName', 'Fern'); await p6.check('#frAdult'); await p6.check('#frOn')
            FR["save_delay"] = 1.5
            await p6.click('#frSave'); await p6.wait_for_timeout(250)
            await p6.evaluate("()=>OvuAuth.signOut(false)"); await p6.wait_for_timeout(150)
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS_B))
            await p6.wait_for_timeout(2200); FR["save_delay"] = 0
            sw2 = await p6.evaluate("()=>({sheet: OvuRoom.sheetOpen() && !!document.querySelector('#frSheet'), me: OvuFriends.state().me, toast: (document.querySelector('#toast')||{}).textContent||''})")
            check("a form opened by one account sends nothing once another account is signed in, and a reply that lands after a switch shows nothing and is not kept", sw1["sent"] == 0 and not sw2["sheet"] and sw2["me"] is None and "plaza card is ready" not in sw2["toast"], {"first": sw1, "second": sw2})
            await p6.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS))
            check("every Plaza friends call carried her own sign-in token", fauth and all(a == "Bearer smoke-token" for a in fauth), fauth[:2])
            check("no page errors or console errors in the Plaza friends run", not f_errors, f_errors[:3])
            await ctx6.close()

            # Plaza friends before its server exists (the live database answers 404 PGRST202 until the migration is
            # applied): one question at start, then no row, no timers and no further calls; the plaza itself still works
            mcalls, m_errors = [], []
            async def missing_gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url: return await route.fulfill(status=200, content_type="text/css", body="")
                m = re.search(r"/rest/v1/rpc/([a-z_]+)", url); name = m.group(1) if m else ""; body = json.loads(route.request.post_data or "{}")
                if name.startswith("social_"):
                    mcalls.append(name)
                    return await route.fulfill(status=404, content_type="application/json", body=json.dumps({"code": "PGRST202", "message": "Could not find the function public.%s without parameters in the schema cache" % name}))
                if name == "plaza_list": out = {"servers": [{"id": "pcos", "name": "PCOS", "capacity": 24, "open": True, "people": 3}], "mine": None, "beat_seconds": 25}
                elif name == "plaza_join": out = {"ok": True, "server": "pcos", "name": "PCOS", "capacity": 24, "people": 4, "visit": "v1", "beat_seconds": 25}
                elif name == "plaza_beat": out = {"ok": True, "server": "pcos", "visit": body.get("p_visit"), "people": 4}
                else: out = {"ok": True} if name else {}
                return await route.fulfill(status=200, content_type="application/json", body=json.dumps(out))
            ctx7 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx7.add_init_script(seed_signed_in)
            p7 = await ctx7.new_page(); await p7.route("**/*", missing_gate)
            p7.on("pageerror", lambda e: m_errors.append("pageerror: " + str(e)))
            p7.on("console", lambda m: m_errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text and "404" not in m.text else None)  # the expected 404 logs itself
            await p7.goto(BASE + "room.html", wait_until="networkidle"); await p7.wait_for_selector(".hotspot"); await p7.wait_for_timeout(800)
            await p7.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuRoom.closeSheet && OvuRoom.closeSheet();}")
            m0 = await p7.evaluate("()=>OvuFriends.state()")
            await p7.evaluate("()=>OvuWalk.travel('plaza')")  # a test jump
            try: await p7.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza'", timeout=12000)
            except Exception: pass
            await p7.click('#plazaPill'); await p7.wait_for_selector('#plazaList [data-join=pcos]'); await p7.click('#plazaList [data-join=pcos]')
            try: await p7.wait_for_function("()=>OvuPlaza.state().joined && OvuPlaza.state().joined.id==='pcos'", timeout=8000)
            except Exception: pass
            await p7.evaluate("()=>{OvuFriends.poll(); OvuFriends.refresh();}"); await p7.wait_for_timeout(500)
            m1 = await p7.evaluate("()=>({row: (document.querySelector('#plazaFriendsRow')||{innerHTML:'none'}).innerHTML, joined: !!OvuPlaza.state().joined, st: OvuFriends.state()})")
            check("before its server exists, Plaza friends asks once, then shows no row, runs no timers and asks nothing more; joining a group still works", mcalls == ["social_me"] and m0["missing"] and not m0["timers"] and m1["row"] == "" and m1["joined"] and m1["st"]["missing"] and not m1["st"]["timers"], {"calls": mcalls, "m0": {k: m0[k] for k in ("missing", "timers", "held")}, "row": m1["row"][:80]})
            check("no page errors in the Plaza friends before-the-server run", not m_errors, m_errors[:3])
            await ctx7.close()

            # the staff dashboard signed in as an owner (fake session, fake staff calls): the Plazas card shows counts only
            ctx5 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx5.add_init_script("localStorage.setItem('ovumind_auth_v1', %s);" % json.dumps(json.dumps(SESS)))
            sg_today = (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).date().isoformat()
            STAFF = {"admin_me": {"admin": True, "role": "owner", "uid": SESS["user"]["id"]},
                     "admin_overview": {"counts": {"accounts": 1, "accounts_with_cloud_copy": 0, "consent_active": 0, "consent_eligible": 0}, "floor": 20, "runs": [], "open_proposals": 0, "blocked": [], "latest": {}},
                     "admin_feed": [],
                     "admin_plaza": {"stale_seconds": 75, "today": sg_today, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "now": [{"id": "pcos", "name": "PCOS", "capacity": 24, "open": True, "people": 3}, {"id": "everyone", "name": "Everyone", "capacity": 24, "open": True, "people": 1}, {"id": "menopause", "name": "Menopause", "capacity": 24, "open": True, "people": 0}],
                                     "days": [{"day": sg_today, "server": "pcos", "joins": 5, "peak": 4}, {"day": sg_today, "server": "everyone", "joins": 1, "peak": 1}]},
                     "admin_proposals": [],
                     "admin_social_reports": {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "reports": [{"id": 3, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "reason": "unkind", "status": "open", "decided_at": None, "days": None, "card": "1a2b3c4d", "name": "Mei", "look": "base", "phrase": "Sending you a warm cup of tea.", "about_note": True, "from_card": "9f8e7d6c", "from_name": "Priya", "open_on_card": 1, "card_now": "active"}]},
                     "admin_social_decide": {"ok": True}}
            async def staff_gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url: return await route.fulfill(status=200, content_type="text/css", body="")
                m = re.search(r"/rest/v1/rpc/([a-z_]+)", url)
                if m and m.group(1) in STAFF:
                    if STAFF[m.group(1)] is None: return await route.fulfill(status=503, content_type="application/json", body='{"message":"unavailable"}')
                    return await route.fulfill(status=200, content_type="application/json", body=json.dumps(STAFF[m.group(1)]))
                return await route.fulfill(status=200, content_type="application/json", body="{}")
            p5 = await ctx5.new_page(); await p5.route("**/*", staff_gate)
            await p5.goto(BASE + "admin.html", wait_until="networkidle")
            try: await p5.wait_for_function("()=>/PCOS/.test((document.querySelector('#plazaCard')||{}).textContent||'')", timeout=8000)
            except Exception: pass
            pc = await p5.evaluate("()=>{var c=document.querySelector('#plazaCard'); return c ? {text: c.textContent, rows: c.querySelectorAll('#plazaDays tr').length} : null}")
            check("the staff Today tab shows a Plazas card: 4 online, PCOS 3 of 24 with peak 4 and 5 joins on the server's date, a day row, and no names", pc and "4 online" in pc["text"] and "3 of 24" in pc["text"] and "peak 4 today · 5 joins" in pc["text"] and pc["rows"] == 2 and "smoke@example.test" not in pc["text"], pc)
            # the team (21 Oct): Nimbus gathers four named clouds on Today, each one says what it can measure, the plaza card draws its days
            tm = await p5.evaluate("()=>({nimbus: /Nimbus, the orchestrator/.test((document.querySelector('.card.nimbus')||{}).textContent||''), mates: [...document.querySelectorAll('.mate b')].map(b=>b.textContent).join(','), chart: !!document.querySelector('#plazaCard .chart svg'), honest: /No finished run yet|counts only/.test((document.querySelector('.card.nimbus')||{}).textContent||'')})")
            check("the staff Today tab opens with Nimbus and the four named clouds (Bloom, Dozy, Pudding, Misty), says honestly that there is no run yet, and charts the plaza days", tm["nimbus"] and tm["mates"] == "Bloom,Dozy,Pudding,Misty" and tm["chart"] and tm["honest"], tm)
            await p5.click('nav.tabs button[data-tab=agents]'); await p5.wait_for_timeout(400)
            ag5 = await p5.evaluate("()=>({says: document.querySelectorAll('.agent .say').length, clouds: document.querySelectorAll('.agent svg.cloudy').length, text: (document.querySelector('#mate-cycle .say')||{}).textContent||''})")
            check("the Agents tab shows each cloud with its own report bubble, and Bloom says there is no finished run yet", ag5["says"] == 4 and ag5["clouds"] == 4 and "No finished run has a report from me yet" in ag5["text"], ag5)
            await p5.click('nav.tabs button[data-tab=today]'); await p5.wait_for_timeout(400)
            # a refresh that fails is shown as not current, not as live numbers
            STAFF["admin_plaza"] = None
            await p5.evaluate("()=>document.dispatchEvent(new Event('visibilitychange'))")
            try: await p5.wait_for_function("()=>/not updated since/.test((document.querySelector('#plazaCard')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            st5 = await p5.evaluate("()=>(document.querySelector('#plazaCard')||{}).textContent||''")
            check("when a plaza refresh fails the card says it is not current and keeps the last numbers", "not updated since" in st5 and "Not current" in st5 and "3 of 24" in st5, st5[:160])
            sdec = []
            async def staff_gate2(route):
                m = re.search(r"/rest/v1/rpc/(admin_social_decide)", route.request.url)
                if m: sdec.append(json.loads(route.request.post_data or "{}")); STAFF["admin_social_reports"]["reports"][0]["status"] = "paused"
                return await staff_gate(route)
            await p5.unroute("**/*"); await p5.route("**/*", staff_gate2)
            await p5.click('nav.tabs button[data-tab=queue]')
            try: await p5.wait_for_function("()=>/Mei · card 1a2b3c4d/.test((document.querySelector('#reportsCard')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            rc = await p5.evaluate("()=>{var c=document.querySelector('#reportsCard'); return c ? {text: c.textContent, acts: c.querySelectorAll('[data-sdecide]').length} : null}")
            check("the staff Queue tab lists Plaza reports by card (name, short card number, reason, phrase, reporter's card), never an email or a group", rc and "Plaza reports" in rc["text"] and "1 open" in rc["text"] and "Unkind or upsetting" in rc["text"] and "Sending you a warm cup of tea." in rc["text"] and "Priya" in rc["text"] and rc["acts"] == 3 and "smoke@example.test" not in rc["text"] and "PCOS" not in rc["text"], rc)
            await p5.click('#reportsCard [data-sdecide=pause]')
            try: await p5.wait_for_function("()=>/No open reports/.test((document.querySelector('#reportsCard')||{}).textContent||'') || /paused/.test((document.querySelector('#reportsCard')||{}).textContent||'')", timeout=6000)
            except Exception: pass
            check("an owner's Pause 7 days sends that report and seven days", sdec == [{"p_id": 3, "p_decision": "pause", "p_days": 7}], sdec)
            await ctx5.close()

            # the launch setting: Luna's AI help is paused. The three AI choices cannot be turned on, Luna says so, and no AI request goes out
            ctxP = await browser.new_context(viewport={"width": 390, "height": 844}, paused=True)
            await ctxP.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxP.add_init_script(SESSION_SEED)
            pP = await ctxP.new_page(); ai_calls = []
            async def p_gate(route):
                u = route.request.url
                if "/functions/v1/luna" in u or "/functions/v1/insight" in u: ai_calls.append(u); return await route.abort()
                if u.startswith(BASE): return await route.continue_()
                if "fonts.g" in u: return await route.fulfill(status=200, content_type="text/css", body="")
                return await route.abort()
            await pP.route("**/*", p_gate)
            await pP.goto(BASE + "room.html"); await pP.wait_for_timeout(1500)
            pz = await pP.evaluate("""async () => {
              const C = OvuConsent, O = OvuOrb;
              C.setMany({ ai_reading: true, food_photo_ai: true, ai_summaries: true }, 'settings');
              const allowed = ['ai_reading', 'food_photo_ai', 'ai_summaries'].some(p => C.allows(p));
              let err = ''; try { await O.parseAI('slept badly and my left knee hurts'); } catch (e) { err = e.message; }
              let perr = ''; try { await O.parsePhoto('data:image/jpeg;base64,AAAA'); } catch (e) { perr = e.message; }
              return { paused: O.aiPaused(), allowed, err, perr };
            }""")
            check("the launch build pauses Luna's AI help: no AI choice can be turned on, an AI read or photo says paused, and nothing is sent", pz["paused"] and not pz["allowed"] and "paused" in pz["err"] and "paused" in pz["perr"] and ai_calls == [], {"pz": pz, "calls": ai_calls})
            await ctxP.close()

            # the staff page with no session at all: the sign-in gate only, no dashboard, no data call (its own context: the main one carries the fake session)
            ctxA = await browser.new_context(viewport={"width": 390, "height": 844}); a_calls = []
            async def admin_gate(route):
                url = route.request.url
                if url.startswith(BASE): return await route.continue_()
                if "fonts.googleapis.com" in url or "fonts.gstatic.com" in url: return await route.fulfill(status=200, content_type="text/css", body="")
                a_calls.append(url); await route.abort()
            pa = await ctxA.new_page(); await pa.route("**/*", admin_gate)
            await pa.goto(BASE + "admin.html", wait_until="networkidle"); await pa.wait_for_timeout(500)
            ag = await pa.evaluate("()=>({h2: (document.querySelector('h2')||{}).textContent, email: !!document.querySelector('#gEmail'), send: !!document.querySelector('#gSend'), nav: !!document.querySelector('nav.tabs'), session: localStorage.getItem('ovumind_auth_v1')})")
            check("the staff page with no session shows only the sign-in gate (no dashboard, no data request)", ag["h2"] == "Rhythme staff" and ag["email"] and ag["send"] and not ag["nav"] and ag["session"] is None and not [u for u in a_calls if ".supabase.co" in u], {"ag": ag, "calls": a_calls[:3]})
            await ctxA.close()
            # the clinician page needs no account: a fresh browser opens doctor.html and stays there (persona walk, 21 Oct)
            ctxD = await browser.new_context(viewport={"width": 390, "height": 844}); pd = await ctxD.new_page(); await pd.route("**/*", gate)
            await pd.goto(BASE + "doctor.html", wait_until="load"); await pd.wait_for_timeout(900)
            check("doctor.html opens without a session or a diary and is not sent to the room", pd.url.endswith("doctor.html") and await pd.evaluate("()=>!!document.querySelector('h1, h2')"), pd.url)
            await ctxD.close()
            # a reflection is read for safety in the journal too (persona walk, 21 Oct)
            ctxR = await browser.new_context(viewport={"width": 390, "height": 844}); await ctxR.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxR.add_init_script(SESSION_SEED)
            pr = await ctxR.new_page(); await pr.route("**/*", gate)
            await pr.goto(BASE + "journal.html", wait_until="networkidle"); await pr.wait_for_timeout(400)
            await pr.fill('#rfText', 'Feeling awful today. I want to die.'); await pr.click('#saveRf'); await pr.wait_for_timeout(500)
            rc = await pr.evaluate("()=>{var c=document.querySelector('#rfCare'); return {card: !!c, text: c ? c.textContent : '', role: c && c.getAttribute('role'), url: location.pathname}}")
            check("a journal reflection that says 'I want to die' shows the help card there, with 995 and SOS", rc["card"] and "Please get help now" in rc["text"] and "1767" in rc["text"] and rc["role"] == "alert", rc)
            await ctxR.close()
            # another tab signs out: the wall returns over the open You sheet, the email form is fresh, and a page that loads neither shared script still sends her to the room
            ctxX = await browser.new_context(viewport={"width": 390, "height": 844}); await ctxX.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxX.add_init_script(SESSION_SEED)
            px = await ctxX.new_page(); await px.route("**/*", gate)
            await px.goto(BASE + "room.html", wait_until="networkidle"); await px.goto(BASE + "room.html#you", wait_until="load"); await px.reload(wait_until="networkidle"); await px.wait_for_selector('#sheet[aria-hidden="false"]', timeout=10000)  # a cold goto to #you boots once and strips the hash; the fragment step after a full load keeps it through the reload
            await px.evaluate("()=>{localStorage.removeItem('ovumind_auth_v1'); localStorage.setItem('smoke_signed_out', '1'); window.dispatchEvent(new StorageEvent('storage', {key:'ovumind_auth_v1'}));}"); await px.wait_for_timeout(600)
            xo = await px.evaluate("()=>({wall: !!document.querySelector('#welcome:not([hidden])'), sheet: document.querySelector('#sheet').getAttribute('aria-hidden'), fresh: !document.querySelector('#wEmail').readOnly && document.querySelector('#wCodeWrap').hidden && document.querySelector('#wEmailForm').hidden && !document.querySelector('#wSignIn').hidden, inert: document.querySelector('#main').inert === true})")
            check("a sign-out in another tab brings the wall back over the open You sheet, closes the sheet, makes the room inert, and leaves the email form fresh", xo["wall"] and xo["sheet"] == "true" and xo["fresh"] and xo["inert"], xo)
            await px.goto(BASE + "face-ppg.html", wait_until="load"); await px.wait_for_timeout(700)
            check("a health page that loads neither shared script still sends a person without a session to the room", px.url.endswith("room.html"), px.url)
            await ctxX.close()
            odd = [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1/entries" in u or ("/functions/v1/" in u and "/podcast" not in u))]  # the Plus claim (functions/v1/podcast) is the signed-in account's own call, not a model relay
            check("no sign-in request and no diary row left the page in the whole run (the signed-in account's own calls aside), and no relay call", not odd, odd[:4])
            check("nothing was requested from any third party during the run", not external, external[:3])

            # two tabs in one browser (21 Oct): tab A stops hearing storage events, standing in for a tab asleep in the background;
            # tab B saves a diary entry, a consent choice and game state, then tab A saves; nothing of B's is lost or brought back
            ctxT = await browser.new_context(viewport={"width": 390, "height": 844}); await ctxT.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxT.add_init_script(SESSION_SEED)
            await ctxT.add_init_script("window.addEventListener('storage', function (e) { if (window.__deaf) e.stopImmediatePropagation(); }, true);")
            tA = await ctxT.new_page(); tB = await ctxT.new_page()
            for tp in (tA, tB):
                await tp.route("**/*", gate); tp.on("pageerror", lambda e: errors.append("two tabs pageerror: " + str(e)))
                await tp.goto(BASE + "room.html", wait_until="networkidle"); await tp.wait_for_selector(".hotspot")
            await tA.evaluate("()=>{ window.__deaf = true; OvuStore.list(null); }")
            bid = await tB.evaluate("()=>{ var e = OvuStore.add('reflection', OvuStore.today(), {text: 'from tab B'}); OvuConsent.grant('improve_logging', 'you'); OvuStore.commit({farm: Object.assign({}, OvuStore.state().farm || {}, {smokeTab: 'B'})}); OvuStore.remove('s3'); return e.id; }")
            await tA.wait_for_timeout(300)
            await tA.evaluate("()=>OvuStore.add('mindfulness', OvuStore.today(), {activity: 'breathe', seconds: 60})")
            tt = await tA.evaluate("(id)=>{ var db = JSON.parse(localStorage.getItem('ovumind_db_v1')); return {b: db.events.some(e => e.id === id), a: db.events.some(e => e.type === 'mindfulness' && e.data.activity === 'breathe'), consent: db.profile.consentEvents.some(e => e.purpose === 'improve_logging' && e.action === 'grant') && db.profile.consent && db.profile.consent.improve === true, farm: (db.state.farm || {}).smokeTab === 'B', deleted: !db.events.some(e => e.id === 's3'), mem: !!OvuStore.get(id) && !OvuStore.get('s3')}; }", bid)
            check("a stale tab's save keeps the other tab's diary entry, consent choice, game state and delete, and then shows them", all(tt.values()), tt)
            await tA.evaluate("()=>{ window.__deaf = false; }")
            nid = await tB.evaluate("()=>OvuStore.add('reflection', OvuStore.today(), {text: 'heard at once'}).id"); await tA.wait_for_timeout(400)
            heard = await tA.evaluate("(id)=>!!OvuStore.get(id)", nid)
            check("a tab that hears the storage event shows the other tab's save without writing", heard, heard)
            await ctxT.close()

            # 9. asleep: nothing opens until the bed wakes her (hotspots, the nav sheets, Luna); You and the bed stay open
            ctx9 = await browser.new_context(viewport={"width": 390, "height": 844})
            zz = json.loads(json.dumps(DB)); zz["state"]["sleeping"] = {"startedAt": NOW, "bedTime": "23:00", "prevOutfit": "base", "pj": True}
            await ctx9.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(zz))); await ctx9.add_init_script(SESSION_SEED)
            p9 = await ctx9.new_page(); await p9.route("**/*", gate)
            p9.on("pageerror", lambda e: errors.append("asleep pageerror: " + str(e)))
            await p9.goto(BASE + "room.html", wait_until="networkidle"); await p9.wait_for_selector(".hotspot"); await p9.wait_for_timeout(900)
            await p9.click(".hotspot[data-id=diary]"); await p9.wait_for_timeout(500)
            z1 = await p9.evaluate("()=>({toast: document.querySelector('#toast').textContent, sheet: document.querySelector('#sheet').getAttribute('aria-hidden')})")
            await p9.click(".hotspot[data-id=door]"); await p9.wait_for_timeout(700)
            z1["door"] = await p9.evaluate("()=>({sheet: document.querySelector('#sheet').getAttribute('aria-hidden'), layout: (document.querySelector('.scene')||{}).dataset ? document.querySelector('.scene').dataset.layout : null})")
            await p9.click("nav a[data-tab=food]"); await p9.wait_for_timeout(500)
            z2 = await p9.evaluate("()=>({sheet: document.querySelector('#sheet').getAttribute('aria-hidden'), tab: (document.querySelector('nav a.on')||{}).dataset ? document.querySelector('nav a.on').dataset.tab : null})")
            await p9.evaluate("()=>document.querySelector('#lunaBtn').click()"); await p9.wait_for_timeout(500)  # the orb floats, so a synthetic click
            z3 = await p9.evaluate("()=>document.querySelector('#sheet').getAttribute('aria-hidden')")
            check("asleep, a room object, the street door, a nav sheet and Luna all answer with the bed toast and open nothing", "asleep" in z1["toast"] and z1["sheet"] == "true" and z1["door"]["sheet"] == "true" and (z1["door"]["layout"] in (None, "room")) and z2["sheet"] == "true" and z3 == "true", {"z1": z1, "z2": z2, "z3": z3})
            await p9.evaluate("()=>document.querySelector('nav a[data-tab=you]').click()"); await p9.wait_for_selector('#sheet[aria-hidden="false"] #youAccount', timeout=8000)
            await p9.keyboard.press("Escape"); await p9.wait_for_timeout(300)
            await p9.evaluate("()=>document.querySelector('.hotspot[data-id=bed]').click()"); await p9.wait_for_selector('#sheet[aria-hidden="false"]', timeout=8000); await p9.wait_for_timeout(300)
            z4 = await p9.evaluate("()=>(document.querySelector('#sheet h2')||document.querySelector('#sheet .sh-title')||{}).textContent")
            check("asleep, You still opens and the bed offers the morning", z4 and "morning" in z4.lower(), z4)
            await ctx9.close()

            # the food diary is for food: its Ideas pane points to the garden greenhouse for teas and herbs and lists none itself
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>document.querySelector('nav a[data-tab=food]').click()"); await page.wait_for_selector('#dTabs', timeout=8000)
            await page.evaluate("()=>document.querySelector('#dTabs [data-dpane=ideas]').click()"); await page.wait_for_timeout(300)
            ti = await page.evaluate("()=>{var p=document.querySelector('.dpane[data-pane=ideas]'); return {teas: p.querySelectorAll('details.tea, .dsec.teas').length, pointer: (p.textContent||'').indexOf('garden greenhouse')>-1};}")
            check("the food diary's Ideas pane lists no teas and points to the garden greenhouse", ti["teas"] == 0 and ti["pointer"], ti)
            # food search knows Singapore dishes (HPB), and offers Luna when the tables have little
            await page.evaluate("()=>document.querySelector('#dTabs [data-dpane=add]').click()"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{var b=document.querySelector('.foodmodes [data-mode=search]'); if(b) b.click()}"); await page.wait_for_selector('#fdSearch', timeout=8000); await page.wait_for_timeout(1200)
            await page.fill('#fdSearch', 'laksa'); await page.wait_for_timeout(300)
            lk = await page.evaluate("()=>({first: (document.querySelector('#fdResults .result b')||{}).textContent, ask: !!document.querySelector('#fdResults [data-askluna]')})")
            await page.fill('#fdSearch', 'mee siam'); await page.wait_for_timeout(300)
            ms = await page.evaluate("()=>({ask: (document.querySelector('#fdResults [data-askluna]')||{}).textContent || ''})")
            await page.fill('#fdSearch', 'zzqqx dish'); await page.wait_for_timeout(300)
            zz = await page.evaluate("()=>({ask: (document.querySelector('#fdResults [data-askluna]')||{}).textContent || ''})")
            check("searching laksa finds HPB's laksa first; a dish the tables do not know offers Ask Luna", lk["first"] == "Laksa" and "zzqqx" in zz["ask"], {"laksa": lk, "mee siam": ms, "unknown": zz})
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)

            # acupressure (DeepSeek TCM review, 20 Oct): fourteen points with SP8 for first-day cramps, a before-you-press safety
            # list, and pregnancy cautions on SP6, SP8, LR3, LI4, the belly points and the lower back
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>{var b=document.querySelector('nav a[data-tab=mind]'); b.click();}"); await page.wait_for_selector("#mindAcu", timeout=8000)
            await page.evaluate("()=>document.querySelector('#mindAcu').click()"); await page.wait_for_selector(".acusafe", timeout=8000); await page.wait_for_timeout(400)
            nums = await page.evaluate("()=>Array.from(new Set(Array.from(document.querySelectorAll('[data-pt]')).map(b=>b.dataset.pt).filter(Boolean)))")
            await page.evaluate("()=>{var b=document.querySelector('[data-pt=sp8]'); if(b) b.click();}"); await page.wait_for_timeout(400)
            sp8 = await page.evaluate("()=>{var t=document.querySelector('#sheetBody, .sheet-body, #sheet').textContent; return {find: /four fingers flat downward/.test(t), use: /especially on the first day/.test(t), caution: /maternity team/.test(t), page: /page has not been checked/.test(t)};}")
            safe = await page.evaluate("()=>{var t=(document.querySelector('.acusafe')||{}).textContent||''; return {skin: /broken, red, hot, swollen/.test(t), thinners: /blood thinners/.test(t), stop: /numbness, tingling or dizziness/.test(t)};}")
            check("the acupressure sheet lists fourteen points with SP8, and the before-you-press list covers skin, blood thinners and when to stop", len(nums) >= 14 and "sp8" in nums and all(safe.values()), {"points": nums, "safe": safe})
            check("SP8 says how to find it with four fingers, what it is for, the pregnancy caution, and that its WHO page is not yet checked", all(sp8.values()), sp8)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(200)

            # four-persona review (20 Oct): a saved symptom shows its mindful line and her notebook pose; a chest-pain note saved by
            # hand opens the care card; the mat draws her in her own clothes; after menopause the calendar says Bleeding, fills
            # nothing and a saved day opens the prompt card; the fertility page shows no invented result
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>document.querySelector('.hotspot[data-id=calendar]').click()"); await page.wait_for_selector('#calTabs', timeout=8000)
            await page.evaluate("()=>document.querySelector('#calTabs [data-tab=symptom]').click()"); await page.wait_for_selector('#saveSym', timeout=8000)
            await page.evaluate("()=>{document.querySelector('#symChips [data-sym=headache]').click(); document.querySelector('#saveSym').click();}"); await page.wait_for_timeout(600)
            mo = await page.evaluate("()=>({sub: (document.querySelector('#toast .toastsub')||{}).textContent||'', img: document.querySelector('#avatarImg').getAttribute('src')})")
            check("a saved symptom shows a mindful line under the toast and her notebook pose", len(mo["sub"]) > 10 and "act-note" in mo["img"], mo)
            await page.evaluate("()=>{document.querySelector('#symNotes').value='my chest feels tight since lunch'; document.querySelector('#saveSym').click();}"); await page.wait_for_timeout(600)
            cc = await page.evaluate("()=>({care: !!document.querySelector('#careDone'), text: (document.querySelector('.carecard')||{}).textContent||'', toast: (document.querySelector('#toast')||{}).textContent||'', pop: document.querySelector('#heartsChip').classList.contains('pop')})")
            check("a chest-pain note saved by hand opens the care card with Call 995", cc["care"] and "Call 995" in cc["text"], cc)
            check("no hearts toast or heart pop sits beside the care card", "\u2665" not in cc["toast"] and not cc["pop"], cc)
            await page.evaluate("()=>{var b=document.querySelector('#careDone'); if(b) b.click();}"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{OvuStore.setProfile({outfit:'party'}); document.querySelector('nav a[data-tab=mind]').click();}"); await page.wait_for_timeout(800)
            md = await page.evaluate("()=>document.querySelector('#meditator img').getAttribute('src')")
            check("the mat draws her meditating in what she wears", "avatar-meditate-party" in (md or ""), md)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            await page.evaluate("()=>{OvuStore.setProfile({outfit:'base', lifeStage:'post'}); document.querySelector('.hotspot[data-id=calendar]').click();}"); await page.wait_for_selector('#calTabs', timeout=8000)
            pm1 = await page.evaluate("()=>{var tab=document.querySelector('#calTabs [data-tab=period]').textContent; var days=[...document.querySelectorAll('.cal-day[data-date]:not(.future)')].filter(b=>!/p-/.test(b.className)); var d=days[days.length-3]; var before=OvuStore.list('period').length; d.click(); return {tab:tab, added: OvuStore.list('period').length-before, date: d.dataset.date};}"); await page.wait_for_timeout(400)
            await page.evaluate("()=>{document.querySelector('#flowChips [data-flow=light]').click(); document.querySelector('#savePeriod').click();}"); await page.wait_for_timeout(600)
            pm2 = await page.evaluate("()=>({care: !!document.querySelector('#careDone'), text: (document.querySelector('.carecard')||{}).textContent||''})")
            check("after menopause the calendar says Bleeding, fills nothing, and a saved day opens the prompt card", pm1["tab"] == "Bleeding" and pm1["added"] == 0 and pm2["care"] and "This is not a period" in pm2["text"], [pm1, pm2["text"][:80]])
            await page.evaluate("()=>{var b=document.querySelector('#careDone'); if(b) b.click(); OvuStore.setProfile({lifeStage:''});}"); await page.wait_for_timeout(300)
            # Codex branch review (20 Oct): pain 10 entered on the period form opens the same-day card; a red flag found only after a
            # Luna save (heavy flow logged earlier, then "dizzy today") is shown in the chat
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>{var t=OvuStore.today(); OvuStore.byDate(t).forEach(function(e){ OvuStore.remove(e.id); }); OvuStore.setProfile({lifeStage:''});}") # a clean today: earlier checks saved a chest-pain note
            await page.evaluate("()=>document.querySelector('.hotspot[data-id=calendar]').click()"); await page.wait_for_selector('#savePeriod', timeout=8000)
            await page.evaluate("()=>{document.querySelector('#flowChips [data-flow=heavy]').click(); var r=document.querySelector('#ppain'); r.value='10'; r.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#savePeriod').click();}"); await page.wait_for_timeout(600)
            pc = await page.evaluate("()=>({care: !!document.querySelector('#careDone'), text: (document.querySelector('.carecard')||{}).textContent||''})")
            check("pain 10 on the period form opens the same-day care card", pc["care"] and "10 out of 10" in pc["text"], pc["text"][:80])
            await page.evaluate("()=>{var b=document.querySelector('#careDone'); if(b) b.click();}"); await page.wait_for_timeout(300)
            await page.evaluate("()=>document.querySelector('nav a[data-tab=luna], #lunaBtn, .luna') && (document.querySelector('#lunaBtn')||document.querySelector('.luna')).click()"); await page.wait_for_selector('#lunaIn', timeout=8000)
            await page.fill("#lunaIn", "dizzy today"); await page.click("#lunaSend"); await page.wait_for_selector("#lunaSave", timeout=8000)
            await page.click("#lunaSave"); await page.wait_for_timeout(600)
            lc = await page.evaluate("()=>[...document.querySelectorAll('#chat .bub.urgent')].map(b=>b.textContent).join(' | ')")
            check("a red flag found only after a Luna save is shown in the chat", "dizziness" in lc.lower() or "heavy bleeding" in lc.lower(), lc[:120])
            await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
            await page.goto(BASE + "fertility.html", wait_until="networkidle"); await page.wait_for_timeout(600)
            ft = await page.evaluate("()=>({t: document.body.innerText, est: (document.querySelector('#myEstimate')||{}).innerText||''})")
            check("the fertility page shows no invented result and her own estimate is labelled", "85%" not in ft["t"] and "surge detected" not in ft["t"].lower() and len(ft["est"]) > 10 and "Reading your calendar" not in ft["est"], ft["est"][:140])

            # round four of the sync review (20 Oct): real Web Locks and real fetch, two tabs of one phone. The first tab's
            # pull never answers; within its time limit the sync gives up, aborts the request and lets go of the lock, so
            # the second tab's sync, queued behind it, then runs. Only ovu-store.js and ovu-sync.js load, on a page with
            # no scripts of its own, against a host that cannot resolve: every request is answered or held here.
            ctx8 = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx8.add_init_script("window.OVU_CONFIG={supabaseUrl:'https://sync-test.invalid',supabaseKey:'k',functionsBase:'https://sync-test.invalid/functions/v1',syncRequestMs:400};")
            hold, held_urls, failed_urls = asyncio.Event(), [], []
            async def sync_gate(route):
                url, m = route.request.url, route.request.method
                if url.startswith(BASE): return await route.continue_()
                if "sync-test.invalid/rest/v1/entries" in url and m == "GET" and not held_urls:
                    held_urls.append(url); await hold.wait()
                    try: await route.abort()
                    except Exception: pass
                    return
                if "sync-test.invalid/rest/v1/" in url:
                    return await route.fulfill(status=200 if m == "GET" else 201, content_type="application/json", body="[]" if m == "GET" else "")
                await route.abort()
            await ctx8.route("**/*", sync_gate)
            ctx8.on("requestfailed", lambda r: failed_urls.append(r.url))
            stub = "()=>{window.OvuAuth={session:()=>({user:{id:'u1'}}),token:()=>Promise.resolve('t'),userId:()=>'u1'}; OvuStore.setProfile({cloud:{v:1,at:'2026-10-20T00:00:00Z',uid:'u1'}}); return true;}"
            tabs8 = []
            for _ in range(2):
                t = await ctx8.new_page(); await t.goto(BASE + "404.html")
                await t.add_script_tag(url=BASE + "ovu-store.js"); await t.add_script_tag(url=BASE + "ovu-sync.js"); await t.evaluate(stub)
                tabs8.append(t)
            await tabs8[0].evaluate("()=>{window.__s=OvuSync.syncNow(); return true;}")
            await tabs8[0].wait_for_timeout(50)
            try: second = await asyncio.wait_for(tabs8[1].evaluate("()=>{var t0=performance.now(); return OvuSync.syncNow().then(r=>({r:r, ms:Math.round(performance.now()-t0)}));}"), 10)
            except asyncio.TimeoutError: second = {"r": {}, "ms": -1, "stuck": True}
            try: first = await asyncio.wait_for(tabs8[0].evaluate("()=>window.__s"), 10)
            except asyncio.TimeoutError: first = {"stuck": True}
            locks = await tabs8[0].evaluate("()=>navigator.locks.query().then(q=>({held:q.held.length, pending:q.pending.length}))")
            await tabs8[0].wait_for_timeout(100); aborted_by_page = list(failed_urls) # before this harness lets go of the held request
            hold.set(); await tabs8[0].wait_for_timeout(100)
            check("real Web Locks: a pull that never answers ends the first tab's sync within its limit, and the second tab's sync then runs", bool(held_urls) and first.get("ok") is False and "too long" in (first.get("error") or "") and second["r"].get("ok") is True and second["ms"] >= 250 and locks == {"held": 0, "pending": 0}, {"first": first, "second": second, "locks": locks, "held": len(held_urls)})
            check("and the page aborted the stalled request itself, not left open", any("rest/v1/entries" in u for u in aborted_by_page), aborted_by_page[:2])
            await ctx8.close()
            # ---------- game music (21 Oct): opt in, one stop, silent where it must be ----------
            ctxm = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctxm.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxm.add_init_script(SESSION_SEED)
            pm = await ctxm.new_page(); await pm.route("**/*", gate)
            merr = []; pm.on("pageerror", lambda e: merr.append("pageerror: " + str(e)))
            await pm.goto(BASE + "room.html", wait_until="domcontentloaded")
            try: await pm.wait_for_function("()=>window.OvuMusic && window.OvuRoom && document.querySelector('#scene').dataset.layout && !OvuRoom.busy()", timeout=15000)
            except Exception: pass
            async def travel_m(t):
                await pm.evaluate("(t)=>OvuWalk.travel(t)", t)
                try: await pm.wait_for_function("(t)=>document.querySelector('#scene').dataset.layout===t && !document.querySelector('#scene').classList.contains('fading')", arg=t, timeout=12000)
                except Exception: pass
                await pm.wait_for_timeout(700)
            await pm.mouse.click(195, 420); await pm.wait_for_timeout(300); await pm.keyboard.press("Escape"); await pm.wait_for_timeout(200)
            await travel_m('garden')
            m0 = await pm.evaluate("()=>Object.assign(OvuMusic.state(), {chip: document.querySelector('#musicChip').getAttribute('aria-pressed'), pressedName: document.querySelector('#musicChip').getAttribute('aria-label')})")
            check("music: with the preference off, taps and a scene change start nothing; the chip is a Music button, not pressed", m0["on"] is False and m0["mode"] == "off" and m0["running"] is False and m0["chip"] == "false" and m0["pressedName"] == "Music", m0)
            await travel_m('home')
            await pm.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('window'))")
            try: await pm.wait_for_function("()=>OvuRoom.sheetOpen() && document.querySelector('#winMusic')", timeout=8000)
            except Exception: pass
            await pm.click('#winMusic'); await pm.wait_for_timeout(1200)
            m1 = await pm.evaluate("()=>Object.assign(OvuMusic.state(), {btn: document.querySelector('#winMusic') && document.querySelector('#winMusic').getAttribute('aria-pressed'), label: document.querySelector('#winMusic .mlabel') && document.querySelector('#winMusic .mlabel').textContent, focus: document.activeElement && document.activeElement.id, chip: document.querySelector('#musicChip').getAttribute('aria-pressed')})")
            check("music: Music on from the window sheet starts the home tune with the context running; the button stays focused and reads pressed, the chip too", m1["on"] is True and m1["mode"] == "play" and m1["theme"] == "home" and m1["running"] is True and m1["ctx"] == "running" and m1["btn"] == "true" and m1["label"] == "Music on" and m1["focus"] == "winMusic" and m1["chip"] == "true" and m1["layers"] == 1, m1)
            await pm.keyboard.press("Escape"); await pm.wait_for_timeout(300)
            await travel_m('garden'); await pm.wait_for_timeout(400)
            m2 = await pm.evaluate("()=>OvuMusic.state()")
            await travel_m('cave'); await pm.wait_for_timeout(1300)
            m3 = await pm.evaluate("()=>OvuMusic.state()")
            check("music: the garden brings its own theme on a crossfade; the cave has none and the engine goes quiet for the scene", m2["theme"] == "garden" and m2["mode"] == "play" and m3["mode"] == "silent" and m3["why"] == "scene" and m3["running"] is False and m3["gate"] <= 0.01, {"garden": m2, "cave": m3})
            await travel_m('home'); await pm.wait_for_timeout(1500)
            SILENT = re.search(r"var SILENT = '([^']+)'", open(os.path.join(ROOT, "ovu-morning.js")).read()).group(1)
            dk = await pm.evaluate("""async(sil)=>{var out={};
              var a=new Audio('assets/audio/guide-interim/teeth-0-0.mp3'); a.volume=1; try{ await a.play(); }catch(e){ out.playErr=String(e); }
              await new Promise(r=>setTimeout(r,500)); out.during=OvuMusic.state();
              a.pause(); await new Promise(r=>setTimeout(r,1700)); out.after=OvuMusic.state();
              var s=new Audio(sil); try{ await s.play(); }catch(e){ out.silErr=String(e); } await new Promise(r=>setTimeout(r,400)); out.silent=OvuMusic.state(); s.pause();
              return out; }""", SILENT)
            check("music: a voice clip ducks the tune to silence while it plays and the tune returns after it; the silent data: clip ducks nothing", dk["during"]["mode"] == "duck" and dk["during"]["media"] == 1 and dk["during"]["running"] is True and dk["after"]["mode"] == "play" and dk["after"]["media"] == 0 and dk["silent"]["mode"] == "play" and dk["silent"]["media"] == 0, dk)
            md = await pm.evaluate("""async()=>{ OvuRoom.enterMeditation(); await new Promise(r=>setTimeout(r,900)); var during=OvuMusic.state(); OvuRoom.exitMeditation(); await new Promise(r=>setTimeout(r,1400)); return {during: during, after: OvuMusic.state()}; }""")
            check("music: paced breathing is an activity that needs the ear: silent for its whole length, back afterwards", md["during"]["mode"] == "silent" and md["during"]["why"] == "activity" and md["after"]["mode"] == "play", md)
            sl = await pm.evaluate("""async()=>{ OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}}); await new Promise(r=>setTimeout(r,700)); var asleep=OvuMusic.state(); OvuStore.setState({sleeping:null}); await new Promise(r=>setTimeout(r,1400)); return {asleep: asleep, awake: OvuMusic.state()}; }""")
            check("music: sleep silences the tune at once and waking brings it back", sl["asleep"]["mode"] == "silent" and sl["asleep"]["why"] == "sleep" and sl["asleep"]["running"] is False and sl["awake"]["mode"] == "play", sl)
            hd = await pm.evaluate("""async()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:function(){return true}}); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r=>setTimeout(r,500)); var hidden=OvuMusic.state(); Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false}}); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r=>setTimeout(r,900)); return {hidden: hidden, back: OvuMusic.state()}; }""")
            check("music: a hidden page stops the scheduling and the tune returns when the page is back", hd["hidden"]["mode"] == "silent" and hd["hidden"]["why"] == "hidden" and hd["hidden"]["running"] is False and hd["back"]["mode"] == "play" and hd["back"]["running"] is True, hd)
            cues = await pm.evaluate("()=>({cast: OvuSound.play('cast'), boop: OvuSound.play('boop'), kit: !!OvuSound.KIT.cast})")
            check("music: the new harbour cast cue exists in the kit and plays", cues["kit"] and cues["cast"] is True and cues["boop"] is True, cues)
            await pm.click('#musicChip'); await pm.wait_for_timeout(900)
            m4 = await pm.evaluate("()=>Object.assign(OvuMusic.state(), {chip: document.querySelector('#musicChip').getAttribute('aria-pressed')})")
            await pm.reload(wait_until="domcontentloaded")
            try: await pm.wait_for_function("()=>window.OvuMusic && window.OvuRoom && document.querySelector('#scene').dataset.layout", timeout=15000)
            except Exception: pass
            await pm.wait_for_timeout(800)
            m5 = await pm.evaluate("()=>Object.assign(OvuMusic.state(), {chip: document.querySelector('#musicChip').getAttribute('aria-pressed')})")
            check("music: the top-bar chip stops the tune within a second, and the choice survives a reload", m4["on"] is False and m4["mode"] == "off" and m4["running"] is False and m4["chip"] == "false" and m5["on"] is False and m5["mode"] == "off" and m5["chip"] == "false", {"stopped": m4, "reloaded": m5})
            await pm.evaluate("()=>OvuStore.setState({music: true})"); await pm.reload(wait_until="domcontentloaded")
            try: await pm.wait_for_function("()=>window.OvuMusic && window.OvuRoom && document.querySelector('#scene').dataset.layout", timeout=15000)
            except Exception: pass
            await pm.wait_for_timeout(900)
            m6 = await pm.evaluate("()=>OvuMusic.state()")
            await pm.mouse.click(195, 420); await pm.wait_for_timeout(1200)
            m7 = await pm.evaluate("()=>OvuMusic.state()")
            check("music: with the preference already on, a fresh page waits for her first tap before anything sounds, then plays", m6["on"] is True and m6["mode"] in ("waiting", "silent") and m6["running"] is False and m7["mode"] == "play" and m7["running"] is True and m7["ctx"] == "running", {"before": m6, "after": m7})
            check("music: no page errors in the music run", not merr, merr[:3])
            await ctxm.close()
            # ---------- the Cycle tab and Your cycle rhythm (21 Oct) ----------
            ctxc = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctxc.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxc.add_init_script(SESSION_SEED)
            pc = await ctxc.new_page(); await pc.route("**/*", gate)
            cerr = []; pc.on("pageerror", lambda e: cerr.append("pageerror: " + str(e)))
            await pc.goto(BASE + "room.html", wait_until="domcontentloaded")
            try: await pc.wait_for_function("()=>window.OvuRhythm && window.OvuRoom && document.querySelector('#scene').dataset.layout && !OvuRoom.busy()", timeout=15000)
            except Exception: pass
            nav = await pc.evaluate("()=>[...document.querySelectorAll('.nav a')].map(a=>a.dataset.tab||'home')")
            # asleep, the Cycle tab still opens the calendar: the diary does not depend on the game
            await pc.evaluate("()=>OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}})"); await pc.wait_for_timeout(300)
            await pc.click('.nav a[data-tab=cycle]'); await pc.wait_for_timeout(700)
            c1 = await pc.evaluate("()=>({sheet: OvuRoom.sheetId(), tabs: [...document.querySelectorAll('#calTabs button')].map(b=>b.textContent), on: document.querySelector('.nav a[data-tab=cycle]').classList.contains('on')})")
            check("cycle: the tab is back between Home and Food and opens the calendar even while she sleeps, with Period, Symptoms and Rhythm views", nav[:3] == ["home", "cycle", "food"] and c1["sheet"] == "calendar" and c1["tabs"] == ["Period", "Symptoms", "Rhythm"] and c1["on"], {"nav": nav, "c1": c1})
            await pc.evaluate("()=>OvuStore.setState({sleeping:null})")
            await pc.click('#calTabs button[data-tab=rhythm]'); await pc.wait_for_timeout(400)
            r1 = await pc.evaluate("()=>({panel: document.querySelector('#rhythmPanel').textContent, hiddenCal: document.querySelector('#calBody').hidden, view: OvuStore.state().cycleView, dots: document.querySelectorAll('.ready .dot.on').length})")
            check("cycle: the Rhythm view shows Building your cycle picture at 0 of 3 for one logged period, Ovulation signs not assessed, no score anywhere", "Building your cycle picture" in r1["panel"] and "0 of 3" in r1["panel"] and r1["dots"] == 0 and "Not assessed" in r1["panel"] and "score" not in r1["panel"].lower() and "unlocked" not in r1["panel"].lower() and r1["hiddenCal"] and r1["view"] == "rhythm", {"dots": r1["dots"], "view": r1["view"], "head": r1["panel"][:160]})
            # four starts a month apart make 3 of 3 and a regularity comparison once the age band is known
            await pc.evaluate("""()=>{var S=OvuStore; S.setProfile({ageRange:'30-34'}); ['2026-07-02','2026-07-30','2026-08-27','2026-09-24'].forEach(function(s){ for(var i=0;i<4;i++) S.add('period', S.addDays(s,i), {flow:i<2?'medium':'light', clots:false, impact:false}, 'room'); });}""")
            await pc.keyboard.press("Escape"); await pc.wait_for_timeout(300)
            await pc.click('.nav a[data-tab=cycle]'); await pc.wait_for_timeout(700)
            r2 = await pc.evaluate("()=>({tab: document.querySelector('#calTabs button.on').dataset.tab, panel: document.querySelector('#rhythmPanel').textContent, dots: document.querySelectorAll('.ready .dot.on').length, levels: [...document.querySelectorAll('.rcard .lvl')].map(l=>l.textContent)})")
            check("cycle: the last view is remembered; four starts give 3 of 3, Within the reference range for regularity and lengths, Not assessed for ovulation; levels never add up", r2["tab"] == "rhythm" and r2["dots"] == 3 and "3 of 3" in r2["panel"] and r2["levels"][0] == "Within the reference range in these records" and r2["levels"][1] == "Within the reference range in these records" and r2["levels"][2] == "Not assessed" and "FIGO" in r2["panel"], {"tab": r2["tab"], "dots": r2["dots"], "levels": r2["levels"]})
            # after the menopause the tab reads Body and the view keeps symptoms, drops the count and names bleeding as a check
            await pc.evaluate("()=>OvuStore.setProfile({lifeStage:'post', ageRange:'50+'})"); await pc.wait_for_timeout(400)
            await pc.keyboard.press("Escape"); await pc.wait_for_timeout(300)
            lbl = await pc.evaluate("()=>document.querySelector('#navCycle .navlabel').textContent")
            await pc.click('.nav a[data-tab=cycle]'); await pc.wait_for_timeout(700)
            r3 = await pc.evaluate("()=>({tabs: [...document.querySelectorAll('#calTabs button')].map(b=>b.textContent), panel: document.querySelector('#rhythmPanel').textContent})")
            check("cycle: after the menopause the tab reads Body, the calendar's third view is Your body, there is no cycle count and any bleeding is named as a check", lbl == "Body" and r3["tabs"] == ["Bleeding", "Symptoms", "Your body"] and "Building your cycle picture" not in r3["panel"] and "any bleeding at all" in r3["panel"], {"lbl": lbl, "tabs": r3["tabs"]})
            check("cycle: no page errors in the cycle run", not cerr, cerr[:3])
            await ctxc.close()
            # ---------- Luna's chat panel (21 Oct): the Ovuluna card, honest about what Luna is ----------
            ctxl = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctxl.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB))); await ctxl.add_init_script(SESSION_SEED)
            pl = await ctxl.new_page(); await pl.route("**/*", gate)
            lerr = []; pl.on("pageerror", lambda e: lerr.append("pageerror: " + str(e)))
            await pl.goto(BASE + "room.html", wait_until="domcontentloaded")
            try: await pl.wait_for_function("()=>window.OvuRoom && document.querySelector('#scene').dataset.layout && !OvuRoom.busy()", timeout=15000)
            except Exception: pass
            await pl.evaluate("()=>document.querySelector('#lunaBtn').click()"); await pl.wait_for_timeout(600)
            lp = await pl.evaluate("()=>({card: document.querySelector('#sheet').classList.contains('luna-sheet'), face: !!document.querySelector('#sheetIcon img.lunaico'), title: document.querySelector('#sheetTitle').textContent, state: (document.querySelector('.lunastrip .lstate')||{}).textContent||'', dot: !!document.querySelector('.ldot'), asks: [...document.querySelectorAll('.askchip')].map(a=>a.getAttribute('href')), note: (document.querySelector('.lunanote')||{}).textContent||'', placeholder: document.querySelector('#lunaIn').placeholder, upgrade: /upgrade|premium/i.test(document.querySelector('#sheetBody').textContent)})")
            pages_ok = []
            for href in lp["asks"]:
                r = await pl.request.get(BASE + href); pages_ok.append(r.ok)
            check("luna: the chat is a floating card with her face, 'Your wellness companion', an honest state line, three ask chips that open real guides, the companion note, and no upsell", lp["card"] and lp["face"] and "Your wellness companion" in lp["title"] and ("Rules only" in lp["state"] or "reading is on" in lp["state"]) and lp["dot"] and len(lp["asks"]) == 3 and all(pages_ok) and "not a doctor" in lp["note"] and "ask about your cycle" in lp["placeholder"] and not lp["upgrade"], {"lp": {k: lp[k] for k in ("card", "face", "title", "state", "asks", "placeholder", "upgrade")}, "pages": pages_ok})
            await pl.keyboard.press("Escape"); await pl.wait_for_timeout(300)
            await pl.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('window'))"); await pl.wait_for_timeout(500)
            other = await pl.evaluate("()=>({card: document.querySelector('#sheet').classList.contains('luna-sheet'), icon: !!document.querySelector('#sheetIcon .ms')})")
            check("luna: another sheet is an ordinary sheet again, with an icon, not her face", not other["card"] and other["icon"], other)
            # closed on a tall screen, Luna's top-anchored card leaves the screen for good (Codex re-check, 21 Oct)
            await pl.set_viewport_size({"width": 390, "height": 1000})
            await pl.evaluate("()=>document.querySelector('#lunaBtn').click()"); await pl.wait_for_timeout(500)
            await pl.evaluate("()=>OvuRoom.closeSheet()"); await pl.wait_for_timeout(700)
            lc = await pl.evaluate("()=>{var s=document.querySelector('#sheet'), cs=getComputedStyle(s), r=s.getBoundingClientRect(); var hit=document.elementFromPoint(195, Math.min(990, Math.max(0, r.top+10))); return {vis: cs.visibility, pe: cs.pointerEvents, inside: !!(hit && s.contains(hit)), aria: s.getAttribute('aria-hidden')}}")
            check("luna: closed on a tall screen, the card is hidden, untappable and marked hidden for assistive technology", lc["vis"] == "hidden" and lc["pe"] == "none" and not lc["inside"] and lc["aria"] == "true", lc)
            check("luna: no page errors in the Luna run", not lerr, lerr[:3])
            await ctxl.close()

            check("no page errors or console errors across the run", not errors, errors[:3])
            await browser.close()
    finally:
        if server: server.terminate()
    failed = [r for r in results if not r[1]]
    print("\n%d passed, %d failed" % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)

asyncio.run(main())
