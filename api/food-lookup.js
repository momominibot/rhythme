// Ovuluna · Food Lookup API — Vercel serverless function
// Barcode lookup via Open Food Facts + OCR text processing.
// Returns standardized food data for the label scanner.

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'Ovuluna/1.0 (food-label-scanner; wellness app)';

// ── Allergen normalization (port of mallow allergens.ts) ──
const ALLERGEN_SYNONYMS = {
  milk: 'milk', dairy: 'milk', lactose: 'milk',
  egg: 'eggs', eggs: 'eggs',
  fish: 'fish',
  crustaceans: 'shellfish', shellfish: 'shellfish', molluscs: 'shellfish',
  mollusks: 'shellfish', shrimp: 'shellfish',
  'tree-nuts': 'tree-nuts', 'tree nuts': 'tree-nuts', nuts: 'tree-nuts',
  almond: 'tree-nuts', cashew: 'tree-nuts', walnut: 'tree-nuts',
  peanut: 'peanuts', peanuts: 'peanuts', groundnuts: 'peanuts',
  wheat: 'wheat', gluten: 'gluten',
  soy: 'soybeans', soya: 'soybeans', soybeans: 'soybeans',
  sesame: 'sesame', 'sesame-seeds': 'sesame'
};

const ALLERGEN_ORDER = ['milk','eggs','fish','shellfish','tree-nuts','peanuts','wheat','gluten','soybeans','sesame'];

function normalizeAllergens(raw) {
  if (!raw || !raw.length) return [];
  const found = new Set();
  for (const item of raw) {
    const cleaned = String(item).toLowerCase().replace(/^[a-z]{2}:/, '').trim();
    if (ALLERGEN_SYNONYMS[cleaned]) {
      found.add(ALLERGEN_SYNONYMS[cleaned]);
      continue;
    }
    for (const [token, canon] of Object.entries(ALLERGEN_SYNONYMS)) {
      if (cleaned.includes(token)) found.add(canon);
    }
  }
  return ALLERGEN_ORDER.filter(a => found.has(a));
}

// ── NOVA parsing ──
function parseNova(v) {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return (n === 1 || n === 2 || n === 3 || n === 4) ? n : undefined;
}

// ── Nutriment mapping from OFF ──
function mapNutriments(n) {
  n = n || {};
  return {
    energyKcal: n['energy-kcal_100g'],
    proteinG: n['proteins_100g'],
    fatG: n['fat_100g'],
    saturatedFatG: n['saturated-fat_100g'],
    carbsG: n['carbohydrates_100g'],
    sugarsG: n['sugars_100g'],
    fiberG: n['fiber_100g'],
    saltG: n['salt_100g'],
    sodiumMg: n['sodium_100g'] != null ? n['sodium_100g'] * 1000 : undefined
  };
}

// ── Additive extraction from OFF tags ──
function extractAdditives(tags) {
  if (!tags || !tags.length) return { count: 0, list: [] };
  const list = tags.map(t => String(t).replace(/^[a-z]{2}:/, '').replace(/^e-?/, 'E').trim()).filter(Boolean);
  return { count: list.length, list };
}

// ── Barcode lookup via Open Food Facts ──
async function lookupBarcode(barcode) {
  const fields = [
    'product_name', 'brands', 'image_url', 'image_front_url',
    'ingredients_text', 'serving_size', 'serving_quantity',
    'allergens_tags', 'allergens', 'nova_group',
    'additives_n', 'additives_tags', 'nutriments'
  ].join(',');

  const url = `${OFF_BASE}/product/${encodeURIComponent(barcode)}?fields=${fields}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);

  const json = await res.json();
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const additives = extractAdditives(p.additives_tags);
  const novaGroup = parseNova(p.nova_group);
  const additivesCount = p.additives_n != null ? p.additives_n : additives.count;

  return {
    name: (p.product_name || '').trim() || 'Unknown product',
    brand: (p.brands || '').split(',')[0]?.trim() || undefined,
    ingredients: (p.ingredients_text || '').trim() || undefined,
    ingredientsList: (p.ingredients_text || '').split(/[,;]/).map(s => s.trim()).filter(Boolean),
    nutriments: mapNutriments(p.nutriments),
    processing: {
      novaGroup: novaGroup,
      additivesCount: additivesCount,
      additivesList: additives.list
    },
    allergens: normalizeAllergens(p.allergens_tags || (p.allergens ? p.allergens.split(',') : [])),
    imageUrl: p.image_front_url || p.image_url,
    source: 'barcode',
    barcode: barcode
  };
}

// ── NOVA estimation from ingredients text (heuristic) ──
function estimateNovaFromIngredients(ingredientsText, additivesCount) {
  if (!ingredientsText) return undefined;
  const text = ingredientsText.toLowerCase();

  // Ultra-processed indicators (NOVA 4)
  const nova4Indicators = [
    'high fructose corn syrup', 'hydrogenated oil', 'partially hydrogenated',
    'modified starch', 'maltodextrin', 'dextrose', 'invert sugar',
    'artificial flavor', 'artificial colour', 'artificial color',
    'monosodium glutamate', 'msg', 'sodium nitrite', 'sodium nitrate',
    'carrageenan', 'polysorbate', 'xanthan gum', 'guar gum',
    'soy protein isolate', 'whey protein isolate', 'textured vegetable protein'
  ];
  const nova4Hits = nova4Indicators.filter(i => text.includes(i)).length;

  // Processed indicators (NOVA 3)
  const nova3Indicators = [
    'sugar', 'salt', 'oil', 'butter', 'vinegar', 'honey',
    'natural flavor', 'natural flavour', 'citric acid', 'ascorbic acid',
    'tocopherol', 'lecithin', 'pectin', 'gelatin'
  ];
  const nova3Hits = nova3Indicators.filter(i => text.includes(i)).length;

  if (additivesCount >= 5 || nova4Hits >= 2) return 4;
  if (additivesCount >= 2 || nova4Hits >= 1 || nova3Hits >= 3) return 3;
  if (nova3Hits >= 1) return 2;
  return 1;
}

// ── Parse additives from ingredients text ──
function parseAdditivesFromText(ingredientsText) {
  if (!ingredientsText) return { count: 0, list: [] };
  // Match E-numbers (e.g., E102, E-330, e 415) and common additive names
  const eNumbers = ingredientsText.match(/[Ee]-?\s?\d{3,4}[a-z]?/gi) || [];
  const normalized = eNumbers.map(e => e.toUpperCase().replace(/\s/g, '').replace(/-/g, ''));
  const unique = [...new Set(normalized)];

  // Also look for common additive names
  const additiveNames = [
    'citric acid', 'ascorbic acid', 'tocopherol', 'lecithin', 'pectin',
    'gelatin', 'carrageenan', 'xanthan gum', 'guar gum', 'polysorbate',
    'monosodium glutamate', 'sodium nitrite', 'sodium nitrate',
    'maltodextrin', 'dextrose', 'invert sugar', 'high fructose corn syrup',
    'hydrogenated oil', 'modified starch', 'artificial flavor', 'artificial flavour',
    'natural flavor', 'natural flavour', 'sodium benzoate', 'potassium sorbate'
  ];
  const text = ingredientsText.toLowerCase();
  const foundNames = additiveNames.filter(n => text.includes(n));

  const allAdditives = [...unique, ...foundNames];
  return { count: allAdditives.length, list: allAdditives };
}

// ── Process OCR / manual ingredients text ──
function processOcrText(data) {
  const { ingredients, nutriments, name, brand } = data;

  const additives = parseAdditivesFromText(ingredients);
  const novaGroup = estimateNovaFromIngredients(ingredients, additives.count);

  // Parse ingredients into list
  const ingredientsList = ingredients
    ? ingredients.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    : [];

  // Normalize nutriments — ensure per 100g values
  const normNutriments = {};
  if (nutriments) {
    if (nutriments.sugarsG != null) normNutriments.sugarsG = Number(nutriments.sugarsG);
    if (nutriments.saltG != null) normNutriments.saltG = Number(nutriments.saltG);
    if (nutriments.fatG != null) normNutriments.fatG = Number(nutriments.fatG);
    if (nutriments.saturatedFatG != null) normNutriments.saturatedFatG = Number(nutriments.saturatedFatG);
    if (nutriments.proteinG != null) normNutriments.proteinG = Number(nutriments.proteinG);
    if (nutriments.carbsG != null) normNutriments.carbsG = Number(nutriments.carbsG);
    if (nutriments.energyKcal != null) normNutriments.energyKcal = Number(nutriments.energyKcal);
    if (nutriments.fiberG != null) normNutriments.fiberG = Number(nutriments.fiberG);
  }

  // Detect allergens from ingredients text
  const allergenHints = [];
  if (ingredients) {
    const text = ingredients.toLowerCase();
    if (text.includes('milk') || text.includes('dairy') || text.includes('lactose')) allergenHints.push('milk');
    if (text.includes('egg')) allergenHints.push('eggs');
    if (text.includes('fish')) allergenHints.push('fish');
    if (text.includes('shellfish') || text.includes('shrimp') || text.includes('crustacean')) allergenHints.push('shellfish');
    if (text.includes('almond') || text.includes('cashew') || text.includes('walnut') || text.includes('tree nut')) allergenHints.push('tree-nuts');
    if (text.includes('peanut')) allergenHints.push('peanuts');
    if (text.includes('wheat') || text.includes('flour')) allergenHints.push('wheat');
    if (text.includes('gluten')) allergenHints.push('gluten');
    if (text.includes('soy') || text.includes('soya')) allergenHints.push('soybeans');
    if (text.includes('sesame')) allergenHints.push('sesame');
  }

  return {
    name: name || 'Scanned product',
    brand: brand || undefined,
    ingredients: ingredients || undefined,
    ingredientsList: ingredientsList,
    nutriments: normNutriments,
    processing: {
      novaGroup: novaGroup,
      additivesCount: additives.count,
      additivesList: additives.list
    },
    allergens: normalizeAllergens(allergenHints),
    imageUrl: undefined,
    source: 'ocr'
  };
}

// ── Main handler ──
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { barcode, ingredients, nutriments, name, brand } = body;

    // ── Mode 1: Barcode lookup ──
    if (barcode) {
      const cleanBarcode = String(barcode).trim();
      if (!cleanBarcode) {
        return res.status(400).json({ error: 'invalid_barcode', message: 'Barcode is empty' });
      }

      try {
        const result = await lookupBarcode(cleanBarcode);
        if (!result) {
          return res.status(404).json({ error: 'not_found', message: 'Product not found in Open Food Facts' });
        }
        return res.status(200).json(result);
      } catch (err) {
        console.error('Barcode lookup error:', err);
        return res.status(502).json({ error: 'off_api_error', message: 'Open Food Facts API unavailable' });
      }
    }

    // ── Mode 2: OCR / manual text processing ──
    if (ingredients || nutriments) {
      const result = processOcrText({ ingredients, nutriments, name, brand });
      return res.status(200).json(result);
    }

    // ── Neither ──
    return res.status(400).json({
      error: 'missing_params',
      message: 'Provide either { barcode } or { ingredients, nutriments? }'
    });

  } catch (error) {
    console.error('Food lookup error:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  }
}
