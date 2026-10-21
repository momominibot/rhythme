import asyncio, json, sys, socket, threading, http.server, functools, os, importlib.util
root = os.path.abspath(sys.argv[1]); out = os.path.abspath(sys.argv[2]); os.makedirs(out, exist_ok=True)
spec = importlib.util.spec_from_file_location("smk", os.path.join(root, "tools", "e2e_smoke.py"))
src = open(os.path.join(root, "tools", "e2e_smoke.py")).read()
ns = {"__file__": os.path.join(root, "tools", "e2e_smoke.py"), "__name__": "seed"}; exec(src.split("def png_rows")[0], ns); DB = ns["DB"]
# the person in the pictures: the smoke fixture is "Smoke"; store frames use the name Jamie asked for (SHOT_NAME)
if os.environ.get("SHOT_NAME"):
    def rename(o):
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if isinstance(v, str) and v == "Smoke": o[k] = os.environ["SHOT_NAME"]
                else: rename(v)
        elif isinstance(o, list):
            for v in o: rename(v)
    rename(DB)
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
H.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % port
from playwright.async_api import async_playwright
async def gate(route):
    u = route.request.url
    if u.startswith(BASE): await route.continue_()
    elif "fonts.g" in u: await route.continue_()
    else: await route.abort()
async def main(jobs):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, url, seed, night, clip, act in jobs:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, reduced_motion="reduce")
            if seed is not None:
                await ctx.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(seed)))
                await ctx.add_init_script("localStorage.setItem('ovumind_auth_v1', JSON.stringify({access_token:'shot-token',refresh_token:'shot-refresh',expires_at:%d,user:{id:'00000000-0000-4000-8000-0000000000aa',email:'you@example.test'}}));" % (int(__import__('time').time()) + 86400))
            if night:
                await ctx.add_init_script("try{Object.defineProperty(window,'__forceSky',{value:'night'})}catch(e){}")
            pg = await ctx.new_page(); await pg.route("**/*", gate)
            await pg.goto(BASE + url, wait_until="domcontentloaded"); await pg.wait_for_timeout(2500)
            if act: await pg.evaluate(act); await pg.wait_for_timeout(1200)
            kw = {"path": os.path.join(out, name + ".png")}
            if clip: kw["clip"] = clip
            await pg.screenshot(**kw); print("shot", name)
            await ctx.close()
        await b.close()
jobs = json.loads(open(sys.argv[3]).read())
jobs = [[(DB if v == "__DB__" else v) for v in j] for j in jobs]
asyncio.run(main([tuple(j) for j in jobs]))
srv.shutdown()
