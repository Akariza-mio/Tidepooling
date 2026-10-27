/* Pure game rules. Works both directly in a browser and in Node verification. */
(function (root) {
  'use strict';
  const levels = typeof module !== 'undefined' && module.exports ? require('./levels.js') : root.BeachLevels;
  class MemoryGame {
    constructor(options = {}) {
      this.level = options.level ?? levels[0];
      this.duration = options.duration ?? this.level.duration;
      this.revealDuration = options.revealDuration ?? 500;
      this.state = 'idle';
      this.cards = [];
      this.elapsed = 0;
      this.pairs = 0;
      this.turns = 0;
      this.selected = [];
      this.pending = null;
      this.version = 0;
    }
    start(now) {
      this.cards = this.level.layout.map((value, index) => ({ index, value, status: 'hidden' }));
      this.state = 'playing';
      this.elapsed = this.pairs = this.turns = 0;
      this.selected = [];
      this.pending = null;
      this.lastNow = now;
      this.version++;
    }
    update(now) {
      if (this.state !== 'playing') return;
      this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, now - this.lastNow));
      this.lastNow = now;
      if (this.elapsed >= this.duration) {
        this.state = 'lost';
        this.pending = null;
        this.version++;
        return;
      }
      if (this.pending && this.elapsed >= this.pending.at) {
        this.selected.forEach(index => { this.cards[index].status = 'hidden'; });
        this.selected = [];
        this.pending = null;
        this.version++;
      }
    }
    select(index, now) {
      this.update(now);
      const card = this.cards[index];
      if (this.state !== 'playing' || this.pending || !card || card.status !== 'hidden') return false;
      card.status = 'open';
      this.selected.push(index);
      this.version++;
      if (this.selected.length === 2) {
        this.turns++;
        const [a, b] = this.selected.map(i => this.cards[i]);
        if (a.value === b.value) {
          a.status = b.status = 'matched';
          this.pairs++;
          this.selected = [];
          if (this.pairs === this.cards.length / 2) this.state = 'won';
        } else {
          this.pending = { at: this.elapsed + this.revealDuration };
        }
      }
      return true;
    }
    pause(now) {
      this.update(now);
      if (this.state !== 'playing') return false;
      this.state = 'paused';
      this.version++;
      return true;
    }
    resume(now) {
      if (this.state !== 'paused') return;
      this.lastNow = now;
      this.state = 'playing';
      this.version++;
    }
    get progress() { return Math.min(1, this.elapsed / this.duration); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = MemoryGame;
  else root.MemoryGame = MemoryGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
