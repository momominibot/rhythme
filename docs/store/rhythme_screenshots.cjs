/* Upload the 8 iPhone promo screenshots (store/promo/ios, 1320 x 2868) to the Rhythme App Store version, en-GB.
   Safe to re-run: a file already in the 6.9-inch set with the same name and size is skipped; nothing else is removed.
   Does not submit anything. Usage: node tools/asc_screenshots.cjs [--dry] */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { call } = require("./asc.cjs");
const APP = "6826516943", TYPE = "APP_IPHONE_67", DIR = path.join(__dirname, "2026-10-21"), DRY = process.argv.includes("--dry");

function must(r, label) {
  if (r.status >= 300) { console.log("FAIL", label, r.status, JSON.stringify(r.json || r.text).slice(0, 500)); process.exit(1); }
  return r.json;
}

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => /^frame-\d\d-.*\.jpg$/.test(f)).sort();
  if (files.length !== 8) { console.log("FAIL expected 8 screenshots, found", files.length); process.exit(1); }
  const vers = must(await call("GET", "/v1/apps/" + APP + "/appStoreVersions?include=appStoreVersionLocalizations"), "versions");
  const loc = (vers.included || []).find((i) => i.type === "appStoreVersionLocalizations" && i.attributes.locale === "en-US");
  if (!loc) { console.log("FAIL no en-GB version localization"); process.exit(1); }
  const sets = must(await call("GET", "/v1/appStoreVersionLocalizations/" + loc.id + "/appScreenshotSets?include=appScreenshots"), "sets");
  let set = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === TYPE);
  const have = (sets.included || []).filter((i) => i.type === "appScreenshots" && set && (set.relationships.appScreenshots.data || []).some((d) => d.id === i.id))
    .map((i) => i.attributes.fileName + "|" + i.attributes.fileSize);
  console.log("set", set ? set.id : "(new)", "already there:", have.length);
  if (DRY) { console.log("dry run: would upload", files.filter((f) => have.indexOf(f + "|" + fs.statSync(path.join(DIR, f)).size) < 0)); return; }
  if (!set) set = must(await call("POST", "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: TYPE },
    relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } }), "create set").data;

  for (const f of files) {
    const buf = fs.readFileSync(path.join(DIR, f));
    if (have.indexOf(f + "|" + buf.length) >= 0) { console.log("skip", f); continue; }
    const shot = must(await call("POST", "/v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: f, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } } }), "reserve " + f).data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = {}; (op.requestHeaders || []).forEach((h) => { headers[h.name] = h.value; });
      const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) { console.log("FAIL upload part", f, r.status); process.exit(1); }
    }
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    must(await call("PATCH", "/v1/appScreenshots/" + shot.id, { data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } }), "commit " + f);
    console.log("ok", f);
  }
  const after = must(await call("GET", "/v1/appScreenshotSets/" + set.id + "/appScreenshots"), "readback");
  console.log("readback:", after.data.map((s) => s.attributes.fileName + " " + (s.attributes.assetDeliveryState || {}).state).join(", "));
})();
