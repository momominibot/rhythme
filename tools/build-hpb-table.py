#!/usr/bin/env python3
"""Build assets/data/nutrients-sg-hpb.json from the Health Promotion Board's
Singapore Food Insights Database (SG FoodID, formerly FOCOS).

Source and licence (read on 2026-10-18):
  Web app   https://pphtpc.hpb.gov.sg/web/sgfoodid
  API       https://pphtpc.hpb.gov.sg/bff/v1/food-portal  (the app's own
            backend: GET foods?searchText=..&pageNumber=n, GET foods/details/{crId})
  Terms     https://file.go.gov.sg/termsofuse-hpbsgfoodid.pdf  (section 10,
            "Terms of Use of Data": HPB grants a worldwide, perpetual,
            royalty-free, non-exclusive licence to use, access, download, copy,
            distribute, transmit, modify and adapt the Data, commercially or
            non-commercially; section 11 requires a conspicuous attribution
            notice with a link to the licence, and no suggestion of HPB
            endorsement. These SG FoodID terms prevail over the general
            hpb.gov.sg terms where they conflict.)

Every row is one exact HPB record chosen by name from the curated DISHES list
below; nothing is invented. The script searches the exact name, keeps only an
exact (case-insensitive) name match, fetches the detail record and stores:
  per100Edible  HPB "baseFoodNutrients": per 100 g (100 ml for drinks) of the
                edible portion, exactly as published (-1 and null -> null)
  perServing    HPB "calculatedFoodNutrients" for the default portion
  n             per 100 g AS SERVED = per100Edible x ediblePortion/100, which
                is the figure the app multiplies by the grams on the plate.
                For every row the script checks that n x servingWeight/100
                reproduces HPB's own perServing value within 2 percent, so
                the derivation is verified against HPB's arithmetic.
Nutrient keys follow assets/data/nutrients-usda-sr.json. HPB publishes no
magnesium, so `mg` is always null. Missing values stay null, never zero.

Usage: python3 tools/build-hpb-table.py [--refresh]  (about 13 minutes for a full fetch at
       HPB's 60-a-minute limit; rows already in the JSON are kept unless --refresh)
"""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error, datetime

API = "https://pphtpc.hpb.gov.sg/bff/v1/food-portal"
APP = "https://pphtpc.hpb.gov.sg/web/sgfoodid"
TERMS = "https://file.go.gov.sg/termsofuse-hpbsgfoodid.pdf"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "data", "nutrients-sg-hpb.json")
PACE = 0.2  # small gap between calls; the real limit is read from the x-ratelimit headers

# HPB field -> app key. Folate: HPB names the column "folicAcid"; kept under the
# app's `folate` key and labelled as published. Magnesium is not published.
MAP = {"kcal": "energy", "protein": "protein", "fat": "fat", "carb": "carbohydrate", "fiber": "dietaryFibre",
       "sugar": "sugar", "ca": "calcium", "fe": "iron", "mg": None, "k": "potassium", "na": "sodium", "zn": "zinc",
       "vitc": "vitC", "folate": "folicAcid", "vitd": "vitD", "b12": "vitB12"}
NUTRIENTS = {"kcal": "Energy (kcal)", "protein": "Protein (g)", "fat": "Total fat (g)", "carb": "Carbohydrate (g)",
             "fiber": "Dietary fibre (g)", "sugar": "Sugars (g)", "ca": "Calcium (mg)", "fe": "Iron (mg)",
             "mg": "Magnesium (mg), not published by HPB", "k": "Potassium (mg)", "na": "Sodium (mg)", "zn": "Zinc (mg)",
             "vitc": "Vitamin C (mg)", "folate": "Folic acid / folate (µg) as published by HPB", "vitd": "Vitamin D (µg)",
             "b12": "Vitamin B12 (µg)"}

# (exact HPB name, app id, aliases the photo model or a person might use).
# The HPB name itself always counts as an alias. Longest whole-phrase alias
# wins in the app, so "bak chor mee soup" beats "bak chor mee".
DISHES = [
    # rice plates
    ("Steamed chicken rice", "chicken-rice", ["chicken rice", "hainanese chicken rice", "poached chicken rice", "white chicken rice", "steamed chicken with rice"]),
    ("Roasted chicken rice", "roast-chicken-rice", ["roasted chicken rice", "roast chicken rice", "roasted chicken with rice"]),
    ("Soya sauce chicken rice", "soy-chicken-rice", ["soya sauce chicken rice", "soy sauce chicken rice", "soy chicken rice"]),
    ("Claypot chicken rice", "claypot-chicken-rice", ["claypot chicken rice", "claypot rice"]),
    # Set rows take only names that say which set. HPB has no plain nasi lemak plate, only these three
    # sets and the coconut rice alone, so a bare "nasi lemak" (or one with only egg and ikan bilis named)
    # is on no row and stays the photo estimate; see sgMatch in ovu-food.js.
    ("Nasi lemak (fish set)", "nasi-lemak", ["nasi lemak with fish", "nasi lemak fish", "nasi lemak ikan", "nasi lemak with fried fish", "nasi lemak fried fish"]),
    ("Nasi lemak (chicken wing set)", "nasi-lemak-wing", ["nasi lemak chicken wing", "nasi lemak with chicken wing", "nasi lemak with fried chicken wing", "nasi lemak fried chicken wing", "nasi lemak ayam", "nasi lemak with chicken"]),
    ("Nasi lemak (chicken cutlet set)", "nasi-lemak-cutlet", ["nasi lemak chicken cutlet", "nasi lemak with chicken cutlet", "nasi lemak with fried chicken cutlet"]),
    ("Nasi lemak (rice only)", "coconut-rice", ["coconut rice", "nasi lemak rice", "nasi lemak rice only"]),
    ("Egg fried rice", "fried-rice", ["egg fried rice", "fried rice", "chinese fried rice", "fried rice with egg"]),
    ("Pineapple fried rice", "pineapple-fried-rice", ["pineapple fried rice", "thai pineapple fried rice"]),
    ("Yang chow fried rice", "yangzhou-fried-rice", ["yang chow fried rice", "yangzhou fried rice", "yangchow fried rice"]),
    ("Nasi goreng", "nasi-goreng", ["nasi goreng", "malay fried rice", "indonesian fried rice"]),
    ("Nasi briyani (chicken)", "chicken-briyani", ["chicken briyani", "chicken biryani", "briyani", "biryani", "nasi briyani", "nasi biryani"]),
    ("Nasi briyani (mutton)", "mutton-briyani", ["mutton briyani", "mutton biryani", "lamb biryani"]),
    ("Roasted duck rice", "duck-rice", ["duck rice", "roast duck rice", "roasted duck rice", "roasted duck with rice"]),
    ("Roasted pork rice", "roast-pork-rice", ["roast pork rice", "roasted pork rice", "sio bak rice", "crispy pork rice"]),
    ("Char siew rice", "char-siew-rice", ["char siew rice", "char siu rice", "bbq pork rice", "barbecued pork rice"]),
    ("Economic rice (1 vegetable, 1 meat)", "economy-rice", ["economy rice", "economic rice", "mixed vegetable rice", "cai fan", "cai png", "mixed rice", "economy rice 1 meat 1 vegetable"]),
    ("Economic rice (2 meats)", "economy-rice-2-meats", ["economy rice 2 meats", "economic rice 2 meats", "mixed rice 2 meats"]),
    ("Economic rice (2 vegetables)", "economy-rice-2-veg", ["economy rice 2 vegetables", "economic rice 2 vegetables", "mixed rice 2 vegetables", "vegetarian economy rice"]),
    ("Cooked white rice", "white-rice", ["white rice", "steamed rice", "plain rice", "steamed white rice", "jasmine rice", "cooked rice", "bowl of rice"]),
    ("Chicken porridge", "chicken-porridge", ["chicken porridge", "chicken congee", "porridge", "congee", "rice porridge"]),
    ("Oatmeal (boiled)", "oatmeal", ["oatmeal", "oats", "oat porridge", "boiled oats", "porridge oats", "oatmeal porridge", "cooked oats", "bowl of oats"]),
    ("Minced pork porridge", "pork-porridge", ["pork porridge", "minced pork porridge", "pork congee", "minced meat porridge"]),
    ("Sliced fish porridge", "fish-porridge", ["fish porridge", "sliced fish porridge", "fish congee"]),
    ("Ayam penyet with rice", "ayam-penyet", ["ayam penyet", "nasi ayam penyet", "smashed fried chicken with rice"]),
    ("Nasi padang (chicken set)", "nasi-padang", ["nasi padang", "nasi padang chicken"]),
    ("Lontong", "lontong", ["lontong", "lontong sayur"]),
    ("Fried carrot cake (black)", "carrot-cake-black", ["fried carrot cake", "carrot cake", "chai tow kway", "chai tau kway", "black carrot cake", "fried radish cake", "radish cake"]),
    ("Fried carrot cake (white)", "carrot-cake-white", ["white carrot cake", "white fried carrot cake", "fried carrot cake white"]),
    ("Chee cheong fun (plain)", "chee-cheong-fun", ["chee cheong fun", "cheong fun", "rice noodle rolls", "rice rolls"]),
    ("Lor mai kai (chicken)", "lor-mai-kai", ["lor mai kai", "glutinous rice with chicken", "glutinous rice chicken"]),
    # noodles
    ("Bak chor mee (dry)", "bak-chor-mee", ["bak chor mee", "minced meat noodles", "minced pork noodles", "mee pok", "bak chor mee dry", "dry bak chor mee", "minced meat noodles dry", "dry minced meat noodles", "minced meat mee pok", "noodles with minced pork", "noodles with minced meat", "flat noodles with minced pork", "mee pok with minced pork", "minced pork mee pok", "mee pok dry", "dry mee pok", "bak chor mee dry with soup"]),
    ("Bak chor mee (soup)", "bak-chor-mee-soup", ["bak chor mee soup", "minced meat noodles soup", "minced meat noodle soup", "minced pork noodle soup", "soup bak chor mee", "mee pok soup", "noodle soup with minced pork", "minced pork noodles in soup"]),
    ("Laksa", "laksa", ["laksa", "curry laksa", "katong laksa", "laksa noodles"]),
    ("Char kway teow", "char-kway-teow", ["char kway teow", "fried kway teow", "char kuey teow", "char kueh teow", "ckt"]),
    ("Hokkien mee", "hokkien-mee", ["hokkien mee", "fried hokkien mee", "hokkien prawn mee", "fried hokkien prawn noodles", "hokkien noodles"]),
    ("Wanton noodles (dry)", "wanton-mee", ["wanton mee", "wanton noodles", "wonton noodles", "wonton mee", "wanton noodles dry", "dry wanton noodles"]),
    ("Wanton noodles (soup)", "wanton-mee-soup", ["wanton noodle soup", "wanton noodles soup", "wonton noodle soup", "wanton mee soup"]),
    ("Fishball noodles (dry)", "fishball-noodles", ["fishball noodles", "fish ball noodles", "fishball mee", "fish ball mee", "fishball noodles dry", "dry fishball noodles"]),
    ("Fishball noodles (soup)", "fishball-noodles-soup", ["fishball noodle soup", "fish ball noodle soup", "fishball noodles soup", "fishball mee soup"]),
    ("Prawn noodles (soup)", "prawn-mee", ["prawn noodles", "prawn mee", "prawn noodle soup", "hae mee", "prawn noodles soup"]),
    ("Prawn noodles (dry)", "prawn-mee-dry", ["prawn noodles dry", "dry prawn noodles", "dry prawn mee", "prawn mee dry"]),
    ("Mee siam", "mee-siam", ["mee siam"]),
    ("Mee rebus", "mee-rebus", ["mee rebus"]),
    ("Mee goreng", "mee-goreng", ["mee goreng", "indian mee goreng", "fried yellow noodles", "mamak mee goreng"]),
    ("Mee soto", "mee-soto", ["mee soto"]),
    ("Soto ayam", "soto-ayam", ["soto ayam"]),
    ("Lor mee", "lor-mee", ["lor mee"]),
    ("Kway chap", "kway-chap", ["kway chap", "kueh chap"]),
    ("Ban mian (soup)", "ban-mian", ["ban mian", "ban mee", "handmade noodles", "handmade noodle soup", "ban mian soup"]),
    ("Ban mian (dry)", "ban-mian-dry", ["ban mian dry", "dry ban mian", "dry ban mee"]),
    ("Mee hoon kway (soup)", "mee-hoon-kueh", ["mee hoon kueh", "mee hoon kway", "mee hoon kuay"]),
    ("Beef hor fun", "beef-hor-fun", ["beef hor fun", "beef kway teow", "beef hor fun noodles", "beef flat rice noodles"]),
    ("Satay beehoon", "satay-bee-hoon", ["satay bee hoon", "satay beehoon"]),
    ("Plain fried beehoon", "fried-bee-hoon", ["fried bee hoon", "fried beehoon", "plain fried bee hoon", "fried vermicelli", "economy bee hoon", "economical bee hoon"]),
    ("Sliced fish beehoon soup (no milk)", "fish-bee-hoon-soup", ["sliced fish bee hoon soup", "fish bee hoon soup", "fish soup bee hoon", "sliced fish beehoon", "fish beehoon soup"]),
    ("Sliced fish soup (no milk)", "fish-soup", ["fish soup", "sliced fish soup", "fish slice soup", "sliced fish soup no milk"]),
    ("Fried fish soup (no milk)", "fried-fish-soup", ["fried fish soup", "fried fish slice soup"]),
    ("Fishball soup (no noodles)", "fishball-soup", ["fishball soup", "fish ball soup", "fishball soup no noodles"]),
    ("Bak kut teh (soup)", "bak-kut-teh", ["bak kut teh", "pork rib soup", "pork ribs soup", "bak kut teh soup"]),
    ("Chicken macaroni soup", "chicken-macaroni", ["chicken macaroni soup", "macaroni soup", "chicken macaroni"]),
    # bread, batter, snacks
    ("Plain prata", "prata", ["roti prata", "prata", "plain prata", "roti canai", "prata kosong"]),
    ("Prata (egg)", "egg-prata", ["egg prata", "prata egg", "roti prata egg", "roti prata with egg", "prata with egg", "prata telur"]),
    ("Toast (with butter)", "butter-toast", ["toast with butter", "buttered toast", "butter toast"]),
    ("French toast", "french-toast", ["french toast"]),
    ("Kaya and butter toast", "kaya-toast", ["kaya toast", "kaya butter toast", "kaya and butter toast", "kaya toast with butter"]),
    ("Soft-boiled chicken egg, whole", "soft-boiled-egg", ["soft boiled egg", "soft boiled eggs", "half boiled egg", "half boiled eggs", "soft-boiled egg", "half-boiled egg", "runny eggs"]),
    ("Thosai", "thosai", ["thosai", "dosa", "dosai", "plain thosai"]),
    ("Masala thosai", "masala-thosai", ["masala thosai", "masala dosa", "masala dosai"]),
    ("Chapati", "chapati", ["chapati", "chapatti", "chappati"]),
    ("Murtabak (mutton)", "mutton-murtabak", ["murtabak", "mutton murtabak"]),
    ("Murtabak (chicken)", "chicken-murtabak", ["chicken murtabak"]),
    ("Roti john", "roti-john", ["roti john"]),
    ("Popiah", "popiah", ["popiah", "spring roll fresh"]),
    ("Curry puff (chicken)", "curry-puff", ["curry puff", "chicken curry puff", "curry puffs"]),
    ("Char siew pau", "char-siew-pau", ["char siew pau", "char siu bao", "char siew bao", "bbq pork bun", "barbecued pork bun"]),
    ("Pork pau", "pork-pau", ["pork pau", "pork bun", "meat bun", "steamed pork bun"]),
    ("Toast", "toast", ["toast", "plain toast", "toasted bread"]),
    ("White bread", "white-bread", ["white bread", "bread slice", "sliced bread", "bread"]),
    ("Chwee kueh", "chwee-kueh", ["chwee kueh", "steamed rice cake with chye poh"]),
    ("You tiao", "you-tiao", ["you tiao", "youtiao", "dough fritter", "dough fritters", "yu char kway", "fried dough stick"]),
    ("Goreng pisang", "goreng-pisang", ["goreng pisang", "banana fritter", "banana fritters", "fried banana"]),
    ("Ondeh ondeh", "ondeh-ondeh", ["ondeh ondeh", "onde onde"]),
    ("Kueh lapis", "kueh-lapis", ["kueh lapis", "kuih lapis", "layer cake"]),
    ("Xiao long bao", "xiao-long-bao", ["xiao long bao", "xiaolongbao", "soup dumplings", "soup dumpling"]),
    ("Siew mai", "siew-mai", ["siew mai", "siu mai", "shumai"]),
    ("Har gao", "har-gao", ["har gao", "har gow", "prawn dumplings", "prawn dumpling", "shrimp dumplings"]),
    ("Chicken satay", "chicken-satay", ["satay", "chicken satay", "satay sticks"]),
    ("Beef satay", "beef-satay", ["beef satay"]),
    ("Mutton satay", "mutton-satay", ["mutton satay", "lamb satay"]),
    # meat, egg, vegetable sides
    ("Chicken curry", "chicken-curry", ["chicken curry", "curry chicken"]),
    ("Beef rendang", "beef-rendang", ["beef rendang", "rendang"]),
    ("Chicken rendang", "chicken-rendang", ["chicken rendang", "rendang ayam"]),
    ("Fried chicken wing", "fried-chicken-wing", ["fried chicken wing", "fried chicken wings", "chicken wing", "chicken wings", "fried wings"]),
    ("Barbecued chicken wing", "bbq-chicken-wing", ["bbq chicken wing", "bbq chicken wings", "barbecued chicken wing", "grilled chicken wing", "grilled chicken wings", "roasted chicken wing"]),
    ("Fried chicken cutlet", "chicken-cutlet", ["chicken cutlet", "fried chicken cutlet", "crispy chicken cutlet"]),
    ("Fried chicken (1 pc)", "fried-chicken", ["fried chicken", "fried chicken piece", "fried chicken thigh", "fried chicken drumstick"]),
    ("Korean fried chicken", "korean-fried-chicken", ["korean fried chicken", "korean chicken"]),
    ("Mapo tofu", "mapo-tofu", ["mapo tofu", "ma po tofu", "mapo doufu"]),
    ("Sweet and sour pork", "sweet-sour-pork", ["sweet and sour pork", "sweet sour pork"]),
    ("Char siew", "char-siew", ["char siew", "char siu", "bbq pork", "barbecued pork"]),
    ("Roasted pork belly", "roast-pork", ["roast pork", "roasted pork", "roasted pork belly", "sio bak", "crispy pork belly", "crispy roast pork"]),
    ("Roast duck", "roast-duck", ["roast duck", "roasted duck"]),
    ("Braised egg", "braised-egg", ["braised egg", "soy egg", "soy sauce egg", "lor nerng", "braised eggs"]),
    ("Tea leaf egg", "tea-egg", ["tea egg", "tea leaf egg", "tea eggs"]),
    ("Fried egg", "fried-egg", ["fried egg", "sunny side up", "fried eggs", "sunny-side-up egg"]),
    ("Steamed egg", "steamed-egg", ["steamed egg", "steamed eggs", "chawanmushi"]),
    ("Plain omelette", "omelette", ["omelette", "omelet", "plain omelette", "egg omelette"]),
    ("Oyster omelette", "oyster-omelette", ["oyster omelette", "orh luak", "or luak", "oyster omelet"]),
    ("Luncheon meat", "luncheon-meat", ["luncheon meat", "spam", "fried luncheon meat"]),
    ("Otah", "otah", ["otah", "otak otak", "otak-otak", "otah otah"]),
    ("Fishcake", "fishcake", ["fishcake", "fish cake", "fried fishcake", "fish cake slices"]),
    ("Fried tau kwa", "fried-tau-kwa", ["fried tau kwa", "fried tofu", "tau kwa", "fried beancurd", "fried bean curd"]),
    ("Plain tofu", "tofu", ["tofu", "plain tofu", "bean curd", "silken tofu", "steamed tofu"]),
    ("Steamed fish (Economic rice)", "steamed-fish", ["steamed fish", "steamed fish slice", "steamed fish fillet"]),
    ("Sambal kangkong", "sambal-kangkong", ["sambal kangkong", "kangkong", "kangkung", "water spinach"]),
    ("Stir fried chye sim", "chye-sim", ["chye sim", "cai xin", "choy sum", "stir fried chye sim", "stir-fried chye sim", "chye sim with oyster sauce"]),
    ("Stir fried kailan", "kailan", ["kailan", "kai lan", "chinese broccoli", "stir fried kailan", "gai lan"]),
    ("Stir fried mixed vegetables", "mixed-vegetables", ["stir fried mixed vegetables", "stir-fried mixed vegetables", "mixed vegetables", "stir fried vegetables", "stir-fried vegetables", "fried vegetables", "stir fried greens", "stir-fried greens", "sauteed vegetables"]),
    ("Braised mixed vegetables", "chap-chye", ["chap chye", "braised mixed vegetables", "braised vegetables", "chap chai"]),
    ("Curry vegetables", "curry-vegetables", ["curry vegetables", "curry vegetable", "vegetable curry", "sayur lodeh"]),
    ("Stir fried cabbage", "cabbage", ["stir fried cabbage", "cabbage", "fried cabbage"]),
    ("Stir fried bittergourd with egg", "bittergourd-egg", ["bitter gourd with egg", "bittergourd with egg", "bitter gourd egg", "stir fried bitter gourd"]),
    ("Stir fried bean paste long beans", "long-beans", ["long beans", "long bean", "stir fried long beans", "fried long beans"]),
    ("Yong tau foo (clear soup, 7 pieces, mixed)", "yong-tau-foo", ["yong tau foo", "yong tau fu", "yong tofu", "ytf", "yong tau foo soup", "yong tau foo clear soup"]),
    ("Yong tau foo (laksa, 7 pieces, mixed)", "yong-tau-foo-laksa", ["laksa yong tau foo", "yong tau foo laksa", "yong tau foo in laksa"]),
    ("Chinese rojak (mixed)", "rojak", ["rojak", "chinese rojak"]),
    ("Indian rojak", "indian-rojak", ["indian rojak"]),
    ("Chilli crab", "chilli-crab", ["chilli crab", "chili crab"]),
    # drinks (per 100 ml, serving in ml)
    ("Kopi", "kopi", ["kopi", "kopitiam coffee", "coffee with condensed milk", "local coffee", "kopi with condensed milk"]),
    ("Kopi C", "kopi-c", ["kopi c", "kopi-c", "coffee with evaporated milk"]),
    ("Kopi O", "kopi-o", ["kopi o", "kopi-o", "black coffee with sugar", "kopi o kosong"]),
    ("Iced Kopi", "iced-kopi", ["iced kopi", "kopi peng", "kopi ice", "iced local coffee"]),
    ("Teh", "teh", ["teh", "teh with condensed milk", "local milk tea", "kopitiam milk tea"]),
    ("Teh C", "teh-c", ["teh c", "teh-c", "tea with evaporated milk"]),
    ("Teh O", "teh-o", ["teh o", "teh-o", "black tea with sugar", "teh o kosong"]),
    ("Teh Tarik", "teh-tarik", ["teh tarik", "pulled tea"]),
    ("Iced Teh", "iced-teh", ["iced teh", "teh peng", "teh ice", "iced milk tea local"]),
    ("Teh halia", "teh-halia", ["teh halia", "ginger milk tea", "ginger tea with milk"]),
    ("Milo", "milo", ["milo", "hot milo", "chocolate malt drink", "malted chocolate drink", "milo chocolate malt drink"]),
    ("Iced Milo", "iced-milo", ["iced milo", "milo peng", "milo ice"]),
    ("Milo dinosaur", "milo-dinosaur", ["milo dinosaur"]),
    ("Bandung", "bandung", ["bandung", "sirap bandung", "rose syrup milk"]),
    ("Barley drink", "barley", ["barley", "barley drink", "barley water"]),
    ("Soy milk (no topping)", "soya-bean-milk", ["soya bean milk", "soy milk", "soya milk", "soybean milk", "soya bean drink", "soy bean milk"]),
    ("Fresh sugarcane juice", "sugarcane-juice", ["sugarcane juice", "sugar cane juice", "sugarcane drink", "sugar cane drink"]),
    ("Lime juice/calamansi drink", "lime-juice", ["lime juice", "calamansi juice", "limau", "calamansi drink", "lime juice drink"]),
    ("Grass jelly drink", "grass-jelly", ["grass jelly drink", "grass jelly", "chin chow"]),
    ("Bubble tea with milk", "bubble-tea", ["bubble tea", "bubble milk tea", "boba milk tea", "pearl milk tea", "boba tea"]),
    ("Chendol", "chendol", ["chendol", "cendol"]),
    ("Ice kacang", "ice-kacang", ["ice kacang", "ais kacang", "shaved ice kacang"]),
    ("Tau huey", "tau-huay", ["tau huay", "tau huey", "beancurd pudding", "soya beancurd", "soy beancurd", "douhua", "tau hway"]),
    ("Cheng tng", "cheng-tng", ["cheng tng", "cheng teng"]),
    ("Red bean soup", "red-bean-soup", ["red bean soup"]),
]


def get(path, tries=6):
    """One GET. The API sends x-ratelimit-limit 60 / x-ratelimit-reset 60 (a 60-a-minute window), so
    we pause only when the window is nearly spent, and back off on a 429."""
    req = urllib.request.Request(API + path, headers={"Accept": "application/json", "Referer": APP + "/"})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                left, reset = r.headers.get("x-ratelimit-remaining"), r.headers.get("x-ratelimit-reset")
                data = json.load(r)
            if left is not None and int(left) <= 2:
                time.sleep(float(reset or 60) + 1)
            else:
                time.sleep(PACE)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1:
                time.sleep(float(e.headers.get("x-ratelimit-reset") or 0) + 15 + 10 * i); continue
            raise


def num(v):
    """HPB uses -1 and null for 'not available'. Both become null; never zero."""
    if v is None: return None
    try: v = float(v)
    except (TypeError, ValueError): return None
    if v < 0: return None
    return round(v, 3)


def pick(block, edible):
    raw, served = {}, {}
    for key, field in MAP.items():
        v = num(block.get(field)) if field else None
        raw[key] = v
        served[key] = None if v is None else round(v * edible / 100, 3)
    return raw, served


def find_exact(name):
    for page in (1, 2):
        rows = get("/foods?searchText=" + urllib.parse.quote(name) + "&pageNumber=" + str(page))
        for r in rows:
            if r.get("name", "").strip().lower() == name.lower() and not r.get("isDeactivated"):
                return r
        if len(rows) < 25: break
    return None


def main():
    """Rows already in the JSON are kept (aliases and ids refreshed from DISHES) unless --refresh is
    given, so an alias change does not refetch every dish."""
    today = datetime.date.today().isoformat()
    refresh = "--refresh" in sys.argv
    prev = {}
    if os.path.exists(OUT) and not refresh:
        try:
            for f in json.load(open(OUT, encoding="utf-8")).get("foods", []):
                if f.get("crId") and f.get("n") and f.get("perServing"): prev[f["name"].strip().lower()] = f
        except (ValueError, OSError):
            prev = {}
    foods, misses, warnings, fetched = [], [], [], 0
    for name, slug, aliases in DISHES:
        old = prev.get(name.lower())
        if old:
            row = dict(old); row["id"] = "hpb:" + slug; row["aliases"] = aliases; foods.append(row)
            print("kept  %-45s %s (accessed %s)" % (name, row["crId"], row.get("accessed"))); continue
        fetched += 1
        row = find_exact(name)
        if not row:
            misses.append(name); print("MISS  " + name); continue
        d = get("/foods/details/" + row["crId"])
        if "baseFoodNutrients" not in d:
            misses.append(name); print("NODATA " + name + " " + json.dumps(d)[:120]); continue
        edible = float(d.get("ediblePortion") or 100)
        weight = num(d.get("defaultWeight"))
        is_drink = (d.get("category") or row.get("type")) == "Drink"
        per100, served = pick(d["baseFoodNutrients"], edible)
        per_serving, _ = pick(d.get("calculatedFoodNutrients") or {}, 100)
        # verify the as-served derivation against HPB's own per-serving arithmetic
        if weight:
            for k in ("kcal", "protein", "fat", "carb"):
                if served[k] is not None and per_serving[k] not in (None, 0):
                    pred = served[k] * weight / 100
                    if abs(pred - per_serving[k]) > 0.02 * per_serving[k] + 0.6:
                        warnings.append("%s %s: derived %.1f vs HPB serving %.1f" % (row["crId"], k, pred, per_serving[k]))
        foods.append({
            "id": "hpb:" + slug, "crId": row["crId"], "name": d.get("name") or name, "desc": d.get("description") or "",
            "group": d.get("l1Category"), "cat": d.get("l2Category"), "type": "drink" if is_drink else "food",
            "aliases": aliases, "basis": "100ml" if is_drink else "100g",
            "serving": {"label": d.get("defaultPortion") or "", "g": weight},
            "altPortions": None if (d.get("alternativePortions") in (None, "", "-")) else d.get("alternativePortions"),
            "edible": edible, "year": d.get("yearOfData"), "method": d.get("sourceOfData"),
            "n": served, "per100Edible": per100, "perServing": per_serving,
            "url": APP + "/tools/food-search", "accessed": today,
        })
        print("ok    %-45s %s  %s  %s kcal/100  serving %s" % (name, row["crId"], d.get("sourceOfData"), served["kcal"], d.get("defaultPortion")))
    retrieved = max([f.get("accessed") or today for f in foods] or [today])
    out = {
        "source": "Health Promotion Board, Singapore Food Insights Database (SG FoodID, formerly FOCOS), " + APP,
        "licence": {
            "summary": "SG FoodID Terms of Use section 10: worldwide, perpetual, royalty-free, non-exclusive licence to use, access, download, copy, distribute, transmit, modify and adapt the Data, commercially or non-commercially. Section 11: a conspicuous attribution notice with a link to the licence is required; no suggestion of HPB endorsement; data is provided as is.",
            "terms": TERMS, "link": APP,
            "notice": "Contains information from Singapore Food Insights Database (SG FoodID) accessed on " + retrieved + " from Health Promotion Board which is made available under the terms found at " + APP + ". The information contained within this dataset is provided on an \"as-is\" basis. The data, including but not limited to nutritional information, is subject to inherent limitations. No warranty or representation is made as to the accuracy or completeness of the data contained herein.",
        },
        "retrieved": retrieved, "api": API,
        "basis": "n = per 100 g (100 ml for drinks) as served, derived as HPB per-100 g edible-portion value x ediblePortion / 100 and checked against HPB's own per-serving figures; per100Edible = HPB baseFoodNutrients as published; perServing = HPB calculatedFoodNutrients for serving.g. -1 and null in HPB are null here. Carbohydrate is as published by HPB (available carbohydrate, fibre listed separately).",
        "nutrients": NUTRIENTS, "count": len(foods), "misses": misses, "foods": foods,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print("\n%d foods written to %s (%d fetched, %d kept); %d misses; %d derivation warnings" % (len(foods), OUT, fetched, len(foods) - fetched, len(misses), len(warnings)))
    for w in warnings: print("WARN  " + w)
    return 1 if misses or warnings else 0


if __name__ == "__main__":
    sys.exit(main())
