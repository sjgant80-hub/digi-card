// src/shrink.mjs — TRAINING BUILDS, the first kind: SHRINK a build into one small card.
//
// The build is the TEACHER: its fielded parts (src/build.mjs) coupled by non-negative stacking learned on the FIT rows —
// where every part's mind was grown, so the teacher never sees a GATE answer — and its yes or no on every FIT row, cut so
// that it says yes as often as the FIT rows really do. A search (seed-library's evolution, as a level or a strike runs one)
// then looks for the rules of one small card on one department's own columns, on FIT, by how well they give the teacher's
// answers instead of the true ones. What it finds is a card's mind like any other: the rules' shape is the search's, and
// wherever the card is expressed its weights and thresholds are read off that ground's FIT rows and true answers, as every
// card's are. The STUDENT is that card, judged on GATE against the true answers. It is KEPT only if it beats every one of
// its sources there: its GATE at least MARGIN (a level's lift) above the best fielded part's own. A kept student is the mind
// of a new card, for its trainer to seal as maker, as a fallen boss's loot is.
//
// The trainer's key, the build, the department and the shrink's number fix the search's seed, so no two trainers repeat
// each other's work. Anyone re-checks a shrink in milliseconds (the student re-expressed on the true bytes must score its
// stated GATE, the teacher and its sources theirs), or deeply (the search re-run on the teacher's answers must find that
// very student). Whether a student taught by its build does better than the same search on the true answers is for an
// organ to measure, never for this file to assert.
//
// Pure apart from the signatures (WebCrypto Ed25519) and the search, which a caller may run in a worker (opts.organ).
import { organOf, searchOf, seedsFor, atShare, scoreRow, MARGIN, GROW } from './mind.mjs';
import { viewOf, departments } from './data.mjs';
import { measure, buildId } from './build.mjs';
import { BAR } from './raid.mjs';
import { coupleNonNegative, coupled } from '../vendor/dex-frontier/src/compose.mjs';
import { decodeSeed } from '../vendor/dex-frontier/vendor/living-seed/vendor/seed-library/seedlib.mjs';
import { sign, verify as verifySig } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/keys.mjs';
import { canonical, utf8 } from '../vendor/dex-frontier/vendor/living-seed/vendor/keys/canon.mjs';

export const KEYS = ['best', 'build', 'by', 'data', 'domain', 'found', 'gate', 'k', 'kept', 'kind', 'recipe', 'sig', 'teacher'];
const HEX = /^[0-9a-f]{64}$/, SIG = /^[0-9a-f]{128}$/;
const no = (why) => ({ ok: false, why });
const isObj = (x) => Object.prototype.toString.call(x) === '[object Object]';
const exactly = (x, keys) => isObj(x) && Object.keys(x).sort().join() === keys.join();
const unsigned = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'sig'));

/** the seed of a trainer's k-th shrink of a build into a department: their key, the build and the number fix it */
export const shrinkSeed = (pub, build, domain, k) => seedsFor('digi-card/shrink/' + build + '/' + domain + '/' + pub, k + 1)[k];

/**
 * The teacher's answers: the fielded parts coupled on FIT (non-negative stacking), and on each FIT row a yes where its
 * score is above the cut that leaves the FIT rows' own share of yeses. → Map(row → 0 | 1)
 */
export function teacherOf(fielded, ground) {
  const fit = ground.ds.fitRows, y = fit.map((i) => ground.ds.y[i]);
  const cols = fielded.map((f) => fit.map((i) => scoreRow(f.mind, ground, i)));
  const c = coupleNonNegative(cols, y), z = fit.map((_, j) => coupled(c, cols.map((col) => col[j])));
  const base = y.reduce((a, b) => a + b, 0) / y.length, cut = atShare([...z].sort((a, b) => a - b), 1 - base);
  return new Map(fit.map((i, j) => [i, z[j] > cut ? 1 : 0]));
}

/** a department's view with the teacher's answers on its FIT rows (a copy: the ground's own answers are never touched) */
export function taughtView(view, teach) {
  const y = view.y.slice();
  for (const [i, a] of teach) y[i] = a;
  return { ...view, y };
}

/** is a student kept: its GATE at least MARGIN above its best source's */
export const keptOf = (gate, best) => gate >= best + MARGIN;

/** the department a shrink goes into by default: the best fielded part's first */
const defaultDomain = (m) => m.receipt.parts.find((p) => p.card === m.fielded[0].card).domains.split('+')[0];

/** the best fielded part's own GATE (millionths), the bar a student must clear by MARGIN */
const bestOf = (m) => Math.max(...m.receipt.parts.filter((p) => p.joined).map((p) => p.gate));

/**
 * Shrink: the trainer's k-th search for a student of this build in one department (by default, the best part's), signed.
 * Slow (it is a search); the caller may run organOf(searchOf(...), taughtView(...)) in a worker and hand it in as opts.organ.
 * → { ok, shrink: { kind: 'shrink', build, data, domain, k, found, recipe, gate, teacher, best, kept, by, sig } } | a refusal
 */
export async function shrink(keys, build, cards, ground, { domain, k = 0, organ } = {}) {
  try {
    if (!keys || !HEX.test(keys.pub || '')) return no('a shrink is signed by an Ed25519 key');
    if (!Number.isSafeInteger(k) || k < 0 || k > 99999) return no('a shrink’s number is a whole number from 0');
    const m = measure(build, cards, ground);
    if (!m.ok) return no('the build does not measure here: ' + m.why);
    if (m.receipt.fielded < 2) return no('a build of one fielded part has nothing to teach that part does not know');
    const dom = domain === undefined ? defaultDomain(m) : domain;
    if (!departments(ground).includes(dom)) return no('this ground holds no ' + String(dom).slice(0, 40) + ' department');
    const view = viewOf(ground, dom), id = buildId(build), found = searchOf(dom, shrinkSeed(keys.pub, id, dom, k), GROW);
    const o = organ || organOf(found, taughtView(view, teacherOf(m.fielded, ground)), BAR / 1e6);
    if (!o || o.ok !== true) return no('the search could not run here: ' + ((o && o.why) || 'no organ'));
    const student = organOf(o.fixed, view, BAR / 1e6);
    if (!student.ok) return no('the student could not be expressed here: ' + student.why);
    const best = bestOf(m), fields = { kind: 'shrink', build: id, data: ground.id, domain: dom, k, found, recipe: o.fixed, gate: student.gate, teacher: m.receipt.gate, best, kept: keptOf(student.gate, best), by: keys.pub };
    return { ok: true, shrink: { ...fields, sig: await sign(keys, utf8(canonical(fields))) } };
  } catch { return no('the build could not be shrunk here'); }
}

/**
 * Check a shrink against its build, cards and ground: its shape and signature; the search it names is this trainer's k-th
 * for this build and department; the student it carries is that department's and scores exactly its GATE here; the teacher
 * and the best source score theirs; it is kept exactly when it beats the best source by MARGIN; with deep, the search run
 * on the teacher's answers finds that very student. → { ok } | a refusal naming why
 */
export async function checkShrink(s, build, cards, ground, { deep = false } = {}) {
  try {
    if (!exactly(s, KEYS) || s.kind !== 'shrink' || !HEX.test(s.by) || !SIG.test(s.sig) || !HEX.test(s.build)) return no('not a shrink');
    if (!Number.isSafeInteger(s.k) || s.k < 0 || s.k > 99999 || !Number.isSafeInteger(s.gate) || typeof s.kept !== 'boolean') return no('not a shrink');
    if (!(await verifySig(s.by, s.sig, utf8(canonical(unsigned(s)))))) return no('the shrink’s signature does not check');
    if (!ground || s.data !== ground.id) return no('this device does not hold the data the shrink was made on');
    if (s.build !== buildId(build)) return no('the shrink is of another build');
    const m = measure(build, cards, ground);
    if (!m.ok) return no('the build does not measure here: ' + m.why);
    if (s.teacher !== m.receipt.gate) return no('the teacher scores ' + m.receipt.gate + ' here, not the ' + s.teacher + ' it says');
    if (s.best !== bestOf(m)) return no('its best source scores ' + bestOf(m) + ' here, not the ' + s.best + ' it says');
    if (!departments(ground).includes(s.domain)) return no('this ground holds no ' + String(s.domain).slice(0, 40) + ' department');
    if (s.found !== searchOf(s.domain, shrinkSeed(s.by, s.build, s.domain, s.k), GROW)) return no('the search it names is not this trainer’s shrink ' + s.k + ' of this build');
    const d = decodeSeed(s.recipe);
    if (!d.ok || d.seed.grow || d.seed.domain !== s.domain) return no('a shrink carries the student it found, fixed, for its own department');
    const view = viewOf(ground, s.domain), o = organOf(s.recipe, view, BAR / 1e6);
    if (!o.ok || o.gate !== s.gate) return no('the student it carries scores ' + (o.ok ? o.gate : 'nothing') + ' here, not the ' + s.gate + ' it says');
    if (s.kept !== keptOf(s.gate, s.best)) return no('a student is kept exactly when it beats its best source by ' + MARGIN + ' millionths');
    if (deep && organOf(s.found, taughtView(view, teacherOf(m.fielded, ground)), BAR / 1e6).fixed !== s.recipe) return no('the search it names does not find the student it carries');
    return { ok: true };
  } catch { return no('not a shrink'); }
}

/** a kept student's genome fields, for its trainer to seal as maker (as a fallen boss's loot) */
export function studentOf(s) {
  if (!exactly(s, KEYS) || s.kind !== 'shrink' || s.kept !== true) return no('only a kept student becomes a card');
  if (!(s.gate >= BAR)) return no('a student becomes a card only once it clears the plain bar of 0.6 on GATE');
  return { ok: true, genome: { name: s.domain, parents: [], gate: { auc: BAR / 1e6 }, organs: [s.recipe] } };
}
