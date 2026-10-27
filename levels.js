/* Authored, fixed level data. Each future level owns its layout and time budget. */
(function (root) {
  'use strict';
  const levels = Object.freeze([
    Object.freeze({
      id: 1,
      name: '初见浅湾',
      rows: 6,
      columns: 6,
      duration: 120000,
      layout: Object.freeze([
        0, 1, 2, 0, 3, 1,
        2, 3, 1, 2, 0, 3,
        1, 0, 3, 1, 2, 0,
        3, 2, 0, 3, 1, 2,
        0, 2, 1, 0, 3, 1,
        1, 3, 0, 2, 1, 0
      ])
    })
  ]);
  if (typeof module !== 'undefined' && module.exports) module.exports = levels;
  else root.BeachLevels = levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);
