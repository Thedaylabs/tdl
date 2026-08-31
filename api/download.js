export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { fileId, name } = req.query;
  if (!fileId) return res.status(400).json({ error: 'fileId required' });

  try {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) return res.status(502).json({ error: 'Drive fetch failed', status: response.status });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    if (name) res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
