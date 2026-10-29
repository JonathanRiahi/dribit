/**
 * רשימת ההמתנה של דריבית: מסד נתונים בגיליון Google Sheets.
 *
 * מה הסקריפט עושה:
 *  - doPost: דף הנחיתה שולח לכאן כל הרשמה. שורה חדשה בגיליון "רשימת המתנה".
 *    מי שכבר ברשימה (אותו טלפון או אימייל) לא נכנס פעמיים: מקבל בחזרה את הקוד והמקום שלו
 *    (ואם עכשיו כתב שם ובשורה שלו עוד אין שם, השם נכנס).
 *    השם לא חובה. הוא בעמודה האחרונה, "שם", כדי שהעמודות הישנות ונוסחאות הסיכום לא יזוזו.
 *    מי שנרשם מקישור של חבר (ref) נספר לחבר בעמודת "הזמנות" (רק למדידה: זה לא משנה את המקום בתור).
 *  - doGet?count=1: כמה אנשים ברשימה (הדף מציג את זה רק מעל 50), וגם איזו גרסה של הסקריפט פרוסה (v).
 *  - doGet?code=XXXXXX: המקום בתור של קוד אחד (בלי שום פרט אישי).
 *  - אימייל אליך על כל נרשם חדש (NOTIFY). נשלח מהחשבון שלך אל עצמך, ולכן אין בקוד שום כתובת.
 *  - גיליון "סיכום": נוסחאות שמתעדכנות לבד (סך הכול, אנדרואיד/אייפון, לפי סטטוס ולפי מקור).
 *
 * התקנה: ראו README.md באותה תיקייה. אחרי כל שינוי בקוד: Deploy > Manage deployments > עריכה > New version.
 */

var SHEET_NAME = 'רשימת המתנה';
var SUMMARY_NAME = 'סיכום';
var NOTIFY = true; // אימייל על כל נרשם חדש. false = בלי אימיילים
var SCRIPT_VERSION = 'sheet-3'; // מופיע בכתובת ?count=1, כך רואים איזו גרסה של הסקריפט באמת פרוסה
var HEADERS = ['תאריך', 'קוד', 'טלפון או אימייל', 'סוג', 'טלפון', 'סטטוס', 'מקור', 'הוזמן על ידי', 'הזמנות', 'אישור דיוור', 'תחנות בדף', 'גרסת דף', 'שם'];
var COL = { at: 1, code: 2, contact: 3, type: 4, device: 5, status: 6, source: 7, ref: 8, refs: 9, consent: 10, stations: 11, v: 12, name: 13 };

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

    var name = cleanName_(d.name);
    var sh = sheet_();
    var rows = data_(sh);

    // already on the list: same contact, return the existing place (and fill in the name if it was missing)
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][COL.contact - 1]).replace(/^'/, '') === contact) {
        if (name && !rows[i][COL.name - 1]) sh.getRange(i + 2, COL.name).setNumberFormat('@').setValue(name);
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
    row[COL.name - 1] = name;

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
    var out = placeOf_(rows, rows.length - 1, { ok: true });
    if (NOTIFY) notify_(row, out);
    return json_(out);
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
  return json_({ ok: true, total: rows.length, v: SCRIPT_VERSION });
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
  // a sheet made before a column was added (like "שם") gets its header now
  var nameHead = sh.getRange(1, COL.name);
  if (nameHead.getValue() === '') {
    nameHead.setValue(HEADERS[COL.name - 1]).setFontWeight('bold').setBackground('#0E6E58').setFontColor('#ffffff');
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

// the optional name: letters, spaces and the marks names use (ג'ורג', בן-דוד). Never starts like a formula.
function cleanName_(v) {
  return String(v || '').replace(/[^A-Za-z\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF '"\u05F3\u05F4.\-]/g, '').replace(/\s+/g, ' ')
    .replace(/^['"\-. ]+/, '').trim().slice(0, 40);
}

// nothing that a spreadsheet could read as a formula
function safe_(v, max) { return String(v || '').replace(/[^\w.,\- ֐-׿]/g, '').replace(/^[=+\-@]+/, '').slice(0, max); }

function newCode_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
  for (var i = 0; i < 6; i++) out += abc.charAt(Math.floor(Math.random() * abc.length));
  return out;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// an email to the owner of the sheet about the new signup. A failure here never fails the signup.
function notify_(row, out) {
  try {
    var to = Session.getEffectiveUser().getEmail();
    if (!to) return;
    var lines = [
      'מקום ברשימה: #' + out.position + ' (סך הכול ' + out.total + ')',
      'שם: ' + (row[COL.name - 1] || 'לא נכתב'),
      'טלפון או אימייל: ' + row[COL.contact - 1],
      'סטטוס: ' + (row[COL.status - 1] || 'לא נבחר'),
      'טלפון: ' + (row[COL.device - 1] || 'מחשב'),
      'מקור: ' + (row[COL.source - 1] || 'direct'),
      '',
      'הגיליון: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ];
    var who = row[COL.name - 1] ? ' ' + row[COL.name - 1] : '';
    MailApp.sendEmail({ to: to, subject: 'דריבית: נרשם/ה חדש/ה לרשימה' + who + ' (#' + out.position + ')', body: lines.join('\n'), name: 'רשימת ההמתנה של דריבית' });
  } catch (err) {}
}

// optional: run once from the editor to create both sheets before the first signup
function setup() { sheet_(); }

// run once from the editor (choose testEmail at the top, then Run): Google asks to allow sending email,
// and a test email arrives right away. After that every new signup sends one. Then: Deploy > Manage deployments > New version.
function testEmail() {
  var to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: to,
    subject: 'דריבית: בדיקה, ההתראות על נרשמים חדשים עובדות',
    body: 'מעכשיו כל הרשמה חדשה לרשימת ההמתנה תשלח לך אימייל כזה.\n\nנשאר רק: Deploy > Manage deployments > עיפרון > New version > Deploy.\n\nהגיליון: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    name: 'רשימת ההמתנה של דריבית'
  });
  sheet_();
}
