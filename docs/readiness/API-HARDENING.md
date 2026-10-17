# Local API boundary hardening

11 September 2026 · Baseline `3c6fefb` · No production calls, deployment or identity provisioning.

## What changed

The four owned endpoints now reject the concrete unsafe paths reproduced in the earlier audit. A future-dated NFC string cannot grant Premium. The chat proxy no longer forwards an arbitrary client system instruction/model, accepts arbitrary image URLs or leaks raw provider errors. Missing identity/provider configuration returns an explicit unavailable error instead of invented/demo results.

Files: `api/chat.js`, `api/food-vision.js`, `api/nfc.js`, `api/nfc-verify.js`; shared server-only modules under `api/_lib/`; regression runner `scripts/check-api.cjs`. No frontend, native, package or existing record-store code is changed by this API task. `api/food-lookup.js` is outside this task and remains separately reviewable.

**Authentication is not complete.** No account system, trusted verifier or authorized NFC issuer exists in this checkout. The AI endpoints fail closed until a separately deployed and reviewed authorization server is deliberately configured. Creating environment variables alone does not establish trustworthy identity, paid entitlement, revocation or account deletion. NFC verification has no enabling environment switch and always withholds entitlement.

## Verification boundary

AI endpoints accept a bounded bearer token only in the Authorization header. Its syntax is not evidence of validity. They call a fixed server-configured HTTPS introspection endpoint using server-held client credentials, refuse redirects and accept access only after checking the trusted response's active state, subject, expiry, issuer, audience and exact endpoint scope. No request field chooses the verifier URL; no local JWT decoding or client-side premium flag authorizes a call.

The boundary uses OAuth token introspection. RFC 7662 defines querying a protected authorization-server endpoint for token state and metadata; Ovuluna's profile deliberately requires `sub`, `exp`, `iss`, `aud` and `scope` even though several are optional in the base RFC. Token state is not cached here. [RFC 7662](https://www.rfc-editor.org/rfc/rfc7662)

The Authorization-header transport follows bearer-token usage. Credentials are never placed in an AI API query string or logged; 401 responses include a Bearer challenge. [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)

Server configuration contract (names only; no values were inspected or set):

| Variable | Required behavior |
|---|---|
| `OVULUNA_AUTH_INTROSPECTION_URL` | Fixed HTTPS endpoint with no embedded credentials, query or fragment; redirects rejected. |
| `OVULUNA_AUTH_CLIENT_ID` / `OVULUNA_AUTH_CLIENT_SECRET` | Credentials for this resource server's authorized introspection request, not a mobile-app secret. |
| `OVULUNA_AUTH_ISSUER` | Exact expected `iss`. |
| `OVULUNA_AUTH_AUDIENCE` | Exact expected audience, present as a string or in the response's string array. |
| `VOLCENGINE_API_KEY` | Server-only provider credential; not sufficient to enable access without verified identity. |
| `OVULUNA_ALLOWED_ORIGINS` | Optional comma-separated exact origins. Default is the existing deployed web origin, `https://ovuluna.vercel.app`. A native origin such as `capacitor://localhost` requires explicit configuration; wildcard/null origins are rejected. CORS is not authentication. |

Required introspection response:

- `active` must be boolean `true`; an invented opaque token must be rejected by the trusted service.
- `sub` must be a nonblank string of at most 256 characters.
- `exp` must be an integer Unix timestamp later than the current time. Optional `nbf`/`iat` must be integer timestamps and cannot be more than 30 seconds ahead.
- `iss` and `aud` must match configuration; audience arrays contain at most ten strings.
- `scope` must include exactly `ovuluna:chat`, `ovuluna:label-ocr` or `ovuluna:food-vision` as required by the operation. A similarly named scope does not match.

Implement and independently test the actual issuer/verifier, session lifecycle, account deletion, access revocation, per-user data authorization and distributed quotas before enabling this boundary. It is not a new working identity provider and the synthetic fixture verifier is never used in production.

## Input and upstream policy

| Surface | Enforced bounds/policy |
|---|---|
| HTTP | Method allowlists, exact-origin CORS, accepted preflight headers, JSON content type, 3 MiB application body cap; cache disabled and nosniff set. Vercel's own request cap may reject earlier. |
| Chat | 1–12 messages; user/assistant roles only; final message must be user; 2,000 characters per text and 12,000 total. Unknown object fields, unsupported roles and invalid shapes reject. |
| System/model | The fixed server model remains `doubao-seed-1-6`; provider availability is unverified. A client model must be absent or equal that existing model. Legacy `system` strings are capped at 8,000 characters and discarded. Only fixed server wellness/OCR prompts are sent. |
| Label OCR | Fixed `label-ocr` purpose, one user message and one image. Legacy image-message shape selects that same purpose; the client never supplies its executable instruction. It requires its own scope. |
| Images | One JPEG/PNG/WebP data image, at most 2 MiB decoded. Canonical base64 and MIME/signature checks; no HTTP(S), SVG, file or arbitrary remote image URLs. These are representation checks, not a complete image decoder or a quality/clinical assessment. |
| Food vision | Bounded image and optional enumerated legacy phase. The phase is not sent to the provider. Returned numeric/object/array fields are checked; cycle advice is replaced with a factual unverified-phase statement. Output remains an explicitly unvalidated image estimate. |
| Network | Verifier timeout 3 seconds / response cap 16 KiB; provider timeout 12 seconds / response cap 128 KiB; redirect refusal and bounded streaming reads. Replies must be nonempty strings no longer than 16,000 characters. |
| Errors/logs | Generic status/code/text only. No raw upstream body, prompt, photo, token, stack trace or model response is logged or echoed on failure. |
| Rate backstop | At most 20 admitted requests per verified subject and purpose in a 60-second window within one process; bounded map capacity. This is a secondary instance-level limit, **not** distributed abuse control, billing or a durable account quota. |

Input types/ranges, request limits and safe error responses follow the OWASP REST security recommendations; this does not constitute a security certification. [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

A server-owned prompt is a policy layer, not proof against prompt injection, medical misinformation or invented citations. The model outputs still need the clinical/evidence review and user-consent controls required by the wider release plan. OCR result interpretation and the separate food-lookup service remain outside this change.

## NFC behavior

`/api/nfc-verify` validates a bounded input shape, then returns 503 with `valid:false`, `isPremium:false` and `entitlement:"unverified"`. It does not accept an unsigned, expired, JWT-looking or future-dated string. No HMAC/JWT signing scheme was invented because no purchase ledger or authorized issuance workflow exists.

`/api/nfc?action=verify` returns the same unavailable state. Its public `tap`, `checkin` and `foodscan` actions may navigate to fixed Home, journal or label-scan pages. Card text is not inserted into the redirect, used as a response header or treated as an entitlement. Public navigation can succeed without proving membership or a purchase. Unrecognized actions, malformed structured queries and control characters reject.

A future NFC entitlement implementation must bind an actual authorized purchase/account grant to a server-verifiable credential or ledger entry, enforce audience/expiry/revocation and prevent reuse where required. Keep the present fail-closed state until that implementation and its negative tests exist.

## Client response contract

Failure bodies are `{error, message, available:false}`. Entitlement-unavailable bodies additionally include `valid:false`, `isPremium:false`, `entitlement:"unverified"`.

| HTTP/code | Meaning |
|---|---|
| 400 `invalid_request` | Invalid data, role, model, purpose, image or query shape. |
| 401 `authentication_required` | Missing/malformed bearer credential or inactive/out-of-time verified session. |
| 403 `access_denied` / `origin_not_allowed` | Wrong verified subject/issuer/audience/scope or disallowed browser origin. |
| 405 `method_not_allowed` | Unsupported method. |
| 413 `request_too_large` / 415 `unsupported_media_type` | Body/image limit or content-type failure. |
| 422 `image_not_identified` | Provider could not identify food; raw provider text is withheld. |
| 429 `rate_limited` | Instance backstop; Retry-After is included. |
| 502 `upstream_unavailable` / 504 `upstream_timeout` | Failed, malformed, oversized or timed-out provider response. |
| 503 `service_unavailable` | Missing/unavailable verifier or provider configuration. |
| 503 `entitlement_unavailable` | NFC subscription verification is not implemented; access withheld. |

A successful chat remains `{reply,model,demo:false}`. That proves only the scoped request completed; it must not switch the interface to “cloud synced”, “Premium verified” or “authentication complete”. The separate Luna frontend work uses an explicit offline guide while real sign-in remains absent and must not turn guide text into a substitute API success.

## Verification and remaining release work

Run `node scripts/check-api.cjs`; optionally pass `--output docs/readiness/api-regressions.json`. The runner starts a child process with inherited credentials removed and replaces every fetch with a stub. It covers 22 grouped success/negative cases: request/CORS bounds; absent and hostile auth; active/time/issuer/audience/scope checks; upstream errors/limits/timeout; server prompt/model ownership; data-image validation; OCR/food paths; false NFC entitlement regressions; fixed public routing; and per-instance rate limiting.

These tests do not contact Vercel, an identity provider, Volcengine, production users or paid services. They prove deterministic local behavior only. The actual authorization server, native bearer-session transport, consent, account/community isolation, revocation/deletion, durable quotas, purchase verification, model accuracy/citation control and deployed Vercel behavior remain open. No submission-readiness or clinical-validation claim is made.
