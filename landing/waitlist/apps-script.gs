/**
 * רשימת ההמתנה של דריבית: מסד נתונים בגיליון Google Sheets.
 *
 * מה הסקריפט עושה:
 *  - doPost: דף הנחיתה שולח לכאן כל הרשמה. שורה חדשה בגיליון "רשימת המתנה".
 *    מי שכבר ברשימה (אותו טלפון או אימייל) לא נכנס פעמיים: מקבל בחזרה את הקוד והמקום שלו.
 *    מי שנרשם מקישור של חבר (ref) נספר לחבר בעמודת "הזמנות" (רק למדידה: זה לא משנה את המקום בתור).
 *  - doGet?count=1: כמה אנשים ברשימה (הדף מציג את זה רק מעל 50).
 *  - doGet?code=XXXXXX: המקום בתור של קוד אחד (בלי שום פרט אישי).
 *  - גיליון "סיכום": נוסחאות שמתעדכנות לבד (סך הכול, אנדרואיד/אייפון, לפי סטטוס ולפי מקור).
 *
 * התקנה: ראו README.md באותה תיקייה. אחרי כל שינוי בקוד: Deploy > Manage deployments > עריכה > New version.
 */

var SHEET_NAME = 'רשימת המתנה';
var SUMMARY_NAME = 'סיכום';
var HEADERS = ['תאריך', 'קוד', 'טלפון או אימייל', 'סוג', 'טלפון', 'סטטוס', 'מקור', 'הוזמן על ידי', 'הזמנות', 'אישור דיוור', 'תחנות בדף', 'גרסת דף'];
var COL = { at: 1, code: 2, contact: 3, type: 4, device: 5, status: 6, source: 7, ref: 8, refs: 9, consent: 10, stations: 11, v: 12 };

var DEVICE_HE = { android: 'אנדרואיד', iphone: 'אייפון' };
var STATUS_HE = { sadir: 'בשירות סדיר', pre: 'לפני שחרור', post: 'אחרי שחרור', none: 'לא בצבא' };

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var contact = cleanContact_(d.contact);
    if (!contact) return json_({ ok: false, error: 'contact' });
    if (d.consent !== true) return json_({ ok: false, error: 'consent' });

    var sh = sheet_();
    var rows = data_(sh);

    // already on the list: same contact, return the existing place
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.contact - 1]).replace(/^'/, '') === contact) {
        return json_(placeOf_(rows, i, { ok: true, existing: true }));
      }
    }

    var code = /^[A-Z0-9]{6,8}$/.test(String(d.code || '')) ? String(d.code) : newCode_();
    var taken = {};
    rows.forEach(function (r) { taken[r[COL.code - 1]] = true; });
    while (taken[code]) code = newCode_();

    // count the signup for the friend who sent the link (for measurement only, the place in line doesn't change)
    var ref = String(d.ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    var refRow = -1;
    if (ref && ref !== code) {
      for (var j = 0; j < rows.length; j++) if (rows[j][COL.code - 1] === ref) { refRow = j; break; }
    }
    if (refRow < 0) ref = '';

    var row = [];
    row[COL.at - 1] = new Date();
    row[COL.code - 1] = code;
    row[COL.contact - 1] = contact;
    row[COL.type - 1] = contact.indexOf('@') > 0 ? 'אימייל' : 'וואטסאפ';
    row[COL.device - 1] = DEVICE_HE[d.device] || '';
    row[COL.status - 1] = STATUS_HE[d.status] || '';
    row[COL.source - 1] = safe_(d.source, 40);
    row[COL.ref - 1] = ref;
    row[COL.refs - 1] = 0;
    row[COL.consent - 1] = 'כן';
    row[COL.stations - 1] = safe_(d.stations, 60);
    row[COL.v - 1] = safe_(d.v, 20);

    var r = sh.getLastRow() + 1;
    var range = sh.getRange(r, 1, 1, HEADERS.length);
    range.setNumberFormat('@'); // phone numbers keep their leading 0
    sh.getRange(r, COL.at).setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange(r, COL.refs).setNumberFormat('0');
    range.setValues([row]);

    if (refRow >= 0) {
      var cell = sh.getRange(refRow + 2, COL.refs);
      cell.setValue((Number(cell.getValue()) || 0) + 1);
    }

    SpreadsheetApp.flush();
    rows = data_(sh);
    return json_(placeOf_(rows, rows.length - 1, { ok: true }));
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var sh = sheet_();
  var rows = data_(sh);
  if (p.code) {
    var code = String(p.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (var i = 0; i < rows.length; i++) if (rows[i][COL.code - 1] === code) return json_(placeOf_(rows, i, { ok: true }));
    return json_({ ok: false, error: 'not-found' });
  }
  return json_({ ok: true, total: rows.length });
}

// place in line: the order of signing. Inviting friends doesn't move anyone up (Jonathan, 26.10).
function placeOf_(rows, i, out) {
  out.code = rows[i][COL.code - 1];
  out.position = i + 1;
  out.total = rows.length;
  return out;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#0E6E58').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.setColumnWidth(COL.contact, 170);
    sh.getRange(2, 1, sh.getMaxRows() - 1, HEADERS.length).setNumberFormat('@');
  }
  if (!ss.getSheetByName(SUMMARY_NAME)) summary_(ss);
  return sh;
}

function summary_(ss) {
  var s = ss.insertSheet(SUMMARY_NAME);
  s.setRightToLeft(true);
  var L = "'" + SHEET_NAME + "'!";
  var rows = [
    ['סך הכול ברשימה', '=COUNTA(' + L + 'B2:B)'],
    ['נרשמו היום', '=COUNTIF(' + L + 'A2:A,">="&TODAY())'],
    ['נרשמו ב-7 הימים האחרונים', '=COUNTIF(' + L + 'A2:A,">="&TODAY()-6)'],
    ['אנדרואיד', '=COUNTIF(' + L + 'E2:E,"אנדרואיד")'],
    ['אייפון', '=COUNTIF(' + L + 'E2:E,"אייפון")'],
    ['בשירות סדיר', '=COUNTIF(' + L + 'F2:F,"בשירות סדיר")'],
    ['לפני שחרור', '=COUNTIF(' + L + 'F2:F,"לפני שחרור")'],
    ['אחרי שחרור', '=COUNTIF(' + L + 'F2:F,"אחרי שחרור")'],
    ['לא בצבא', '=COUNTIF(' + L + 'F2:F,"לא בצבא")'],
    ['הגיעו מחבר', '=COUNTIF(' + L + 'H2:H,"?*")'],
    ['', ''],
    ['לפי מקור', '=IFERROR(QUERY(' + L + 'A2:L,"select G, count(B) where B is not null group by G order by count(B) desc label count(B) \'\'",0),"")']
  ];
  s.getRange(1, 1, rows.length, 2).setValues(rows);
  s.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  s.setColumnWidth(1, 200);
}

function data_(sh) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues().map(function (r) {
    r[COL.code - 1] = String(r[COL.code - 1]);
    return r;
  });
}

function cleanContact_(v) {
  var s = String(v || '').trim().toLowerCase();
  var d = s.replace(/[^\d+]/g, '');
  if (d.indexOf('+972') === 0) d = '0' + d.slice(4); else if (d.indexOf('972') === 0) d = '0' + d.slice(3);
  if (/^05\d{8}$/.test(d) && s.indexOf('@') < 0) return d;
  if (/^[^\s@=+\-]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120) return s;
  return '';
}

// nothing that a spreadsheet could read as a formula
function safe_(v, max) { return String(v || '').replace(/[^\w.,\- ֐-׿]/g, '').replace(/^[=+\-@]+/, '').slice(0, max); }

function newCode_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
  for (var i = 0; i < 6; i++) out += abc.charAt(Math.floor(Math.random() * abc.length));
  return out;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// optional: run once from the editor to create both sheets before the first signup
function setup() { sheet_(); }
