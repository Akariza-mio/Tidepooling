/* Manual memory matches earn pulls; random rewards clear complete pairs, never more pulls. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class SlotMachine extends BaseGame {
    start(now) {
      super.start(now);
      this.reels = this.level.kinds.slice(0, 3);
      this.phase = 'idle';
      this.hasSpun = false;
      this.noRewardStreak = 0;
      this.fiveNoRewardPulls = false;
      this.credits = 0;
      this.manualPairs = 0;
      this.autoPairs = 0;
      this.spinStartedAt = null;
      this.matchAt = null;
      this.result = null;
      this.outcome = null;
      this.feedback = 'ready';
    }
    spin(now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning || this.phase !== 'idle' || this.credits < 1 || this.pending || this.selected.length) return false;
      this.credits--;
      this.outcome = Array.from({ length: 3 }, () => this.level.kinds[Math.floor(this.random() * this.level.kinds.length)]);
      this.spinStartedAt = this.activeTime;
      this.phase = 'spinning';
      this.feedback = 'spinning';
      this.result = null;
      this.hasSpun = true;
      this.version++;
      return true;
    }
    update(now) {
      if (this.state !== 'playing') return;
      if (!this.timerRunning) { this.lastNow = now; return; }
      const before = this.animationKey;
      const targetNow = Math.max(this.lastNow, now);
      // Resolve scheduled stops and deliveries before later deadlines, even in a long frame.
      while (this.lastNow < targetNow && this.state === 'playing') {
        const boundary = this.phase === 'spinning' ? this.spinStartedAt + this.level.reelStops[2]
          : this.phase === 'matching' ? this.matchAt : Infinity;
        const step = Math.min(targetNow - this.lastNow, Math.max(0, boundary - this.activeTime), this.remaining);
        super.update(this.lastNow + step);
        if (this.state !== 'playing') {
          if (this.phase === 'matching') this.result.indices.forEach(index => { this.cards[index].status = 'hidden'; });
          this.phase = 'idle';
          this.outcome = null;
          this.feedback = 'timeout';
          break;
        }
        if (this.activeTime < boundary) continue;
        if (this.phase === 'spinning') {
          this.reels = [...this.outcome];
          const kind = this.reels.find(kind => this.reels.filter(value => value === kind).length >= 2);
          const multiplicity = kind === undefined ? 0 : this.reels.filter(value => value === kind).length;
          const candidates = this.cards.filter(card => card.value === kind && card.status === 'hidden');
          const indices = (multiplicity === 3 ? candidates : candidates.slice(0, 2)).map(card => card.index);
          this.result = { kind: kind ?? null, multiplicity, indices, count: indices.length };
          this.noRewardStreak = indices.length ? 0 : Math.min(5, this.noRewardStreak + 1);
          if (this.noRewardStreak === 5) this.fiveNoRewardPulls = true;
          if (indices.length) {
            indices.forEach(index => { this.cards[index].status = 'open'; });
            this.phase = 'matching';
            this.matchAt = boundary + this.level.deliveryDuration;
            this.feedback = multiplicity === 3 ? 'triple' : 'pair';
          } else {
            this.phase = 'idle';
            this.feedback = multiplicity ? 'empty' : 'miss';
          }
        } else if (this.phase === 'matching') {
          this.result.indices.forEach(index => { this.cards[index].status = 'matched'; });
          const pairs = this.result.count / 2;
          this.autoPairs += pairs;
          this.pairs += pairs;
          for (let i = 0; i < pairs; i++) { this.pairTimes.push(this.activeTime); this.pairKinds.push(this.result.kind); }
          this.lastMatchedKind = this.result.kind;
          this.phase = 'idle';
          if (this.pairs === this.totalPairs) { this.state = 'won'; this.feedback = 'won'; }
        }
        this.version++;
      }
      if (before !== this.animationKey) this.version++;
    }
    get displayReels() {
      if (this.phase !== 'spinning') return [...this.reels];
      const elapsed = this.activeTime - this.spinStartedAt;
      return this.reels.map((_, index) => elapsed >= this.level.reelStops[index] ? this.outcome[index]
        : this.level.kinds[(index + Math.floor(elapsed / 80)) % this.level.kinds.length]);
    }
    get stoppedReels() { return this.reels.map((_, index) => this.phase !== 'spinning' || this.activeTime - this.spinStartedAt >= this.level.reelStops[index]); }
    get matchProgress() { return this.phase === 'matching' ? Math.min(1, Math.max(0, 1 - (this.matchAt - this.activeTime) / this.level.deliveryDuration)) : 0; }
    get animationKey() { return `${this.phase}:${this.displayReels.join(',')}:${this.stoppedReels.join(',')}:${Math.floor(this.matchProgress * 20)}`; }
    select(index, now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning || this.phase !== 'idle') return false;
      const before = this.pairs;
      const accepted = super.select(index, now);
      if (this.pairs > before) {
        this.manualPairs++;
        this.credits++;
        this.result = null;
        this.feedback = this.state === 'won' ? 'won' : 'earned';
        this.version++;
      } else if (accepted) {
        this.feedback = this.pending ? 'mismatch' : 'ready';
      }
      return accepted;
    }
    get collectedCount() { return this.pairs * 2; }
    get totalItems() { return this.cards.length; }
    clearFog() { return false; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SlotMachine;
  else root.SlotMachine = SlotMachine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
