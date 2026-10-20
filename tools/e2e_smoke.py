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
DB = {"version": 1, "createdAt": NOW, "updatedAt": NOW,
      "profile": {"name": "Smoke", "outfit": "base", "lifeStage": "", "cycleLength": None, "periodLength": None, "onboarded": True,
                  "consent": {"v": 3, "at": NOW, "luna": False, "improve": False}, "ageAttest": {"confirmed": True, "version": 1, "at": NOW},
                  "consentEvents": [{"id": "ce1", "purpose": "age_18", "action": "grant", "at": NOW, "notice": 3, "method": "sheet", "uid": None, "sent": False}, {"id": "ce2", "purpose": "health_tracking", "action": "grant", "at": NOW, "notice": 3, "method": "sheet", "uid": None, "sent": False}], "consentImportedAt": NOW},
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
            check("eight or more hotspots and the five tabs render", info["hots"] >= 8 and info["tabs"] == 5, info)
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
            await page.wait_for_timeout(300); routed = await page.evaluate("()=>({walking: OvuWalk.walking(), route: !!OvuWalk.route(), cyc: OvuWalk.cycle().on})")
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
            await floor_tap(44, 76)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            zoomed = await page.evaluate("()=>({pos: OvuRoom.pos(), zoomed: document.querySelector('#scene').classList.contains('zoomed')})")
            check("a floor tap while the camera is zoomed in lands on the right spot of the plate", zoomed["zoomed"] and abs(zoomed["pos"]["x"] - 44) < 2 and abs(zoomed["pos"]["y"] - 76) < 2, zoomed)
            await page.evaluate("()=>OvuTextSize.set('large')"); await page.wait_for_timeout(200)
            await floor_tap(52, 82)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            big = await page.evaluate("()=>({zoom: document.documentElement.style.zoom, attr: document.documentElement.getAttribute('data-text'), saved: JSON.parse(localStorage.getItem('ovumind_db_v1')).profile.textSize, pos: OvuRoom.pos(), scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1})")
            await page.evaluate("()=>OvuTextSize.set('default')")
            check("the text size setting scales the whole page, is saved, keeps the page from scrolling sideways, and a floor tap still lands on the right spot", big["zoom"] == "1.12" and big["attr"] == "large" and big["saved"] == "large" and abs(big["pos"]["x"] - 52) < 2 and abs(big["pos"]["y"] - 82) < 2 and big["scroll"], big)
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
            await page.click("#hudMute"); await page.wait_for_timeout(200)
            mu = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), pressed: document.querySelector('#hudMute').getAttribute('aria-pressed'), flag: OvuVoice.muted(), saved: localStorage.getItem('rhythme_voice_muted'), probe: (function(){ var a=new Audio('assets/audio/guide-interim/garden-water-0.mp3'); a.play().catch(function(){}); var m=a.muted; a.pause(); return m; })()})")
            await page.click("#hudMute"); await page.wait_for_timeout(150)
            unmu = await page.evaluate("()=>({pressed: document.querySelector('#hudMute').getAttribute('aria-pressed'), flag: OvuVoice.muted()})")
            check("the mute button silences Erin's voice without stopping the watering minute, is remembered, and turns her back on", mu["on"] and mu["pressed"] == "true" and mu["flag"] and mu["saved"] == "1" and mu["probe"] and unmu["pressed"] == "false" and not unmu["flag"], {"mu": mu, "unmu": unmu})
            await page.click("#hudStop"); await page.wait_for_timeout(500)
            stopped = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), toast: document.querySelector('#toast').textContent})")
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
            check("signed out, the pill says Groups · sign in to join and its sheet offers sign-in, with no group list and no request", po["shown"] and "Groups · sign in to join" in po["text"] and po["signin"], po)
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

            # 2. the Cycle tab opens a sheet with the calendar
            await page.goto(BASE + "room.html#cycle", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] [data-date], #sheet[aria-hidden="false"] .rday', timeout=10000)
            cyc = await page.evaluate("()=>{var cells=document.querySelectorAll('#sheet [data-date], #sheet .rday'); return {sheet: document.querySelector('#sheet')?.getAttribute('aria-hidden') === 'false', title: document.querySelector('#sheetTitle')?.textContent.slice(0,13), days: cells.length, visible: (cells[0]?.getBoundingClientRect().height || 0) > 0};}")
            check("Cycle tab opens the calendar sheet with visible days", cyc["sheet"] and cyc["title"] == "Your calendar" and cyc["days"] >= 28 and cyc["visible"], cyc)
            ib = await page.evaluate("()=>{var b=document.querySelector('#sheet .ibtn'); if(!b) return null; b.click(); var p=document.querySelector('#sheet .guide[data-guide-panel='+b.dataset.guide+']'); return {topic: b.dataset.guide, on: !!(p && p.classList.contains('on'))}}")
            check("an (i) button in the calendar sheet opens its guide panel, made on the spot if the sheet forgot it", ib is None or ib["on"], ib)

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
            # 3b. the safety rules read before anything is parsed (docs/debate/2026-10-18-persona-safety-recheck.md)
            await page.goto(BASE + "room.html#luna", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector("#lunaIn", timeout=10000)
            await page.fill("#lunaIn", "I want to hurt myself"); await page.click("#lunaSend"); await page.wait_for_timeout(400)
            sh = await page.evaluate("()=>{var c=[...document.querySelectorAll('.bub.urgent.emergency')].pop(); return c ? {text: c.textContent, hrefs: [...c.querySelectorAll('a')].map(a=>a.getAttribute('href'))} : null}")
            check("a self-harm note shows the 995 and SOS card with its own call links", bool(sh) and "If you have thoughts of harming yourself, you need help now." in sh["text"] and "your baby" not in sh["text"] and "SOS is available 24 hours on 1767, or WhatsApp 9151 1767." in sh["text"] and sh["hrefs"] == ["tel:995", "tel:1767", "https://wa.me/6591511767"], sh)
            await page.fill("#lunaIn", "My period has not returned."); await page.click("#lunaSend"); await page.wait_for_timeout(400)
            np = await page.evaluate("()=>{var b=[...document.querySelectorAll('.bub.from-luna')].pop(); var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); return {text: b ? b.textContent : '', periodsToday: db.events.filter(e=>e.type==='period'&&e.date==='%s').length, confirm: document.querySelectorAll('.bub.confirm').length}}" % TODAY)
            check("'My period has not returned.' is acknowledged as no bleeding and adds no period day", "no bleeding" in np["text"] and np["periodsToday"] == 0 and np["confirm"] == 0, np)
            check("still no relay call after the safety notes", not relay_calls, relay_calls[:2])

            # 4. the food diary opens with its tabs
            await page.goto(BASE + "room.html#food", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector(".foodmodes button", timeout=10000)
            food = await page.evaluate("()=>({modes: document.querySelectorAll('.foodmodes button').length, panes: document.querySelectorAll('.dtabs button, .dpane').length})")
            check("food diary opens with its modes and panes", food["modes"] >= 2 and food["panes"] >= 2, food)

            # 4b. the You tab shows the Your account row; a signed-out visitor makes no auth or data call
            await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle"); await page.wait_for_selector('#sheet[aria-hidden="false"] #youAccount .ygroup', timeout=10000)
            acct = await page.evaluate("()=>{var a=document.querySelector('#youAccount');return {label:a&&a.querySelector('.lbl')?a.querySelector('.lbl').textContent:null, email: !!(a&&a.querySelector('[data-ya=\"email-start\"]')), intro: ((a&&a.querySelector('.ya-intro')?a.querySelector('.ya-intro').textContent:'')||'').toLowerCase().indexOf('cloud backup')>=0};}")
            check("You tab shows the Your account row with email sign-in and the backup line", acct["label"] == "Your account" and acct["email"] and acct["intro"], acct)
            check("no sign-in or data request leaves the page for a signed-out person", not [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1" in u)], relay_calls[:3])
            # Your choices: every use of the data as a switch, the required one locked on, a receipt; a change is recorded with where it was made
            await page.evaluate("()=>document.querySelector('[data-yact=choices]').click()"); await page.wait_for_selector("#y_health_tracking", timeout=8000); await page.wait_for_timeout(300)
            ch = await page.evaluate("()=>({title: document.querySelector('#sheetTitle').textContent, n: document.querySelectorAll('.c-choice input').length, req: document.querySelector('#y_health_tracking').checked && document.querySelector('#y_health_tracking').disabled, anyOn: Array.from(document.querySelectorAll('.c-choice input:not(#y_health_tracking)')).some(i=>i.checked), receipt: (document.body.textContent||'').indexOf('Your consent receipt')>-1 && (document.body.textContent||'').indexOf('Notice version 3')>-1})")
            check("Your choices lists six switches with health tracking locked on, the rest off, and the receipt at notice 3", ch["title"].startswith("Your choices") and ch["n"] == 6 and ch["req"] and not ch["anyOn"] and ch["receipt"], ch)
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
            before = await p2.evaluate("()=>({shown: !document.querySelector('#consent').hidden, n: document.querySelectorAll('#cChoices input[type=checkbox]').length, anyOn: Array.from(document.querySelectorAll('#cChoices input')).some(i=>i.checked), age: document.querySelector('#cAge').checked, health: document.querySelector('#cHealth').checked, locked: document.querySelector('#cAgree').disabled, under: !!document.querySelector('#cUnder')})")
            check("the notice opens with five separate choices all off, the required health line ticked, the 18+ tick unticked, the button locked and an under-18 way out", before["shown"] and before["n"] == 5 and not before["anyOn"] and not before["age"] and before["health"] and before["locked"] and before["under"], before)
            await p2.uncheck("#cHealth"); await p2.check("#cAge"); lockedStill = await p2.evaluate("()=>document.querySelector('#cAgree').disabled"); await p2.check("#cHealth"); await p2.click("#cAgree"); await p2.wait_for_timeout(600)
            check("the health line is still required: with it unticked, the age tick alone does not unlock the button", lockedStill)
            after = await p2.evaluate("()=>{var p=JSON.parse(localStorage.getItem('ovumind_db_v1')).profile; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); return {v:p.consent&&p.consent.v, age:p.ageAttest&&p.ageAttest.confirmed===true?p.ageAttest.version:null, purposes:(p.consentEvents||[]).map(e=>e.purpose+':'+e.action+':'+e.method).sort(), aiOn:!!ai.on, cloud:p.cloud&&p.cloud.v, hidden: document.querySelector('#consent').hidden};}")
            check("agreeing records the 18+ attestation and health tracking at notice 3, nothing else, and closes the notice", after["v"] == 3 and after["age"] == 1 and after["purposes"] == ["age_18:grant:sheet", "health_tracking:grant:sheet"] and not after["aiOn"] and not after["cloud"] and after["hidden"], after)
            await ctx2.close()
            # a person whose consent predates notice v2 is sent back to the room from any other page
            ctx3 = await browser.new_context(viewport={"width": 390, "height": 844})
            old = json.loads(json.dumps(DB)); old["profile"]["consent"] = {"v": 1, "at": NOW, "improve": True}
            await ctx3.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(old)))
            p3 = await ctx3.new_page(); await p3.route("**/*", gate)
            await p3.goto(BASE + "hormones.html", wait_until="load"); await p3.wait_for_timeout(700)
            check("a v1 consent is sent back to the room to be asked again", p3.url.endswith("room.html"), p3.url)
            await ctx3.close()
            # a person who agreed to notice v2 reads v3: the switches show today's settings, 18+ is asked afresh, the diary is kept
            ctx4 = await browser.new_context(viewport={"width": 390, "height": 844})
            v2 = json.loads(json.dumps(DB)); v2["profile"]["consent"] = {"v": 2, "at": NOW, "luna": True, "improve": False, "age13": True}
            for k in ("ageAttest", "consentEvents", "consentImportedAt"): v2["profile"].pop(k, None)
            await ctx4.add_init_script("if(!localStorage.getItem('ovumind_db_v1')){ localStorage.setItem('ovumind_db_v1', %s); localStorage.setItem('ovumind_ai_v1', JSON.stringify({on:false, insights:false, photos:true})); }" % json.dumps(json.dumps(v2)))
            p4 = await ctx4.new_page(); await p4.route("**/*", gate)
            p4.on("pageerror", lambda e: errors.append("v2 pageerror: " + str(e)))
            await p4.goto(BASE + "room.html", wait_until="networkidle"); await p4.wait_for_timeout(900)
            rc = await p4.evaluate("()=>({shown: !document.querySelector('#consent').hidden, title: document.querySelector('#cTitle').textContent, photos: document.querySelector('#c_food_photo_ai').checked, reading: document.querySelector('#c_ai_reading').checked, cloud: document.querySelector('#c_cloud_sync').checked, age: document.querySelector('#cAge').checked, locked: document.querySelector('#cAgree').disabled, fine: document.querySelector('#cFine').textContent, welcome: !!document.querySelector('#welcome:not([hidden])')})")
            check("a v2 consent reads the changed notice: the photo switch mirrors her setting, the rest are off, 18+ is asked afresh", rc["shown"] and rc["title"] == "Our data notice has changed" and rc["photos"] and not rc["reading"] and not rc["cloud"] and not rc["age"] and rc["locked"] and rc["fine"] == "Your diary on this phone is kept as it is." and not rc["welcome"], rc)
            await p4.check("#c_ai_reading"); await p4.check("#cAge"); await p4.check("#cHealth"); await p4.click("#cAgree"); await p4.wait_for_timeout(700)
            rd = await p4.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); var p=db.profile; var ai=JSON.parse(localStorage.getItem('ovumind_ai_v1')||'{}'); var ev=p.consentEvents||[]; return {v:p.consent.v, age:p.ageAttest&&p.ageAttest.confirmed, imports: ev.filter(e=>e.method==='import').map(e=>e.purpose).sort(), sheet: ev.filter(e=>e.method==='sheet').map(e=>e.purpose+':'+e.action).sort(), aiOn: ai.on, aiPhotos: ai.photos, events: db.events.length, hidden: document.querySelector('#consent').hidden};}")
            check("agreeing again keeps the earlier choices as imports, records the sheet's choices at notice 3 and keeps every entry", rd["v"] == 3 and rd["age"] is True and rd["imports"] == ["food_photo_ai", "health_tracking"] and rd["sheet"] == ["age_18:grant", "ai_reading:grant", "food_photo_ai:grant", "health_tracking:grant"] and rd["aiOn"] is True and rd["aiPhotos"] is True and rd["events"] == 3 and rd["hidden"], rd)
            await ctx4.close()
            # under 18: the room does not open, nothing is saved, and the notice is back on the next visit
            ctx5 = await browser.new_context(viewport={"width": 390, "height": 844})
            p5 = await ctx5.new_page(); await p5.route("**/*", gate)
            await p5.goto(BASE + "room.html", wait_until="networkidle"); await p5.wait_for_timeout(700)
            await p5.click("#welcome .btn.primary"); await p5.wait_for_timeout(400)
            await p5.click("#cUnder"); await p5.wait_for_timeout(400)
            u1 = await p5.evaluate("()=>({msg: (document.querySelector('#consent h2')||{}).textContent, agree: !!document.querySelector('#cAgree'), open: !document.querySelector('#consent').hidden, exportLink: !!document.querySelector('#cExport') && !!document.querySelector('#cWipe'), db: localStorage.getItem('ovumind_db_v1')})")
            await p5.reload(wait_until="networkidle"); await p5.wait_for_timeout(700)
            u2 = await p5.evaluate("()=>({welcome: !!document.querySelector('#welcome:not([hidden])'), consent: !document.querySelector('#consent').hidden, db: localStorage.getItem('ovumind_db_v1')})")
            check("under 18: a plain message, export and delete right there, no agree button, nothing written at all, and the doorway is back on reload", "18 and over" in (u1["msg"] or "") and not u1["agree"] and u1["open"] and u1["exportLink"] and '"consent":{' not in (u1["db"] or "") and 'under18' not in (u1["db"] or "") and (u2["welcome"] or u2["consent"]) and '"ageAttest"' not in (u2["db"] or ""), {"u1": {k: u1[k] for k in ("msg", "agree", "open", "exportLink")}, "u2": {k: u2[k] for k in ("welcome", "consent")}})
            await ctx5.close()
            # bleeding after menopause: the journal note stays until she hides it, and hiding it holds after a reload
            ctx6 = await browser.new_context(viewport={"width": 390, "height": 844})
            pm = json.loads(json.dumps(DB)); pm["profile"]["lifeStage"] = "post"
            pm["events"].append({"id": "pm1", "type": "symptom", "date": TODAY, "createdAt": NOW, "updatedAt": NOW, "source": "luna", "data": {"symptoms": ["spotting"], "pain": None, "mood": "", "notes": ""}})
            await ctx6.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(pm)))
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
            await page.evaluate("()=>{document.querySelector('#mQuiet').checked = true}")
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
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(250)
            er = await page.evaluate("()=>({title: document.querySelector('#mpTitle').textContent, text: document.querySelector('#mpText').textContent, voice: document.querySelector('#mpQuiet') && document.querySelector('#mpQuiet').textContent})")
            await page.evaluate("()=>OvuStore.setState({sleeping:{startedAt:new Date().toISOString(), bedTime:'23:00'}})"); await page.wait_for_timeout(1400)
            cx = await page.evaluate("()=>{var y=document.querySelector('#mdYes'); return {active: OvuMorning.active(), panel: document.querySelector('#mpanel').hidden, prompt: OvuRoom.sheetOpen()}}")
            check("with Erin: her own first line and a voice switch; falling asleep stops it at once with no save prompt", er["title"] == "Brushing with Erin" and er["text"].startswith("Good morning") and er["voice"] == "Voice off" and not cx["active"] and cx["panel"] and not cx["prompt"], {"er": er, "cx": cx})
            await page.evaluate("()=>{OvuStore.setState({sleeping:null, morningStart:null}); OvuRoom.renderDeck();}"); await page.wait_for_timeout(200)
            await page.click("#miLater"); await page.wait_for_timeout(200)
            lt = await page.evaluate("()=>({inv: document.querySelector('#morningInvite').hidden, dis: (OvuStore.state().morningStart||{}).dismissed})")
            check("Not today puts the invitation away for the day", lt["inv"] and lt["dis"], lt)
            # after the Codex diff review: focus, pause then next, no walking, sleep then stop, no overlap, the invitation comes back
            await page.evaluate("()=>{OvuStore.setState({morningStart:null}); OvuRoom.renderDeck();}"); await page.wait_for_timeout(150)
            await page.click("#miBegin"); await page.wait_for_selector("#mBegin", timeout=5000); await page.evaluate("()=>{document.querySelector('#mQuiet').checked = true}")
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
            await page.click("#mpStop"); await page.wait_for_timeout(300)
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
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(200)
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
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.wait_for_timeout(100)
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
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady"); await page.click("#mpPause")
            for _ in range(3): await page.click("#mpNext")
            pk = await page.evaluate("()=>OvuMorning.state()")
            await page.click("#mpStop"); await page.wait_for_selector("#mdYes", timeout=5000)
            sp = await page.evaluate("()=>{Date.now = window.__dn6; return [...document.querySelectorAll('.mintro')].map(e=>e.textContent).join(' | ')}")
            await page.click("#mdNo"); await page.wait_for_timeout(200)
            await page.evaluate("()=>OvuMorning.begin('erin', true)"); await page.wait_for_timeout(80)
            await page.click("#mpNext"); await page.click("#mpNext"); await page.click("#mpReady")
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
            await page.mouse.click(30, 700); await page.wait_for_timeout(400)
            # the street bench: on the wide plate the seated width comes from the box's aspect, not the plate's
            went = await page.evaluate("()=>({went: OvuWalk.travel('street'), toast: (document.querySelector('#toast')||{}).textContent, cls: document.querySelector('#scene').className})")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            onst = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, bench: !!document.querySelector('.hotspot[data-id=bench]'), cls: document.querySelector('#scene').className})")
            ST = "()=>({layout: document.querySelector('#scene').dataset.layout, pos: OvuRoom.pos(), sitting: OvuGarden.sitting(), walking: OvuWalk.walking(), cls: document.querySelector('#scene').className, toast: (document.querySelector('#toast')||{}).textContent})"
            if onst["layout"] == "street" and onst["bench"]:
                b0 = await page.evaluate(ST)
                await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('bench'))")
                try: await page.wait_for_selector('#benchSit', timeout=12000); await page.click('#benchSit'); await page.wait_for_timeout(900)
                except Exception: print("street bench card did not open:", b0, await page.evaluate(ST))
            else: print("street bench skipped:", went, onst)
            sb = await page.evaluate("()=>{var el=document.querySelector('.nb.sitter'), b=document.querySelector('#scene').getBoundingClientRect(), r=el&&el.getBoundingClientRect(); return {there: !!el, w: el&&parseFloat(el.style.width), left: el&&parseFloat(el.style.left), inside: !!r && r.left>=b.left && r.right<=b.right && r.bottom<=b.bottom, layout: document.querySelector('#scene').dataset.layout}}")
            check("on the street bench she sits on its seat, on screen", sb["there"] and sb["layout"] == "street" and abs(sb["left"] - 53) < 0.5 and sb["w"] > 5 and sb["inside"], sb)
            await page.mouse.click(30, 700); await page.wait_for_timeout(400)
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

            # the farm: the garden path leads there, twelve beds draw on the plate, the shed gives seeds, a bed is planted and
            # watered, and a harvest offers to log a meal without writing one
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.evaluate("()=>{OvuRoom.isNight=function(){return false}; OvuRoom.asleep=function(){return false}; if (window.OvuPetWalk) OvuPetWalk.auto(false); OvuStore.setState({farm: null, stamina: null}); OvuWalk.travel('garden');}"); await page.wait_for_timeout(1800)
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('farmpath'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'farm'", timeout=12000)
            except Exception: pass
            await page.wait_for_timeout(900)
            farm = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, beds: document.querySelectorAll('#ownedProps .bed').length, hots: [...document.querySelectorAll('.hotspot')].map(h=>h.dataset.id).join(','), here: document.querySelector('#mapHere')?.textContent, zone: document.querySelector('#zoneName')?.textContent})")
            check("the garden path walks her onto the farm: twelve beds on the plate, four hotspots, the pill saying Farm", farm["layout"] == "farm" and farm["beds"] == 12 and farm["hots"] == "farmgate,shed,well,basket" and farm["here"] == "Farm" and farm["zone"] == "Your farm", farm)
            foods_before = await page.evaluate("()=>OvuStore.list('food').length")
            # the shed's hearts shelf (Phase 1, 20 Oct): seed packs, local crops and tools for hearts; the free seeds stay
            sh = await page.evaluate("()=>{OvuFarm.openShed(); var b=document.querySelector('#shedBuy'); var snap=JSON.stringify(OvuStore.state().farm||null), rw=JSON.stringify(OvuStore.state().rewards||null); var f=OvuFarm.farmState(OvuStore); var before=f.seeds.radish||0; var p=b && b.querySelector('[data-pack=radish]'); if (p) p.click(); var after=(OvuFarm.farmState(OvuStore).seeds.radish||0); OvuStore.setState({farm: JSON.parse(snap), rewards: JSON.parse(rw)}); return {shelf: !!b, packs: b ? b.querySelectorAll('[data-pack]').length : 0, unlocks: b ? b.querySelectorAll('[data-unlock]').length : 0, tools: b ? b.querySelectorAll('[data-tool]').length : 0, free: document.querySelectorAll('#shedActs [data-seed]').length, gained: after - before}}")
            check("the shed has a hearts shelf (seed packs, five local crops to unlock, two tools) beside the free seeds, and a pack adds three seeds", sh["shelf"] and sh["packs"] >= 5 and sh["unlocks"] == 5 and sh["tools"] == 2 and sh["free"] >= 5 and sh["gained"] == 3, sh)
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
            watered = await page.evaluate("(id)=>{var b=document.querySelector('#bedActs [data-bed=water]'); if(!b) return {btn:false}; b.click(); var bb=OvuFarm.bed(OvuStore,id); return {btn:true, days: OvuFarm.growthDays(bb), stam: OvuStamina.value(), stage: OvuFarm.stage(bb)}}", bed)
            check("tapping a bed walks her over and opens it; planting a radish and watering it costs energy and counts one day", planted["btn"] and planted["crop"] == "radish" and watered["btn"] and watered["days"] == 1 and 1 <= watered["stage"] <= 2 and watered["stam"] == 100 - 2 - 6, {"planted": planted, "watered": watered})
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
            await page.evaluate("()=>OvuRoom.tap(OvuRoom.hotspot('farmgate'))")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout === 'garden'", timeout=12000)
            except Exception: pass
            back = await page.evaluate("()=>document.querySelector('#scene').dataset.layout")
            check("the farm gate leads back to the garden", back == "garden", back)
            # plaza servers, signed in: a fake session and a small fake plaza server answer the four plaza calls here;
            # nothing leaves the machine. 23 in PCOS, 2 in Everyone, Menopause full.
            SESS = {"access_token": "smoke-token", "refresh_token": "smoke-refresh", "expires_at": int(time.time()) + 86400, "user": {"id": "00000000-0000-4000-8000-0000000000aa", "email": "smoke@example.test"}}
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
            check("Make my card sends the name, the look, the two ticked boxes (18+ and Plaza friends), no expected card and the notice version, and the sheet shows her card, Priya's ask with its hello and the note from her", cs and cs[0]["p_name"] == "Fern" and cs[0]["p_look"] == "kebaya-red" and cs[0]["p_adult"] is True and cs[0]["p_opt_in"] is True and cs[0]["p_expect"] is None and cs[0]["p_hidden"] is False and cs[0]["p_notice"] == 3 and "Fern" in fs["text"] and "Hello, nice to see you here." in fs["text"] and "Hope today is gentle with you." in fs["text"] and "Welcome her in." in fs["text"], {"save": cs, "text": fs["text"][:200]})
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
            xt = await p6.evaluate("()=>({open: OvuRoom.sheetOpen() && !!document.querySelector('#frSheet'), me: OvuFriends.state().me && OvuFriends.state().me.card ? OvuFriends.state().me.card.name : null})")
            b_calls = [a for a in fauth[n_before:]]
            await tab2.evaluate("(s)=>localStorage.setItem('ovumind_auth_v1', s)", json.dumps(SESS)); await p6.wait_for_timeout(700)
            await tab2.close()
            check("signing into another account in another tab closes the friends sheet here and drops the last account's card at once; what follows asks as the new account", not xt["open"] and xt["me"] is None and b_calls and all(a == "Bearer smoke-token-b" for a in b_calls), {"tab": xt, "calls after": b_calls})
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

            # the staff page: signed out it shows the sign-in gate only, no dashboard, no data call
            await page.goto(BASE + "admin.html", wait_until="networkidle"); await page.wait_for_timeout(500)
            ag = await page.evaluate("()=>({h2: (document.querySelector('h2')||{}).textContent, email: !!document.querySelector('#gEmail'), send: !!document.querySelector('#gSend'), nav: !!document.querySelector('nav.tabs')})")
            check("the staff page signed out shows only the sign-in gate (no dashboard, no data request)", ag["h2"] == "Rhythme staff" and ag["email"] and ag["send"] and not ag["nav"], ag)
            check("no Supabase auth or data request was made anywhere in the signed-out run", not [u for u in relay_calls if ("/auth/v1" in u or "/rest/v1" in u)], relay_calls[:3])
            check("nothing was requested from any third party during the run", not external, external[:3])

            # 9. asleep: nothing opens until the bed wakes her (hotspots, the nav sheets, Luna); You and the bed stay open
            ctx9 = await browser.new_context(viewport={"width": 390, "height": 844})
            zz = json.loads(json.dumps(DB)); zz["state"]["sleeping"] = {"startedAt": NOW, "bedTime": "23:00", "prevOutfit": "base", "pj": True}
            await ctx9.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(zz)))
            p9 = await ctx9.new_page(); await p9.route("**/*", gate)
            p9.on("pageerror", lambda e: errors.append("asleep pageerror: " + str(e)))
            await p9.goto(BASE + "room.html", wait_until="networkidle"); await p9.wait_for_selector(".hotspot"); await p9.wait_for_timeout(900)
            await p9.click(".hotspot[data-id=diary]"); await p9.wait_for_timeout(500)
            z1 = await p9.evaluate("()=>({toast: document.querySelector('#toast').textContent, sheet: document.querySelector('#sheet').getAttribute('aria-hidden')})")
            await p9.click(".hotspot[data-id=door]"); await p9.wait_for_timeout(700)
            z1["door"] = await p9.evaluate("()=>({sheet: document.querySelector('#sheet').getAttribute('aria-hidden'), layout: (document.querySelector('.scene')||{}).dataset ? document.querySelector('.scene').dataset.layout : null})")
            await p9.click("nav a[data-tab=cycle]"); await p9.wait_for_timeout(500)
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
            await page.evaluate("()=>document.querySelector('nav a[data-tab=cycle]').click()"); await page.wait_for_selector('#calTabs', timeout=8000)
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
            await page.evaluate("()=>{OvuStore.setProfile({outfit:'base', lifeStage:'post'}); document.querySelector('nav a[data-tab=cycle]').click();}"); await page.wait_for_selector('#calTabs', timeout=8000)
            pm1 = await page.evaluate("()=>{var tab=document.querySelector('#calTabs [data-tab=period]').textContent; var days=[...document.querySelectorAll('.cal-day[data-date]:not(.future)')].filter(b=>!/p-/.test(b.className)); var d=days[days.length-3]; var before=OvuStore.list('period').length; d.click(); return {tab:tab, added: OvuStore.list('period').length-before, date: d.dataset.date};}"); await page.wait_for_timeout(400)
            await page.evaluate("()=>{document.querySelector('#flowChips [data-flow=light]').click(); document.querySelector('#savePeriod').click();}"); await page.wait_for_timeout(600)
            pm2 = await page.evaluate("()=>({care: !!document.querySelector('#careDone'), text: (document.querySelector('.carecard')||{}).textContent||''})")
            check("after menopause the calendar says Bleeding, fills nothing, and a saved day opens the prompt card", pm1["tab"] == "Bleeding" and pm1["added"] == 0 and pm2["care"] and "This is not a period" in pm2["text"], [pm1, pm2["text"][:80]])
            await page.evaluate("()=>{var b=document.querySelector('#careDone'); if(b) b.click(); OvuStore.setProfile({lifeStage:''});}"); await page.wait_for_timeout(300)
            # Codex branch review (20 Oct): pain 10 entered on the period form opens the same-day card; a red flag found only after a
            # Luna save (heavy flow logged earlier, then "dizzy today") is shown in the chat
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(600)
            await page.evaluate("()=>{var t=OvuStore.today(); OvuStore.byDate(t).forEach(function(e){ OvuStore.remove(e.id); }); OvuStore.setProfile({lifeStage:''});}") # a clean today: earlier checks saved a chest-pain note
            await page.evaluate("()=>document.querySelector('nav a[data-tab=cycle]').click()"); await page.wait_for_selector('#savePeriod', timeout=8000)
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

            check("no page errors or console errors across the run", not errors, errors[:3])
            await browser.close()
    finally:
        if server: server.terminate()
    failed = [r for r in results if not r[1]]
    print("\n%d passed, %d failed" % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)

asyncio.run(main())
