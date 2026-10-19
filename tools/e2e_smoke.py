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
      "summaries": [], "state": {"sleeping": None, "visited": {}, "tourDone": True, "tester": {"hearts": True}, "rewards": {"hearts": 200, "earned": 200, "log": [], "owned": ["dog"], "placed": {"dog": True}, "lastDay": None, "streak": 0}}}  # Peach the corgi lives on the room's rim, so her walks start from the nearest floor cell  # tester mode: Dream Street may be visited after hours, so the run does not depend on the clock

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
            ctl = await page.evaluate("()=>({api: !!window.OvuRoom && !!window.OvuWalk && !!window.OvuGarden && !!window.OvuCommunity && !!window.OvuStreet, pad: !!document.querySelector('#walkpad'), stops: [...document.querySelectorAll('#minimap [data-scene]')].map(b=>b.dataset.scene).join(','), door: !!document.querySelector('.hotspot[data-id=door]'), lit: document.querySelector('#minimap .on')?.dataset.scene})")
            check("no joystick, a four-stop mini-map lit on Home, and a door hotspot are in the room", ctl["api"] and not ctl["pad"] and ctl["stops"] == "home,garden,street,plaza" and ctl["door"] and ctl["lit"] == "home", ctl)
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
            g = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, img: document.querySelector('#roomDay').getAttribute('src'), hots: [...document.querySelectorAll('.hotspot')].map(b=>b.dataset.id).join(','), plot: !!document.querySelector('#ownedProps .plot svg'), pos: OvuRoom.pos(), lit: document.querySelector('#minimap .on')?.dataset.scene})")
            check("tapping the door walks her into the garden with its hotspots, the plot and the mini-map lit on Garden", g["layout"] == "garden" and "garden-v1" in g["img"] and "plot" in g["hots"] and "bench" in g["hots"] and g["plot"] and g["lit"] == "garden", g)
            hidden = await page.evaluate("()=>{var p=document.querySelector('#walkpad'); return !p || getComputedStyle(p).display==='none'}")
            check("the joystick stays hidden (tap-to-walk replaces it)", hidden, hidden)
            before = g["pos"]; tf0 = await page.evaluate("()=>document.querySelector('#sceneInner').style.transform")
            await floor_tap(50, 52)
            await page.wait_for_function("()=>!OvuWalk.walking()", timeout=8000); await page.wait_for_timeout(120)
            after = await page.evaluate("()=>({pos: OvuRoom.pos(), layout: document.querySelector('#scene').dataset.layout, walking: OvuWalk.walking(), tf: document.querySelector('#avatar').style.transform})")
            check("a floor tap in the garden walks her from the gate to the lawn and commits the position", abs(after["pos"]["x"] - 50) < 1.5 and abs(after["pos"]["y"] - 52) < 1.5 and after["layout"] == "garden" and not after["walking"] and after["tf"] == "" and abs(before["x"] - 50) > 4, {"before": before, "after": after})
            cam = await page.evaluate(CAM)
            check("the room keeps the whole view (zoom 1); the garden opens through a closer window (zoom 1.6) that moved with her and holds her feet near the middle of the box", home_tf == "" and cam["zoomed"] and abs(cam["z"] - 1.6) < 0.01 and cam["tf"] != tf0 and not cam["held"] and 0.3 < cam["sx"] < 0.72 and 0.4 < cam["sy"] < 0.78, {"home_tf": home_tf, "tf0": tf0, "cam": cam})
            await page.keyboard.down("ArrowLeft"); await page.wait_for_timeout(400); await page.keyboard.up("ArrowLeft"); await page.wait_for_timeout(150)
            key = await page.evaluate("()=>({pos: OvuRoom.pos(), flip: document.querySelector('#avatar').classList.contains('flip')})")
            check("the left arrow key walks her back from the lawn and turns her around", key["pos"]["x"] < after["pos"]["x"] - 1 and key["flip"], key)
            await page.click("#camFit"); await page.wait_for_timeout(450); fit = await page.evaluate(CAM)
            await page.click("#camIn"); await page.wait_for_timeout(900); zin = await page.evaluate(CAM)
            check("fit shows the whole garden; + brings the window back around her", fit["tf"] == "" and not fit["zoomed"] and zin["zoomed"] and zin["z"] > 1.4 and 0.25 < zin["sx"] < 0.72 and 0.35 < zin["sy"] < 0.8, {"fit": fit, "zin": zin})
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
            await page.click("#hudStop"); await page.wait_for_timeout(500)
            stopped = await page.evaluate("()=>({on: document.querySelector('#hud').classList.contains('on'), toast: document.querySelector('#toast').textContent})")
            check("watering at zoom keeps the HUD and its Stop button on screen (lifted out of the plate), and Stop ends the minute", hud["on"] and hud["z"] > 1.4 and hud["screenSpace"] and hud["inside"] and not stopped["on"] and "Stopped" in stopped["toast"], {"hud": hud, "stopped": stopped})
            await page.click('#minimap [data-scene=street]')
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            st = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, stores: [...document.querySelectorAll('.hotspot')].map(b=>b.dataset.id).filter(i=>['petshop','furniture','homes'].includes(i)).length, lit: document.querySelector('#minimap .on')?.dataset.scene})")
            check("the mini-map takes her to Dream Street with its three storefronts", st["layout"] == "street" and st["stores"] == 3 and st["lit"] == "street", st)
            closed = await page.evaluate("()=>{var real=OvuStreet.openNow; OvuStreet.openNow=function(){return false}; var went=OvuWalk.travel('shop-pet'); var sheet=document.querySelector('#sheet'); var r={went: went, open: sheet && sheet.getAttribute('aria-hidden')==='false', title: (document.querySelector('#sheetTitle')||{}).textContent||'', body: (sheet||{}).textContent||'', hours: [OvuStreet.hoursText('pet'), OvuStreet.hoursText('furniture'), OvuStreet.hoursText('home')], at8: OvuStreet.openAt('pet', new Date(2026,9,19,8,30)), at12: OvuStreet.openAt('pet', new Date(2026,9,19,12,0)), plaques: document.querySelectorAll('#ownedProps .closedsign').length}; OvuStreet.openNow=real; return r}")
            check("trying a shut store shows that store's own hours card (named, not Dream Street), the three stores keep different hours, and no plaques sit on the street", closed["went"] is False and closed["open"] and "Whisker" in closed["title"] and "10 am to 7 pm" in closed["body"] and len(set(closed["hours"])) == 3 and not closed["at8"] and closed["at12"] and closed["plaques"] == 0, closed)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await tap_hot("petshop")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='shop-pet' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            inside = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, props: document.querySelectorAll('#ownedProps .shopprop').length, pets: document.querySelectorAll('#ownedProps .shopprop.kind-pet').length, treats: document.querySelectorAll('#ownedProps .shopprop.kind-treat').length, acc: document.querySelectorAll('#ownedProps .shopprop.kind-accessory').length, mat: !!document.querySelector('.hotspot[data-id=mat]'), sub: document.querySelector('#minimap .minimap-sub [data-sub].on')?.dataset.sub, lit: document.querySelector('#minimap [data-scene].on')?.dataset.scene})")
            check("the pet shop door leads into a walkable interior with kittens, puppies, treats and accessories on the shelves", inside["layout"] == "shop-pet" and inside["pets"] >= 5 and inside["treats"] >= 3 and inside["acc"] >= 4 and inside["mat"] and inside["sub"] == "shop-pet" and inside["lit"] == "street", inside)
            await page.click('#ownedProps .shopprop[data-item=cat]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .itemcard', timeout=10000)
            except Exception: pass
            card = await page.evaluate("()=>({open: document.querySelector('#sheet').getAttribute('aria-hidden')==='false', title: document.querySelector('#sheetTitle')?.textContent.slice(0,16), adopt: document.querySelector('#sheet [data-act=buy]')?.textContent.trim(), layout: document.querySelector('#scene').dataset.layout})")
            check("tapping a kitten walks over and opens her adopt card with the price", card["open"] and card["title"].startswith("Mochi") and card["adopt"] and "Adopt" in card["adopt"] and "150" in card["adopt"] and card["layout"] == "shop-pet", card)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await tap_hot("mat")
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='street' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            back = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, pos: OvuRoom.pos(), sub: document.querySelectorAll('#minimap .minimap-sub [data-sub]').length})")
            check("the door mat puts her back on the street outside the pet shop, with the three store stops on the mini-map", back["layout"] == "street" and abs(back["pos"]["x"] - 23) < 1 and back["sub"] == 3, back)
            await page.click('#minimap [data-sub="shop-homes"]')
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='shop-homes' && !document.querySelector('#scene').classList.contains('fading')", timeout=12000)
            except Exception: pass
            sr = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, models: document.querySelectorAll('#ownedProps .shopprop.kind-home').length})")
            check("the mini-map store stop walks her into the showroom with the three house models", sr["layout"] == "shop-homes" and sr["models"] == 3, sr)
            await page.click('#ownedProps .shopprop[data-item=house]')
            try: await page.wait_for_selector('#sheet[aria-hidden="false"] .itemcard', timeout=10000)
            except Exception: pass
            hc = await page.evaluate("()=>({visit: !!document.querySelector('#sheet [data-act=visit]'), buy: document.querySelector('#sheet [data-act=buy]')?.textContent.trim()})")
            check("a house model offers Visit first and Move in", hc["visit"] and hc["buy"] and "Move in" in hc["buy"], hc)
            await page.click("#sheetClose"); await page.wait_for_timeout(300)
            await page.click('#minimap [data-scene=plaza]')
            try: await page.wait_for_function("()=>document.querySelector('#scene').dataset.layout==='plaza' && !document.querySelector('#scene').classList.contains('fading')", timeout=10000)
            except Exception: pass
            pz = await page.evaluate("()=>({layout: document.querySelector('#scene').dataset.layout, nbs: document.querySelectorAll('#ownedProps .nbperson').length, pets: document.querySelectorAll('#ownedProps .nbpet').length, board: !!document.querySelector('.hotspot[data-id=board]'), stall: !!document.querySelector('.hotspot[data-id=stall]')})")
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
            await page.click('#minimap [data-scene=home]')
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

            # 6b. health import: a tiny Apple Health export.xml and a Takeout Fit zip are read on the phone, summarised, and removable in one tap
            await page.goto(BASE + "room.html#you", wait_until="load"); await page.reload(wait_until="networkidle")
            await page.wait_for_selector('#sheet[aria-hidden="false"] [data-yact="import"]', timeout=10000)
            await page.click('[data-yact="import"]'); await page.wait_for_selector("#impApple", state="attached", timeout=10000)
            imp0 = await page.evaluate("()=>({title: document.querySelector('#sheetTitle')?.textContent, cards: document.querySelectorAll('.imp-card').length, bar: !!document.querySelector('#impBar'), remove: !!document.querySelector('#impRemove')})")
            check("import sheet opens from You with two cards, a progress bar and no remove button yet", imp0["cards"] == 2 and imp0["bar"] and not imp0["remove"] and "Bring in" in (imp0["title"] or ""), imp0)
            await page.set_input_files("#impApple", os.path.join(ROOT, "tools", "fixtures", "apple-export-mini.xml"))
            await page.wait_for_function("()=>document.querySelector('#impSummary')?.dataset.run === '1'", timeout=15000)
            imp = await page.evaluate("()=>({text: document.querySelector('#impSummary').innerText, bar: document.querySelector('#impBar').style.width, remove: document.querySelector('#impRemove')?.textContent || '', db: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.source==='apple-health').map(e=>e.type).sort().join(',')})")
            check("Apple Health import shows 2 nights, 1 weigh-in, 2 period days and the never-left-your-phone line", "2 nights" in imp["text"] and "1 weigh-in" in imp["text"] and "2 period days" in imp["text"] and "never left" in imp["text"] and imp["bar"] == "100%", imp)
            check("imported entries carry source apple-health and the remove button counts them", imp["db"] == "period,period,sleep,sleep,weight" and "(5)" in imp["remove"], imp)
            await page.set_input_files("#impGoogle", os.path.join(ROOT, "tools", "fixtures", "takeout-fit-mini.zip"))
            await page.wait_for_function("()=>document.querySelector('#impSummary')?.dataset.run === '2'", timeout=20000)
            tk = await page.evaluate("()=>({text: document.querySelector('#impSummary').innerText, remove: document.querySelector('#impRemove')?.textContent || '', db: JSON.parse(localStorage.getItem('ovumind_db_v1')).events.filter(e=>e.source==='google-fit').map(e=>e.type).sort().join(',')})")
            check("Takeout zip import shows 2 nights and 2 weigh-ins with the zip read on the phone", "2 nights" in tk["text"] and "2 weigh-ins" in tk["text"] and tk["db"] == "sleep,sleep,weight,weight" and "(9)" in tk["remove"], tk)
            await page.click("#impRemove"); await page.wait_for_selector("#impDelYes", timeout=5000); await page.click("#impDelYes"); await page.wait_for_timeout(600)
            left = await page.evaluate("()=>{var db=JSON.parse(localStorage.getItem('ovumind_db_v1')); return {imported: db.events.filter(e=>e.source==='apple-health'||e.source==='google-fit').length, own: db.events.filter(e=>['s1','s2','s3'].includes(e.id)).length, total: db.events.length, remove: !!document.querySelector('#impRemove')};}")
            check("Remove imported data takes out only the imported entries and keeps the seeded ones", left["imported"] == 0 and left["own"] == 3 and left["total"] == 5 and not left["remove"], left)
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
            check("strength or weights ticks the strength day for you, and zero minutes is refused with a plain message", strd["on"] and strd["locked"] and bad["n"] == 1 and "minutes" in bad["msg"], {"str": strd, "bad": bad})
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
            # Moon Tap: open from the mat sheet, begin, three blooms, stop after the minimum, the entry is saved
            await page.goto(BASE + "room.html", wait_until="networkidle"); await page.wait_for_selector(".hotspot"); await page.wait_for_timeout(800)
            await page.click("nav a[data-tab=mind]"); await page.wait_for_selector("#mindTap", timeout=8000); await page.click("#mindTap"); await page.wait_for_selector("#btapBegin", timeout=8000)
            await page.click("#btapBegin"); await page.wait_for_timeout(5600)
            for _ in range(3): await page.mouse.click(195, 300); await page.wait_for_timeout(150)
            petals = await page.evaluate("()=>{var c=document.querySelector('#btapWater'); return c && c.width > 30 ? 3 : 0}")
            await page.click("#btapStop"); await page.wait_for_timeout(600)
            tap = await page.evaluate("()=>{var d=JSON.parse(localStorage.getItem('ovumind_db_v1')); var e=d.events.filter(x=>x.type==='mindfulness'&&x.data.kind==='breathtap'); return {n:e.length, secs:e.length?e[e.length-1].data.seconds:0, taps:e.length?e[e.length-1].data.taps:0, done:!document.querySelector('#btapDone').hidden, text:document.querySelector('#btapDone').innerText}}")
            check("Moon Tap ripples the water on taps and saves practice time on Stop", petals >= 3 and tap["n"] == 1 and tap["secs"] >= 5 and tap["taps"] == 3 and tap["done"] and "Your pause is saved" in tap["text"], tap)
            # Erin's own teeth scripts: the hour picks morning or evening, eight steps each inside four minutes, the clips exist
            teeth = await page.evaluate("()=>{var a=OvuMindful.byId('teeth'); var am=OvuMindful.nextVariation(a, new Date(2026,9,19,8,0)), pm=OvuMindful.nextVariation(a, new Date(2026,9,19,21,0)); return {am:am.when, pm:pm.when, amSteps:am.steps.length, pmSteps:pm.steps.length, amSecs:OvuMindful.totalSecs(am), pmSecs:OvuMindful.totalSecs(pm), author:am.author, firstLine:am.steps[0].text.slice(0,12)}}")
            r0 = await page.request.get(BASE + "assets/audio/guide-interim/teeth-0-0.mp3"); r7 = await page.request.get(BASE + "assets/audio/guide-interim/teeth-1-7.mp3")
            check("Erin's own teeth scripts: morning before 3 pm, evening after, eight steps each inside four minutes, clips present", teeth["am"] == "morning" and teeth["pm"] == "evening" and teeth["amSteps"] == 8 and teeth["pmSteps"] == 8 and 180 <= teeth["amSecs"] <= 240 and 180 <= teeth["pmSecs"] <= 240 and teeth["author"] == "erin" and teeth["firstLine"] == "Good morning" and r0.status == 200 and r7.status == 200, teeth)
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
            # the staff page: signed out it shows the sign-in gate only, no dashboard, no data call
            await page.goto(BASE + "admin.html", wait_until="networkidle"); await page.wait_for_timeout(500)
            ag = await page.evaluate("()=>({h2: (document.querySelector('h2')||{}).textContent, email: !!document.querySelector('#gEmail'), send: !!document.querySelector('#gSend'), nav: !!document.querySelector('nav.tabs')})")
            check("the staff page signed out shows only the sign-in gate (no dashboard, no data request)", ag["h2"] == "Rhythme staff" and ag["email"] and ag["send"] and not ag["nav"], ag)
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
