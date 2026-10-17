import { accountRoute } from './_lib/account-auth.mjs';
export default async function handler(req, res) {
  return accountRoute('status', req, res);
}
