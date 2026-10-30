/* Authored layouts and item pools. Only levels marked randomize shuffle on entry. */
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
      fog: Object.freeze({ shape: 'perimeter', duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'last-fish', type: 'lastPairKind', checkAt: 'completion', kind: 5, label: '最后一对配对必须是鱼儿',
          itemRefs: Object.freeze([Object.freeze({ text: '鱼儿', kind: 5 })]) })
      ]),
      // Even counts as close to equal as possible: 8, 8, 8, 6, 6.
      layout: Object.freeze([
        2, 5, 5, 5, 1, 4,
        1, 2, 5, 0, 2, 4,
        2, 0, 4, 0, 2, 0,
        0, 1, 4, 5, 0, 5,
        1, 4, 2, 2, 2, 0,
        1, 1, 4, 0, 1, 1
      ])
    }),
    Object.freeze({
      id: 13,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze([14, 15, 20, 21]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不得超过20次' })
      ]),
      layout: Object.freeze([
        0, 0, 5, 4, 4, 1,
        2, 1, 4, 1, 0, 4,
        1, 1, 1, 0, 1, 2,
        2, 0, 2, 2, 5, 0,
        5, 2, 4, 5, 0, 2,
        4, 0, 5, 5, 2, 1
      ])
    }),
    Object.freeze({
      id: 14,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      randomize: true,
      // Fixed fog positions transcribed from the user's red-circle reference.
      fog: Object.freeze({ cells: Object.freeze([
        1, 4,
        7, 9,
        13, 14,
        19, 20,
        25, 27,
        31, 34
      ]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'last-crab', type: 'lastPairKind', checkAt: 'completion', kind: 1, label: '最后一对配对必须是螃蟹',
          itemRefs: Object.freeze([Object.freeze({ text: '螃蟹', kind: 1 })]) })
      ]),
      layout: Object.freeze([
        5, 0, 2, 2, 2, 0,
        4, 5, 0, 4, 2, 0,
        0, 5, 4, 2, 0, 2,
        1, 4, 1, 0, 0, 5,
        5, 4, 5, 4, 5, 5,
        0, 0, 2, 4, 4, 2
      ])
    }),
    Object.freeze({
      id: 15,
      type: 'fogJourney',
      rows: 7,
      columns: 7,
      duration: 60000,
      pairBonus: 0,
      previewDuration: 5000,
      start: 24,
      targetDuration: 15000,
      missPenalty: 20000,
      fog: Object.freeze({ cells: Object.freeze(Array.from({ length: 49 }, (_, i) => i)) }),
      treasures: Object.freeze([
        Object.freeze({ index: 1, kind: 0 }),
        Object.freeze({ index: 12, kind: 1 }),
        Object.freeze({ index: 21, kind: 2 }),
        Object.freeze({ index: 34, kind: 4 }),
        Object.freeze({ index: 45, kind: 5 })
      ]),
      // 0: walkable sand, -1: reef, -2: tidal pool.
      layout: Object.freeze([
         0,  0,  0,  0, -1,  0,  0,
         0, -1,  0,  0,  0,  0,  0,
         0, -1, -2,  0, -1, -2,  0,
         0,  0,  0,  0,  0,  0,  0,
         0, -2,  0,  0, -1,  0,  0,
         0,  0,  0, -1,  0,  0, -1,
        -1,  0,  0,  0,  0,  0,  0
      ])
    }),
    Object.freeze({
      id: 16,
      type: 'fogJourney',
      rows: 7,
      columns: 7,
      duration: 60000,
      pairBonus: 0,
      previewDuration: 5000,
      start: 24,
      noRevisit: true,
      targetDuration: 15000,
      missPenalty: 20000,
      fog: Object.freeze({ cells: Object.freeze(Array.from({ length: 49 }, (_, i) => i)) }),
      treasures: Object.freeze([
        Object.freeze({ index: 8, kind: 0 }),
        Object.freeze({ index: 12, kind: 1 }),
        Object.freeze({ index: 22, kind: 2 }),
        Object.freeze({ index: 36, kind: 4 }),
        Object.freeze({ index: 40, kind: 5 })
      ]),
      layout: Object.freeze([
        -1,  0,  0,  0,  0,  0, -1,
         0,  0,  0,  0,  0,  0,  0,
         0,  0, -1,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0, -2,  0,  0,
         0,  0,  0,  0,  0,  0,  0,
        -2,  0,  0,  0,  0,  0, -1
      ])
    }),
    Object.freeze({
      id: 17,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze([
        3, 4, 5, 9, 10, 11, 15, 16, 17,
        21, 22, 23, 27, 28, 29, 33, 34, 35
      ]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-tide', type: 'mismatchTideRise', checkAt: 'continuous', penalty: 3000, label: '配对失败会导致潮水上涨' })
      ]),
      layout: Object.freeze([
        2, 5, 0, 1, 4, 2,
        0, 1, 2, 5, 0, 4,
        4, 2, 1, 0, 5, 1,
        1, 0, 4, 2, 1, 5,
        5, 4, 2, 0, 2, 0,
        0, 1, 5, 4, 1, 2
      ])
    }),
    Object.freeze({
      id: 18,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      // Only the twelve red-circled cells from the user's reference are fogged.
      fog: Object.freeze({ cells: Object.freeze([
        2, 3, 7, 10, 14, 15, 19, 22, 25, 28, 32, 33
      ]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'three-pairs-in-five-seconds', type: 'timedPairs', checkAt: 'continuous', count: 3, window: 5000, label: '在5秒内完成3组配对' })
      ]),
      layout: Object.freeze([
        1, 4, 0, 2, 5, 1,
        2, 0, 1, 4, 2, 0,
        0, 5, 2, 1, 0, 4,
        5, 1, 5, 0, 2, 1,
        1, 2, 5, 4, 0, 2,
        4, 0, 1, 2, 4, 5
      ])
    }),
    Object.freeze({
      id: 19,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze([
        0, 1, 2,
        15, 16, 17,
        24, 25, 26
      ]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'penultimate-conch', type: 'pairKindFromEnd', checkAt: 'continuous', fromEnd: 2, kind: 4, label: '倒数第二对配对必须是海螺',
          itemRefs: Object.freeze([Object.freeze({ text: '海螺', kind: 4 })]) }),
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不得超过20次' })
      ]),
      layout: Object.freeze([
        4, 0, 1, 2, 4, 5,
        0, 5, 2, 1, 0, 4,
        1, 4, 0, 2, 5, 1,
        1, 2, 5, 4, 0, 2,
        2, 0, 1, 4, 2, 0,
        5, 1, 5, 0, 2, 1
      ])
    }),
    Object.freeze({
      id: 20,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze(Array.from({ length: 36 }, (_, index) => index)), duration: 5000 }),
      layout: Object.freeze([
        5, 0, 1, 4, 2, 0,
        1, 2, 0, 5, 1, 4,
        4, 1, 5, 0, 2, 1,
        0, 4, 2, 1, 0, 5,
        2, 4, 0, 5, 2, 1,
        5, 2, 1, 0, 4, 2
      ])
    }),
    Object.freeze({
      id: 21,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      intro: 'seagrass',
      seagrass: Object.freeze({ cells: Object.freeze([
        2, 5,
        7, 10,
        12, 15,
        20, 23,
        25, 28,
        30, 33
      ]) }),
      layout: Object.freeze([
        2, 5, 2, 0, 1, 2,
        4, 0, 0, 0, 5, 4,
        2, 1, 1, 2, 1, 0,
        4, 1, 4, 0, 1, 4,
        5, 2, 5, 0, 2, 4,
        1, 5, 5, 0, 2, 1
      ])
    })
  ]);
  if (typeof module !== 'undefined' && module.exports) module.exports = levels;
  else root.BeachLevels = levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
