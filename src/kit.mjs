// src/kit.mjs — THE KIT: every DIGI is born with an inventory, and what it carries is capability it can prove.
//
// Slots are part of what a card is, from its issue: NODE slots (two at birth, a third once it has levelled, a fourth at
// rare) and TOOL slots (two). Nothing about a card's bytes changes to have them — slotsOf() reads them off the checked
// dossier — so every card ever issued, the drop's thousand included, has them already.
//
// A NODE is another card of the same business that its owner also owns: a specialist mind for a department the DIGI does
// not cover. Equipped, it couples with the DIGI exactly as the mesh couples its members (non-negative stacking learned on
// GATE, judged out of fold: a node adds its word or is silent, never counted against its own evidence). A node joins the
// kitted mind only if it answers on the ground, covers a department nothing fielded covers yet, and leads a coin on GATE
// with a paired-bootstrap bound above zero — the mesh's join rule. Every slot shows what it is worth: the kitted mind's
// out-of-fold GATE AUC with it, less without it. A better kit scores better only where it measurably does; whether that
// holds on TEST is for an organ to measure, not for this file to assert.
//
// A TOOL is an app item its owner holds (src/item.mjs): it rides with the DIGI and opens from its inventory. A tool never
// changes a score — the arena and the raids score minds — and the inventory says so.
//
// A LOADOUT is the owner's signed choice of kit for the card as it stands (its id and head) and for each node as it
// stands: give a card away, level it, or move a node, and the loadout lapses until its owner equips again. A KIT DUEL is
// the arena's duel with loadouts: both sides sign for their card and the hash of their loadout, the batch comes from both
// signatures, and each kitted mind scores the batch with its coupling learned on the GATE cases outside the batch (so no
// case it is judged on taught it how to weigh its nodes). The receipt re-runs exactly, and src/arena.mjs ratings() reads
// it like any duel. Nothing is staked.
//
// Pure apart from the signatures (WebCrypto Ed25519); total: junk is refused in plain words, never thrown.
import { mindOf, scoreRow } from './mind.mjs';
import { facts } from './dossier.mjs';
import { oof } from './mesh.mjs';
import { seedOf, batchOf, BATCH } from './arena.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { lead } from '../vendor/dex-frontier/src/stats.mjs';
import { auc } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/sha256.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const LOADOUT = 'digi.loadout.v1';
export const TOOL_SLOTS = 2;
export const ZERO = '0'.repeat(64);
export const KEYS = ['by', 'card', 'head', 'nodes', 'sig', 'tools', 'type'];
const HEX = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/, CARD = /^[0-9a-f]{16}$/, NONCE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CH = ['by', 'card', 'head', 'kit', 'nonce', 'sig', 'type'], AC = ['by', 'card', 'challenge', 'head', 'kit', 'sig', 'type'];
const no = (why) => ({ ok: false, why });
const milli = (x) => Math.round(x * 1e6);
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));
const hashOf = (e) => sha256Hex(canonical(e));
const liveOf = (mind) => mind.organs.filter((o) => o.state === 'live').map((o) => o.domain);

/** a card's slots, from what it is: node slots by its level (2, 3 once levelled, 4 from rare), and its tool slots */
export function slotsOf(v) {
  const f = facts(v);
  return { nodes: 2 + (f.stage >= 1 ? 1 : 0) + (f.stage >= 3 ? 1 : 0), tools: TOOL_SLOTS, stage: f.stage, rarity: f.rarity };
}

/** why this kit cannot be carried by this card, or '' — nodes: checked dossiers; tools: checked items (src/item.mjs) */
function misfit(v, nodes, tools) {
  if (!Array.isArray(nodes) || !Array.isArray(tools)) return 'a kit is a list of node cards and a list of tools';
  const s = slotsOf(v), dataset = facts(v).dataset, seen = new Set([v.id]);
  if (nodes.length > s.nodes) return 'this DIGI has ' + s.nodes + ' node slots';
  if (tools.length > s.tools) return 'this DIGI has ' + s.tools + ' tool slots';
  for (const n of nodes) {
    if (!n || n.ok !== true) return 'a node is a card that checks';
    if (n.id === v.id) return 'a DIGI cannot be its own node';
    if (seen.has(n.id)) return 'the same card is in two slots';
    if (n.owner !== v.owner) return 'a node is a card the DIGI’s owner also owns';
    if (facts(n).dataset !== dataset) return 'a node works with its DIGI on the same business’s records: this one is ' + facts(n).dataset + ', the DIGI ' + dataset;
    seen.add(n.id);
  }
  const held = new Set();
  for (const t of tools) {
    if (!t || t.ok !== true || t.form !== 'app' || !HEX.test(t.id || '')) return 'a tool is an app item that checks';
    if (t.owner !== v.owner) return 'a tool is an item the DIGI’s owner also holds';
    if (held.has(t.id)) return 'the same tool is in two slots';
    held.add(t.id);
  }
  return '';
}

/** the owner equips this kit on this card as it stands. → { ok, loadout } | a refusal */
export async function equip(keys, v, nodes = [], tools = []) {
  if (!v || v.ok !== true) return no('only a card that checks can be kitted');
  if (!keys || keys.pub !== v.owner) return no('only the card’s owner can equip it');
  const bad = misfit(v, nodes, tools);
  if (bad) return no(bad);
  const fields = { type: LOADOUT, card: v.id, head: v.head, nodes: nodes.map((n) => ({ card: n.id, head: n.head })), tools: tools.map((t) => t.id), by: keys.pub };
  return { ok: true, loadout: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

/** is this the owner's loadout for this card as it stands, naming exactly these nodes as they stand? → { ok } | why not */
export async function loadoutOk(lo, v, nodes = [], tools = []) {
  try {
    if (!exactly(lo, KEYS) || lo.type !== LOADOUT) return no('not a loadout');
    if (!CARD.test(lo.card) || !HEX.test(lo.head) || !HEX.test(lo.by) || !SIG.test(lo.sig)) return no('not a loadout');
    if (!lo.nodes.every((n) => exactly(n, ['card', 'head']) && CARD.test(n.card) && HEX.test(n.head)) || !lo.tools.every((t) => typeof t === 'string' && HEX.test(t))) return no('not a loadout');
    if (!(await verifySig(lo.by, lo.sig, utf8(canonical(unsigned(lo)))))) return no('the loadout’s signature does not check');
    if (!v || v.ok !== true || lo.card !== v.id) return no('the loadout is for another card');
    if (lo.head !== v.head) return no('the card has changed since this kit was equipped: its owner equips it again');
    if (lo.by !== v.owner) return no('the loadout is not its card’s owner’s');
    const ns = Array.isArray(nodes) ? nodes : null, ts = Array.isArray(tools) ? tools : null;
    if (!ns || !ts || ns.length !== lo.nodes.length || ts.length !== lo.tools.length) return no('these are not the nodes and tools the loadout names');
    for (const [k, n] of lo.nodes.entries()) {
      if (!nodes[k] || nodes[k].id !== n.card) return no('these are not the nodes and tools the loadout names');
      if (nodes[k].head !== n.head) return no('node ' + (k + 1) + ' has changed since it was equipped: its owner equips it again');
    }
    if (lo.tools.some((t, k) => !tools[k] || tools[k].id !== t)) return no('these are not the nodes and tools the loadout names');
    const bad = misfit(v, nodes, tools);
    return bad ? no(bad) : { ok: true };
  } catch { return no('not a loadout'); }
}

/**
 * The kitted mind on a ground: the DIGI and its nodes, in slot order. → { ok, gate, alone, lift (millionths, out of fold
 * on GATE), own: the DIGI's contribution, slots: [{ card, domains, gate, joined, why, contribution }], fielded, rows } |
 * a refusal. A node that cannot join is named with its reason and adds nothing.
 */
export function kitted(v, nodes, ground) {
  try {
    if (!v || v.ok !== true) return no('only a card that checks can be kitted');
    if (!Array.isArray(nodes)) return no('a kit is a list of node cards');
    const rows = ground.ds.gateRows, y = rows.map((i) => ground.ds.y[i]), main = mindOf(v, ground);
    if (main.gate === null) return no('the DIGI must answer on this ground: a card of another business is dormant here');
    const covered = new Set(liveOf(main)), fielded = [{ card: v.id, mind: main, col: rows.map((i) => scoreRow(main, ground, i)) }], slots = [];
    for (const n of nodes) {
      if (!n || n.ok !== true) { slots.push({ card: null, domains: '', gate: null, joined: false, why: 'the card does not check', contribution: 0 }); continue; }
      const mind = mindOf(n, ground), row = { card: n.id, domains: '', gate: mind.gate, joined: false, contribution: 0 };
      if (mind.gate === null) { slots.push({ ...row, why: 'it is dormant here: no department of its mind answers on this ground' }); continue; }
      const doms = liveOf(mind), twice = doms.filter((d) => covered.has(d));
      row.domains = doms.join('+');
      if (twice.length) { slots.push({ ...row, why: 'what it knows is covered already: ' + twice.join(', ') }); continue; }
      const col = rows.map((i) => scoreRow(mind, ground, i)), l = lead(col, col.map(() => 0), y, 400, 7);
      if (!(l.low95 > 0)) { slots.push({ ...row, why: 'it does not lead a coin on GATE (bound ' + l.low95 + ')' }); continue; }
      doms.forEach((d) => covered.add(d));
      fielded.push({ card: n.id, mind, col });
      slots.push({ ...row, joined: true, why: null });
    }
    const cols = fielded.map((f) => f.col), gate = milli(oof(cols, y)), alone = milli(oof([cols[0]], y));
    const worth = fielded.map((_, k) => gate - milli(oof(cols.filter((__, j) => j !== k), y)));
    fielded.slice(1).forEach((f, k) => { slots.find((s) => s.card === f.card && s.joined).contribution = worth[k + 1]; });
    return { ok: true, gate, alone, lift: gate - alone, own: worth[0], slots, fielded, rows: rows.length };
  } catch { return no('the kit could not be measured here'); }
}

/** the kitted mind's scores on a batch of GATE rows: alone, its own score; kitted, coupled on GATE outside the batch */
export function scoresOn(k, ground, batch) {
  if (k.fielded.length === 1) return batch.map((i) => scoreRow(k.fielded[0].mind, ground, i));
  const out = new Set(batch), rows = ground.ds.gateRows, fit = rows.map((_, j) => j).filter((j) => !out.has(rows[j]));
  const c = coupleNonNegative(k.fielded.map((f) => fit.map((j) => f.col[j])), fit.map((j) => ground.ds.y[rows[j]]));
  return batch.map((i) => coupled(c, k.fielded.map((f) => scoreRow(f.mind, ground, i))));
}

/** the challenger's offer for its card as it stands and its loadout (or none). → { ok, challenge } | a refusal */
export async function kitChallenge(keys, v, lo, nonce) {
  if (!v || v.ok !== true) return no('only a card that checks can challenge');
  if (!keys || keys.pub !== v.owner) return no('only the card’s owner can send its challenge');
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) return no('a nonce is up to 64 lowercase letters, digits and hyphens');
  const fields = { type: 'digi.kit-challenge.v1', card: v.id, head: v.head, kit: lo ? hashOf(lo) : ZERO, nonce, by: keys.pub };
  return { ok: true, challenge: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

/** the defender's acceptance, for its own card as it stands and its loadout (or none). → { ok, accept } | a refusal */
export async function kitAccept(keys, v, lo, ch) {
  if (!v || v.ok !== true) return no('only a card that checks can accept');
  if (!keys || keys.pub !== v.owner) return no('only the card’s owner can accept for it');
  const bad = await checkSigned(ch, 'digi.kit-challenge.v1', CH, 'challenge');
  if (bad) return no(bad);
  if (ch.card === v.id) return no('a card cannot fight itself');
  const fields = { type: 'digi.kit-accept.v1', card: v.id, head: v.head, kit: lo ? hashOf(lo) : ZERO, challenge: hashOf(ch), by: keys.pub };
  return { ok: true, accept: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
}

async function checkSigned(e, type, keys, what) {
  const not = 'not ' + (what === 'acceptance' ? 'an ' : 'a ') + what;
  if (!exactly(e, keys) || e.type !== type) return not;
  if (!CARD.test(e.card) || !HEX.test(e.head) || !HEX.test(e.kit) || !HEX.test(e.by) || !SIG.test(e.sig)) return not;
  if (e.nonce !== undefined && !NONCE.test(e.nonce)) return not;
  return (await verifySig(e.by, e.sig, utf8(canonical(unsigned(e))))) ? '' : 'the ' + what + '’s signature does not check';
}

/** one side as signed: its card, its loadout (or none) and the nodes and tools that loadout names */
async function sideOf(s, signed, what) {
  if (!s || !s.v || s.v.ok !== true) return 'both cards must check';
  if (signed.card !== s.v.id || signed.head !== s.v.head) return 'the ' + what + ' is not for this card as it stands';
  if (signed.by !== s.v.owner) return 'the ' + what + ' was not signed by its card’s owner';
  if (signed.kit !== (s.loadout ? hashOf(s.loadout) : ZERO)) return 'the ' + what + ' names another kit';
  if (!s.loadout) return (s.nodes || []).length || (s.tools || []).length ? 'a side with no loadout fields its card alone' : '';
  const ok = await loadoutOk(s.loadout, s.v, s.nodes || [], s.tools || []);
  return ok.ok ? '' : ok.why;
}

/**
 * Fight a kit duel: each side { v, loadout, nodes, tools } (loadout null: the card alone), the ground, and the signed
 * challenge and acceptance. → { ok, receipt: { kind: 'duel', data, a: { card, head, kit, auc }, b: { … }, challenge,
 * accept, seed, n, winner, self }, batch, scores, y, kits } | a refusal naming why
 */
export async function kitDuel(A, B, ground, { challenge: ch, accept: ac } = {}) {
  try {
    const badC = await checkSigned(ch, 'digi.kit-challenge.v1', CH, 'challenge');
    if (badC) return no(badC);
    const badA = await checkSigned(ac, 'digi.kit-accept.v1', AC, 'acceptance');
    if (badA) return no(badA);
    if (ac.challenge !== hashOf(ch)) return no('the acceptance is for another challenge');
    const sa = await sideOf(A, ch, 'challenge');
    if (sa) return no(sa);
    const sb = await sideOf(B, ac, 'acceptance');
    if (sb) return no(sb);
    if (A.v.id === B.v.id) return no('a card cannot fight itself');
    const kA = kitted(A.v, A.nodes || [], ground), kB = kitted(B.v, B.nodes || [], ground);
    if (!kA.ok || !kB.ok) return no('both cards must answer on this ground: a card of another business is dormant here');
    const seed = seedOf(ch, ac), batch = batchOf(ground, seed);
    if (batch.length < BATCH) return no('this ground holds fewer than ' + BATCH + ' GATE cases');
    const y = batch.map((i) => ground.ds.y[i]), scA = scoresOn(kA, ground, batch), scB = scoresOn(kB, ground, batch);
    const a = Math.round(auc(scA, y) * 1e6), b = Math.round(auc(scB, y) * 1e6);
    const receipt = { kind: 'duel', data: ground.id, a: { card: A.v.id, head: A.v.head, kit: ch.kit, auc: a }, b: { card: B.v.id, head: B.v.head, kit: ac.kit, auc: b }, challenge: hashOf(ch), accept: hashOf(ac), seed, n: batch.length, winner: a > b ? 'a' : b > a ? 'b' : 'draw', self: A.v.owner === B.v.owner };
    return { ok: true, receipt, batch, scores: { a: scA, b: scB }, y, kits: { a: kA, b: kB } };
  } catch { return no('the duel could not be fought here'); }
}

/** re-fight a kit duel from its receipt, both sides, the ground and the signed pair. → { ok } | why not */
export async function kitRerun(receipt, A, B, ground, signed) {
  if (!isObj(receipt) || receipt.kind !== 'duel' || !isObj(receipt.a) || !HEX.test(receipt.a.kit || '')) return no('not a kit duel receipt');
  const r = await kitDuel(A, B, ground, signed);
  if (!r.ok) return no('the duel does not re-fight: ' + r.why);
  return canonical(r.receipt) === canonical(receipt) ? { ok: true } : no('re-fought here, it gives ' + r.receipt.a.auc + ' against ' + r.receipt.b.auc + ', not the receipt’s ' + receipt.a.auc + ' against ' + receipt.b.auc);
}
