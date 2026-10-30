/* Cross-shaped fog search: independent tide and target clocks share active play time. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class FogJourney extends BaseGame {
    start(now) {
      super.start(now);
      this.position = this.level.start;
      this.visited = new Set([this.position]);
      this.walkNeighbors = this.cards.map(card => [card.index - this.level.columns, card.index + this.level.columns, card.index - 1, card.index + 1]
        .filter(index => index >= 0 && index < this.cards.length && this.cards[index].value === 0
          && Math.abs(Math.floor(index / this.level.columns) - Math.floor(card.index / this.level.columns)) + Math.abs(index % this.level.columns - card.index % this.level.columns) === 1));
      this.phase = 'intro';
      this.timerRunning = false;
      this.previewElapsed = 0;
      this.collected = new Set();
      this.target = null;
      this.targetElapsed = 0;
      this.targetHistory = [];
      this.penalties = 0;
      this.penaltyUntil = -1;
      this.wrongKind = null;
      this.feedback = '先观察五种物品和障碍的位置';
      this.cards.forEach(card => { card.fog = { covered: false, until: Infinity }; });
      this.refreshVisibility();
    }
    select() { return false; }
    clearFog() { return false; }
    beginPreview(now) {
      if (this.state !== 'playing' || this.phase !== 'intro') return false;
      this.update(now);
      this.phase = 'preview';
      this.previewElapsed = 0;
      this.lastNow = now;
      this.version++;
      return true;
    }
    update(now) {
      if (this.state !== 'playing') return;
      let delta = Math.max(0, now - this.lastNow);
      this.lastNow = Math.max(this.lastNow, now);
      const targetSeconds = Math.ceil(this.targetRemaining / 1000);
      const penaltyActive = this.penaltyActive;
      if (this.phase === 'preview') {
        const before = this.previewSeconds;
        const used = Math.min(delta, this.level.previewDuration - this.previewElapsed);
        this.previewElapsed += used;
        this.activeTime += used;
        delta -= used;
        if (this.previewElapsed >= this.level.previewDuration) {
          this.phase = 'exploring';
          this.timerRunning = true;
          this.feedback = '按上方目标寻找，只能碰当前要求的物品';
          this.nextTarget();
          this.refreshVisibility();
        } else if (before !== this.previewSeconds) this.version++;
      }
      // Process deadlines chronologically, so a long frame cannot skip a penalty.
      while (this.phase === 'exploring' && this.state === 'playing' && delta > 0) {
        const step = Math.min(delta, this.targetRemaining, this.remaining);
        this.activeTime += step;
        this.elapsed += step;
        this.targetElapsed += step;
        delta -= step;
        if (this.remaining <= 0) this.timeout();
        else if (this.targetRemaining <= 0) {
          this.penalties++;
          this.elapsed = Math.min(this.duration + this.bonusTime, this.elapsed + this.level.missPenalty);
          this.penaltyUntil = this.activeTime + 1200;
          this.feedback = '未找到目标，潮水上涨 20 秒';
          this.version++;
          if (this.remaining <= 0) this.timeout();
          else this.nextTarget();
        }
      }
      if (targetSeconds !== Math.ceil(this.targetRemaining / 1000) || penaltyActive !== this.penaltyActive) this.version++;
    }
    timeout() {
      this.state = 'lost';
      this.failureReason = 'timeout';
      this.version++;
    }
    nextTarget() {
      const remaining = this.level.treasures.filter(item => !this.collected.has(item.index));
      let choices = remaining.length > 1 ? remaining.filter(item => item.kind !== this.target?.kind) : remaining;
      if (this.level.noRevisit) {
        const viable = choices.filter(item => this.completionRoute(item.index) !== null);
        // A player's route can close itself off; never force an impossible target
        // when another choice still has a full non-repeating completion route.
        if (viable.length) choices = viable;
        else if (this.target && remaining.some(item => item.index === this.target.index) && this.completionRoute(this.target.index) !== null) choices = [this.target];
      }
      this.target = choices.length ? choices[Math.floor(this.random() * choices.length)] : null;
      this.targetElapsed = 0;
      // When only the final item remains, continue it rather than draw a duplicate.
      if (this.target && this.targetHistory.at(-1) !== this.target.kind) this.targetHistory.push(this.target.kind);
      this.version++;
    }
    isAdjacent(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.cards.length) return false;
      const columns = this.level.columns;
      return Math.abs(Math.floor(index / columns) - Math.floor(this.position / columns))
        + Math.abs(index % columns - this.position % columns) === 1;
    }
    isSpent(index) { return Boolean(this.level.noRevisit && this.visited.has(index) && index !== this.position); }
    completionRoute(firstIndex) {
      const items = this.level.treasures.filter(item => !this.collected.has(item.index));
      const itemBits = new Map(items.map((item, i) => [item.index, 1 << i]));
      const cellBits = this.cards.map(card => 1n << BigInt(card.index));
      let used = 0n;
      for (const index of this.visited) used |= cellBits[index];
      const all = (1 << items.length) - 1, failed = new Set(), route = [];
      const distance = (a, b) => Math.abs(Math.floor(a / this.level.columns) - Math.floor(b / this.level.columns)) + Math.abs(a % this.level.columns - b % this.level.columns);
      const search = (at, mask, pending) => {
        if (!pending) return [...route];
        const key = at + ':' + pending + ':' + mask.toString(36);
        if (failed.has(key)) return null;
        const reachable = new Set([at]), queue = [at];
        for (const cell of queue) for (const next of this.walkNeighbors[cell]) {
          if ((mask & cellBits[next]) || reachable.has(next)) continue;
          reachable.add(next); queue.push(next);
        }
        if (items.some(item => (pending & itemBits.get(item.index)) && !reachable.has(item.index))) return null;
        const wanted = (pending & itemBits.get(firstIndex)) ? firstIndex : null;
        const goals = wanted === null ? items.filter(item => pending & itemBits.get(item.index)).map(item => item.index) : [wanted];
        const candidates = this.walkNeighbors[at].filter(next => !(mask & cellBits[next])
          && (!(pending & (itemBits.get(next) || 0)) || wanted === null || next === wanted));
        candidates.sort((a, b) => Math.min(...goals.map(goal => distance(a, goal))) - Math.min(...goals.map(goal => distance(b, goal))));
        for (const next of candidates) {
          route.push(next);
          const answer = search(next, mask | cellBits[next], pending & ~(itemBits.get(next) || 0));
          if (answer) return answer;
          route.pop();
        }
        failed.add(key);
        return null;
      };
      return search(this.position, used, all);
    }
    move(index, now) {
      this.update(now);
      if (this.state !== 'playing' || this.phase !== 'exploring' || !this.isAdjacent(index)) return false;
      if (this.isSpent(index)) {
        this.feedback = '灰色格子已经走过，不能再次踏入';
        this.version++;
        return false;
      }
      if (this.cards[index].value < 0) {
        this.feedback = this.cards[index].value === -1 ? '前面是礁石，换一条路吧' : '这里有潮池，从旁边绕过去吧';
        this.version++;
        return false;
      }
      this.position = index;
      this.visited.add(index);
      this.turns++;
      const treasure = this.level.treasures.find(item => item.index === index);
      if (treasure && !this.collected.has(index)) {
        if (treasure.kind !== this.target?.kind) {
          this.state = 'lost';
          this.failureReason = 'wrongTarget';
          this.wrongKind = treasure.kind;
          this.feedback = '碰到了其他物品，本次挑战结束';
        } else {
          this.collected.add(index);
          if (this.collectedCount === this.totalTreasures) {
            this.state = 'won';
            this.phase = 'complete';
            this.target = null;
            this.feedback = '五种物品全部找齐了！';
          } else {
            this.feedback = '找到了！马上寻找上方的新目标';
            this.nextTarget();
          }
        }
      } else if (!this.penaltyActive) this.feedback = '注意上方目标，避开其他物品';
      this.refreshVisibility();
      return true;
    }
    refreshVisibility() {
      this.cards.forEach(card => {
        const visible = this.phase !== 'exploring' || card.index === this.position || this.isAdjacent(card.index);
        card.fog.covered = !visible;
      });
      this.version++;
    }
    get previewSeconds() { return Math.ceil((this.level.previewDuration - this.previewElapsed) / 1000); }
    get targetRemaining() { return this.target ? Math.max(0, this.level.targetDuration - this.targetElapsed) : 0; }
    get penaltyActive() { return this.activeTime < this.penaltyUntil; }
    get collectedCount() { return this.collected?.size ?? 0; }
    get totalTreasures() { return this.level.treasures.length; }
    get totalPairs() { return 0; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = FogJourney;
  else root.FogJourney = FogJourney;
})(typeof globalThis !== 'undefined' ? globalThis : this);
