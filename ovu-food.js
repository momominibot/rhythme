/* Rhythme camera-assisted food logging.
 * Accuracy comes from data the camera cannot see: a real nutrient database
 * (USDA SR Legacy per-100 g values, Open Food Facts label data for barcodes)
 * and a portion the user confirms. Photos are kept as thumbnails and barcodes
 * are read on-device (BarcodeDetector, ZXing fallback). Missing values stay
 * null, never zero; carbohydrate follows USDA "by difference" (includes fibre).
 */
(function (root) {
  'use strict';
  var TABLE_URL = 'assets/data/nutrients-usda-sr.json';
  var KEYS = ['kcal', 'protein', 'fat', 'carb', 'fiber', 'sugar', 'ca', 'fe', 'mg', 'k', 'na', 'zn', 'vitc', 'folate', 'vitd', 'b12'];
  var LABEL = { kcal: 'Energy', protein: 'Protein', fat: 'Fat', carb: 'Carbs', fiber: 'Fibre', sugar: 'Sugars', ca: 'Calcium', fe: 'Iron', mg: 'Magnesium', k: 'Potassium', na: 'Sodium', zn: 'Zinc', vitc: 'Vitamin C', folate: 'Folate', vitd: 'Vitamin D', b12: 'B12' };
  var UNIT = { kcal: 'kcal', protein: 'g', fat: 'g', carb: 'g', fiber: 'g', sugar: 'g', ca: 'mg', fe: 'mg', mg: 'mg', k: 'mg', na: 'mg', zn: 'mg', vitc: 'mg', folate: 'µg', vitd: 'µg', b12: 'µg' };
  /* local names people actually type */
  var ALIASES = { prawn: 'shrimp', prawns: 'shrimp', brinjal: 'eggplant', aubergine: 'eggplant', courgette: 'zucchini', 'bean curd': 'tofu', taukwa: 'tofu', 'pak choi': 'bok choy', 'pak choy': 'bok choy', kopi: 'coffee', teh: 'tea', kailan: 'kale', 'bee hoon': 'rice noodles', beehoon: 'rice noodles', mee: 'egg noodles', 'ikan': 'fish', ayam: 'chicken', nasi: 'rice', telur: 'egg', yoghurt: 'yogurt', mince: 'mince', capsicum: 'capsicum', 'sweet potato': 'sweet potato', 'long bean': 'green beans', tau: 'tofu' };
  var table = null, loading = null;

  function load() {
    if (table) return Promise.resolve(table);
    loading = loading || fetch(TABLE_URL).then(function (r) { if (!r.ok) throw new Error('Food table unavailable (' + r.status + ')'); return r.json(); }).then(function (t) {
      t.foods.forEach(function (f) {
        f._s = (f.name + ' ' + f.sr + ' ' + f.cat).toLowerCase();
        var ps = (f.portions || []).filter(function (p) { return p.g > 0; });
        f.portions = [{ label: '100 g', g: 100 }].concat(ps);
        f.source = { kind: 'usda', ref: 'FDC ' + f.fdc, date: 'SR Legacy, April 2018', detail: f.sr, label: 'USDA FoodData Central' };
      });
      table = t; return t;
    });
    return loading;
  }
  function normaliseQuery(q) {
    q = String(q || '').toLowerCase().trim();
    Object.keys(ALIASES).sort(function (a, b) { return b.length - a.length; }).forEach(function (a) { if (q.indexOf(a) > -1) q = q.replace(a, ALIASES[a]); });
    return q;
  }
  function search(q, limit) {
    if (!table) return [];
    var nq = normaliseQuery(q), tokens = nq.split(/[^a-z0-9%]+/).filter(Boolean);
    if (!tokens.length) return table.foods.slice(0, limit || 12);
    var scored = [];
    table.foods.forEach(function (f) {
      var score = 0, name = f.name.toLowerCase();
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (name.indexOf(t) === 0) score += 4; else if (name.indexOf(t) > -1) score += 3; else if (f._s.indexOf(t) > -1) score += 1; else { score = -1; break; }
      }
      if (score > 0) scored.push([score - name.length / 100, f]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    return scored.slice(0, limit || 12).map(function (x) { return x[1]; });
  }
  function byId(id) { return table ? table.foods.filter(function (f) { return f.id === id; })[0] || null : null; }

  /* ---------- nutrient maths ---------- */
  function scale(per100, grams) {
    var out = {};
    KEYS.forEach(function (k) { var v = per100 ? per100[k] : null; out[k] = (v === undefined || v === null || isNaN(v)) ? null : v * grams / 100; });
    return out;
  }
  function makeItem(food, portion, grams, method) {
    grams = Number(grams || (portion && portion.g) || 100);
    return {
      name: food.name, foodId: food.id, source: food.source, basis: food.basis || '100g', prep: food.prep || null,
      grams: Math.round(grams * 10) / 10, portionLabel: portion ? portion.label : grams + ' g', method: method || (portion && portion.g === grams ? 'household measure' : 'typed amount'),
      per100: food.n, nutrients: scale(food.n, grams),
      nova: food.nova || null, cat: food.cat || null,
      /* the whole list is kept: the diary reclassifies from it, and a cut list could change the group */
      ingredients: food.ingredients ? { source: food.ingredients.source || 'off', text: String(food.ingredients.text || '').slice(0, 4000), additives: (food.ingredients.additives || []).slice(0, 80), markers: food.ingredients.markers || null, rule: 'ingredients-v1' } : null
    };
  }
  function sum(items) {
    var totals = {}, known = {}, missing = {};
    KEYS.forEach(function (k) { totals[k] = null; known[k] = 0; missing[k] = 0; });
    (items || []).forEach(function (it) {
      var n = it.nutrients || scale(it.per100, it.grams);
      KEYS.forEach(function (k) { if (n[k] === null || n[k] === undefined) missing[k]++; else { totals[k] = (totals[k] || 0) + n[k]; known[k]++; } });
    });
    return { totals: totals, known: known, missing: missing, count: (items || []).length };
  }
  function fmt(k, v) {
    if (v === null || v === undefined || isNaN(v)) return '?';
    if (k === 'kcal') return String(Math.round(v));
    if (UNIT[k] === 'g') return v < 10 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
    if (UNIT[k] === 'mg') return v < 10 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
    return v < 10 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
  }
  function line(n, keys) {
    return (keys || ['kcal', 'protein', 'carb', 'fat', 'fiber']).map(function (k) { return fmt(k, n[k]) + (k === 'kcal' ? ' kcal' : ' ' + UNIT[k] + ' ' + LABEL[k].toLowerCase()); }).join(' · ');
  }

  /* ---------- Open Food Facts (label data for barcodes) ---------- */
  var OFF_FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments,nutriscore_grade,nova_group,image_front_small_url,last_modified_t,categories_tags_en,ingredients_text,additives_tags,nova_groups_markers,ingredients_n';
  /* The ingredient list, additive tags and Open Food Facts' own NOVA markers, when the record has them.
   * ovu-nova.js reads these when nova_group is missing, so a product is not left "Not classified". */
  function offIngredients(p) {
    var txt = String(p.ingredients_text || '').trim(), adds = Array.isArray(p.additives_tags) ? p.additives_tags : [], mk = p.nova_groups_markers && typeof p.nova_groups_markers === 'object' ? p.nova_groups_markers : null;
    if (!txt && !adds.length && !mk) return null;
    return { text: txt.slice(0, 4000), additives: adds.map(function (a) { return String(a).replace(/^en:/, '').toLowerCase(); }).slice(0, 80), markers: mk, source: 'off' };
  }
  function g(n, key, mult) { var v = n[key]; if (v === undefined || v === null || v === '') return null; v = Number(v); return isNaN(v) ? null : v * (mult || 1); }
  function offToFood(p) {
    var n = p.nutriments || {};
    var kcal = g(n, 'energy-kcal_100g'); if (kcal === null && g(n, 'energy_100g') !== null) kcal = g(n, 'energy_100g') / 4.184;
    var per100 = { kcal: kcal, protein: g(n, 'proteins_100g'), fat: g(n, 'fat_100g'), carb: g(n, 'carbohydrates_100g'), fiber: g(n, 'fiber_100g'), sugar: g(n, 'sugars_100g'), ca: g(n, 'calcium_100g', 1000), fe: g(n, 'iron_100g', 1000), mg: g(n, 'magnesium_100g', 1000), k: g(n, 'potassium_100g', 1000), na: g(n, 'sodium_100g', 1000), zn: g(n, 'zinc_100g', 1000), vitc: g(n, 'vitamin-c_100g', 1000), folate: g(n, 'folates_100g', 1e6), vitd: g(n, 'vitamin-d_100g', 1e6), b12: g(n, 'vitamin-b12_100g', 1e6) };
    var basis = p.nutrition_data_per === '100ml' ? '100ml' : '100g';
    var portions = [{ label: basis === '100ml' ? '100 ml' : '100 g', g: 100 }];
    var sq = Number(p.serving_quantity);
    if (sq > 0) portions.push({ label: '1 serving' + (p.serving_size ? ' (' + p.serving_size + ')' : ''), g: sq });
    var name = (p.product_name_en || p.product_name || 'Packaged food').trim() + (p.brands ? ' · ' + p.brands.split(',')[0].trim() : '');
    return { id: 'off:' + p.code, name: name, cat: 'packaged', n: per100, basis: basis, portions: portions, image: p.image_front_small_url || null, nutriscore: p.nutriscore_grade || null, nova: p.nova_group || null, ingredients: offIngredients(p),
      source: { kind: 'off', ref: 'Barcode ' + p.code, date: p.last_modified_t ? new Date(p.last_modified_t * 1000).toISOString().slice(0, 10) : null, label: 'Open Food Facts label data', url: 'https://world.openfoodfacts.org/product/' + p.code, detail: 'Community-maintained label transcription; check against the pack.' } };
  }
  /* Product search by name through Rhythme's `foods` relay (Open Food Facts text search sends no CORS
   * headers). Returns [{code, name, brands, quantity, nova, sg, image}], Singapore products first. */
  function searchProducts(q) {
    var base = (root.OVU_CONFIG && root.OVU_CONFIG.functionsBase) || 'https://zodkohwaznqgrfrcfdkf.supabase.co/functions/v1';
    return fetch(base + '/foods?q=' + encodeURIComponent(String(q || '').trim().slice(0, 60)))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('Product search replied ' + r.status + '.')); return d.products || []; }); });
  }
  /* Open Food Facts lists every pack size and country edition as its own product, so one jar can
   * appear many times. Group by name and brand, keep one entry per pack size (the most complete,
   * then the most scanned), and rank groups: sold in Singapore first, then most complete data. */
  function normKey(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function normQty(q) { var m = String(q || '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|cl|oz)\b/); if (!m) return ''; var n = Number(m[1]), u = m[2]; if (u === 'kg') { n *= 1000; u = 'g'; } if (u === 'l') { n *= 1000; u = 'ml'; } if (u === 'cl') { n *= 10; u = 'ml'; } return Math.round(n) + ' ' + u; }
  function groupProducts(list) {
    var groups = {}, order = [];
    (list || []).forEach(function (p) {
      if (!p || !p.code || !p.name) return;
      var brand = normKey(String(p.brands || '').split(',')[0]), name = normKey(p.name), key = name + '|' + (brand === name ? '' : brand);
      if (!groups[key]) { groups[key] = { key: key, name: p.name, brands: String(p.brands || '').split(',')[0].trim(), variants: [], sg: false }; order.push(key); }
      groups[key].variants.push(p); if (p.sg) groups[key].sg = true;
    });
    var score = function (p) { return (p.image ? 2 : 0) + (normQty(p.quantity) ? 1 : 0) + (p.nova ? 1 : 0) + (Number(p.complete) || 0) * 3 + Math.min(1, (Number(p.scans) || 0) / 500); };
    return order.map(function (k) {
      var g = groups[k], bySize = {};
      g.variants.sort(function (a, b) { return (Number(!!b.sg) - Number(!!a.sg)) || (score(b) - score(a)); }).forEach(function (p) { var q = normQty(p.quantity) || 'size not listed'; if (!bySize[q]) bySize[q] = p; });
      var sizes = Object.keys(bySize).map(function (q) { return { label: q, code: bySize[q].code }; }).sort(function (a, b) { return (a.label === 'size not listed') - (b.label === 'size not listed') || parseFloat(a.label) - parseFloat(b.label); });
      var best = g.variants[0];
      return { name: g.name, brands: g.brands, best: best, image: (g.variants.filter(function (p) { return p.image; })[0] || {}).image || null, nova: best.nova || (g.variants.filter(function (p) { return p.nova; })[0] || {}).nova || null, sg: g.sg, sizes: sizes, count: g.variants.length, rank: score(best) + (g.sg ? 10 : 0) };
    }).sort(function (a, b) { return b.rank - a.rank; });
  }
  function lookupBarcode(code) {
    code = String(code || '').replace(/\D/g, '');
    if (code.length < 8) return Promise.reject(new Error('That does not look like a product barcode.'));
    return fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=' + OFF_FIELDS).then(function (r) {
      if (r.status === 404) throw new Error('No Open Food Facts record for ' + code + '. You can add it as a custom food from the label.');
      if (!r.ok) throw new Error('Open Food Facts is busy (' + r.status + '). Try again or add a custom food.');
      return r.json();
    }).then(function (d) { if (!d.product) throw new Error('No product found for ' + code + '.'); return offToFood(d.product); });
  }

  /* ---------- camera, photo and barcode reading ---------- */
  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, (max || 480) / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve({ dataUrl: c.toDataURL('image/jpeg', 0.78), canvas: c, image: img });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
      img.src = url;
    });
  }
  /* ---------- barcode decoders ----------
   * Native BarcodeDetector where the browser has one (Chrome, Android). iOS Safari ships none, so the
   * app carries its own decoder: the barcode-detector ponyfill over zxing-wasm (assets/vendor, MIT),
   * served from this origin and cached by the service worker. No third-party script is loaded. */
  var WASM_JS = 'assets/vendor/barcode-detector-3.2.2.ponyfill.js', WASM_BIN = 'assets/vendor/zxing_reader-3.1.3.wasm';
  var FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
  var wasmLoading = null;
  function loadWasm() {
    if (root.BarcodeDetectionAPI) return Promise.resolve(root.BarcodeDetectionAPI);
    wasmLoading = wasmLoading || new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = WASM_JS; s.async = true;
      s.onload = function () {
        var B = root.BarcodeDetectionAPI;
        if (!B) { reject(new Error('Barcode reader did not load.')); return; }
        try { B.setZXingModuleOverrides({ locateFile: function (path, prefix) { return /\.wasm$/.test(path) ? WASM_BIN : prefix + path; } }); } catch (e) { }
        resolve(B);
      };
      s.onerror = function () { reject(new Error('Barcode reader could not load (offline?). You can type the digits instead.')); };
      document.head.appendChild(s);
    });
    return wasmLoading;
  }
  /* Last resort for photos only: the older ZXing JS port (self-hosted, lazy) reads some small blurred
   * 1D codes the WASM build misses. Not used for live frames, where it was too slow to be useful. */
  var ZX_JS = 'assets/vendor/zxing-browser-0.1.5.min.js', zxLoading = null;
  function loadZXingJs() {
    if (root.ZXingBrowser) return Promise.resolve(root.ZXingBrowser);
    zxLoading = zxLoading || new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = ZX_JS; s.async = true;
      s.onload = function () { root.ZXingBrowser ? resolve(root.ZXingBrowser) : reject(new Error('no ZXingBrowser')); }; s.onerror = function () { reject(new Error('ZXing JS did not load')); };
      document.head.appendChild(s);
    });
    return zxLoading;
  }
  function zxingJsTry(sources) {
    return loadZXingJs().then(function (Z) {
      var hints = new Map(); hints.set(3, true); /* DecodeHintType.TRY_HARDER */
      var reader = new Z.BrowserMultiFormatReader(hints), i = 0;
      function next() {
        if (i >= sources.length) return null;
        var src; try { src = sources[i++](); } catch (e) { return next(); }
        var p = src.tagName === 'CANVAS' ? reader.decodeFromCanvas(src) : reader.decodeFromImageElement(src);
        return Promise.resolve(p).then(function (r) { return r && r.getText ? r.getText() : next(); }, function () { return next(); });
      }
      return next();
    }).catch(function () { return null; });
  }
  function hasNative() { return 'BarcodeDetector' in root; }
  /* a detector with detect(source) -> Promise<[{ rawValue }]>, native or self-hosted */
  function detector() {
    if (hasNative()) return Promise.resolve(new root.BarcodeDetector({ formats: FORMATS }));
    return loadWasm().then(function (B) { return new B.BarcodeDetector({ formats: FORMATS }); });
  }
  /* Warm the self-hosted decoder (one WASM fetch) when scan mode opens, so the first live frame does not wait. */
  function warmDecoder() {
    if (hasNative()) return Promise.resolve();
    return detector().then(function (det) { var c = document.createElement('canvas'); c.width = 8; c.height = 8; return det.detect(c); }).catch(function () { });
  }
  function fit(img, max) {
    var w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height, s = Math.min(1, max / Math.max(w, h));
    if (s >= 1 && img.tagName !== 'VIDEO') return img;
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function rotated(src, deg) {
    var w = src.width, h = src.height, c = document.createElement('canvas'); c.width = h; c.height = w;
    var x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(src, -w / 2, -h / 2); return c;
  }
  function centreCrop(src, fw, fh) {
    var w = src.width, h = src.height, c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * fw)); c.height = Math.max(1, Math.round(h * fh));
    c.getContext('2d').drawImage(src, (w - c.width) / 2, (h - c.height) / 2, c.width, c.height, 0, 0, c.width, c.height); return c;
  }
  /* Photo path: the photo at up to 2048 px, then rotated 90 and 270 degrees (a pack held sideways), then the middle. */
  function detectInImage(imageEl) {
    return detector().then(function (det) {
      var base = fit(imageEl, 2048);
      var tries = [function () { return base; }, function () { return rotated(base, 90); }, function () { return rotated(base, 270); }, function () { return centreCrop(base, 0.6, 0.6); }];
      var i = 0;
      function next() {
        if (i >= tries.length) return zxingJsTry(tries);
        var src; try { src = tries[i++](); } catch (e) { return next(); }
        return det.detect(src).then(function (codes) { return codes && codes.length ? codes[0].rawValue : next(); }, function () { return next(); });
      }
      return next();
    }).catch(function () { return zxingJsTry([function () { return fit(imageEl, 2048); }]); });
  }
  /* live scan: returns a stop() function; onCode(code) fires once; onHint() once after 6 s without a read */
  function scanLive(videoEl, onCode, onError, onHint) {
    var stopped = false, stream = null, timer = 0, hinted = false, t0 = 0;
    function stop() { stopped = true; clearTimeout(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); videoEl.srcObject = null; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setTimeout(function () { if (!stopped && onError) onError(new Error('This browser has no camera access here. You can type the barcode digits instead.')); }, 0); return stop; }
    /* ask for 1080p frames: a barcode a few centimetres wide needs the pixels; the default is often 640 by 480 */
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
      if (stopped) { s.getTracks().forEach(function (t) { t.stop(); }); throw { name: 'Cancelled' }; } /* the sheet closed while the permission prompt was up */
      stream = s; videoEl.srcObject = s; videoEl.setAttribute('playsinline', ''); videoEl.muted = true;
      try {
        var track = s.getVideoTracks()[0], caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.indexOf('continuous') > -1) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () { });
      } catch (e) { }
      return videoEl.play();
    }).then(function () { return detector(); }).then(function (det) {
      if (stopped) return;
      var crop = false, failures = 0; t0 = Date.now();
      function hint() { if (!hinted && !stopped && onHint && Date.now() - t0 > 6000) { hinted = true; onHint(); } }
      function frame() {
        if (stopped) return;
        if (videoEl.readyState < 2 || !videoEl.videoWidth) { timer = setTimeout(frame, 120); return; }
        var src;
        /* every other frame: just the reticle box (room.css: 12% in from the sides, 30% from top and bottom) */
        try { src = crop ? centreCrop(fit(videoEl, 1920), 0.76, 0.40) : videoEl; } catch (e) { src = videoEl; }
        crop = !crop;
        det.detect(src).then(function (codes) {
          if (stopped) return;
          failures = 0;
          if (codes && codes.length) { stop(); onCode(codes[0].rawValue); return; }
          hint(); timer = setTimeout(frame, 150);
        }, function () {
          if (stopped) return;
          if (++failures >= 12) { stop(); onError && onError(new Error('The barcode reader is not working on this phone. You can type the digits instead.')); return; }
          hint(); timer = setTimeout(frame, 250);
        });
      }
      frame();
    }).catch(function (e) {
      var cancelled = stopped || (e && e.name === 'Cancelled'); stop();
      if (cancelled || !onError) return;
      onError(new Error(e && e.name === 'NotAllowedError' ? 'Camera permission was declined. You can type the barcode instead.' : ((e && e.message) || 'Camera unavailable. You can type the barcode instead.')));
    });
    return stop;
  }

  /* ---------- Singapore dishes: HPB SG FoodID ----------
   * assets/data/nutrients-sg-hpb.json is built by tools/build-hpb-table.py from the Health Promotion
   * Board's Singapore Food Insights Database (licence: SG FoodID Terms of Use s.10, attribution s.11).
   * `n` is per 100 g (100 ml for drinks) as served, so nutrients = n × grams on the plate ÷ 100. */
  var SG_URL = 'assets/data/nutrients-sg-hpb.json', sgTable = null, sgLoading = null;
  /* words that make a dish a different dish: a match is only confident when every one of these that
   * appears in the photo name also appears in the HPB row's own name or aliases */
  var SG_QUALIFIERS = ['kimchi', 'pineapple', 'seafood', 'korean', 'thai', 'japanese', 'vietnamese', 'indian', 'vegetarian', 'vegan', 'mock', 'cheese', 'mushroom', 'mala', 'salted', 'truffle', 'curry', 'sambal', 'french', 'oat', 'oatmeal', 'pandan', 'wholemeal', 'garlic', 'butter', 'honey', 'lemon', 'green', 'matcha', 'chocolate', 'strawberry', 'mango', 'durian', 'packaged', 'canned', 'instant', 'raw', 'uncooked', 'dried', 'ice cream', 'jelly', 'pearl', 'penang', 'ipoh', 'claypot', 'crayfish', 'beef', 'mutton', 'lamb', 'duck', 'pork', 'chicken', 'fish', 'prawn', 'shrimp', 'crab', 'egg', 'tofu', 'soup', 'dry', 'fried', 'iced', 'ice'];
  function sgNorm(s) {
    return String(s || '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
      .split(' ').map(function (t) { return t.length > 3 && /[^s]s$/.test(t) ? t.slice(0, -1) : t; }).join(' ');
  }
  function sgUse(t) {
    (t.foods || []).forEach(function (f) {
      f._keys = [f.name].concat(f.aliases || []).map(sgNorm).filter(Boolean);
      f._text = ' ' + f._keys.join(' ') + ' ';
      f.portions = [{ label: f.basis === '100ml' ? '100 ml' : '100 g', g: 100 }].concat(f.serving && f.serving.g ? [{ label: f.serving.label || '1 serving', g: f.serving.g }] : []);
      f.source = { kind: 'hpb', label: 'HPB SG FoodID', ref: f.crId + ' ' + f.name, date: 'data ' + f.year + ', read ' + t.retrieved, detail: (f.method || 'HPB') + ' · per 100 ' + (f.basis === '100ml' ? 'ml' : 'g') + ' as served · HPB serving ' + ((f.serving && f.serving.label) || '?'), url: f.url || (t.licence && t.licence.link) || 'https://pphtpc.hpb.gov.sg/web/sgfoodid' };
    });
    sgTable = t; return t;
  }
  function sgLoad() {
    if (sgTable) return Promise.resolve(sgTable);
    sgLoading = sgLoading || fetch(SG_URL).then(function (r) { if (!r.ok) throw new Error('HPB table unavailable (' + r.status + ')'); return r.json(); }).then(sgUse);
    return sgLoading;
  }
  var SG_PROTEINS = ['beef', 'mutton', 'lamb', 'duck', 'pork', 'chicken', 'fish', 'prawn', 'shrimp', 'crab', 'egg', 'tofu'];
  /* The longest alias found as a whole phrase inside the dish name wins ("bak chor mee soup" beats
   * "bak chor mee"). Then the qualifier guard: the head of the name (before "with", "and", a comma or a
   * bracket) must not carry a qualifier word the row does not know, so "kimchi fried rice" stays an
   * estimate instead of becoming egg fried rice; in the tail, where the model lists ingredients
   * ("... with minced pork, mushrooms, cabbage"), only a protein the row does not know rejects it.
   * Returns null or { food, alias } where alias is the matched phrase. */
  function sgMatch(name) {
    if (!sgTable) return null;
    var raw = String(name || ''), nq = sgNorm(raw), q = ' ' + nq + ' ', best = null, hit = '';
    if (nq.length < 3) return null;
    sgTable.foods.forEach(function (f) {
      f._keys.forEach(function (k) { if (k.length > hit.length && q.indexOf(' ' + k + ' ') > -1) { best = f; hit = k; } });
    });
    if (!best) return null;
    var head = ' ' + sgNorm(raw.split(/,|\(|\bwith\b|\band\b|\bserved\b|\btopped\b|\bplus\b/i)[0]) + ' ';
    for (var i = 0; i < SG_QUALIFIERS.length; i++) {
      var w = ' ' + sgNorm(SG_QUALIFIERS[i]) + ' ', inHead = head.indexOf(w) > -1, inTail = !inHead && q.indexOf(w) > -1 && SG_PROTEINS.indexOf(SG_QUALIFIERS[i]) > -1;
      if ((inHead || inTail) && best._text.indexOf(w) < 0) return null;
    }
    return { food: best, alias: hit };
  }
  function sgTableLoaded() { return sgTable; }

  root.OvuFood = { groupProducts: groupProducts, KEYS: KEYS, LABEL: LABEL, UNIT: UNIT, load: load, search: search, byId: byId, scale: scale, makeItem: makeItem, sum: sum, fmt: fmt, line: line, lookupBarcode: lookupBarcode, searchProducts: searchProducts, offToFood: offToFood, shrink: shrink, detectInImage: detectInImage, scanLive: scanLive, warmDecoder: warmDecoder, hasNativeDetector: 'BarcodeDetector' in root, sgLoad: sgLoad, sgUse: sgUse, sgMatch: sgMatch, sgNorm: sgNorm, sgTable: sgTableLoaded };
})(window);
