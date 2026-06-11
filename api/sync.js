const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuFSzyLv9qNKtpYNtCtBiaUacfanaHdQxVKXq6rIxuDUERCraxckG9Ok9eWcXNkHkF/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(SCRIPT_URL + '?action=all');
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body
      });
      return res.status(200).json({ result: 'ok' });
    }
  } catch (e) {
    return res.status(500).json({ result: 'error', message: e.message });
  }
}
