// 엑셀(Power Query) 연동용 CSV — 관리자 페이지와 동일한 수수료 계산식(admin.html의 FEE-CALC 구간)을 그대로 사용
// 사용: GET /api/export?key=<키>[&from=2026-06]   (from 미지정 시 2026-06부터)
import vm from 'node:vm';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOhb36HetbIyVegBr-urlnHqcDqJuUWMNlE9hOU0ArhU2qm0fazoHu3Q2Tv1XkTtBb/exec';
const EXPORT_KEY = process.env.EXPORT_KEY || 'tdl-xl-7f3a91c2e8b54d06a1c9';

// 관리자 페이지 지점명 → 엑셀 지점명
const EXCEL_NAME = { '명동시그니처데이뷰의원': '명동2호점' };
// 엑셀 ①② 시트의 지점 순서
const ORDER = ['의정부점','강서발산점','마포홍대점','건대입구점','광주상무점','강남점','안양범계점','여의도점','영등포점','대전둔산점','명동점','분당점','인천구월점','전주점','부산서면점','명동2호점','수원점','세라미크 강남점','세라미크 신사점','세라미크 명동점'];

function between(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error('admin.html 수수료 계산 구간(FEE-CALC 표시)을 찾지 못했습니다');
  return src.slice(a, b);
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    if (q.key !== EXPORT_KEY) return res.status(403).send('forbidden');
    const from = /^\d{4}-\d{2}$/.test(q.from || '') ? q.from : '2026-06';

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const [htmlRes, dataRes] = await Promise.all([
      fetch(`https://${host}/admin.html`),
      fetch(SCRIPT_URL + '?action=all'),
    ]);
    const html = await htmlRes.text();
    const data = await dataRes.json();
    if (!Array.isArray(data.sales_data)) throw new Error('서버 데이터를 불러오지 못했습니다');

    const ctx = { RATE_HISTORY: data.rate_history || [], numFmt: n => Number(n || 0).toLocaleString('ko-KR') };
    vm.createContext(ctx);
    vm.runInContext(
      between(html, '// [FEE-CALC-A-START]', '// [FEE-CALC-A-END]') + '\n' +
      between(html, '// [FEE-CALC-B-START]', '// [FEE-CALC-B-END]'),
      ctx
    );

    // 지점+월 중복 제출 시 최신 1건만
    const latest = new Map();
    for (const r of data.sales_data) {
      if (!r.branch || !r.month || r.month < from) continue;
      const k = r.branch + '|' + r.month;
      const p = latest.get(k);
      if (!p || new Date(r.submittedAt || 0) >= new Date(p.submittedAt || 0)) latest.set(k, r);
    }

    const rows = [...latest.values()].map(r => {
      const f = vm.runInContext('calcFees', ctx)(r);
      return {
        branch: EXCEL_NAME[r.branch] || r.branch,
        month: r.month,
        tot: Math.round(r.salesTotal || 0),
        dom: Math.round(r.salesDomestic || 0),
        ov: Math.round(r.salesOverseas || 0),
        ex: Math.round(f.feeExemptTotal || 0),
        mgmt: Math.round(f.mgmt || 0),
      };
    });
    const ord = b => { const i = ORDER.indexOf(b); return i < 0 ? 999 : i; };
    rows.sort((a, b) => a.month.localeCompare(b.month) || ord(a.branch) - ord(b.branch) || a.branch.localeCompare(b.branch));

    const csv = ['지점,년월,정산 총매출,정산 국내매출,정산 해외매출,수수료 제외 매출,"경영수수료(청구, VAT포함)"']
      .concat(rows.map(r => [r.branch, r.month + '-01', r.tot, r.dom, r.ov, r.ex, r.mgmt].join(',')))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send('﻿' + csv);
  } catch (e) {
    return res.status(500).send('error: ' + e.message);
  }
}
