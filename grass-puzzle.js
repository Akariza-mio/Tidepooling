/* Reversible cross toggles: clear every grass cell before the tide arrives. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class GrassPuzzle extends BaseGame {
    start(now) {
      super.start(now);
      this.cards = this.level.layout.map((value, index) => ({
        index, value, grass: Boolean(value), status: value ? 'grass' : 'clear',
        tangled: false, grassLockedUntil: null, fog: null
      }));
      this.lastAffected = [];
    }
    affected(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.cards.length) return [];
      const row = Math.floor(index / this.level.columns), column = index % this.level.columns;
      return this.cards.filter(card => Math.abs(Math.floor(card.index / this.level.columns) - row)
        + Math.abs(card.index % this.level.columns - column) <= 1).map(card => card.index);
    }
    select(index, now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning) return false;
      const affected = this.affected(index);
      if (!affected.length) return false;
      this.lastAffected = affected;
      for (const cellIndex of affected) {
        const card = this.cards[cellIndex];
        card.grass = !card.grass;
        card.value = Number(card.grass);
        card.status = card.grass ? 'grass' : 'clear';
      }
      this.turns++;
      this.version++;
      // A move-limit violation wins priority even if that move clears the board.
      if (this.conditionStates.some(condition => condition.failed)) {
        this.state = 'lost';
        this.failureReason = 'conditions';
      } else if (this.grassCount === 0) {
        this.state = this.conditionStates.every(condition => condition.completed) ? 'won' : 'lost';
        if (this.state === 'lost') this.failureReason = 'conditions';
      }
      return true;
    }
    clearFog() { return false; }
    get conditionStates() {
      return super.conditionStates.map(condition => {
        if (condition.type !== 'maxTurns') return condition;
        const failed = this.turns > condition.limit;
        return { ...condition, current: this.turns, completed: this.grassCount === 0 && !failed, failed };
      });
    }
    get grassCount() { return this.cards.filter(card => card.grass).length; }
    get totalPairs() { return 0; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = GrassPuzzle;
  else root.GrassPuzzle = GrassPuzzle;
})(typeof globalThis !== 'undefined' ? globalThis : this);
