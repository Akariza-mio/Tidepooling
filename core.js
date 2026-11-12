/* Pure game rules. Works both directly in a browser and in Node verification. */
(function (root) {
  'use strict';
  const levels = typeof module !== 'undefined' && module.exports ? require('./levels.js') : root.BeachLevels;
  class MemoryGame {
    constructor(options = {}) {
      this.level = options.level ?? levels[0];
      this.duration = options.duration ?? this.level.duration;
      this.pairBonus = options.pairBonus ?? this.level.pairBonus ?? 5000;
      this.revealDuration = options.revealDuration ?? 500;
      this.random = options.random ?? Math.random;
      this.state = 'idle';
      this.countdownRemaining = 0;
      this.cards = [];
      this.elapsed = 0;
      this.activeTime = 0;
      this.playStartedAt = 0;
      this.timerRunning = true;
      this.bonusTime = 0;
      this.pairs = 0;
      this.turns = 0;
      this.mismatches = 0;
      this.grassMatches = 0;
      this.pairTimes = [];
      this.pairKinds = [];
      this.selected = [];
      this.pending = null;
      this.version = 0;
      this.lastMatchedKind = null;
      this.winRemaining = null;
      this.failureReason = null;
    }
    start(now) {
      const layout = [...this.level.layout];
      if (this.level.randomize) {
        for (let i = layout.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [layout[i], layout[j]] = [layout[j], layout[i]];
        }
      }
      this.cards = layout.map((value, index) => {
        const row = Math.floor(index / this.level.columns), column = index % this.level.columns;
        const fog = this.level.fog && (this.level.fog.cells ? this.level.fog.cells.includes(index) : this.level.fog.shape === 'perimeter'
          ? row === 0 || row === this.level.rows - 1 || column === 0 || column === this.level.columns - 1
          : row < this.level.fog.rows);
        return { index, value, status: 'hidden', tangled: Boolean(this.level.seagrass?.cells.includes(index)), grassLockedUntil: null, fog: fog ? { covered: true, until: null } : null };
      });
      this.state = 'playing';
      this.elapsed = this.bonusTime = this.pairs = this.turns = 0;
      this.mismatches = 0;
      this.grassMatches = 0;
      this.pairTimes = [];
      this.pairKinds = [];
      this.activeTime = 0;
      this.playStartedAt = 0;
      this.countdownRemaining = this.level.startCountdown ?? 0;
      this.timerRunning = this.countdownRemaining === 0 && !this.level.untimed;
      this.lastMatchedKind = null;
      this.winRemaining = null;
      this.failureReason = null;
      this.selected = [];
      this.pending = null;
      this.lastNow = now;
      this.version++;
    }
    update(now) {
      if (this.state !== 'playing') return;
      let delta = Math.max(0, now - this.lastNow);
      if (this.countdownRemaining > 0) {
        const seconds = Math.ceil(this.countdownRemaining / 1000);
        const preparation = Math.min(delta, this.countdownRemaining);
        this.countdownRemaining -= preparation;
        delta -= preparation;
        if (this.countdownRemaining === 0) this.timerRunning = !this.level.untimed;
        if (Math.ceil(this.countdownRemaining / 1000) !== seconds) this.version++;
      }
      this.activeTime += delta;
      if (this.timerRunning && !this.level.untimed) this.elapsed = Math.min(this.duration + this.bonusTime, this.elapsed + delta);
      this.lastNow = now;
      if (this.remaining <= 0) {
        this.state = 'lost';
        this.failureReason = 'timeout';
        this.pending = null;
        this.version++;
        return;
      }
      for (const card of this.cards) {
        if (card.grassLockedUntil !== null && this.activeTime >= card.grassLockedUntil) {
          card.grassLockedUntil = null;
          this.version++;
        }
        if (card.fog && !card.fog.covered && this.activeTime >= card.fog.until) {
          card.fog.covered = true;
          card.fog.until = null;
          this.version++;
        }
      }
      if (this.pending && this.activeTime >= this.pending.at) {
        if (this.conditions.some(condition => condition.type === 'mismatchSwap')) {
          const [a, b] = this.selected.map(index => this.cards[index]);
          [a.value, b.value] = [b.value, a.value];
        }
        this.selected.forEach(index => { this.cards[index].status = 'hidden'; });
        this.selected = [];
        this.pending = null;
        this.version++;
      }
    }
    select(index, now) {
      this.update(now);
      const card = this.cards[index];
      if (this.state !== 'playing' || this.countdownRemaining > 0 || this.pending || !card || this.isGrassLocked(card) || card.fog?.covered || card.status !== 'hidden') return false;
      card.status = 'open';
      this.selected.push(index);
      this.version++;
      if (this.selected.length === 2) {
        this.turns++;
        const [a, b] = this.selected.map(i => this.cards[i]);
        if (a.value === b.value) {
          // Count each successfully collected grass cell, including new growth.
          this.grassMatches += Number(a.tangled) + Number(b.tangled);
          a.status = b.status = 'matched';
          this.pairs++;
          this.pairTimes.push(this.activeTime);
          this.pairKinds.push(a.value);
          this.lastMatchedKind = a.value;
          const remainingBeforeReward = this.remaining;
          // Discard overflow now, so repeated matches cannot bank invisible time
          // beneath the lowest tide level. Each level uses its own time limit.
          this.bonusTime += Math.min(this.pairBonus, Math.max(0, this.elapsed - this.bonusTime));
          this.selected = [];
          if (this.conditionStates.some(condition => condition.checkAt === 'continuous' && condition.failed)) {
            this.state = 'lost';
            this.failureReason = 'conditions';
          } else if (this.pairs === this.totalPairs) {
            this.state = this.conditionStates.every(condition => condition.completed) ? 'won' : 'lost';
            if (this.state === 'won') this.winRemaining = remainingBeforeReward;
            if (this.state === 'lost') this.failureReason = 'conditions';
          }
        } else {
          this.mismatches++;
          // Snapshot the two original grass cells so newly spread grass does not
          // cascade or retroactively lock a normal cell in this same mismatch.
          const sources = [a, b].filter(card => card.tangled);
          for (const source of sources) {
            source.grassLockedUntil = this.activeTime + 10000;
            for (const neighbor of this.cards) if (!neighbor.tangled && neighbor.status === 'hidden'
              && !this.isGrassLocked(neighbor) &&
              Math.abs(Math.floor(source.index / this.level.columns) - Math.floor(neighbor.index / this.level.columns))
              + Math.abs(source.index % this.level.columns - neighbor.index % this.level.columns) === 1) neighbor.tangled = true;
          }
          const penalty = this.conditions.reduce((total, condition) => total + (condition.type === 'mismatchTideRise' ? condition.penalty : 0), 0);
          this.elapsed = Math.min(this.duration + this.bonusTime, this.elapsed + penalty);
          if (this.conditionStates.some(condition => condition.failed)) {
            this.state = 'lost';
            this.failureReason = 'conditions';
            this.pending = null;
          } else if (this.remaining <= 0) {
            this.state = 'lost';
            this.failureReason = 'timeout';
            this.pending = null;
          } else this.pending = { at: this.activeTime + this.revealDuration };
        }
      }
      return true;
    }
    isGrassLocked(card) { return Boolean(card && card.grassLockedUntil !== null && this.activeTime < card.grassLockedUntil); }
    clearFog(index, now) {
      this.update(now);
      const card = this.cards[index];
      if (this.state !== 'playing' || !this.timerRunning || !card?.fog?.covered) return false;
      card.fog.covered = false;
      card.fog.until = this.activeTime + this.level.fog.duration;
      this.version++;
      return true;
    }
    pause(now) {
      this.update(now);
      if (this.state !== 'playing') return false;
      this.state = 'paused';
      this.version++;
      return true;
    }
    setTimerRunning(running, now) {
      this.update(now);
      if (running && !this.timerRunning && !this.level.untimed) this.playStartedAt = this.activeTime;
      this.timerRunning = running && !this.level.untimed;
      this.version++;
    }
    resume(now) {
      if (this.state !== 'paused') return;
      this.lastNow = now;
      this.state = 'playing';
      this.version++;
    }
    get conditions() { return this.level.conditions ?? []; }
    get conditionStates() {
      const allCollected = this.pairs === this.totalPairs && this.totalPairs > 0;
      return this.conditions.map(condition => {
        if (condition.type === 'firstPairsKind') {
          const first = this.pairKinds.slice(0, condition.count);
          const failed = first.some(kind => kind !== condition.kind);
          return { ...condition, current: first.length, completed: first.length === condition.count && !failed, failed };
        }
        if (condition.type === 'pairKindFromEnd') {
          const index = this.totalPairs - condition.fromEnd;
          const completed = index >= 0 && this.pairKinds[index] === condition.kind;
          return { ...condition, completed, failed: allCollected && !completed };
        }
        if (condition.type === 'timedPairs') {
          const completed = this.pairTimes.some((time, index) => index + condition.count <= this.pairTimes.length
            && this.pairTimes[index + condition.count - 1] - time <= condition.window);
          return { ...condition, completed, failed: allCollected && !completed };
        }
        if (condition.type === 'mismatchTideRise' || condition.type === 'mismatchSwap') return { ...condition, completed: allCollected, failed: false };
        if (condition.type === 'noPairBonus') return { ...condition, completed: allCollected && this.bonusTime === 0, failed: this.bonusTime > 0 };
        if (condition.type === 'minGrassMatches') {
          const completed = this.grassMatches >= condition.target;
          return { ...condition, current: this.grassMatches, completed, failed: allCollected && !completed };
        }
        if (condition.type === 'maxGrass') {
          // Open and temporarily locked grass still belongs to the board;
          // collected holes never count toward the spreading-grass limit.
          const current = this.cards.filter(card => card.tangled && card.status !== 'matched').length;
          const failed = current > condition.limit;
          return { ...condition, current, completed: allCollected && !failed, failed };
        }
        if (condition.type === 'maxMismatches') {
          const failed = this.mismatches > condition.limit;
          return { ...condition, current: this.mismatches, completed: allCollected && !failed, failed };
        }
        // Unknown future conditions remain unmet until their evaluator is added.
        const completed = condition.type === 'lastPairKind' && allCollected && this.lastMatchedKind === condition.kind;
        return { ...condition, completed, failed: allCollected && !completed };
      });
    }
    get totalPairs() { return this.level.layout.length / 2; }
    get remaining() { return Math.max(0, Math.min(this.duration, this.duration + this.bonusTime - this.elapsed)); }
    get progress() { return Math.max(0, Math.min(1, 1 - this.remaining / this.duration)); }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = MemoryGame;
  else root.MemoryGame = MemoryGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
