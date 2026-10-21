#!/usr/bin/env node
// tools/seal-4.mjs — organ 4, BREEDING: the claims, sealed before tools/measure-4.mjs runs.
import { seal } from './organ.mjs';

seal(4, {
  organ: 'breeding: a child card is born only if it beats both parents on GATE, and its lineage is in its seal',
  population: 'same department: for every department in the drop, its genesis cards paired in serial order, five pairs; across departments: for every set with two or more departments in the drop, five pairs between each department and the next. Each pair is handed to one demo breeder and bred with seed 1, up to 12 crossings',
  rules: [
    { id: 'P1', kind: 'property', claim: 'Every child born beats both parents on GATE, re-run by birthCheck on the ground.' },
    { id: 'P2', kind: 'property', claim: 'Every child names both parents in its seal, is sealed by its breeder, carries the higher of their bars, and is issued at generation one.' },
    { id: 'P3', kind: 'property', claim: 'Every pair that bore no child says why with the numbers: the best child seen against the parent it had to beat, and how many crossings were tried.' },
    { id: 'Q1', kind: 'prediction', claim: 'Within a department, at least 50% of children born score above both parents on TEST.' },
    { id: 'Q2', kind: 'prediction', claim: 'Across departments, at least 80% of children born score above both parents on TEST.' },
    { id: 'Q3', kind: 'prediction', claim: 'At least 30% of same-department pairs bear a child within 12 crossings.' },
  ],
}, ['tools/lib.mjs']);
