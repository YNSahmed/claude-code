import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const ORGANIZER = 'organizer@example.com';
const env = await initializeTestEnvironment({
  projectId: 'demo-clutch-arena',
  firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8').replace('YOUR-EMAIL@gmail.com', ORGANIZER), host: '127.0.0.1', port: 8080 },
});
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
const future = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3600_000));
const past = firebase.firestore.Timestamp.fromDate(new Date(Date.now() - 60_000));

let passed = 0, failed = 0;
async function check(label, fn) {
  try { await fn(); passed++; console.log('PASS ', label); }
  catch (e) { failed++; console.log('FAIL ', label, '—', String(e.message).split('\n')[0].slice(0, 160)); }
}

async function seed(id, overrides = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`tournaments/${id}`).set({
      title: 'Friday Squads', status: 'OPEN', startsAt: future, maxSquads: 2,
      squadsRegistered: 0, nextTeamNumber: 1, lastRegistrationId: '', prizePool: 1000, ...overrides,
    });
    await ctx.firestore().doc('config/settings').set({ organizerName: 'Clutch Arena', entryFeesEnabled: false });
  });
}

let n = 0;
const phone = () => `98${String(10000000 + n++).padStart(8, '0')}`;
const members = (phones = [phone(), phone(), phone(), phone()]) =>
  phones.map((p, i) => ({ name: `Player ${i + 1}`, phone: p, uid: '' }));

/** The exact batch the app sends to register a squad. */
function registerBatch(db, tid, { rid = `r${n++}`, squadName = 'Team Inferno', ms = members(), teamNumber = 1, counter = 1, team = teamNumber, extra = {}, skip = {} } = {}) {
  const b = db.batch();
  if (!skip.registration) b.set(db.doc(`tournaments/${tid}/registrations/${rid}`), { squadName, teamNumber, members: ms, adult: true, consent: true, paymentStatus: 'unpaid', createdAt: ts(), ...extra });
  if (!skip.phones) for (const m of ms) b.set(db.doc(`tournaments/${tid}/phones/${m.phone}`), { registrationId: rid });
  if (!skip.publicSquad) b.set(db.doc(`tournaments/${tid}/publicSquads/${rid}`), { squadName, teamNumber });
  if (!skip.counter) b.update(db.doc(`tournaments/${tid}`), { squadsRegistered: counter, nextTeamNumber: team + 1, lastRegistrationId: rid });
  return b;
}

const anon = env.unauthenticatedContext().firestore();
const organizer = env.authenticatedContext('org', { email: ORGANIZER, email_verified: true }).firestore();
const stranger = env.authenticatedContext('x', { email: 'someone@gmail.com', email_verified: true }).firestore();
const unverified = env.authenticatedContext('y', { email: ORGANIZER, email_verified: false }).firestore();

await seed('t1');
await check('anyone can read tournaments and settings', async () => {
  await assertSucceeds(anon.doc('tournaments/t1').get());
  await assertSucceeds(anon.doc('config/settings').get());
});
const first = members();
await check('a player (no login) can register a squad', () => assertSucceeds(registerBatch(anon, 't1', { rid: 'squadA', ms: first }).commit()));
await check('anyone can see squad names', () => assertSucceeds(anon.collection('tournaments/t1/publicSquads').get()));
await check('players cannot read registrations (names and numbers)', () => assertFails(anon.collection('tournaments/t1/registrations').get()));
await check('players cannot read one registration by id', () => assertFails(anon.doc('tournaments/t1/registrations/squadA').get()));
await check('players cannot read the phone list', () => assertFails(anon.doc(`tournaments/t1/phones/${first[0].phone}`).get()));
await check('another Google account cannot read registrations', () => assertFails(stranger.collection('tournaments/t1/registrations').get()));
await check('organizer email that is not verified cannot read', () => assertFails(unverified.collection('tournaments/t1/registrations').get()));
await check('the organizer can read registrations', () => assertSucceeds(organizer.collection('tournaments/t1/registrations').get()));
await check('a number already in a squad cannot join another squad', () =>
  assertFails(registerBatch(anon, 't1', { ms: members([first[1].phone, phone(), phone(), phone()]), teamNumber: 2, counter: 2 }).commit()));
await check('the same number twice in one squad is refused', () => {
  const p = phone();
  return assertFails(registerBatch(anon, 't1', { ms: members([p, p, phone(), phone()]), teamNumber: 2, counter: 2 }).commit());
});
await check('registering without updating the squad count is refused', () => assertFails(registerBatch(anon, 't1', { teamNumber: 2, skip: { counter: true } }).commit()));
await check('bumping the squad count without a registration is refused', () => assertFails(registerBatch(anon, 't1', { teamNumber: 2, counter: 2, skip: { registration: true, phones: true, publicSquad: true } }).commit()));
await check('a wrong team number is refused', () => assertFails(registerBatch(anon, 't1', { teamNumber: 5, counter: 2, team: 1 }).commit()));
await check('a public squad name different from the registration is refused', async () => {
  const db = anon; const rid = 'mismatch'; const ms = members();
  const b = registerBatch(db, 't1', { rid, ms, teamNumber: 2, counter: 2, skip: { publicSquad: true } });
  b.set(db.doc(`tournaments/t1/publicSquads/${rid}`), { squadName: 'Fake Name', teamNumber: 2 });
  await assertFails(b.commit());
});
await check('3 members instead of 4 is refused', () => assertFails(registerBatch(anon, 't1', { ms: members().slice(0, 3), teamNumber: 2, counter: 2 }).commit()));
await check('an invalid phone number is refused', () => assertFails(registerBatch(anon, 't1', { ms: members(['12345', phone(), phone(), phone()]), teamNumber: 2, counter: 2 }).commit()));
await check('extra fields (e.g. paymentStatus "paid") are refused', () => assertFails(registerBatch(anon, 't1', { teamNumber: 2, counter: 2, extra: { paymentStatus: 'paid' } }).commit()));
await check('without the 18+ confirmation it is refused', () => assertFails(registerBatch(anon, 't1', { teamNumber: 2, counter: 2, extra: { adult: false } }).commit()));
await check('a second squad fills the last spot', () => assertSucceeds(registerBatch(anon, 't1', { teamNumber: 2, counter: 2 }).commit()));
await check('a full tournament refuses more squads', () => assertFails(registerBatch(anon, 't1', { teamNumber: 3, counter: 3 }).commit()));
await check('players cannot change prizes, status or title', async () => {
  await assertFails(anon.doc('tournaments/t1').update({ prizePool: 999999 }));
  await assertFails(anon.doc('tournaments/t1').update({ status: 'COMPLETED' }));
  await assertFails(anon.doc('tournaments/t1').update({ maxSquads: 50 }));
});
await check('players cannot delete or edit registrations or tournaments', async () => {
  await assertFails(anon.doc('tournaments/t1/registrations/squadA').delete());
  await assertFails(anon.doc('tournaments/t1/registrations/squadA').update({ paymentStatus: 'paid' }));
  await assertFails(anon.doc('tournaments/t1/publicSquads/squadA').delete());
  await assertFails(anon.doc('tournaments/t1').delete());
});
await check('players cannot change settings; a random Google account cannot either', async () => {
  await assertFails(anon.doc('config/settings').update({ upiId: 'hacker@upi' }));
  await assertFails(stranger.doc('config/settings').update({ upiId: 'hacker@upi' }));
});
await check('the organizer can change settings and mark a squad paid', async () => {
  await assertSucceeds(organizer.doc('config/settings').update({ upiId: 'clutch@upi' }));
  await assertSucceeds(organizer.doc('tournaments/t1/registrations/squadA').update({ paymentStatus: 'paid' }));
});
await check('the organizer can remove a squad and free its spot', async () => {
  const b = organizer.batch();
  b.delete(organizer.doc('tournaments/t1/registrations/squadA'));
  b.delete(organizer.doc('tournaments/t1/publicSquads/squadA'));
  for (const m of first) b.delete(organizer.doc(`tournaments/t1/phones/${m.phone}`));
  b.update(organizer.doc('tournaments/t1'), { squadsRegistered: 1 });
  await assertSucceeds(b.commit());
});
await check('unknown collections are denied', async () => {
  await assertFails(anon.doc('users/abc').set({ a: 1 }));
  await assertFails(anon.collection('anything').get());
});
await seed('closed', { status: 'CLOSED' });
await check('a closed tournament refuses registrations', () => assertFails(registerBatch(anon, 'closed').commit()));
await seed('started', { startsAt: past });
await check('a tournament that has started refuses registrations', () => assertFails(registerBatch(anon, 'started').commit()));

console.log(`\n${failed === 0 ? `ALL ${passed} RULE CHECKS PASSED` : `${failed} FAILED, ${passed} passed`}`);
await env.cleanup();
process.exit(failed ? 1 : 0);
