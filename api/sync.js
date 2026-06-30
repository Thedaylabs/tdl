const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgvA5ZB2ROdBTo4f_7N-GXTezd4UhH5kTWlIKInmlVrugTONgzApw5Ee4xL4orb0W_/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const qs = new URLSearchParams(req.query || {});
      const url = SCRIPT_URL + (qs.toString() ? '?' + qs.toString() : '?action=all');
      const response = await fetch(url);
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body
      });
      const data = await response.json().catch(() => ({ result: 'ok' }));
      return res.status(200).json(data);
    }
  } catch (e) {
    return res.status(500).json({ result: 'error', message: e.message });
  }
}
