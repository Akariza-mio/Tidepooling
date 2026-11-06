/* Authored layouts and item pools. Only levels marked randomize shuffle on entry. */
(function (root) {
  'use strict';
  const mathItem = kind => Object.freeze({ kind });
  const mathNumber = number => Object.freeze({ number });
  const mathOp = (op, left, right) => Object.freeze({ op, left, right });
  const mathRound = (values, clues, target) => Object.freeze({
    values: Object.freeze(values),
    clues: Object.freeze(clues.map(([terms, total]) => Object.freeze({
      terms: Object.freeze(terms.map(([kind, coefficient = 1]) => Object.freeze({ kind, coefficient }))), total
    }))), target
  });
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
      duration: 120000,
      pairBonus: 0,
      conditions: Object.freeze([
        Object.freeze({ id: 'no-pair-bonus', type: 'noPairBonus', checkAt: 'completion', label: '此关配对成功将不会奖励时间' })
      ]),
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
        4,
        9, 11,
        16,
        19,
        24, 26,
        31
      ]) }),
      layout: Object.freeze([
        5, 0, 1, 2, 5, 4,
        5, 0, 0, 1, 1, 0,
        0, 5, 0, 2, 1, 1,
        2, 2, 4, 4, 0, 5,
        2, 0, 5, 1, 2, 2,
        2, 1, 4, 1, 4, 4
      ])
    }),
    Object.freeze({
      id: 22,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
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
    }),
    Object.freeze({
      id: 23,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      seagrass: Object.freeze({ cells: Object.freeze([
        2, 8, 12, 13, 14, 15, 16, 17, 20, 26, 32
      ]) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'three-pairs-in-five-seconds', type: 'timedPairs', checkAt: 'continuous', count: 3, window: 5000, label: '在5秒内完成3次配对' })
      ]),
      layout: Object.freeze([
        2, 2, 1, 5, 2, 0,
        5, 2, 5, 4, 1, 0,
        5, 5, 4, 1, 0, 1,
        1, 2, 1, 0, 1, 2,
        4, 4, 0, 4, 1, 0,
        4, 2, 2, 0, 0, 5
      ])
    }),
    Object.freeze({
      id: 24,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      seagrass: Object.freeze({ cells: Object.freeze([7, 16, 26]) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'grass-limit', type: 'maxGrass', checkAt: 'continuous', limit: 10, label: '海草覆盖的格子不能超过10格' })
      ]),
      layout: Object.freeze([
        4, 2, 0, 0, 2, 1,
        1, 1, 1, 2, 1, 0,
        0, 5, 4, 5, 0, 5,
        4, 0, 1, 2, 4, 2,
        5, 0, 2, 5, 5, 1,
        1, 0, 4, 2, 2, 4
      ])
    }),
    Object.freeze({
      id: 25,
      type: 'grassPuzzle',
      rows: 5,
      columns: 5,
      duration: 60000,
      pairBonus: 0,
      rewards: Object.freeze([0, 1, 2, 4, 5]),
      // Generated from a clear board by reversible cross toggles. Fixed for replay.
      layout: Object.freeze([
        0, 1, 1, 1, 1,
        1, 1, 0, 1, 1,
        0, 1, 1, 0, 0,
        0, 0, 0, 0, 1,
        1, 0, 1, 0, 1
      ])
    }),
    Object.freeze({
      id: 26,
      type: 'grassPuzzle',
      rows: 5,
      columns: 5,
      duration: 60000,
      pairBonus: 0,
      rewards: Object.freeze([0, 1, 2, 4, 5]),
      conditions: Object.freeze([
        Object.freeze({ id: 'move-limit', type: 'maxTurns', checkAt: 'continuous', limit: 15, label: '总翻动次数不能超过15次' })
      ]),
      layout: Object.freeze([
        1, 1, 0, 0, 1,
        0, 1, 0, 0, 1,
        1, 0, 1, 0, 0,
        1, 1, 1, 1, 1,
        1, 1, 0, 1, 1
      ])
    }),
    Object.freeze({
      id: 27,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      newItem: Object.freeze({ kind: 3, name: '八爪鱼' }),
      seagrass: Object.freeze({ cells: Object.freeze([
        2, 3, 7, 10, 13, 16, 20, 21, 26, 27
      ]) }),
      layout: Object.freeze([
        1, 5, 4, 5, 2, 1,
        3, 3, 0, 4, 2, 1,
        2, 0, 5, 4, 0, 1,
        0, 2, 4, 1, 2, 5,
        3, 3, 5, 4, 0, 4,
        1, 3, 2, 5, 3, 0
      ])
    }),
    Object.freeze({
      id: 28,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不得超过20次' })
      ]),
      seagrass: Object.freeze({ cells: Object.freeze([
        3, 8, 9, 10, 13, 15, 17, 21, 27, 33
      ]) }),
      layout: Object.freeze([
        0, 0, 5, 1, 3, 2,
        0, 3, 4, 0, 4, 2,
        2, 3, 5, 0, 5, 1,
        1, 1, 4, 0, 3, 4,
        1, 4, 2, 2, 5, 1,
        3, 5, 5, 4, 3, 2
      ])
    }),
    Object.freeze({
      id: 29,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      seagrass: Object.freeze({ cells: Object.freeze([7, 10, 25, 28]) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'grass-harvest', type: 'minGrassMatches', checkAt: 'continuous', target: 10, label: '至少在10个海草格上完成配对' })
      ]),
      layout: Object.freeze([
        2, 1, 5, 0, 1, 0,
        2, 1, 2, 4, 5, 0,
        0, 4, 5, 4, 1, 2,
        5, 1, 0, 0, 2, 5,
        2, 1, 1, 2, 4, 0,
        5, 4, 1, 4, 2, 0
      ])
    }),
    Object.freeze({
      id: 30,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      seagrass: Object.freeze({ cells: Object.freeze([
        0, 1, 7, 8, 14, 15, 21, 22, 28, 29, 35
      ]) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-tide', type: 'mismatchTideRise', checkAt: 'continuous', penalty: 3000, label: '配对失败会导致潮水上涨' })
      ]),
      layout: Object.freeze([
        2, 4, 2, 0, 3, 1,
        1, 2, 5, 5, 4, 3,
        0, 3, 0, 3, 5, 2,
        4, 2, 1, 0, 1, 5,
        3, 4, 0, 1, 5, 3,
        4, 4, 2, 0, 1, 5
      ])
    }),
    Object.freeze({
      id: 31,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      intro: 'surf',
      surf: Object.freeze({ interval: 20000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 3000, axes: Object.freeze(['row', 'column']) }),
      layout: Object.freeze([
        4, 2, 0, 5, 1, 0,
        1, 5, 2, 0, 4, 2,
        0, 1, 4, 2, 5, 1,
        2, 4, 1, 0, 2, 5,
        5, 0, 2, 1, 4, 0,
        1, 2, 5, 4, 0, 1
      ])
    }),
    Object.freeze({
      id: 32,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 20000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 3000, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'three-pairs-in-five-seconds', type: 'timedPairs', checkAt: 'continuous', count: 3, window: 5000, label: '在5秒内完成3次配对' })
      ]),
      layout: Object.freeze([
        2, 3, 0, 4, 5, 2,
        2, 4, 2, 4, 3, 2,
        0, 2, 1, 0, 5, 5,
        5, 5, 0, 0, 3, 1,
        4, 4, 3, 1, 5, 0,
        1, 3, 1, 3, 1, 4
      ])
    }),
    Object.freeze({
      id: 33,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 3000, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不能超过20次' })
      ]),
      layout: Object.freeze([
        5, 0, 3, 3, 1, 1,
        2, 5, 4, 0, 2, 0,
        1, 0, 4, 5, 0, 1,
        1, 2, 2, 3, 4, 3,
        3, 3, 5, 4, 1, 4,
        2, 5, 0, 5, 2, 4
      ])
    }),
    Object.freeze({
      id: 34,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      intro: 'doubleSurf',
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 6000, targetCount: 2, axes: Object.freeze(['row', 'column']) }),
      layout: Object.freeze([
        1, 0, 1, 3, 2, 1,
        0, 5, 2, 3, 5, 3,
        1, 4, 5, 2, 0, 0,
        2, 5, 4, 4, 0, 3,
        4, 3, 1, 2, 5, 0,
        4, 5, 2, 1, 4, 3
      ])
    }),
    Object.freeze({
      id: 35,
      type: 'bucketSort',
      intro: 'bucketSort',
      rows: 2,
      columns: 3,
      duration: 60000,
      pairBonus: 0,
      capacity: 4,
      buckets: Object.freeze([
        Object.freeze([0, 1, 2, 4]), Object.freeze([1, 2, 4, 0]),
        Object.freeze([2, 4, 0, 1]), Object.freeze([4, 0, 1, 2]),
        Object.freeze([]), Object.freeze([])
      ]),
      layout: Object.freeze([0, 1, 2, 4, 1, 2, 4, 0, 2, 4, 0, 1, 4, 0, 1, 2])
    }),
    Object.freeze({
      id: 36,
      type: 'bucketSort',
      rows: 2,
      columns: 4,
      duration: 60000,
      pairBonus: 0,
      capacity: 4,
      buckets: Object.freeze([
        Object.freeze([0, 4, 1, 5]), Object.freeze([4, 1, 5, 2]),
        Object.freeze([1, 5, 2, 3]), Object.freeze([5, 2, 3, 0]),
        Object.freeze([2, 3, 0, 4]), Object.freeze([3, 0, 4, 1]),
        Object.freeze([]), Object.freeze([])
      ]),
      layout: Object.freeze([0, 4, 1, 5, 4, 1, 5, 2, 1, 5, 2, 3, 5, 2, 3, 0, 2, 3, 0, 4, 3, 0, 4, 1])
    }),
    Object.freeze({
      id: 37,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 6000, targetCount: 2, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'antepenultimate-octopus', type: 'pairKindFromEnd', checkAt: 'continuous', fromEnd: 3, kind: 3, label: '倒数第三对配对必须是八爪鱼',
          itemRefs: Object.freeze([Object.freeze({ text: '八爪鱼', kind: 3 })]) }),
        Object.freeze({ id: 'penultimate-conch', type: 'pairKindFromEnd', checkAt: 'continuous', fromEnd: 2, kind: 4, label: '倒数第二对配对必须是海螺',
          itemRefs: Object.freeze([Object.freeze({ text: '海螺', kind: 4 })]) })
      ]),
      layout: Object.freeze([
        4, 3, 1, 2, 2, 4,
        5, 4, 5, 2, 4, 0,
        2, 1, 2, 3, 5, 0,
        1, 4, 5, 1, 0, 5,
        2, 0, 5, 1, 3, 0,
        3, 3, 3, 1, 4, 0
      ])
    }),
    Object.freeze({
      id: 38,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 6000, targetCount: 2, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'two-pairs-in-two-seconds', type: 'timedPairs', checkAt: 'continuous', count: 2, window: 2000, label: '在2秒内完成2次配对' })
      ]),
      layout: Object.freeze([
        0, 2, 3, 1, 2, 4,
        4, 5, 5, 0, 0, 0,
        2, 3, 2, 5, 4, 5,
        4, 4, 2, 1, 0, 3,
        5, 4, 5, 3, 3, 3,
        2, 1, 0, 1, 1, 1
      ])
    }),
    Object.freeze({
      id: 39,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 6000, targetCount: 2, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 20, label: '配对失败的次数不能超过20次' })
      ]),
      layout: Object.freeze([
        1, 3, 2, 0, 3, 1,
        1, 5, 4, 3, 5, 5,
        0, 0, 5, 1, 4, 2,
        5, 4, 4, 3, 3, 1,
        4, 2, 0, 0, 4, 0,
        1, 2, 2, 5, 3, 2
      ])
    }),
    Object.freeze({
      id: 40,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 5000, targetCount: 3, axes: Object.freeze(['row', 'column']) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-tide-rise', type: 'mismatchTideRise', checkAt: 'complete', penalty: 3000, label: '配对失败会导致潮水上涨' })
      ]),
      layout: Object.freeze([
        1, 5, 1, 2, 2, 0,
        3, 5, 2, 1, 4, 2,
        0, 5, 0, 1, 3, 5,
        4, 3, 1, 2, 2, 0,
        4, 3, 3, 0, 4, 3,
        4, 5, 1, 5, 0, 4
      ])
    }),
    Object.freeze({
      id: 41,
      rows: 4,
      columns: 4,
      duration: 60000,
      pairBonus: 5000,
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-limit', type: 'maxMismatches', checkAt: 'continuous', limit: 1, label: '配对失败的次数不得超过1次' })
      ]),
      layout: Object.freeze([
        2, 4, 0, 1,
        1, 0, 4, 2,
        4, 2, 1, 0,
        0, 1, 2, 4
      ])
    }),
    Object.freeze({
      id: 42,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      conditions: Object.freeze([
        Object.freeze({ id: 'eighteen-pairs-in-fifteen-seconds', type: 'timedPairs', checkAt: 'continuous', count: 18, window: 15000, label: '在15秒内完成18次配对' })
      ]),
      layout: Object.freeze([
        1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1
      ])
    }),
    Object.freeze({
      id: 43,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze(Array.from({ length: 36 }, (_, index) => index)), duration: 5000 }),
      seagrass: Object.freeze({ cells: Object.freeze([9, 10, 14, 16, 18, 31]) }),
      layout: Object.freeze([
        0, 2, 1, 4, 0, 1,
        4, 1, 2, 0, 2, 4,
        2, 0, 4, 1, 1, 0,
        1, 4, 0, 2, 4, 2,
        0, 1, 2, 0, 1, 4,
        1, 0, 4, 2, 0, 1
      ])
    }),
    Object.freeze({
      id: 44,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      surf: Object.freeze({ interval: 15000, warning: 3000, arrival: 1000, duration: 5000, departure: 1200, penalty: 5000, firstWaveAt: 3000, targetCount: 1, targetIncrement: 1, axes: Object.freeze(['row', 'column']) }),
      layout: Object.freeze([
        2, 1, 5, 0, 4, 2,
        0, 4, 1, 2, 0, 5,
        1, 2, 0, 5, 1, 4,
        4, 0, 2, 1, 5, 0,
        2, 5, 4, 1, 0, 2,
        1, 0, 1, 4, 2, 5
      ])
    }),
    Object.freeze({
      id: 45,
      type: 'slotMachine',
      intro: 'slotMachine',
      rows: 8,
      columns: 8,
      duration: 120000,
      pairBonus: 0,
      kinds: Object.freeze([0, 1, 2, 4, 5]),
      reelStops: Object.freeze([500, 750, 1000]),
      deliveryDuration: 360,
      layout: Object.freeze([
        0, 4, 0, 0, 4, 1, 1, 2,
        0, 1, 1, 5, 5, 5, 0, 1,
        5, 2, 2, 2, 1, 1, 4, 5,
        2, 2, 2, 2, 4, 5, 1, 4,
        5, 4, 2, 5, 0, 0, 1, 2,
        4, 4, 5, 1, 2, 0, 0, 1,
        2, 4, 4, 5, 1, 5, 1, 4,
        0, 5, 0, 0, 0, 1, 4, 0
      ])
    }),
    Object.freeze({
      id: 46,
      type: 'arithmetic',
      rows: 1,
      columns: 1,
      duration: 120000,
      pairBonus: 0,
      wrongPenalty: 5000,
      layout: Object.freeze([]),
      rounds: Object.freeze([
        mathRound({1:5}, [[[[1,2]],10]], mathItem(1)),
        mathRound({2:6}, [[[[2,3]],18]], mathOp('+',mathItem(2),mathNumber(2))),
        mathRound({0:6,1:4}, [[[[0,2]],12],[[[0],[1]],10]], mathItem(1)),
        mathRound({4:7,2:5}, [[[[4,3]],21],[[[4],[2,2]],17]], mathOp('+',mathItem(4),mathItem(2))),
        mathRound({1:8,5:6}, [[[[1,2]],16],[[[1],[5,2]],20]], mathOp('+',mathOp('*',mathNumber(2),mathItem(1)),mathItem(5))),
        mathRound({0:6,2:5,4:4}, [[[[0,3]],18],[[[0],[2]],11],[[[2],[4]],9]], mathOp('+',mathOp('+',mathItem(0),mathItem(2)),mathItem(4))),
        mathRound({3:7,1:5,5:4}, [[[[3,2]],14],[[[1,2],[3]],17],[[[5],[1]],9]], mathOp('+',mathOp('+',mathItem(3),mathItem(1)),mathOp('*',mathNumber(2),mathItem(5)))),
        mathRound({2:5,4:6,0:4}, [[[[2,3]],15],[[[2],[4,2]],17],[[[4],[0]],10]], mathOp('+',mathOp('*',mathItem(2),mathItem(4)),mathItem(0))),
        mathRound({5:8,1:7,3:5}, [[[[5,2]],16],[[[5],[1]],15],[[[3,2],[1]],17]], mathOp('+',mathItem(5),mathOp('*',mathItem(1),mathItem(3)))),
        mathRound({1:6,2:5,4:4}, [[[[1,3]],18],[[[1],[2,2]],16],[[[2],[4]],9]], mathOp('*',mathOp('+',mathItem(1),mathItem(2)),mathItem(4)))
      ])
    }),
    Object.freeze({
      id: 47,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      seagrass: Object.freeze({ cells: Object.freeze([2, 8, 14, 20, 26, 32]) }),
      conditions: Object.freeze([
        Object.freeze({ id: 'mismatch-swap', type: 'mismatchSwap', label: '配对失败会使物品位置互换' })
      ]),
      layout: Object.freeze([
        4, 5, 3, 4, 5, 0,
        3, 2, 3, 3, 1, 4,
        1, 5, 5, 2, 1, 0,
        1, 2, 5, 2, 4, 4,
        1, 4, 3, 5, 0, 1,
        0, 0, 3, 2, 0, 2
      ])
    }),
    Object.freeze({
      id: 48,
      rows: 6,
      columns: 6,
      duration: 60000,
      pairBonus: 5000,
      fog: Object.freeze({ cells: Object.freeze([1, 3, 5, 6, 8, 10, 13, 15, 17, 18, 20, 22, 25, 27, 29, 30, 32, 34]), duration: 5000 }),
      conditions: Object.freeze([
        Object.freeze({ id: 'first-four-conches', type: 'firstPairsKind', checkAt: 'continuous', count: 4, kind: 4, label: '前四组配对必须是海螺', itemRefs: Object.freeze([Object.freeze({ text: '海螺', kind: 4 })]) })
      ]),
      layout: Object.freeze([
        4, 2, 5, 0, 5, 3,
        1, 4, 3, 0, 4, 3,
        1, 2, 3, 4, 2, 5,
        1, 0, 4, 2, 0, 1,
        1, 4, 2, 5, 0, 2,
        0, 3, 4, 1, 3, 4
      ])
    }),
    Object.freeze({
      id: 49,
      rows: 6,
      columns: 6,
      duration: 10000,
      pairBonus: 2000,
      startCountdown: 3000,
      layout: Object.freeze([
        0, 1, 1, 0, 0, 0,
        1, 4, 2, 4, 2, 0,
        4, 1, 1, 2, 2, 4,
        0, 4, 0, 0, 1, 4,
        0, 2, 2, 2, 0, 1,
        1, 2, 1, 4, 4, 1
      ])
    }),
    Object.freeze({
      id: 50,
      rows: 1,
      columns: 2,
      duration: 60000,
      untimed: true,
      pairBonus: 0,
      layout: Object.freeze([6, 6]),
      endingMessage: Object.freeze([
        '感谢你的时间和精力！',
        '此游戏是一个大学生拷问AI半个月得出的成果',
        '希望能让玩的人得到快乐，体会到一点我的小巧思',
        '特别感谢：开发时的测试者和为我提出建议的人',
        'and you.'
      ])
    })
  ]);
  if (typeof module !== 'undefined' && module.exports) module.exports = levels;
  else root.BeachLevels = levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
