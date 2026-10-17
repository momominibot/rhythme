import { begin, boundedText, fail, jsonBody, keys } from './_lib/security.mjs';

// There is no authorized issuer, purchase ledger or entitlement verifier here.
// Reject all credentials; string shape or expiry must never grant Premium.
export default async function handler(req, res) {
  try {
    if (!begin(req, res, ['GET', 'POST'])) return;
    const input = req.method === 'POST' ? jsonBody(req, 8192) : (req.query || {});
    keys(input, ['token']); boundedText(input.token, 4096);
    return res.status(503).json({ error: 'entitlement_unavailable', message: 'Card and subscription verification is not connected. No access has been granted.', available: false, valid: false, isPremium: false, entitlement: 'unverified' });
  } catch (error) { return fail(res, error); }
}
