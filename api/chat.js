import { authorize, begin, fail, fetchJson, jsonBody, limitInstance, providerKey } from './_lib/security.mjs';
import { chatInput, MODEL, PROVIDER_URL, providerReply } from './_lib/inputs.mjs';

export default async function handler(req, res) {
  try {
    if (!begin(req, res, ['POST'])) return;
    const input = chatInput(jsonBody(req));
    const principal = await authorize(req, input.purpose === 'label-ocr' ? 'ovuluna:label-ocr' : 'ovuluna:chat');
    const key = providerKey();
    limitInstance(principal.subject, input.purpose);
    const data = await fetchJson(PROVIDER_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: input.system }, ...input.messages], max_tokens: input.purpose === 'label-ocr' ? 2000 : 800, temperature: input.purpose === 'label-ocr' ? 0.1 : 0.5 })
    });
    return res.status(200).json({ reply: providerReply(data), model: MODEL, demo: false });
  } catch (error) { return fail(res, error); }
}
