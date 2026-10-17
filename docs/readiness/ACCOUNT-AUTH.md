# Ovuluna web account boundary

Reviewed 1 October 2026. Local implementation, offline regression evidence and the read-only external observations below. `deploy_needed`; no project, provider, SMTP, environment, account or deployment configuration was changed.

## What works locally

`account.html` preserves the current watercolor palette. Real account entry is a separate web route from local health recording. The page only shows a signed-in identity after `GET /api/auth-status` validates its access token with the configured authentication service. A code request, callback status, legacy `ovuluna_auth` value, nickname, appearance choice or Premium preview cannot authenticate it.

Apple/Google use Supabase GoTrue OAuth with a server-generated PKCE S256 verifier. Email uses a code request followed by code verification, bound to the requested email in an encrypted browser cookie. Tokens are only stored in AES-256-GCM authenticated encrypted, `__Host-` HttpOnly, Secure, SameSite=Lax cookies. Access and refresh tokens are split so each cookie stays below 4 KB. Browser JavaScript receives a minimal identity summary and CSRF nonce. No new SDK or runtime dependency was introduced.

The default configuration is unavailable. No unrelated backend is selected implicitly. Native account sign-in, cloud health storage, Premium activation and complete server-account deletion are not connected. This is not a production-readiness or App Store approval claim.

## Target decision before external setup

The parent agent's read-only discovery found the Vercel project `ovuluna`, ID `prj_R3YLM0dNm1vhJJ7kEJOscAubnJa8`, linked to `momominibot/ovuluna-web` main, framework `nextjs`, with no environment keys. This local candidate uses a static public bundle and Vercel functions. Reconcile the canonical source/framework/deployment target before any release.

Supabase project `ovaria-app`, ID `zodkohwaznqgrfrcfdkf`, was found INACTIVE. Ownership of its data and relationship to Ovuluna are unconfirmed. It is not a configured default and must not be resumed, connected or repurposed without verification and approval.

Recommended next target: an isolated Ovuluna backend in the already connected organization, after Jamie approves the concrete project and its data region. Reuse the inactive project only after confirming its purpose, ownership, existing accounts and deletion obligations. Neither alternative was executed. Existing saved platform credentials should be used by the authorized setup operator; do not request or paste secrets into chat.

## Apple membership inspection, 1 October 2026

Jamie completed Apple Developer sign-in personally, then authorized read-only troubleshooting of an existing organization conversion reported as pending for about two months. This is an existing paid membership; do not suggest another enrollment or payment.

Verified in the authenticated UI:

- Membership remains **Individual** with renewal on **23 April 2027**.
- The Developer Program License Agreement shown was accepted on 27 August 2026; the Developer Agreement shown was also accepted. A later restored App Store Connect sign-in verified Free Apps and Paid Apps agreements Active; no agreement was accepted in this audit.
- [Recent support cases](https://developer.apple.com/contact/recent-cases) shows no upcoming or completed support activity in the past 90 days. This is a limited portal observation, not proof that the reported conversion request was never submitted or received.
- [The conversion route](https://developer.apple.com/contact/request/migrate-individual-account) presents a new request form rather than an existing request's status. No form was filled or submitted. The original case was subsequently located in authorized Mail review, summarized below; its current review stage remains unverified.
- The App IDs inventory contains no Ovuluna entry. The Services IDs inventory displays its getting-started empty state. No identifier or key was created and no capability was enabled.

Apple explicitly supports web Sign in with Apple for Individual memberships. It requires a Services ID associated with a primary native App ID enabled for Sign in with Apple; organization conversion is not itself a prerequisite. [Apple web configuration guidance](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web), [primary App ID guidance](https://developer.apple.com/help/account/capabilities/about-sign-in-with-apple/).

Next: follow up on the existing case, ask Apple to acknowledge the earlier readiness confirmation and identify any outstanding action. The [official conversion guidance](https://developer.apple.com/help/account/membership/updating-your-account-information/) requires the requester to be the founder/cofounder and provide the organization's D-U-N-S Number, with possible business documents. These are requirements to check against the actual correspondence, not an inferred explanation for this delay. No completion deadline or precise case cause has been verified. Do not submit a duplicate migration request.

Ovuluna Apple login still requires approved identifier/key/provider setup, the confirmed backend callback, release-boundary repairs and actual end-to-end verification described below. Owner sign-in to Apple Developer does not demonstrate Ovuluna user authentication. No support message was sent, agreement accepted, payment made or external configuration changed.

## Authorized mailbox follow-up, 1 October 2026

The Gmail connector represents the EMIS mailbox, not the requested Ranklore/iCloud correspondence. Focused connector searches returned no relevant messages; this was not treated as evidence that the case did not exist. The already running Mac Mail app provides both Ranklore and iCloud mailboxes. Its focused All Mailboxes searches found the original Apple case and actual sent replies. Private case identifiers, personal identifiers, quoted message bodies and attachments are not copied into these committed notes.

Verified correspondence timeline:

- Apple's 13 August response quotes the original 10 August organization-conversion request.
- A **sent** 2 September reply confirms readiness, company information and acknowledgement of migration effects. It is not merely a draft.
- A **sent** 11 September message follows up on that confirmation. A separate draft/forward with similar wording is not counted as another submission.
- Apple's 12 September message requests readiness confirmation again. Its reply-to is `devprograms@apple.com`; the earlier sent replies went to `asia.dev@apple.com`. Both are Apple addresses. Their difference is a reason to reply directly to the latest message, not proof of misrouting or a verified explanation for the delay.
- Searches for the exact case reference and latest reply address found no later response in the configured mailboxes. Search/index completeness and Apple's internal case state are not established. The portal's empty recent-cases view does not negate the actual correspondence.

`hello@ranklore.ai` is configured in Mac Mail and visible received correspondence is addressed to it. The migration correspondence identifies Ranklore as the organization and associates its website with that entity. Recommend this mailbox as the business correspondence/contact address, while continuing the existing case from its current iCloud Apple Account. Apple's organization-enrollment guidance requires a work address associated with the organization's domain; it does not establish a need to change the existing Apple Account login for this case. [Official enrollment requirements](https://developer.apple.com/help/account/membership/program-enrollment).

Read-only public DNS checks found Spacemail MX/SPF records matching [the provider's documented records](https://www.spaceship.com/knowledgebase/spacemail-dns-records-third-party-domain/). No DMARC TXT was found through two public resolvers. DNS alone does not demonstrate authenticated SMTP or deliverability. Ovuluna automated signup mail still needs approved SMTP/provider configuration, email authentication and real delivery verification. No login email, DNS, SMTP, mailbox routing or connector configuration was changed. A case follow-up may be prepared locally, but sending it requires Jamie's explicit approval.

## Explicit server environment contract

The subsequent [membership conversion readiness audit](APPLE-MIGRATION-READINESS.md) verified Mac-side two-factor authentication, public company website consistency, D&B's historical processing confirmation and the two existing apps marked Ready for Distribution. Restored App Store Connect sign-in verified active agreements, an active personal-name bank account and displayed tax completion. Twenty-three private report files were preserved and gzip-validated outside Git. September 30 daily, September monthly, any needed older granular reports and the owner's intended payout destination remain unresolved; complete migration-start readiness is not certified. None of these checks activates Ovuluna authentication.

These variables are read only in server functions. None should have a `NEXT_PUBLIC_` prefix or be copied into generated web assets.

| Variable | Required value |
| --- | --- |
| `OVULUNA_ACCOUNT_APP_URL` | One approved HTTPS origin, for example `https://ovuluna.vercel.app`, without path/query/fragment. Request Host and POST Origin must match it. |
| `OVULUNA_ACCOUNT_BACKEND_CONFIRMED` | `true` only after confirming the actual Ovuluna backend target. |
| `OVULUNA_SUPABASE_URL` | Confirmed hosted HTTPS project URL. Only a 20-character project reference on `supabase.co` is supported. No default, custom host or arbitrary endpoint. |
| `OVULUNA_SUPABASE_ANON_KEY` | That project's publishable key or legacy anon key. A service-role/secret key is rejected and is not needed. |
| `OVULUNA_AUTH_COOKIE_KEY` | A secret containing exactly 32 random bytes encoded as standard base64. Generate securely outside chat. Rotation invalidates these browser sessions and pending flows; existing provider sessions must also be considered. |
| `OVULUNA_AUTH_GOOGLE_ENABLED` | `true` only after Google registration and provider verification. Otherwise disabled. |
| `OVULUNA_AUTH_APPLE_ENABLED` | `true` only after Apple registration and provider verification. Otherwise disabled. |
| `OVULUNA_AUTH_EMAIL_ENABLED` | `true` only after email code setup and verification. Otherwise disabled. |
| `OVULUNA_AUTH_EMAIL_SMTP_CONFIRMED` | `true` after custom SMTP and code templates are confirmed. Email remains disabled without both email flags. |

The app origin is explicit, not derived from forwarded headers or preview environment URLs. Separate approved HTTPS test environments need their own configuration and provider allowlists. A plain HTTP local preview intentionally cannot issue production cookies or perform provider sign-in.

## Endpoint contract

All responses are private/no-store, nosniff and no-referrer. All POST operations require JSON, exact Origin, same-origin fetch metadata when supplied, and a matching server-issued CSRF nonce. Body size is bounded. Callback redirects are fixed to the approved `account.html` route and never use `next`, `returnTo` or provider error text.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/auth-status` | `{available,providers,authenticated,user,csrfToken,sessionState,refreshAvailable,records:'device-only',accountDeletion}`. Unconfigured: HTTP 200 with `available:false`, no enabled providers, no user, `csrfToken:null`. Configured CSRF is stable across status checks until expiry, and rotates on a new login. |
| `POST /api/auth-start` | `{provider:'google'|'apple',csrfToken}` → fixed GoTrue `authorizationUrl`. Stores only the server PKCE verifier and app state in a ten-minute encrypted flow cookie. |
| `GET /api/auth-callback?state=...&code=...` | Requires the independent app state to match the same-browser flow cookie, exchanges code/verifier, calls `/user`, then issues session cookies. Provider cancellation/failure redirects use a small fixed status enum. |
| `POST /api/auth-email` | Request: `{action:'request',email,createUser:boolean,csrfToken}`. Returns a generic inbox acknowledgement, never a session. Verify: `{action:'verify',code,csrfToken}`; the email comes only from the pending cookie. Six-digit code, ten-minute browser deadline, verified matching server email required. |
| `POST /api/auth-refresh` | `{csrfToken}`. Explicitly rotates via GoTrue then checks the returned user/subject before replacing cookies. Does not claim success as a verified account summary; the client rechecks status. |
| `POST /api/auth-signout` | `{csrfToken}`. Attempts GoTrue `logout?scope=local`. Always removes this browser's account cookies after valid request protection, including corrupt/expired/revoked session recovery. `{signedOut:true,remoteRevoked:boolean,message}` distinguishes local removal from verified refresh-session revocation. Local health records remain untouched. |
| `POST /api/auth-delete` | With valid CSRF, HTTP 501: complete server deletion is unavailable. No false success, no administrative deletion key, no table/storage/provider writes. |

## Provider setup checklist, grounded in current primary sources

1. Confirm the backend and exact approved origin. Configure Supabase Auth Site URL to that origin. Register the fixed callback path, allowing only its `state` query value where necessary. A precise glob can use `https://ovuluna.vercel.app/api/auth-callback\?state=*`, with `\?` as a literal question mark; test this against the deployed service. Do not authorize broad preview wildcards for this BFF. Current GoTrue source accepts redirects matching the Site URL origin and preserves existing callback query parameters when adding its code. Our app state is independent of Supabase's provider state. [Redirect guide](https://supabase.com/docs/guides/auth/redirect-urls), [redirect validation source](https://github.com/supabase/auth/blob/master/internal/utilities/request.go), [external OAuth source](https://github.com/supabase/auth/blob/master/internal/api/external.go), [PKCE redirect source](https://github.com/supabase/auth/blob/master/internal/api/verify.go).

2. Google: use a Web application OAuth client. Register the approved web origin and the confirmed Supabase `https://<project-ref>.supabase.co/auth/v1/callback` redirect URI. Put the client ID/secret in Supabase's Google provider configuration, not Ovuluna's browser bundle. Verify consent audience, scopes and production registration before enabling the Google flag. [Official Google provider instructions](https://supabase.com/docs/guides/auth/social-login/auth-google), [current documentation source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-google.mdx).

3. Apple web OAuth: configure a Sign in with Apple App ID, linked Services ID, Team ID and signing key. Register the Supabase project domain and its `/auth/v1/callback` URL. Configure the Services ID first in Supabase's client IDs for the web flow, and put its generated client secret in that provider's settings. Register relay email sources. Rotate the web OAuth client secret within six months and protect the `.p8` signing key. This flow does not supply a full name; Ovuluna must not invent one. Native Apple sign-in requires separate implementation. [Official Apple provider instructions](https://supabase.com/docs/guides/auth/social-login/auth-apple), [current documentation source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/social-login/auth-apple.mdx).

4. Email: configure custom SMTP host/port/user/password/from identity and domain authentication. Configure the relevant signup and magic-link templates to show `{{ .Token }}` for six-digit code entry. Keep email verification enabled. The request's `create_user` explicitly controls account creation. Test existing and new accounts, delivery, expiration and wrong-code handling before enabling both email flags. Default SMTP is restricted and not suitable for public users; new free projects since 3 June 2026 cannot customize templates using default SMTP. [Passwordless email guide](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp), [template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

5. Exercise GoTrue REST through an approved HTTPS test deployment. The implementation uses `/authorize`, `/token?grant_type=pkce`, `/otp`, `/verify`, `/user`, `/token?grant_type=refresh_token` and `/logout?scope=local`. The documented code exchange is single-use. Our browser-bound verifier never reaches application JavaScript. [GoTrue API specification](https://github.com/supabase/auth/blob/master/openapi.yaml), [PKCE guide](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [verification implementation](https://github.com/supabase/auth/blob/master/internal/api/verify.go).

## Security and release limits

Refresh never runs silently from GET status. Client refresh and logout share the `ovuluna-account-mutation` Web Lock. Without Web Locks, refresh is disabled; explicit browser-session removal stays available for recovery. BroadcastChannel only notifies other tabs to recheck identity and is never treated as a lock. Server refresh calls coalesce within one process, and a stable encrypted session ID plus process tombstone prevents a held refresh from reissuing cookies after logout on that same process.

**Multiple serverless instances are not coordinated by these memory maps.** Separate Vercel endpoints may run in separate function processes, so a shared process tombstone cannot be assumed in deployment. A real distributed session coordination/revocation check and adversarial cross-instance refresh/logout tests remain a release gate. Memory limits fail refresh closed. Crashed tabs, provider refresh reuse behavior and long request scheduling must be tested with the configured provider before release.

**GoTrue `/user` validates identity but does not prove instantaneous session liveness after logout.** Already-issued access JWTs can remain usable until expiry; strict enforcement requires checking the server session record. This implementation does not do a privileged `auth.sessions` lookup. Do not use its status alone to authorize future health-record, chat, paid-feature or shared-community access. [Supabase session semantics](https://supabase.com/docs/guides/auth/sessions).

Per-instance request/verify throttles supplement provider controls but are not shared infrastructure. An attacker can reset browser state or reach another instance. Shared abuse prevention, bot protection/CAPTCHA integration, monitoring and verified email delivery are required before public signup. The current forms do not integrate a CAPTCHA token. Do not enable a provider setup that requires CAPTCHA and then claim these forms are complete.

Complete account deletion remains a public release gate: recent-auth verification, Apple provider revocation, session invalidation, all account-owned tables/files and retention disclosures must be designed and tested together. Local record deletion is separate and cannot delete a server account. No health-record ownership migration is performed at sign-in; health notes can still be seen by other people sharing that browser.

The existing global site's inline-script/CSP and sensitive local-storage risks remain separate security work. HttpOnly account cookies do not make local health records encrypted or safe on shared devices.

## Regression receipt and exact coverage

Run without any live provider or credentials:

```sh
OVULUNA_JSDOM_PATH=/Users/michiyomimi/Desktop/ovuluna/node_modules/jsdom node scripts/check-account-auth.cjs --output /private/tmp/ovuluna-account-auth-regressions.json
```

30 groups pass. The suite executes the actual BFF library and account HTML using synthetic REST responses. It covers absent/malformed configuration, independent provider flags, Origin/Host/fetch metadata, CSRF Unicode, query/cookie ambiguity, PKCE challenge/state binding, fixed redirects, cancellation/expiry/provider errors, server user identity, OTP request versus verification and email binding, token bounds/tampering, explicit refresh/subject checks, held refresh versus logout, honest local-session recovery, fail-closed deletion, bounded upstream failures, client 404 HTML/network/shape handling, native no-fetch, focus recheck, shared Web Lock ordering, disabled refresh without Web Locks, and token-free cross-tab notifications. No live OAuth, real email/account, provider revocation, native sign-in or deployment was exercised. Passing these tests does not remove the release gates above.
