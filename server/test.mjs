// Server checks: run 'npx wrangler@4.40.0 dev --local' in server/ (after 'd1 execute dribit-social --local --file=schema.sql'), then 'node test.mjs'. API=<address> tests another server.
const B = process.env.API || 'http://localhost:8787';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
async function call(path, body, tok, method) {
  const r = await fetch(B + path, { method: method || (body ? 'POST' : 'GET'), headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json() };
}
const wk = (await call('/')).j.week;
const A = await call('/v1/register', { xp: 500, week: wk, weekXp: 120, streak: 3, lessons: 4 });
ok(A.status === 200 && A.j.token && A.j.me.ref.length === 6, 'register A');
const ta = A.j.token, refA = A.j.me.ref;
ok(A.j.me.weekXp === 120, 'A week xp 120');
const Bn = await call('/v1/register', { ref: refA, xp: 0, week: wk, weekXp: 0, streak: 0, lessons: 0 });
const tb = Bn.j.token;
ok(Bn.j.me.invitedBy && Bn.j.me.counted === false, 'B invited, not counted yet');
let a = await call('/v1/sync', { xp: 520, week: wk, weekXp: 140, streak: 3, lessons: 4 }, ta);
ok(a.j.me.friends === 0, 'A has 0 friends before B finishes');
let b = await call('/v1/sync', { xp: 60, week: wk, weekXp: 60, streak: 1, lessons: 1 }, tb);
ok(b.j.me.counted === true, 'B counted after lesson 1');
b = await call('/v1/sync', { xp: 90, week: wk, weekXp: 90, streak: 1, lessons: 2 }, tb);
a = await call('/v1/sync', { xp: 520, week: wk, weekXp: 140, streak: 3, lessons: 4 }, ta);
ok(a.j.me.friends === 1, 'A has 1 friend (counted once)');
const self = await call('/v1/register', { ref: 'ZZZZZZ', xp: 0, lessons: 1 });
ok(self.status === 200 && !self.j.me.invitedBy, 'unknown ref ignored');
// groups
let g = await call('/v1/groups', { name: 'גולני 51' }, ta);
ok(g.status === 400 && g.j.error === 'need_nick', 'group needs nick');
ok((await call('/v1/nick', { nick: 'זונה' }, ta)).j.error === 'bad_nick', 'bad word nick rejected');
ok((await call('/v1/nick', { nick: '0541234567' }, ta)).j.error === 'bad_nick', 'phone nick rejected');
ok((await call('/v1/nick', { nick: 'יהונתן' }, ta)).j.me.nick === 'יהונתן', 'nick set');
g = await call('/v1/groups', { name: 'גולני 51' }, ta);
ok(g.status === 200 && g.j.group.code.length === 6 && g.j.group.people.length === 1, 'group created');
const code = g.j.group.code;
let pv = await call('/v1/groups/' + code, null, tb);
ok(pv.j.group.member === false && pv.j.group.name === 'גולני 51' && !pv.j.group.people, 'preview for non-member');
ok((await call('/v1/groups/' + code + '/join', {}, tb)).j.error === 'need_nick', 'join needs nick');
await call('/v1/nick', { nick: 'נועם' }, tb);
let j = await call('/v1/groups/' + code.toLowerCase() + '/join', {}, tb);
ok(j.status === 200 && j.j.joined && j.j.group.people.length === 2, 'B joined (lowercase code ok)');
ok(j.j.group.people[0].nick === 'יהונתן' && j.j.group.people[0].week === 140, 'A first by week points');
b = await call('/v1/sync', { xp: 400, week: wk, weekXp: 400, streak: 2, lessons: 5 }, tb);
ok(b.j.me.groups[0].rank === 1, 'B rank 1 after more points');
let bd = await call('/v1/groups/' + code, null, ta);
ok(bd.j.group.people[0].nick === 'נועם' && bd.j.group.owner === true, 'board order + owner');
ok((await call('/v1/groups/' + code + '/kick', { user: bd.j.group.people[1].id }, tb)).j.error === 'not_owner', 'only owner kicks');
let k = await call('/v1/groups/' + code + '/kick', { user: bd.j.group.people[0].id }, ta);
ok(k.j.group.people.length === 1, 'owner kicked B');
await call('/v1/groups/' + code + '/join', {}, tb);
await call('/v1/groups/' + code + '/leave', {}, ta);
bd = await call('/v1/groups/' + code, null, tb);
ok(bd.j.group.owner === true && bd.j.group.size === 1, 'owner left, B is owner');
await call('/v1/groups/' + code + '/leave', {}, tb);
ok((await call('/v1/groups/' + code, null, tb)).status === 404, 'empty group removed');
ok((await call('/v1/sync', {}, 'AAAAAAAAAA.' + 'a'.repeat(48))).status === 401, 'bad token 401');
// last week winner: put a row from last week
const st = await call('/v1/stats');
ok(st.j.people >= 3 && st.j.friends_counted >= 1, 'stats ' + JSON.stringify(st.j));
// 5 groups max, 3 creates a day
for (let i = 0; i < 3; i++) await call('/v1/groups', { name: 'קבוצה ' + i }, ta);
ok((await call('/v1/groups', { name: 'רביעית' }, ta)).j.error === 'slow_down', '3 creates a day');
console.log(fails ? fails + ' FAILED' : 'ALL OK');
