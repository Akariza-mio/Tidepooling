/* Ten authored icon equations sharing one tide clock. No eval or runtime dependencies. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class ArithmeticGame extends BaseGame {
    start(now) {
      super.start(now);
      this.completed = 0;
      this.wrongAnswers = 0;
      this.feedback = 'ready';
    }
    update(now) {
      if (this.state === 'playing' && !this.timerRunning) { this.lastNow = now; return; }
      super.update(now);
    }
    static evaluate(node, values) {
      if ('kind' in node) return values[node.kind];
      if ('number' in node) return node.number;
      const a = ArithmeticGame.evaluate(node.left, values), b = ArithmeticGame.evaluate(node.right, values);
      if (node.op === '+') return a + b;
      if (node.op === '*') return a * b;
      throw new Error('Unsupported arithmetic operator');
    }
    get roundIndex() { return Math.min(this.completed, this.level.rounds.length - 1); }
    get round() { return this.level.rounds[this.roundIndex]; }
    get totalRounds() { return this.level.rounds.length; }
    submit(raw, now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning) return false;
      const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
      this.version++;
      if (!/^\d{1,3}$/.test(text)) { this.feedback = 'invalid'; return false; }
      this.turns++;
      if (Number(text) !== ArithmeticGame.evaluate(this.round.target, this.round.values)) {
        this.wrongAnswers++;
        this.feedback = 'wrong';
        this.elapsed = Math.min(this.duration + this.bonusTime, this.elapsed + this.level.wrongPenalty);
        if (this.remaining === 0) { this.state = 'lost'; this.failureReason = 'timeout'; }
        return false;
      }
      this.completed++;
      this.feedback = 'correct';
      if (this.completed === this.totalRounds) this.state = 'won';
      return true;
    }
    select() { return false; }
    clearFog() { return false; }
    get totalPairs() { return 0; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = ArithmeticGame;
  else root.ArithmeticGame = ArithmeticGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
