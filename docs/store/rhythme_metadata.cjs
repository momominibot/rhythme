/* Fill the Rhythme App Store listing through the App Store Connect API (docs/store/LISTING.md values).
   Safe to re-run: every call updates the same records. Submits nothing. Usage: node rhythme_metadata.cjs */
const { call } = require("./asc.cjs");
const APP = "6826516943", LOC = "en-US";
const URLS = { privacy: "https://momominibot.github.io/rhythme/terms.html", support: "https://momominibot.github.io/rhythme/terms.html" };
const KEYWORDS = "period,tracker,cycle,menstrual,cosy,game,garden,mindfulness,sleep,pms,pcos,menopause,wellbeing";
const DESCRIPTION = `Looking after yourself should feel lovely, not like homework. Rhythme turns your daily check-in into a cosy little ritual: a dreamy room that is all yours, where logging your period, sleep, mood and meals takes a few gentle taps, and every log earns hearts to grow your world.

WHY YOU WILL LOVE IT
- A diary that feels like a game: tap things around your room to log sleep, water, meals and more.
- Hearts for showing up for yourself, to grow a garden, keep a farm, dress up and decorate your home.
- Calm whenever you need it, with guided mindfulness from a certified MBSR teacher.
- Private by design: your diary stays on your phone unless you choose to back it up.

KNOW YOUR CYCLE
- Log period days, flow, spotting, symptoms, pain and mood in seconds.
- See where you are in your cycle, when your next period may come and your likely fertile days, always shown as estimates from what you have logged.
- Watch your cycles over time on a calendar, and see how much your cycle length varies.

YOUR WHOLE DAY, IN ONE PLACE
- Sleep on the bedside clock, a food diary with food search and barcode scanning, water, movement and weight.
- Bring in sleep, period days, spotting, steps, workouts, resting heart rate and temperature from Apple Health, only what you tick. Rhythme never writes to Apple Health.
- A four-week summary and a PDF ready for your next doctor's visit.

CALM, WITH ERIN
- Short practices voiced by Erin Lee, a certified MBSR teacher: a morning start, breathing, and mindful moments while you brush your teeth or make tea.
- Soothing breathing games like the Koi Pond and the Light Flower, and a hidden spring to sit by.

LEARN, GROW AND COOK
- Recipes and short reads from women's health and bone health charities, each source summarised right inside the app.
- Grow vegetables, keep hens and a cow, fish at the harbour, then cook the recipes in your own little kitchen.
- Wander a lane of little shops, try on outfits and make friends with the villagers.

YOURS, AND ONLY YOURS
- No ads, ever, and your data is never sold. Health data is never used for marketing.
- Cloud backup stays off until you turn it on.

Free to download, with no in-app purchases.

Rhythme is for adults 18 and over. It is a wellness diary, not a medical device: it does not diagnose or treat any condition, and its cycle estimates are not a method of contraception. Talk to a doctor about any health concern. In an emergency, call your local emergency number.`;
const PROMO = "Make self-care a cosy ritual. Log your cycle, sleep and mood in your own dream room, earn hearts, and grow a garden, a farm and a home. Free, with no ads.";
const REVIEW_NOTES = "Rhythme is a period and wellbeing diary for adults 18 and over, set in a cosy room you look after. Sign in on the first screen with the six-digit code emailed to any address; signing in does not upload anything. After the short start the room opens: the Cycle tab shows the cycle estimate, the Mind tab holds guided mindfulness, the Food tab the food diary, and tapping things in the room logs sleep, water and more. Apple Health is read only, after the person ticks what to bring in, and is never written. Cloud backup is off until the person turns it on in You. Hearts are earned by logging and cannot be bought; there are no in-app purchases. Rhythme gives general information only, never diagnoses, and says its estimates are not contraception. Sources open as in-app summaries. The AI help is paused and sends nothing.";

if (KEYWORDS.length > 100 || PROMO.length > 170 || DESCRIPTION.length > 4000) throw new Error("too long: " + [KEYWORDS.length, PROMO.length, DESCRIPTION.length]);
async function must(p, label) { const r = await p; if (r.status >= 300) { console.log("FAIL", label, r.status, JSON.stringify(r.json || r.text).slice(0, 500)); process.exitCode = 1; } else console.log("ok", label, r.status); return r; }

(async () => {
  const infos = await call("GET", "/v1/apps/" + APP + "/appInfos?include=appInfoLocalizations");
  const info = infos.json.data[0];
  const infoLoc = (infos.json.included || []).find((i) => i.type === "appInfoLocalizations" && i.attributes.locale === LOC);
  await must(call("PATCH", "/v1/appInfos/" + info.id, { data: { type: "appInfos", id: info.id, relationships: {
    primaryCategory: { data: { type: "appCategories", id: "HEALTH_AND_FITNESS" } },
    secondaryCategory: { data: { type: "appCategories", id: "LIFESTYLE" } } } } }), "categories");
  await must(call("PATCH", "/v1/appInfoLocalizations/" + infoLoc.id, { data: { type: "appInfoLocalizations", id: infoLoc.id, attributes: {
    subtitle: "Log your days, grow your world", privacyPolicyUrl: URLS.privacy } } }), "subtitle, privacy URL");
  const vers = await call("GET", "/v1/apps/" + APP + "/appStoreVersions?include=appStoreVersionLocalizations,appStoreReviewDetail");
  const ver = vers.json.data[0];
  await must(call("PATCH", "/v1/appStoreVersions/" + ver.id, { data: { type: "appStoreVersions", id: ver.id, attributes: {
    copyright: "2026 RANKLORE PTE. LTD.", releaseType: "MANUAL" } } }), "copyright, manual release");
  const verLoc = (vers.json.included || []).find((i) => i.type === "appStoreVersionLocalizations" && i.attributes.locale === LOC);
  await must(call("PATCH", "/v1/appStoreVersionLocalizations/" + verLoc.id, { data: { type: "appStoreVersionLocalizations", id: verLoc.id, attributes: {
    description: DESCRIPTION, keywords: KEYWORDS, promotionalText: PROMO, supportUrl: URLS.support } } }), "description, keywords, support URL");
  const mal = await call("GET", "/v1/apps/6824951843/appStoreVersions?limit=1&include=appStoreReviewDetail");
  const src = (mal.json.included || []).find((i) => i.type === "appStoreReviewDetails").attributes;
  const contact = { contactFirstName: src.contactFirstName, contactLastName: src.contactLastName, contactPhone: src.contactPhone,
    contactEmail: "hello@ranklore.ai", demoAccountRequired: false, notes: REVIEW_NOTES };
  const existing = (vers.json.included || []).find((i) => i.type === "appStoreReviewDetails");
  if (existing) await must(call("PATCH", "/v1/appStoreReviewDetails/" + existing.id, { data: { type: "appStoreReviewDetails", id: existing.id, attributes: contact } }), "review details");
  else await must(call("POST", "/v1/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes: contact,
    relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } } } }), "review details");
})();
