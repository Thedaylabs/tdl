// ================================================================
// 월별 매출 보고서 - Google Apps Script 백엔드
//
// [설치 가이드]
// 1. 새 Google Sheets 생성 (전용 시트 권장)
// 2. 확장 프로그램 > Apps Script 열기
// 3. 이 코드 전체 붙여넣기 (기존 내용 삭제 후)
// 4. 저장 → 배포 > 새 배포
//    - 유형: 웹 앱
//    - 다음 사용자로 실행: 나
//    - 액세스 권한: 모든 사용자
// 5. 배포 URL 복사 → admin.html / monthly-sales-report.html 의
//    SCRIPT_URL 에 붙여넣기
// ================================================================

const SHEET_SALES = '매출데이터';
const SHEET_MGMT  = '경영확인';
const SHEET_PINS  = 'PIN정보';

const SALES_HDR = ['id','branch','manager','month','salesDomestic','salesOverseas','salesTotal','special','memo','submittedAt','fileCount'];
const MGMT_HDR  = ['id','paid','paidDate','paidAmt','invoice','invoiceDate'];
const PINS_HDR  = ['branch','pin'];

// ── GET: 전체 데이터 조회 ──────────────────────────────────────
function doGet(e) {
  try {
    return jsonOut({
      result:     'ok',
      sales_data: readSales(),
      mgmt_check: readMgmt(),
      pin_map:    readPins()
    });
  } catch(err) {
    return jsonOut({ result: 'error', message: err.message });
  }
}

// ── POST: 데이터 저장 ──────────────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if      (action === 'submit_sales')  upsertSales(body.data);
    else if (action === 'bulk_import')   (body.data||[]).forEach(r => upsertSales(r));
    else if (action === 'update_mgmt')   upsertMgmt(body.id, body.data);
    else if (action === 'save_pins')     savePinsToSheet(body.pins);
    else if (action === 'delete_sales')  deleteSalesById(body.id);

    return jsonOut({ result: 'ok' });
  } catch(err) {
    return jsonOut({ result: 'error', message: err.message });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 읽기 ──────────────────────────────────────────────────────
function readSales() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SALES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const cols = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    cols.forEach((c,i) => obj[c] = row[i]);
    ['salesDomestic','salesOverseas','salesTotal','fileCount'].forEach(f => {
      obj[f] = Number(obj[f]) || 0;
    });
    try { obj.special = typeof obj.special === 'string' ? JSON.parse(obj.special||'{}') : (obj.special||{}); }
    catch { obj.special = {}; }
    return obj;
  });
}

function readMgmt() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MGMT);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const data = sheet.getDataRange().getValues();
  const cols = data[0];
  const result = {};
  data.slice(1).forEach(row => {
    const o = {};
    cols.forEach((c,i) => o[c] = row[i]);
    const id = o.id; delete o.id;
    o.paid    = o.paid    === true || o.paid    === 'TRUE';
    o.invoice = o.invoice === true || o.invoice === 'TRUE';
    o.paidAmt = Number(o.paidAmt) || 0;
    result[id] = o;
  });
  return result;
}

function readPins() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PINS);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const data = sheet.getDataRange().getValues();
  const result = {};
  data.slice(1).forEach(row => { if (row[0]) result[String(row[0])] = String(row[1]||''); });
  return result;
}

// ── 매출 upsert ────────────────────────────────────────────────
function upsertSales(rec) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SALES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SALES);
    sheet.appendRow(SALES_HDR);
    sheet.getRange(1,1,1,SALES_HDR.length)
      .setBackground('#4f46e5').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const specialStr = typeof rec.special === 'object'
    ? JSON.stringify(rec.special) : (rec.special || '{}');

  const newRow = [
    rec.id||'', rec.branch||'', rec.manager||'', rec.month||'',
    rec.salesDomestic||0, rec.salesOverseas||0, rec.salesTotal||0,
    specialStr, rec.memo||'', rec.submittedAt||'', rec.fileCount||0
  ];

  if (sheet.getLastRow() < 2) { sheet.appendRow(newRow); return; }

  const ids   = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().flat();
  const rowNo = ids.indexOf(rec.id);
  if (rowNo >= 0) {
    sheet.getRange(rowNo+2,1,1,newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }
}

function deleteSalesById(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SALES);
  if (!sheet || sheet.getLastRow() < 2) return;
  const ids   = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().flat();
  const rowNo = ids.indexOf(id);
  if (rowNo >= 0) sheet.deleteRow(rowNo+2);
}

// ── 경영 확인 upsert ───────────────────────────────────────────
function upsertMgmt(id, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_MGMT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MGMT);
    sheet.appendRow(MGMT_HDR);
    sheet.getRange(1,1,1,MGMT_HDR.length)
      .setBackground('#059669').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const newRow = [
    id,
    data.paid    || false,
    data.paidDate|| '',
    data.paidAmt || 0,
    data.invoice || false,
    data.invoiceDate || ''
  ];

  if (sheet.getLastRow() < 2) { sheet.appendRow(newRow); return; }

  const ids   = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().flat();
  const rowNo = ids.indexOf(id);
  if (rowNo >= 0) {
    sheet.getRange(rowNo+2,1,1,newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }
}

// ── PIN 저장 ───────────────────────────────────────────────────
function savePinsToSheet(pins) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PINS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PINS);
    sheet.getRange(1,1,1,2).setValues([PINS_HDR])
      .setBackground('#7c3aed').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  if (sheet.getLastRow() > 1)
    sheet.getRange(2,1,sheet.getLastRow()-1,2).clearContent();

  const rows = Object.entries(pins).map(([b,p]) => [b,p]);
  if (rows.length > 0) sheet.getRange(2,1,rows.length,2).setValues(rows);
}
