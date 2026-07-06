(function() {
  const SPECIALS = {
    '2025-09': 60648390,
    '2025-10': 59801742,
    '2025-11': 97815415,
    '2025-12': 95605587,
    '2026-01': 91341657,
    '2026-02': 25228269,
    '2026-03': 58202595,
    '2026-04': 71403057,
    '2026-05': 62413956,
  };

  const data = JSON.parse(localStorage.getItem('sales_data') || '[]');
  let updated = 0;

  data.forEach(row => {
    if (row.branch !== '강남점') return;
    const amt = SPECIALS[row.month];
    if (amt == null) return;
    row.special = { '특약사항': { amount: amt, memo: '' } };
    updated++;
  });

  if (updated === 0) {
    alert('업데이트할 강남점 데이터가 없습니다. 데이터가 먼저 임포트되어 있어야 합니다.');
    return;
  }

  localStorage.setItem('sales_data', JSON.stringify(data));
  alert('✅ 강남점 특약사항 패치 완료! (' + updated + '개월 업데이트)');
  location.reload();
})();
