#!/usr/bin/env node
// tools/judge-10.mjs — organ 10's verdict, by its sealed rules alone (data/organ-10/prereg.json) over its record.
//   node tools/judge-10.mjs [--write | --check]
import { judgeMain, isMain } from './organ.mjs';

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null; };
const six = (m) => (m / 1e6).toFixed(6);
export const RULES = {
  P1: (r) => { const kits = r.kits.filter((k) => k.same && k.worthOk && k.loOk).length, duels = r.duels.filter((d) => d.ok && d.rerun).length; return { pass: r.kits.length === 100 && kits === 100 && r.duels.length === 300 && duels === 300, saw: kits + ' of ' + r.kits.length + ' kits measured twice the same, every worth exact, the loadout checking; ' + duels + ' of ' + r.duels.length + ' kit duels re-ran to the same receipt' }; },
  P2: (r) => { const refused = r.forgeries.filter((f) => f.refused).length; return { pass: r.forgeries.length === 240 && refused === 240, saw: refused + ' of ' + r.forgeries.length + ' forgeries refused' }; },
  P3: (r) => { const good = r.parties.filter((p) => p.ok && p.rerun && p.shares === 1000000 && p.barOk).length; return { pass: r.parties.length === 55 && good === 55, saw: good + ' of ' + r.parties.length + ' party strikes re-ran to the same receipt, their shares a million, their bar the world boss’s' }; },
  P4: (r) => { const same = r.kits.filter((k) => k.tool && k.tool.same).length; return { pass: r.kits.length === 100 && same === 100, saw: same + ' of ' + r.kits.length + ' duels with a tool scored exactly as the same nodes with none' }; },
  P5: (r) => { const i = r.items; return { pass: i.apps === 337 && i.minted === 337 && i.verified === 337 && i.handed === 337 && i.forged === 1685 && i.refused === 1685, saw: i.verified + ' of ' + i.minted + ' items verified, ' + i.handed + ' handed on and still verifying; ' + i.refused + ' of ' + i.forged + ' forged bodies refused' }; },
  Q1: (r) => { const lifted = r.kits.filter((k) => k.lift >= 5000), held = lifted.filter((k) => k.testLift > 0).length; return { pass: lifted.length > 0 && held / lifted.length >= 0.8, saw: held + ' of ' + lifted.length + ' kits that lifted GATE by 0.005 or more (' + pct(held, lifted.length) + '%) also lifted TEST' }; },
  Q2: (r) => { const g = median(r.kits.map((k) => k.lift)), t = median(r.kits.map((k) => k.testLift)); return { pass: g > 0 && t >= 0.8 * g, saw: 'median lift on GATE ' + six(g) + ', on TEST ' + six(t) + ' (' + (g ? Math.round((100 * t) / g) : 0) + '% of GATE’s)' }; },
  Q3: (r) => { const decided = r.duels.filter((d) => d.ok && d.kitted !== 'draw'), won = decided.filter((d) => d.kitted === 'a').length, alone = r.duels.filter((d) => d.ok && d.alone && d.alone !== 'draw'), aloneWon = alone.filter((d) => d.alone === 'a').length; return { pass: decided.length > 0 && won / decided.length >= 0.7, saw: 'kitted, the DIGI won ' + won + ' of ' + decided.length + ' decided duels (' + pct(won, decided.length) + '%); alone against the same cards it won ' + aloneWon + ' of ' + alone.length + ' (' + pct(aloneWon, alone.length) + '%)' }; },
  Q4: (r) => { const full = r.parties.filter((p) => p.full), fell = full.filter((p) => p.ok && p.cleared); return { pass: fell.length >= 3, saw: fell.length + ' of ' + full.length + ' world bosses fell to their best-card party: ' + full.map((p) => p.set + ' ' + (p.ok ? six(p.gate) + (p.cleared ? ' ≥ ' : ' < ') + six(p.bar) : 'refused')).join(', ') }; },
  Q5: (r) => { const cleared = r.parties.filter((p) => p.ok && p.cleared), held = cleared.filter((p) => Math.abs(p.test - p.gate) <= 30000).length; return { pass: cleared.length > 0 && held / cleared.length >= 0.8, saw: held + ' of ' + cleared.length + ' parties that cleared on GATE (' + pct(held, cleared.length) + '%) scored within 0.03 of it on TEST' }; },
};
if (isMain(import.meta.url, 'judge-10.mjs')) judgeMain(10, RULES);
