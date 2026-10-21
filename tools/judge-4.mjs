#!/usr/bin/env node
// tools/judge-4.mjs — organ 4, judged by the rules tools/seal-4.mjs sealed. node tools/judge-4.mjs [--write | --check]
import { judgeMain } from './organ.mjs';

const born = (r) => r.rows.filter((x) => x.born), not = (r) => r.rows.filter((x) => !x.born);
judgeMain(4, {
  P1: (r) => ({ pass: born(r).length > 0 && born(r).every((x) => x.check && x.gate > Math.max(...x.parentsGate)), saw: born(r).filter((x) => x.check).length + ' of ' + born(r).length + ' children beat both parents on GATE when re-run' }),
  P2: (r) => ({ pass: born(r).length > 0 && born(r).every((x) => x.lineage), saw: born(r).filter((x) => x.lineage).length + ' of ' + born(r).length + ' carry both parents, their breeder, the higher bar and generation one' }),
  P3: (r) => ({ pass: not(r).every((x) => /^no child of theirs beat both parents on GATE \((\d+|no live child) against \d+, \d+ tried\)$/.test(x.why)), saw: not(r).length + ' pairs bore none, each saying why with its numbers' }),
  Q1: (r) => ({ pass: r.same.born > 0 && r.same.overOnTest >= 0.5 * r.same.born, saw: r.same.overOnTest + ' of ' + r.same.born + ' same-department children above both parents on TEST' }),
  Q2: (r) => ({ pass: r.cross.born > 0 && r.cross.overOnTest >= 0.8 * r.cross.born, saw: r.cross.overOnTest + ' of ' + r.cross.born + ' cross-department children above both parents on TEST' }),
  Q3: (r) => ({ pass: r.same.born >= 0.3 * r.same.pairs, saw: r.same.born + ' of ' + r.same.pairs + ' same-department pairs bore a child' }),
});
