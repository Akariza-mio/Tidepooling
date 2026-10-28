/* First-level guidance shares the live board and never creates a second game. */
(function (root) {
  'use strict';
  class BeachTutorial {
    constructor({ game, tiles, onComplete, onLayout, announce }) {
      this.game = game;
      this.tiles = tiles;
      this.onComplete = onComplete;
      this.onLayout = onLayout;
      this.announce = announce;
      this.active = true;
      this.step = 'choice';
      this.target = null;
      this.screen = document.getElementById('play-screen');
      this.coach = document.getElementById('tutorial-coach');
      this.message = document.getElementById('tutorial-message');
      this.next = document.getElementById('tutorial-next');
      this.tideArrow = document.getElementById('tutorial-tide-arrow');
      this.arrow = document.createElement('span');
      this.arrow.className = 'tutorial-arrow';
      this.arrow.setAttribute('aria-hidden', 'true');
      this.arrow.innerHTML = '<svg viewBox="0 0 30 44"><path d="M11 3h8v22h8L15 40 3 25h8Z"/></svg>';
      const cards = game.cards;
      const first = cards[0];
      const match = cards.find(card => card.index !== first.index && card.value === first.value);
      const differentA = cards.find(card => card.index !== first.index && card.index !== match.index);
      const differentB = cards.find(card => card.index !== first.index && card.index !== match.index && card.index !== differentA.index && card.value !== differentA.value);
      this.indices = [first.index, match.index, differentA.index, differentB.index];
      this.advance = () => {
        if (this.game.state !== 'playing' || !this.active) return;
        if (this.step === 'success') this.setStep('different-first');
        else if (this.step === 'mismatch-done') this.setStep('tide');
        else if (this.step === 'tide') this.finish();
      };
      this.next.addEventListener('click', this.advance);
      this.game.setTimerRunning(false, performance.now());
      this.applyLocks();
    }
    begin() { this.setStep('first'); }
    canSelect(index) { return this.active && this.target === index; }
    onSelect() {
      const transitions = { first: 'match', match: 'success', 'different-first': 'different-second', 'different-second': 'mismatch' };
      if (transitions[this.step]) this.setStep(transitions[this.step]);
    }
    update() {
      if (this.active && this.step === 'mismatch' && !this.game.pending) this.setStep('mismatch-done');
    }
    setStep(step) {
      this.step = step;
      const messages = {
        first: '单击沙格扫开它，看看下面埋着什么',
        match: '再扫开另一块，看看下面埋着什么',
        success: '相同的收获配成一对后，可以收入桶中，现在看看没有配对成功会怎么样',
        'different-first': '再扫开一块沙子，记住里面的收获',
        'different-second': '接着扫开这一格，看看它们是不是同一种。',
        'mismatch-done': '看，它们又被盖住了。配对失败不会消除物件，记住位置，下次就能找到另一半。',
        tide: '注意底部箭头指着的水位，开始游戏后，潮水会不断上涨，如果潮水漫过整个画面，则会冲走所有的物品，游戏结束。在这之前完成所有配对，则赶海成功。每完成一对配对，潮水则会稍微退去，抓紧时间吧！'
      };
      const targets = { first: this.indices[0], match: this.indices[1], 'different-first': this.indices[2], 'different-second': this.indices[3] };
      this.target = targets[step] ?? null;
      this.screen.classList.add('is-tutorial');
      this.screen.classList.toggle('tutorial-show-tide', step === 'tide');
      this.coach.hidden = false;
      // Show the final mismatch explanation directly, while the usual 500ms exposure finishes.
      this.message.textContent = messages[step === 'mismatch' ? 'mismatch-done' : step];
      this.next.hidden = !['success', 'mismatch', 'mismatch-done', 'tide'].includes(step);
      this.next.disabled = step === 'mismatch';
      this.next.textContent = step === 'tide' ? '我知道了' : ['mismatch', 'mismatch-done'].includes(step) ? '看看潮水' : '继续教学';
      this.tideArrow.toggleAttribute('hidden', step !== 'tide');
      this.applyLocks();
      this.onLayout();
      if (this.target !== null) this.tiles[this.target].focus({ preventScroll: true });
      else if (!this.next.hidden) this.next.focus({ preventScroll: true });
    }
    applyLocks() {
      this.arrow.remove();
      this.tiles.forEach((tile, index) => {
        tile.disabled = this.game.cards[index].status !== 'hidden' || (this.active && index !== this.target);
        tile.classList.toggle('tutorial-target', this.active && index === this.target);
      });
      if (this.active && this.target !== null) this.tiles[this.target].append(this.arrow);
    }
    finish(skipped = false) {
      this.game.setTimerRunning(true, performance.now());
      this.dispose();
      this.applyLocks();
      this.onComplete();
      this.announce(skipped ? '已跳过教程，开始计时。' : '教学结束，开始计时。找到剩下的配对，把海的礼物带回家。');
      this.tiles.find(tile => !tile.disabled)?.focus({ preventScroll: true });
    }
    dispose() {
      this.active = false;
      this.target = null;
      this.step = 'done';
      this.arrow.remove();
      this.coach.hidden = true;
      this.tideArrow.setAttribute('hidden', '');
      this.screen.classList.remove('is-tutorial', 'tutorial-show-tide');
      this.tiles.forEach(tile => tile.classList.remove('tutorial-target'));
      this.next.removeEventListener('click', this.advance);
    }
  }
  root.BeachTutorial = BeachTutorial;
})(globalThis);
