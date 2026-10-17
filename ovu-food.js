/* Ovumind camera-assisted food logging.
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
      per100: food.n, nutrients: scale(food.n, grams)
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
  var OFF_FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments,nutriscore_grade,nova_group,image_front_small_url,last_modified_t,categories_tags_en';
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
    return { id: 'off:' + p.code, name: name, cat: 'packaged', n: per100, basis: basis, portions: portions, image: p.image_front_small_url || null, nutriscore: p.nutriscore_grade || null, nova: p.nova_group || null,
      source: { kind: 'off', ref: 'Barcode ' + p.code, date: p.last_modified_t ? new Date(p.last_modified_t * 1000).toISOString().slice(0, 10) : null, label: 'Open Food Facts label data', url: 'https://world.openfoodfacts.org/product/' + p.code, detail: 'Community-maintained label transcription; check against the pack.' } };
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
  var zxingLoading = null;
  function loadZXing() {
    if (root.ZXingBrowser) return Promise.resolve(root.ZXingBrowser);
    zxingLoading = zxingLoading || new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js'; s.async = true;
      s.onload = function () { resolve(root.ZXingBrowser); }; s.onerror = function () { reject(new Error('Barcode reader could not load (offline?).')); };
      document.head.appendChild(s);
    });
    return zxingLoading;
  }
  var FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
  function detectInImage(imageEl) {
    if ('BarcodeDetector' in root) {
      return new root.BarcodeDetector({ formats: FORMATS }).detect(imageEl).then(function (codes) { return codes.length ? codes[0].rawValue : null; }).catch(function () { return null; });
    }
    return loadZXing().then(function (Z) { var reader = new Z.BrowserMultiFormatReader(); return reader.decodeFromImageElement(imageEl).then(function (r) { return r.getText(); }, function () { return null; }); }).catch(function () { return null; });
  }
  /* live scan: returns a stop() function; onCode(code) fires once */
  function scanLive(videoEl, onCode, onError) {
    var stopped = false, stream = null, raf = 0, zxControls = null;
    function stop() { stopped = true; cancelAnimationFrame(raf); try { zxControls && zxControls.stop(); } catch (e) { } if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); videoEl.srcObject = null; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (s) {
      stream = s; videoEl.srcObject = s; videoEl.setAttribute('playsinline', ''); videoEl.muted = true; return videoEl.play();
    }).then(function () {
      if ('BarcodeDetector' in root) {
        var det = new root.BarcodeDetector({ formats: FORMATS }), busy = false;
        (function tick() { if (stopped) return; if (!busy && videoEl.readyState >= 2) { busy = true; det.detect(videoEl).then(function (codes) { busy = false; if (codes.length && !stopped) { stop(); onCode(codes[0].rawValue); } }, function () { busy = false; }); } raf = requestAnimationFrame(tick); })();
      } else {
        loadZXing().then(function (Z) {
          var reader = new Z.BrowserMultiFormatReader();
          return reader.decodeFromVideoElement(videoEl, function (result) { if (result && !stopped) { stop(); onCode(result.getText()); } });
        }).then(function (c) { zxControls = c; }).catch(function (e) { stop(); onError && onError(e); });
      }
    }).catch(function (e) { stop(); onError && onError(new Error(e && e.name === 'NotAllowedError' ? 'Camera permission was declined. You can type the barcode instead.' : 'Camera unavailable: ' + (e.message || e))); });
    return stop;
  }

  root.OvuFood = { KEYS: KEYS, LABEL: LABEL, UNIT: UNIT, load: load, search: search, byId: byId, scale: scale, makeItem: makeItem, sum: sum, fmt: fmt, line: line, lookupBarcode: lookupBarcode, offToFood: offToFood, shrink: shrink, detectInImage: detectInImage, scanLive: scanLive, hasNativeDetector: 'BarcodeDetector' in root };
})(window);
