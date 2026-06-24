(function() {
  const data = [
    { id:'imp2604_강서발산점',  branch:'강서발산점',      manager:'', month:'2026-04', salesDomestic:563338348,   salesOverseas:0,          salesTotal:563338348,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:00:00.000Z', fileCount:0 },
    { id:'imp2604_건대입구점',  branch:'건대입구점',      manager:'', month:'2026-04', salesDomestic:262045162,   salesOverseas:174745570,  salesTotal:436790732,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:01:00.000Z', fileCount:0 },
    { id:'imp2604_광주상무점',  branch:'광주상무점',      manager:'', month:'2026-04', salesDomestic:540115580,   salesOverseas:0,          salesTotal:540115580,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:02:00.000Z', fileCount:0 },
    { id:'imp2604_강남점',      branch:'강남점',          manager:'', month:'2026-04', salesDomestic:0,           salesOverseas:2394602812, salesTotal:2394602812,  special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:03:00.000Z', fileCount:0 },
    { id:'imp2604_안양범계점',  branch:'안양범계점',      manager:'', month:'2026-04', salesDomestic:765828510,   salesOverseas:0,          salesTotal:765828510,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:04:00.000Z', fileCount:0 },
    { id:'imp2604_여의도점',    branch:'여의도점',        manager:'', month:'2026-04', salesDomestic:901760533,   salesOverseas:0,          salesTotal:901760533,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:05:00.000Z', fileCount:0 },
    { id:'imp2604_영등포점',    branch:'영등포점',        manager:'', month:'2026-04', salesDomestic:100075450,   salesOverseas:0,          salesTotal:100075450,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:06:00.000Z', fileCount:0 },
    { id:'imp2604_대전둔산점',  branch:'대전둔산점',      manager:'', month:'2026-04', salesDomestic:293468735,   salesOverseas:0,          salesTotal:293468735,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:07:00.000Z', fileCount:0 },
    { id:'imp2604_명동점',      branch:'명동점',          manager:'', month:'2026-04', salesDomestic:1540350,     salesOverseas:1058624810, salesTotal:1060165160,  special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:08:00.000Z', fileCount:0 },
    { id:'imp2604_분당점',      branch:'분당점',          manager:'', month:'2026-04', salesDomestic:297141488,   salesOverseas:0,          salesTotal:296495488,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:09:00.000Z', fileCount:0 },
    { id:'imp2604_인천구월점',  branch:'인천구월점',      manager:'', month:'2026-04', salesDomestic:218784274,   salesOverseas:0,          salesTotal:218784274,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:10:00.000Z', fileCount:0 },
    { id:'imp2604_전주점',      branch:'전주점',          manager:'', month:'2026-04', salesDomestic:163667160,   salesOverseas:0,          salesTotal:163667160,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:11:00.000Z', fileCount:0 },
    { id:'imp2604_부산서면점',  branch:'부산서면점',      manager:'', month:'2026-04', salesDomestic:148100420,   salesOverseas:152512797,  salesTotal:300613217,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:12:00.000Z', fileCount:0 },
    { id:'imp2604_명동2호점',   branch:'명동2호점',       manager:'', month:'2026-04', salesDomestic:82039985,    salesOverseas:850593356,  salesTotal:932633341,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:13:00.000Z', fileCount:0 },
    { id:'imp2604_수원점',      branch:'수원점',          manager:'', month:'2026-04', salesDomestic:116212897,   salesOverseas:0,          salesTotal:116212897,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:14:00.000Z', fileCount:0 },
    { id:'imp2604_세라미크강남점', branch:'세라미크 강남점', manager:'', month:'2026-04', salesDomestic:112046310, salesOverseas:165712910, salesTotal:277759220,   special:{}, memo:'구글시트 26.4월', submittedAt:'2026-04-30T12:15:00.000Z', fileCount:0 },
  ];

  const existing = JSON.parse(localStorage.getItem('sales_data') || '[]');
  const existingIds = new Set(existing.map(r => r.id));
  const toAdd = data.filter(r => !existingIds.has(r.id));

  if (toAdd.length === 0) {
    alert('이미 모두 임포트된 데이터입니다.');
    return;
  }

  localStorage.setItem('sales_data', JSON.stringify([...existing, ...toAdd]));
  alert('✅ 26.4월 수수료 데이터 임포트 완료! (' + toAdd.length + '건 추가)');
  location.reload();
})();
