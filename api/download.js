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
    if (name) {
      // 한글 등 비-ASCII 파일명은 filename= 에 그대로/퍼센트인코딩으로 넣으면
      // 크롬에서 "다운로드 오류"로 실패하는 경우가 있어, RFC 6266 방식으로
      // ASCII 폴백(filename=)과 UTF-8 실제 이름(filename*=)을 함께 내려준다.
      const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    }
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
