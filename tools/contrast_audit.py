#!/usr/bin/env python3
"""Contrast audit: opens every page and the room's sheets with the sky forced to a state (night by default),
measures every visible text element against its effective background (walking up through transparent
ancestors, compositing alpha, taking the first colour of a gradient), and reports WCAG ratios below
4.5 (3.0 for large or bold text). Usage: contrast_audit.py [night|morning] [--json out.json]
Run with the browser venv: ~/.local/share/jev-browser-venv/bin/python tools/contrast_audit.py"""
import asyncio, json, os, re, sys, glob, subprocess, socket, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKY = next((a for a in sys.argv[1:] if a in ('night', 'morning', 'sunset', 'sunrise')), 'night')
OUT = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
sys.path.insert(0, os.path.join(ROOT, 'tools'))
src = open(os.path.join(ROOT, 'tools', 'e2e_smoke.py')).read(); head = src[:src.index('async def main')]
ns = {'__file__': os.path.join(ROOT, 'tools', 'e2e_smoke.py')}; exec(head, ns); DB = ns['DB']

JS = r"""
(() => {
  function parse(c){ const m = c && c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p = m[1].split(',').map(s=>parseFloat(s)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function lum(c){ const f=v=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
  function blend(top, under){ const a=top.a; return {r:top.r*a+under.r*(1-a), g:top.g*a+under.g*(1-a), b:top.b*a+under.b*(1-a), a:1}; }
  function bgOf(el){
    let acc=null; let node=el;
    while(node && node.nodeType===1){
      const cs=getComputedStyle(node); let c=parse(cs.backgroundColor);
      const img=cs.backgroundImage;
      if(img && img!=='none' && !/url\(/.test(img)){ const m=img.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i); if(m){ const t=document.createElement('i'); t.style.color=m[0]; document.body.appendChild(t); const cc=parse(getComputedStyle(t).color); t.remove(); if(cc) c=cc; } }
      if(img && /url\(/.test(img)) return {bg:null, note:'image'};
      if(c && c.a>0){ acc = acc? (acc.a<1? blend(acc, c): acc) : c; if(acc.a>=1) return {bg:acc}; }
      node=node.parentElement;
    }
    const body=parse(getComputedStyle(document.body).backgroundColor)||{r:255,g:255,b:255,a:1};
    return {bg: acc? blend(acc, body): body};
  }
  const out=[]; const seen=new Set();
  const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while((n=walker.nextNode())){
    const t=n.textContent.replace(/\s+/g,' ').trim(); if(t.length<2) continue;
    const el=n.parentElement; if(!el || seen.has(el)) continue;
    const cs=getComputedStyle(el); if(cs.visibility==='hidden' || cs.display==='none' || parseFloat(cs.opacity)===0) continue;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    if(el.closest('.scene, .btap, [hidden], .welcome')) continue;   // picture-backed and hidden areas are judged by eye
    let hidden=false; for(let p=el;p;p=p.parentElement){ const pcs=getComputedStyle(p); if(pcs.display==='none'||pcs.visibility==='hidden'||parseFloat(pcs.opacity)===0){hidden=true;break;} }
    if(hidden) continue;
    seen.add(el);
    const fg=parse(cs.color); if(!fg) continue;
    const b=bgOf(el); if(!b.bg) continue;
    const fgc = fg.a<1? blend(fg, b.bg): fg;
    const L1=lum(fgc), L2=lum(b.bg); const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight,10)>=700; const large = size>=18 || (bold && size>=14);
    const need = large? 3.0 : 4.5;
    if(ratio < need){
      const path=[]; for(let p=el, i=0; p && i<3; p=p.parentElement, i++){ path.unshift(p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+(p.className && typeof p.className==='string'? '.'+p.className.trim().split(/\s+/).slice(0,2).join('.'):'')); }
      out.push({sel:path.join(' > '), text:t.slice(0,40), ratio:Math.round(ratio*100)/100, need, fg:cs.color, bg:'rgb('+Math.round(b.bg.r)+','+Math.round(b.bg.g)+','+Math.round(b.bg.b)+')', size});
    }
  }
  return out;
})()
"""

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

async def main():
    port = free_port(); srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    base = 'http://127.0.0.1:%d/' % port; report = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
            await ctx.add_init_script("if(!localStorage.getItem('ovumind_db_v1')) localStorage.setItem('ovumind_db_v1', %s);" % json.dumps(json.dumps(DB)))
            await ctx.add_init_script("(function(){var k=%s; function f(){try{document.documentElement.setAttribute('data-sky',k)}catch(e){}} f(); new MutationObserver(f).observe(document.documentElement,{attributes:true,attributeFilter:['data-sky']});})();" % json.dumps(SKY))
            page = await ctx.new_page()
            async def gate(route):
                u = route.request.url
                if 'supabase.co' in u or '/functions/v1/' in u: await route.abort()
                else: await route.continue_()
            await page.route('**/*', gate)
            async def audit(name):
                await page.wait_for_timeout(500)
                try: items = await page.evaluate(JS)
                except Exception as e: items = [{'sel': 'ERROR', 'text': str(e)[:60], 'ratio': 0, 'need': 0}]
                if items: report[name] = items
            # the room and its sheets
            await page.goto(base + 'room.html', wait_until='networkidle'); await page.wait_for_selector('.hotspot'); await page.wait_for_timeout(1500)
            await page.evaluate("()=>{var s=document.querySelector('.scene'); if(s){ s.classList.toggle('sky-night', %s); }}" % ('true' if SKY == 'night' else 'false'))
            await audit('room.html')
            steps = [('you', "nav a[data-tab=you]"), ('cycle', "nav a[data-tab=cycle]"), ('food', "nav a[data-tab=food]"), ('mind', "nav a[data-tab=mind]")]
            for name, sel in steps:
                try: await page.click(sel); await page.wait_for_timeout(900); await audit('room.html#' + name)
                except Exception as e: report['room.html#' + name] = [{'sel': 'OPEN FAILED', 'text': str(e)[:60], 'ratio': 0, 'need': 0}]
                if name == 'food':
                    for i in (2, 3):
                        try: await page.click('.dtabs button:nth-child(%d)' % i); await page.wait_for_timeout(700); await audit('room.html#food-pane%d' % i)
                        except Exception: pass
            await page.evaluate("()=>OvuStore.setState({tester:{hearts:true}})")
            try: await page.evaluate("()=>{ if (window.OvuRoom && OvuRoom.closeSheet) OvuRoom.closeSheet(); }"); await page.wait_for_timeout(600)
            except Exception: pass
            try: await page.click('#heartsChip'); await page.wait_for_timeout(900); await audit('room.html#street'); await page.click('.street .store[data-tab=pet]'); await page.wait_for_timeout(800); await audit('room.html#petshop')
            except Exception as e: report['room.html#shop'] = [{'sel': 'OPEN FAILED', 'text': str(e)[:60], 'ratio': 0, 'need': 0}]
            try: await page.click("nav a[data-tab=you]"); await page.wait_for_timeout(700); await page.get_by_text("Luna’s look").first.click(timeout=3000); await page.wait_for_timeout(700); await audit('room.html#mascot')
            except Exception: pass
            # deeper room states (Jamie, 19 Oct: period days, the episode quote and the hand-measure panel were unreadable
            # at night and none of them was opened above): seed a period, open every sheet below, unfold every <details>
            async def deep(name, js, wait=900):
                try:
                    await page.evaluate("()=>{ if (window.OvuRoom && OvuRoom.closeSheet) OvuRoom.closeSheet(); document.querySelector('#bubble') && document.querySelector('#bubble').classList.remove('on'); }"); await page.wait_for_timeout(500)
                    await page.evaluate(js); await page.wait_for_timeout(wait)
                    await page.evaluate("()=>document.querySelectorAll('#sheet details, .sheet details').forEach(d=>d.open=true)"); await page.wait_for_timeout(250)
                    await audit('room.html#' + name)
                except Exception as e: report['room.html#' + name] = [{'sel': 'OPEN FAILED', 'text': str(e)[:60], 'ratio': 0, 'need': 0}]
            await page.evaluate("""()=>{ var S=OvuStore, t=new Date(); function d(n){ var x=new Date(t); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); }
              ['heavy','medium','light','spotting'].forEach(function(f,i){ try { S.add('period', d(3-i), {flow:f}); } catch(e){} });
              try { S.add('symptom', d(1), {symptoms:['cramps'], pain:4, mood:'ok', notes:''}); } catch(e){} }""")
            await deep('calendar-period', "()=>{document.querySelector('nav a[data-tab=cycle]').click(); setTimeout(()=>{var b=[...document.querySelectorAll('#calGrid .cal-day:not(.empty):not(.future)')]; b[b.length-2] && b[b.length-2].click();}, 500)}", 1400)
            await deep('calendar-symptom', "()=>{document.querySelector('nav a[data-tab=cycle]').click(); setTimeout(()=>{document.querySelector('#calTabs [data-tab=symptom]').click(); setTimeout(()=>{var b=[...document.querySelectorAll('#calGrid .cal-day:not(.empty):not(.future)')]; b[b.length-2] && b[b.length-2].click();}, 300)}, 500)}", 1600)
            await deep('acupressure', "()=>{document.querySelector('nav a[data-tab=cycle]').click(); setTimeout(()=>{document.querySelector('#calTabs [data-tab=symptom]').click(); setTimeout(()=>{var b=[...document.querySelectorAll('#calGrid .cal-day:not(.empty):not(.future)')]; b[b.length-1].click(); setTimeout(()=>{var a=document.querySelector('#acuFromSym'); a&&a.click(); setTimeout(()=>{var c=document.querySelector('#sheet .aculist button, #sheet .acucard, #sheet [data-acu]'); c&&c.click();}, 700)}, 300)}, 300)}, 500)}", 2600)
            await deep('luna', "()=>{ try { OvuOrb && OvuOrb.setAiConfig && OvuOrb.setAiConfig(Object.assign({}, OvuOrb.aiConfig(), {on:true, insights:true, photos:true})); } catch(e){} var b=document.querySelector('[data-act=luna], #lunaOrb, .orb'); b && b.click(); }", 1400)
            await deep('listen', "()=>{ var b=document.querySelector('[data-pod-open]'); if(!b){ document.querySelector('nav a[data-tab=mind]').click(); } setTimeout(()=>{ var c=document.querySelector('[data-pod-open]'); c&&c.click(); }, 700); }", 2000)
            await deep('mind', "()=>document.querySelector('nav a[data-tab=mind]').click()", 1000)
            await deep('garden-greenhouse', "()=>{ OvuWalk.travel('garden'); setTimeout(()=>{ var h=document.querySelector('.hotspot[data-id=greenhouse]'); h&&h.click(); }, 2500); }", 6000)
            await deep('garden-plot', "()=>{ var h=document.querySelector('.hotspot[data-id=plot]'); h&&h.click(); }", 3500)
            # every other real page
            pages = sorted(f for f in glob.glob(os.path.join(ROOT, '*.html')) if 'ovu-sky.js' in open(f, errors='ignore').read() and os.path.basename(f) != 'room.html')
            for f in pages:
                name = os.path.basename(f)
                try:
                    await page.goto(base + name, wait_until='networkidle'); await page.wait_for_timeout(900); await audit(name)
                except Exception as e: report[name] = [{'sel': 'LOAD FAILED', 'text': str(e)[:60], 'ratio': 0, 'need': 0}]
            await b.close()
    finally:
        srv.terminate()
    total = sum(len(v) for v in report.values())
    print('sky=%s  pages with failures: %d  failing elements: %d' % (SKY, len(report), total))
    groups = {}
    for pg, items in report.items():
        for it in items:
            key = re.sub(r'#[^ .>]+', '', it['sel'])
            g = groups.setdefault(key, {'count': 0, 'pages': set(), 'worst': 9, 'sample': it})
            g['count'] += 1; g['pages'].add(pg); g['worst'] = min(g['worst'], it['ratio'])
    for key, g in sorted(groups.items(), key=lambda kv: -kv[1]['count'])[:60]:
        s = g['sample']; print('%3d  %4.2f  %-70s  %s  fg %s on %s  "%s"' % (g['count'], g['worst'], key[:70], ','.join(sorted(g['pages']))[:50], s.get('fg'), s.get('bg'), s['text'][:28]))
    if OUT: json.dump(report, open(OUT, 'w'), indent=1)
    return total

if __name__ == '__main__':
    sys.exit(0 if asyncio.run(main()) == 0 else 1)
