# Consent rebuild and 18+ age gate: plan (19 October 2026, before building)

Scope from Jamie's build prompt (`../CLAUDE_GAME_PLAN_PROMPT.md`, sections 4.2, 4.3 and the cleanup list), and the division
of work in `2026-10-19-life-sim-inventory.md` section 3: this session owns the age gate, the granular consent, the removal of
the teen logic, the notice sentences and the server-side consent checks in the existing functions. Nothing here is built yet.
Building starts when Jamie confirms 18+ (asked by the scene session). Work goes on the feature branch `claude/consent-rebuild`,
pull request only, no push to main; migrations applied and verified before any front-end release, each with a rollback.

## 1. What exists today, and what each piece becomes

| Today | Where | Becomes |
|---|---|---|
| `profile.consent {v, at, luna, improve, age13}` | room.js `requireConsent`, store and appnav gates | `profile.consentState` derived from the event log; `age13` gone |
| `profile.cloud {v, at, uid}` | ovu-auth.js, ovu-sync.js `consentOk` | purpose `cloud_sync` |
| `ovumind_ai_v1 {on, insights, photos}` | ovu-orb.js | purposes `ai_reading`, `ai_summaries`, `food_photo_ai` (one to one) |
| `profile.analysis {on, uid, syncedAt, rev, scope}` and `public.analysis_consent` | notice-v3 branch, migration 20261019030000/40000 | purpose `improve_logging`; the account record stays `analysis_consent_set` |
| Age question with `under13`, `13-16`, `17`, `18-24` ... `50+` | room.js onboarding step `age` | 18+ attestation `ageAttest {confirmed, version: 1, at}`; an optional adult age range only if Jamie keeps one (section 6) |
| `isMinor()`, `openMinorNote`, `openTeenPregnancyCard`, `minorAck`, teen 21-day cut-off, `MINOR_PREGNANCY` safeguard, "I am 13 or older" | room.js, ovu-orb.js | removed |
| Notice gate literal `c.v >= 2` | ovu-store.js (done on the v3 branch) and **appnav.js lines 173 to 174 (missed on the v3 branch)** | one check: `ageAttest` present and the required purpose accepted at the current notice |
| terms.html "at least 16 years old" | terms.html line 97 | 18 |
| "hosted outside Singapore" | ovu-auth.js cloud notice, privacy.html, room.html | "hosted in Singapore" (project region ap-southeast-1, verified 19 Oct) |

Edge functions today: `luna` and `insight` run with `verify_jwt = false` (anonymous relay, rate-limited by IP), and no
function reads any consent. `luna` and `insight` call `ark.cn-beijing.volces.com` (prompt constraint 10; provider decision
with Jamie, listed by the scene session).

## 2. Target model

### 2.1 Purposes (all off except the first)

| Purpose | Required | What it allows | Server check |
|---|---|---|---|
| `health_tracking` | yes, to use the diary | local diary, rules on the phone | none (local) |
| `cloud_sync` | no | entries and profile to the account (Singapore) | `entries`/`profiles` writes through sync |
| `ai_reading` | no | a note Luna cannot read goes to the AI relay | `luna` text route |
| `food_photo_ai` | no | a food photo goes to the AI relay once | `luna` image route |
| `ai_summaries` | no | 7 or 28 day summaries for journal readings | `insight` |
| `improve_logging` | no | group counts across 20+ consenting adults (built on the v3 branch) | `analysis_consent` row |
| `personalisation` | no | not built yet: reserved for the utility service of Phase 2 | later |
| `research` | not offered at launch | hidden | none |

Dependencies: `food_photo_ai`, `ai_reading` and `ai_summaries` do not need `cloud_sync` (they are request and response through
the relay, nothing is stored). The prompt's example "food photo AI requires cloud_sync AND food_photo_ai" is not how the relay
works; keeping them independent keeps local-only mode useful. `improve_logging` needs an account (it is an account record) and
only ever reads cloud copies, so without `cloud_sync` it counts nothing.

### 2.2 Records

- **On the phone:** `profile.consentEvents[]`, append-only: `{id, purpose, action: 'grant'|'withdraw', at, notice, method:
  'sheet'|'you'|'jit'|'import', uid}`. Current state is the latest event per purpose. The first run after the release writes
  `import` events from today's flags so nobody loses a choice and receipts exist for history.
- **On the account:** `public.consent_events` (user_id, purpose, action, notice_version, notice_hash, method, at, device_id),
  insert-own and select-own under RLS, no update or delete; `consent_state(p_uid)` returns the latest per purpose;
  `consent_allows(p_uid, p_purpose)` for the functions (owned by postgres, called with the service role). The existing
  `analysis_consent` stays the record for `improve_logging` and writes a mirror event.
- **Receipt:** `{noticeVersion, noticeHash, at, userId or null, purposes: {purpose: state}, method}` shown in You under
  "Your choices", included in the diary export, and returned by the server for signed-in changes.
- **Epoch:** every withdrawal bumps `consentEpoch` for that purpose; sync sends the epoch with writes; the server rejects writes
  whose epoch is older than the latest withdrawal of `cloud_sync` (tombstone), and the client purges its upload queue for the
  withdrawn purpose before anything else.

### 2.3 Server-side checks

- `luna` and `insight`: when a JWT is present, `consent_allows` must be true for the route's purpose, otherwise 403 with a
  plain reason. When no JWT is present (local-only person), the request must carry `X-Rhythme-Consent: <purpose>;notice=<n>`
  and the function logs the purpose with the rate-limit bucket; without the header it refuses. This is the honest limit of
  server-side enforcement for people without accounts: the phone asserts, the server records and refuses silent calls. The
  alternative (AI help only for signed-in people) is Jamie's call (section 6).
- `account` deletion: always allowed, cascades `consent_events` and `analysis_consent`.
- `podcast` (Plus): not a consent purpose; unchanged.
- Sync (`entries`, `profiles` through PostgREST): a `before insert or update` trigger checks the latest `cloud_sync` event for
  the user and the write's epoch; a withdrawn purpose rejects the write.

### 2.4 Withdrawal

As easy as giving: the same switches in You, one tap, with a plain line of what stops. `cloud_sync` off asks "keep the copy
in your account, or delete it now" (today's behaviour keeps it); the choice is an event too. `ai_*` off stops new relay calls
at once and clears any queued photo or note. `improve_logging` off is `analysis_consent_set(false)`. Withdrawing
`health_tracking` is "delete everything on this phone", which already exists.

### 2.5 The sheet and the just-in-time prompts

`ovu-consent.js` (state, events, receipts, `allows(purpose)`, `grant/withdraw`, the matrix, re-consent on notice change,
the JIT helper) and a refactored `#consent` overlay in room.html: a layered summary (what, why, where, who sees it) and the
switches, all off, with the 18+ confirmation as the one required tick. First use of a feature shows its own short card
("This photo goes once to the AI service in <region>, then is deleted") and records a `jit` grant. The improve switch built on
the v3 branch moves into this module unchanged in behaviour (binding, withdrawn rows, precondition).

## 3. Age gate

- `ageAttest {confirmed: true, version: 1, at}` in the profile; no date of birth, no bands for the gate.
- Boot: no `ageAttest` means the gate, for everyone, once. Profiles with `ageBand` in `under13`, `13-16`, `17` see the same
  gate and cannot enter until they confirm 18+; declining shows "Rhythme is designed for adults 18 and over. We are not able to
  create an account for you yet." and the room does not open (export of their own local diary stays available).
- Onboarding step `age` is replaced by the attestation (it is in the sheet, so the step is removed); if Jamie keeps an
  optional adult range it is a separate skippable step.
- Signed-in people: the attestation is also recorded as a `consent_events` row (`purpose: 'age_18'`, `action: 'grant'`).

## 4. Teen logic to remove (search by symbol, lines move)

room.js: onboarding `age` step options and note, `isMinor`, `openMinorNote`, `openTeenPregnancyCard`, `minorAck`, the
`isMinor(A)` branch in `predictionModeFor`, the `under13` condition in the "Periods not yet started" note (adult cut-off
only), `teen` and `shortCut = teen ? 21 : 24` in the recall rhythm, `age13` in the consent write, "I am 13 or older" in the
sheet. ovu-orb.js: `MINOR_PREGNANCY` safeguard. ovu-insight.js: `ageBand` in the payload handed to the AI (becomes the
optional range or nothing). tools/test-core.js and tools/e2e_smoke.py: the teen cases become adult cases. terms.html: 18.
evidence-lifecycle.js, lifecycle-content.js and daily-guidance.js carry a "teen" life stage as content: the `life-teen-*`
evidence and content keys and the `teen` stage ("Early menstrual years") with its `stage-teen` task. Under 18+ these become
unreachable; remove the stage and its keys rather than leave dead content, and check nothing links to them from Learn.

What depends on age today and must keep working for adults: the 35+ fertility note (ASRM), the 40-44 and over framing for
perimenopause in `lifeStage`, and the scene session's `adult_bands` policy in `staff.metrics_build` (every account is adult
after the gate; `p_age_band` becomes the optional range or `'adult'`). Agreed 19 Oct: `'adult'` is already in the policy on
the project and counts as eligible; the old ranges stay allowed until the gate ships.

Shared files while both branches are open: the scene session's `claude/life-sim` adds four script tags at the end of
room.html and a speed hook in ovu-walk.js; the consent rebuild changes room.html only inside the `#consent` overlay and the
script list for `ovu-consent.js`, so the two merge without overlap whichever lands first. Phase 2's aggregate agents read
`analysis_consent` server-side with no user JWT; any per-account insight later needs a signed-in JWT and `consent_allows`.

## 5. Order of work and acceptance

1. Migration `consent_events` + `consent_state` + `consent_allows` + sync trigger, applied and verified, rollback written.
2. `ovu-consent.js`, the sheet, You "Your choices", JIT cards, import of today's flags, receipts in the export.
3. Age gate and the teen removal, terms and privacy updates, region wording.
4. Function checks in `luna`, `insight`; epoch on sync writes; queue purge on withdrawal.
5. Harness: state from events, import mapping, every matrix row, epoch rejection, gate branches. Smoke: fresh person all
   off, returning v2 person, under-18 decline blocks, withdrawal stops sync (route counts), JIT card before the first photo.
6. Codex read-only review of the diff, then the pull request.

## 6. Decisions only Jamie can make

1. 18+ only (asked by the scene session; nothing starts before this).
2. Keep an optional adult age range (18 to 24 ... 50 and over, skippable, guidance only) or ask no age beyond the attestation.
3. AI help for people without an account: keep it with a phone-asserted consent header (section 2.3), or require sign-in.
4. AI provider and region for health text (asked by the scene session); the consent cards name the region.
5. `cloud_sync` withdrawal default: keep the copy (today) or delete it.
6. `improve_logging` stays its own honest toggle (recommended) or is folded under "research", which the prompt says is not
   offered at launch.
