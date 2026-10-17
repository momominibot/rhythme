import { authorize, begin, fail, fetchJson, jsonBody, limitInstance, providerKey } from './_lib/security.mjs';
import { foodInput, FOOD_SYSTEM, foodResult, MODEL, PROVIDER_URL, providerReply } from './_lib/inputs.mjs';

export default async function handler(req, res) {
  try {
    if (!begin(req, res, ['POST'])) return;
    const input = foodInput(jsonBody(req));
    const principal = await authorize(req, 'ovuluna:food-vision');
    const key = providerKey();
    limitInstance(principal.subject, 'food-vision');
    const data = await fetchJson(PROVIDER_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: FOOD_SYSTEM }, { role: 'user', content: [{ type: 'text', text: 'Describe this food photo with uncertain estimates only.' }, { type: 'image_url', image_url: { url: input.image } }] }], temperature: 0.1, max_tokens: 2000 })
    });
    return res.status(200).json(foodResult(providerReply(data)));
  } catch (error) { return fail(res, error); }
}
