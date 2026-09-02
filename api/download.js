export const config = { maxDuration: 30 };

// 확장자별 정확한 MIME 타입 — Drive/기본값이 application/octet-stream으로만 내려오면
// 브라우저나 백신 소프트웨어가 "알 수 없는 파일"로 취급해 다운로드를 막는 경우가 있어,
// 확장자를 알 수 있을 때는 항상 이 값을 우선 사용한다.
const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

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

    const ext = (name || '').split('.').pop().toLowerCase();
    const contentType = MIME_MAP[ext] || response.headers.get('content-type') || 'application/octet-stream';
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
