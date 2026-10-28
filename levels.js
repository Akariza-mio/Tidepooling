/* Authored level data. Layouts stay fixed unless a level explicitly opts into shuffling. */
(function (root) {
  'use strict';
  const levels = Object.freeze([
    Object.freeze({
      id: 1,
      rows: 4,
      columns: 4,
      duration: 60000,
      pairBonus: 5000,
      layout: Object.freeze([
        0, 1, 2, 0,
        2, 0, 1, 2,
        1, 2, 0, 1,
        0, 1, 1, 0
      ])
    }),
    Object.freeze({
      id: 2,
      rows: 4,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      layout: Object.freeze([
        0, 1, 2, 0, 0, 2,
        1, 0, 1, 2, 1, 0,
        2, 2, 0, 2, 1, 0,
        1, 0, 1, 1, 2, 2
      ])
    }),
    Object.freeze({
      id: 3,
      rows: 4,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      newItem: Object.freeze({ kind: 4, name: '海螺' }),
      layout: Object.freeze([
        0, 4, 1, 2, 0, 4,
        2, 1, 4, 0, 2, 1,
        4, 0, 2, 1, 4, 0,
        1, 2, 0, 4, 1, 2
      ])
    }),
    Object.freeze({
      id: 4,
      rows: 4,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      conditions: Object.freeze([
        Object.freeze({ id: 'last-conch', type: 'lastPairKind', checkAt: 'completion', kind: 4, label: '最后一对配对必须是海螺',
          itemRefs: Object.freeze([Object.freeze({ text: '海螺', kind: 4 })]) })
      ]),
      layout: Object.freeze([
        4, 0, 2, 1, 4, 0,
        1, 2, 0, 4, 1, 2,
        0, 4, 1, 2, 0, 4,
        2, 1, 4, 0, 2, 1
      ])
    }),
    Object.freeze({
      id: 5,
      type: 'diagonalPuzzle',
      rows: 4,
      columns: 4,
      duration: 60000,
      pairBonus: 0,
      kinds: Object.freeze([0, 1, 2, 4]),
      layout: Object.freeze([
        0, null, null, null,
        null, null, null, null,
        null, null, null, null,
        null, null, null, 2
      ])
    }),
    Object.freeze({
      id: 6,
      type: 'diagonalPuzzle',
      rows: 5,
      columns: 5,
      duration: 90000,
      pairBonus: 0,
      newItem: Object.freeze({ kind: 5, name: '鱼儿' }),
      kinds: Object.freeze([0, 1, 2, 4, 5]),
      layout: Object.freeze([
        0, null, null, null, 4,
        null, null, null, null, null,
        null, null, 1, null, null,
        null, null, null, null, null,
        5, null, null, null, null
      ])
    }),
    Object.freeze({
      id: 7,
      rows: 4,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      layout: Object.freeze([
        0, 5, 1, 2, 4, 0,
        1, 2, 5, 4, 1, 0,
        4, 0, 1, 5, 2, 1,
        5, 1, 0, 4, 0, 2
      ])
    }),
    Object.freeze({
      id: 8,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      layout: Object.freeze([
        5, 0, 2, 4, 1, 2,
        1, 4, 0, 5, 2, 0,
        2, 1, 5, 0, 4, 1,
        0, 2, 1, 4, 5, 0,
        4, 1, 2, 0, 1, 5,
        2, 5, 4, 1, 0, 2
      ])
    }),
    Object.freeze({
      id: 9,
      rows: 4,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 10, label: '配对失败的次数不得超过10次' })
      ]),
      layout: Object.freeze([
        1, 4, 0, 5, 2, 0,
        5, 0, 1, 2, 4, 1,
        0, 2, 5, 1, 0, 4,
        2, 1, 4, 0, 1, 5
      ])
    }),
    Object.freeze({
      id: 10,
      rows: 8,
      columns: 8,
      duration: 60000,
      pairBonus: 5000,
      layout: Object.freeze([
        1, 5, 2, 4, 2, 4, 1, 5,
        1, 2, 1, 2, 4, 5, 5, 0,
        1, 5, 0, 1, 2, 4, 2, 4,
        0, 0, 0, 4, 2, 5, 2, 0,
        2, 2, 5, 0, 1, 5, 4, 5,
        4, 1, 4, 0, 1, 1, 5, 0,
        4, 2, 1, 0, 0, 5, 4, 0,
        4, 1, 0, 1, 5, 0, 2, 1
      ])
    }),
    Object.freeze({
      id: 11,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      intro: 'nightFog',
      fog: Object.freeze({ rows: 2, duration: 5000 }),
      layout: Object.freeze([
        0, 1, 5, 2, 4, 1,
        2, 0, 4, 5, 1, 2,
        1, 5, 0, 4, 2, 0,
        4, 2, 1, 0, 5, 1,
        0, 4, 2, 1, 0, 5,
        5, 1, 2, 4, 0, 2
      ])
    }),
    Object.freeze({
      id: 12,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      randomize: true,
      fog: Object.freeze({ shape: 'perimeter', duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'last-fish', type: 'lastPairKind', checkAt: 'completion', kind: 5, label: '最后一对配对必须是鱼儿',
          itemRefs: Object.freeze([Object.freeze({ text: '鱼儿', kind: 5 })]) })
      ]),
      // Even counts as close to equal as possible: 8, 8, 8, 6, 6.
      layout: Object.freeze([
        0, 0, 0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2, 2, 2, 2,
        4, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5
      ])
    }),
    Object.freeze({
      id: 13,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      randomize: true,
      fog: Object.freeze({ cells: Object.freeze([14, 15, 20, 21]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不得超过20次' })
      ]),
      layout: Object.freeze([
        0, 0, 0, 0, 0, 0, 0, 0,
        1, 1, 1, 1, 1, 1, 1, 1,
        2, 2, 2, 2, 2, 2, 2, 2,
        4, 4, 4, 4, 4, 4,
        5, 5, 5, 5, 5, 5
      ])
    })
  ]);
  if (typeof module !== 'undefined' && module.exports) module.exports = levels;
  else root.BeachLevels = levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
