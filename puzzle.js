/* Diagonal picture puzzle: rows, columns and the two full diagonals only. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class DiagonalPuzzle extends BaseGame {
    start(now) {
      super.start(now);
      this.cards = this.level.layout.map((value, index) => ({ index, value, fixed: value !== null, status: value === null ? 'empty' : 'fixed' }));
    }
    // A filling puzzle never runs the pair-selection or pair-bonus rules.
    select() { return false; }
    place(index, value, now) {
      this.update(now);
      const cell = this.cards[index];
      if (this.state !== 'playing' || !cell || cell.fixed || (value !== null && !this.level.kinds.includes(value)) || cell.value === value) return false;
      cell.value = value;
      cell.status = value === null ? 'empty' : 'filled';
      this.turns++;
      this.version++;
      if (this.filledCount === this.cards.length && this.conflicts.size === 0) this.state = 'won';
      return true;
    }
    get totalPairs() { return 0; }
    get filledCount() { return this.cards.filter(cell => cell.value !== null).length; }
    get lines() {
      const size = this.level.rows;
      const lines = [];
      for (let row = 0; row < size; row++) lines.push(Array.from({ length: size }, (_, column) => row * size + column));
      for (let column = 0; column < size; column++) lines.push(Array.from({ length: size }, (_, row) => row * size + column));
      lines.push(Array.from({ length: size }, (_, i) => i * size + i));
      lines.push(Array.from({ length: size }, (_, i) => i * size + size - 1 - i));
      return lines;
    }
    get conflicts() {
      const conflicts = new Set();
      for (const line of this.lines) {
        const occurrences = new Map();
        for (const index of line) {
          const value = this.cards[index].value;
          if (value === null) continue;
          if (!occurrences.has(value)) occurrences.set(value, []);
          occurrences.get(value).push(index);
        }
        for (const indices of occurrences.values()) if (indices.length > 1) indices.forEach(index => conflicts.add(index));
      }
      return conflicts;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = DiagonalPuzzle;
  else root.DiagonalPuzzle = DiagonalPuzzle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
