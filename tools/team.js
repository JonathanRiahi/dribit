/* The team's own use of the app (Jonathan and Nehorai, 13.11.2026) is left out of every report count.
   Who is "team":
     1. every person whose last team_device event is on. The app sends it when a device is marked: the link
        https://jonathanriahi.github.io/dribit/?team=1 (or dribit.app/?team=1), or 7 taps on the version line at the bottom
        of the profile (the way in for the home-screen icon and the iPhone / Android app). ?team=0 or 7 more taps undo it.
        The person is dropped with all their history, so marking a device today also removes what it did before.
     2. the dribit.app visits that opened the app on such a device (landing_id on its app_opened events).
     3. optional: the secret TEAM_IDS (device ids, comma separated) for old devices that can no longer be marked.
   Prints only how many people were left out, never an id (the Actions log of this repository is public).
   Use: const team = await loadTeam(hogql); then add `AND ${team.not()}` (or team.not('e.')) to a query on events. */
'use strict';

const FROM = "timestamp >= toDateTime('2026-09-01 00:00:00')";
const OK_ID = /^[A-Za-z0-9-]{8,64}$/;

async function loadTeam(hogql) {
  const extra = (process.env.TEAM_IDS || '').split(/[\s,;]+/).filter((x) => OK_ID.test(x));
  const marked = `
    SELECT person_id FROM events WHERE event = 'team_device' AND ${FROM}
    GROUP BY person_id HAVING argMax(toString(properties.on), timestamp) = 'true'`;
  const markedRows = await hogql(`SELECT toString(person_id) FROM (${marked})`);
  const people = new Set(markedRows.map((r) => r[0]));
  const ids = new Set(extra);
  const quote = (xs) => xs.map((x) => `'${x}'`).join(', ');
  const uuidOk = (p) => /^[0-9a-f-]{36}$/i.test(p);
  if ([...people].some(uuidOk)) {
    const lp = await hogql(`
      SELECT DISTINCT toString(properties.landing_id) FROM events
      WHERE event = 'app_opened' AND ${FROM} AND toString(person_id) IN (${quote([...people].filter(uuidOk))})`);
    for (const [x] of lp) if (OK_ID.test(String(x))) ids.add(String(x));
  }
  if (ids.size) {
    const rows = await hogql(`SELECT DISTINCT toString(person_id) FROM events WHERE ${FROM} AND distinct_id IN (${quote([...ids])})`);
    for (const [p] of rows) people.add(String(p));
  }
  const pids = [...people].filter(uuidOk);
  const sql = quote(pids);
  return {
    devices: markedRows.length,
    people: pids.length,
    extraIds: extra.length,
    // a condition for a query on events: keeps everyone who is not team
    not: (alias) => (pids.length ? `toString(${alias || ''}person_id) NOT IN (${sql})` : '1 = 1'),
    line: () => `לא כולל את הצוות (יהונתן ובוחניק): ${pids.length} מזהים בחוץ (${markedRows.length} מכשירים מסומנים` +
      (extra.length ? `, ${extra.length} מזהים ישנים מ-TEAM_IDS` : '') + ').' +
      (markedRows.length ? '' : ' עוד אין מכשיר מסומן: לפתוח ?team=1 או 7 הקשות על הגרסה בפרופיל.')
  };
}

module.exports = { loadTeam };
