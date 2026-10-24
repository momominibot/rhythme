/* App Store Connect API helper. Reads the team API key from ~/.appstoreconnect/private_keys (never prints it).
   Usage: node tools/asc.cjs GET /v1/apps   |   node tools/asc.cjs POST /v1/bundleIds '{"data":...}' */
const fs = require("fs"), crypto = require("crypto"), os = require("os");
const KEY_ID = process.env.ASC_KEY_ID || "7UJKV6T5FJ", ISSUER = process.env.ASC_ISSUER_ID || "483fb268-57b2-4cc5-8de9-ce9af22c95f6";
function token() {
  const key = fs.readFileSync(os.homedir() + "/.appstoreconnect/private_keys/AuthKey_" + KEY_ID + ".p8", "utf8");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"), now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" }), c = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  return h + "." + c + "." + crypto.sign("sha256", Buffer.from(h + "." + c), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
}
async function call(method, path, body) {
  const r = await fetch("https://api.appstoreconnect.apple.com" + path, { method, headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, json, text: json ? null : text.slice(0, 500) };
}
module.exports = { call };
if (require.main === module) {
  const [method, path, body] = process.argv.slice(2);
  call(method, path, body ? JSON.parse(body) : undefined).then((r) => console.log(JSON.stringify(r, null, 1)));
}
