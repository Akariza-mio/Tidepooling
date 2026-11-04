/* Scheduled surf uses active play time, independent of tide rewards and penalties. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class SurfGame extends BaseGame {
    start(now) {
      super.start(now);
      this.surfTime = 0;
      this.surfPhase = 'calm';
      this.surfTarget = null;
      this.surfTargets = [];
      this.nextWaveAt = this.level.surf.interval;
      this.waveStartedAt = null;
      this.waveUntil = null;
      this.waveRetreatUntil = null;
      this.waveCount = 0;
    }
    update(now) {
      if (this.state !== 'playing') return;
      if (!this.timerRunning) { super.update(now); return; }
      const targetNow = Math.max(this.lastNow, now);
      // Visit every warning, arrival and retreat in order, even after a long frame.
      while (this.lastNow < targetNow && this.state === 'playing') {
        const boundary = this.surfPhase === 'arriving' ? this.waveStartedAt + this.level.surf.arrival
          : this.surfPhase === 'washing' ? this.waveUntil
          : this.surfPhase === 'retreating' ? this.waveRetreatUntil
          : this.surfPhase === 'warning' ? this.nextWaveAt : this.nextWaveAt - this.level.surf.warning;
        const step = Math.min(targetNow - this.lastNow, Math.max(0, boundary - this.surfTime), this.remaining);
        super.update(this.lastNow + step);
        this.surfTime += step;
        if (this.state !== 'playing' || this.surfTime < boundary) continue;
        if (this.surfPhase === 'calm') {
          const axes = this.level.surf.axes;
          const targetCount = (this.level.surf.targetCount ?? 1) + (this.level.surf.targetIncrement ?? 0) * this.waveCount;
          if (targetCount > 1) {
            const pool = axes.flatMap(axis => Array.from({ length: axis === 'row' ? this.level.rows : this.level.columns }, (_, index) => ({ axis, index })));
            this.surfTargets = [];
            for (let i = 0; i < targetCount && pool.length; i++) {
              this.surfTargets.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
            }
          } else {
            // Keep the single-line draw unchanged for the first three levels.
            const axis = axes[Math.floor(this.random() * axes.length)];
            const size = axis === 'row' ? this.level.rows : this.level.columns;
            this.surfTargets = [{ axis, index: Math.floor(this.random() * size) }];
          }
          this.surfTarget = this.surfTargets[0];
          this.surfPhase = 'warning';
        } else if (this.surfPhase === 'warning') {
          this.surfPhase = 'arriving';
          this.waveStartedAt = this.nextWaveAt;
          this.waveUntil = this.waveStartedAt + this.level.surf.arrival + this.level.surf.duration;
          this.waveRetreatUntil = this.waveUntil + this.level.surf.departure;
          this.nextWaveAt += this.level.surf.interval;
          this.waveCount++;
          this.elapsed = Math.min(this.duration + this.bonusTime, this.elapsed + this.level.surf.penalty);
          if (this.remaining <= 0) {
            this.state = 'lost';
            this.failureReason = 'timeout';
            this.pending = null;
          }
        } else if (this.surfPhase === 'arriving') {
          this.surfPhase = 'washing';
        } else if (this.surfPhase === 'washing') {
          this.surfPhase = 'retreating';
        } else {
          this.surfPhase = 'calm';
          this.surfTarget = null;
          this.surfTargets = [];
          this.waveUntil = null;
          this.waveStartedAt = null;
          this.waveRetreatUntil = null;
        }
        this.version++;
      }
    }
    isWashed(index) {
      if (!['arriving', 'washing', 'retreating'].includes(this.surfPhase) || !this.cards[index]) return false;
      return this.surfTargets.some(target => (target.axis === 'row' ? Math.floor(index / this.level.columns) : index % this.level.columns) === target.index);
    }
    select(index, now) {
      this.update(now);
      if (!this.timerRunning || this.isWashed(index)) return false;
      return super.select(index, now);
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = SurfGame;
  else root.SurfGame = SurfGame;
})(typeof globalThis !== 'undefined' ? globalThis : this);
