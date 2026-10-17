import { begin, fail, keys, reject } from './_lib/security.mjs';

// NFC is public navigation only. A supplied card name conveys no entitlement.
export default async function handler(req, res) {
  try {
    if (!begin(req, res, ['GET'])) return;
    const input = req.query || {}; keys(input, ['card', 'action', 'format']);
    if (input.card !== undefined && (typeof input.card !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.card))) reject();
    const action = input.action === undefined ? 'tap' : input.action;
    if (!['tap', 'checkin', 'foodscan', 'verify'].includes(action) || (input.format !== undefined && input.format !== 'json')) reject();
    if (action === 'verify') return res.status(503).json({ error: 'entitlement_unavailable', message: 'Card and subscription verification is not connected. No access has been granted.', available: false, valid: false, isPremium: false, entitlement: 'unverified' });
    const target = { tap: '/home.html?source=nfc', checkin: '/wellness-checkin.html?source=nfc', foodscan: '/label-scan.html?source=nfc' }[action];
    if (input.format === 'json') return res.status(200).json({ redirect: target, message: 'Open this public page. No card or subscription has been verified.', isPremium: false, entitlement: 'unverified' });
    res.setHeader('Location', target); return res.status(302).end();
  } catch (error) { return fail(res, error); }
}
