## Must fix

- **Make redemption atomic and retry-safe.** Checking eligibility and incrementing `uses` must happen in one conditional database operation. Otherwise concurrent requests can exceed `max_uses`. A lost response must not consume the last redemption without a recovery path.
- **Treat Origin checks as browser controls.** Non-browser callers can spoof Origin. Use trustworthy platform IP extraction, atomic counters, per-entitlement limits and a global abuse ceiling. Restrict redemption, counter and secret-reading RPCs to the backend; table RLS does not secure callable privileged functions. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), [Supabase RPC permissions](https://supabase.com/docs/guides/database/functions).
- **Define the access contract.** The year-long token is transferable; a random `sub` does not bind it to a device. `max_uses` limits redemptions, not listeners. Either explicitly accept sharing for this pilot or persist individually revocable grants. Define whether `expires_at` limits redemption or continued listening.
- **Correct revocation expectations.** Signed URLs can be shared and downloaded. Revoking a code stops new URLs, but existing URLs remain usable; Smart CDN caching can outlast token expiry. Audit existing `storage.objects` policies for accidental access to this bucket. [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [CDN behaviour](https://supabase.com/docs/guides/storage/cdn/smart-cdn).
- **Remove “no personal data is sent or stored.”** IP hashes, identifiers and infrastructure logs require assessment; hashing alone does not establish anonymity. Describe actual processing, purposes, retention and providers, and redact codes/tokens from logs. [PDPC guidance](https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/AG-on-Selected-Topics/Advisory-Guidelines-on-PDPA-for-Selected-Topics-9-Oct-2019.pdf?la=en).
- **Clarify rights and pilot terms.** Confirm permission covers re-encoding and gated distribution, and paid distribution before charging. Show “access-code pilot, no purchase available,” access duration and recovery conditions. Avoid implying exclusive recordings when originals remain public. Absence of payment does not automatically exclude CPFTA. [CPFTA](https://sso.agc.gov.sg/Act/CPFTA2003?WholeDoc=1).

## Should fix

- **Specify cryptographic details.** Generate codes with a cryptographic RNG and defined entropy, preferably 128 bits. Use an exact code/grant identifier instead of a hash prefix. Verify HMAC using `crypto.subtle.verify`, validate all claims and define key rotation. SHA-256 hashing is appropriate for sufficiently random codes. [Deno HMAC](https://docs.deno.com/examples/hmac_generate_verify/).
- **Distinguish Vault from Edge secrets.** Vault values require database retrieval through tightly restricted access; they are not automatically available through `Deno.env.get`. Edge Function secrets are simpler for this signing key. [Supabase guidance](https://supabase.com/docs/guides/troubleshooting/working-around-the-edge-function-secrets-limit).
- **Verify actual iOS playback.** Test signed URLs for `206`/`Content-Range`, seeking, background return and expiry/resume. Bound refresh attempts, restore position after metadata loads and offer tap-to-resume when playback is blocked. An `error` event alone cannot identify expiry. [Apple media guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/CreatingVideoforSafarioniPhone/CreatingVideoforSafarioniPhone.html).
- **Address browser-storage loss and theft.** `localStorage` is accessible to same-origin JavaScript and can be cleared. Provide recovery and “remove access”; avoid claiming device binding. [OWASP storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## Fine as is

- The seven-free/twelve-premium split is a reasonable starting point: newest episodes, phase picks and the introduction preserve a useful free experience.
- Private storage, server-owned episode mapping and keeping premium audio outside the public repository are sound choices.
- “Plus” before pricing is not inherently misleading. Keep it clearly a preview, with optional, dismissible prompts and no implied purchase or clinical advantage.

*Design review only; live configuration and device behaviour remain unverified.*

