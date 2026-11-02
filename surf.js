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
          const axis = axes[Math.floor(this.random() * axes.length)];
          const size = axis === 'row' ? this.level.rows : this.level.columns;
          this.surfTarget = { axis, index: Math.floor(this.random() * size) };
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
          this.waveUntil = null;
          this.waveStartedAt = null;
          this.waveRetreatUntil = null;
        }
        this.version++;
      }
    }
    isWashed(index) {
      if (!['arriving', 'washing', 'retreating'].includes(this.surfPhase) || !this.surfTarget || !this.cards[index]) return false;
      return (this.surfTarget.axis === 'row' ? Math.floor(index / this.level.columns) : index % this.level.columns) === this.surfTarget.index;
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
