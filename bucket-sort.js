/* One top item per move; no runtime dependencies or shuffled retry layouts. */
(function (root) {
  'use strict';
  const BaseGame = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.MemoryGame;
  class BucketSort extends BaseGame {
    start(now) {
      super.start(now);
      this.buckets = this.level.buckets.map(bucket => [...bucket]); // Bottom to top.
      this.capacity = this.level.capacity;
      this.source = null;
      this.history = [];
      this.lastMove = null;
      this.feedback = '先选一个桶，再选择要放入的桶。';
      this.cards = this.buckets.map((bucket, index) => ({ index, value: bucket.at(-1), status: 'filled', tangled: false, grassLockedUntil: null, fog: null }));
      this.refreshCards();
    }
    update(now) {
      if (this.state === 'playing' && !this.timerRunning) { this.lastNow = now; return; }
      super.update(now);
    }
    isSorted(index) {
      const bucket = this.buckets[index];
      return bucket.length === this.capacity && bucket.every(kind => kind === bucket[0]);
    }
    canMove(from, to) {
      const source = this.buckets[from], target = this.buckets[to];
      return from !== to && Boolean(source?.length) && Boolean(target) && target.length < this.capacity
        && (!target.length || target.at(-1) === source.at(-1));
    }
    select(index, now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning || !Number.isInteger(index) || !this.buckets[index]) return false;
      this.lastMove = null;
      this.version++;
      if (this.source === index) {
        this.source = null;
        this.feedback = '已取消选择，可以改选其他桶。';
      } else if (this.source === null) {
        if (!this.buckets[index].length) { this.feedback = '这个桶是空的，请先选择装着物品的桶。'; return false; }
        this.source = index;
        this.feedback = '已选中桶顶物品，请点击亮起的桶放入；再点原桶可取消。';
      } else if (this.canMove(this.source, index)) {
        const from = this.source, kind = this.buckets[from].pop();
        this.buckets[index].push(kind);
        this.history.push({ from, to: index, kind });
        this.lastMove = { from, to: index, kind };
        this.source = null;
        this.turns++;
        this.refreshCards();
        this.feedback = '放好了！继续把相同的收获装在一起。';
        if (this.buckets.every((bucket, i) => !bucket.length || this.isSorted(i))) this.state = 'won';
      } else {
        this.feedback = this.buckets[index].length === this.capacity ? '这个桶已经满了，请换一个桶。' : '只能放入空桶，或放在相同物品上方。';
        return false;
      }
      return true;
    }
    undo(now) {
      this.update(now);
      if (this.state !== 'playing' || !this.timerRunning || !this.history.length) return false;
      const { from, to } = this.history.pop();
      this.buckets[from].push(this.buckets[to].pop());
      this.source = null;
      this.lastMove = null;
      this.feedback = '已撤回上一步，潮水会继续上涨。';
      this.refreshCards();
      this.version++;
      return true;
    }
    refreshCards() {
      this.cards.forEach((card, i) => { card.value = this.buckets[i].at(-1); card.status = this.isSorted(i) ? 'sorted' : this.buckets[i].length ? 'filled' : 'empty'; });
    }
    clearFog() { return false; }
    get sortedCount() { return this.buckets.filter((bucket, i) => this.isSorted(i)).length; }
    get totalKinds() { return new Set(this.level.layout).size; }
    get totalPairs() { return 0; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = BucketSort;
  else root.BucketSort = BucketSort;
})(typeof globalThis !== 'undefined' ? globalThis : this);
