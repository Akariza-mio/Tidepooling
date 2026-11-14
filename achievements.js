/* Achievements record the current run, independently of level progress. */
(function (root) {
  'use strict';
  // A new save generation resets previous awards once, while retaining new awards on reload.
  const storageKey = 'beach-pairs-achievements-v2';
  const versionKey = 'beach-pairs-achievements-version';
  const firstTutorialKey = 'beach-pairs-achievements-first-tutorial';
  const saveRevision = '8c32da5b-db73-43b5-8590-9adfbb2783bd';
  const definitions = Object.freeze([
    Object.freeze({ id: 'no-lever-clear', name: '反赌战士', method: '不拉一次拉杆，通关5-5', icon: 'slots', matches: game => game.state === 'won' && game.level.id === 45 && game.level.type === 'slotMachine' && game.hasSpun === false }),
    Object.freeze({ id: 'first-clear', name: '初出茅庐', method: '通关1-1', icon: 'crab', matches: game => game.state === 'won' && game.level.id === 1 }),
    Object.freeze({ id: 'flawless-clear', name: '噫！我中了！', method: '在没有配对失败的情况下通关任意一关', icon: 'trophy', matches: game => game.state === 'won' && game.totalPairs > 0 && game.pairs === game.totalPairs && game.mismatches === 0 }),
    Object.freeze({ id: 'quick-search', name: '揣度优先搜索', method: '在30s内通关1-6', icon: 'search', matches: game => game.state === 'won' && game.level.id === 6 && Number.isFinite(game.activeTime) && game.activeTime - (game.playStartedAt ?? 0) >= 0 && game.activeTime - (game.playStartedAt ?? 0) <= 30000 }),
    Object.freeze({ id: 'picky-eater', name: '挑食', method: '在同一关内连续配对6组相同的物品', icon: 'picky', matches: game => ['playing', 'won', 'lost'].includes(game.state) && game.totalPairs > 0 && (game.pairKinds || []).some((kind, index, kinds) => index >= 5 && kinds.slice(index - 5, index + 1).every(value => value === kind)) }),
    Object.freeze({ id: 'zen-mode', name: '禅模式', method: '在涨潮时仍未完成任何一组配对', icon: 'zen', matches: game => game.state === 'lost' && game.failureReason === 'timeout' && game.totalPairs > 0 && game.pairs === 0 }),
    Object.freeze({ id: 'first-tutorial-skip', name: '我只是点错了', method: '在首次进入1-1时跳过教程', icon: 'fast-forward', matches: () => false }),
    Object.freeze({ id: 'last-second-clear', name: '力挽狂澜', method: '在关卡的最后3s内通关', icon: 'clock', matches: game => game.state === 'won' && !game.level.untimed && (game.winRemaining ?? game.remaining) > 0 && (game.winRemaining ?? game.remaining) <= 3000 }),
    Object.freeze({ id: 'quick-fog-search', name: '眼疾手快', method: '在20s内通关2-5', icon: 'eye', matches: game => game.state === 'won' && game.level.id === 15 && game.level.type === 'fogJourney' && Number.isFinite(game.activeTime) && game.activeTime - game.previewElapsed >= 0 && game.activeTime - game.previewElapsed <= 20000 }),
    Object.freeze({ id: 'weed-master', name: '除草技', method: '在10步之内通关3-5', icon: 'spray', matches: game => game.state === 'won' && game.level.id === 25 && game.level.type === 'grassPuzzle' && Number.isInteger(game.turns) && game.turns >= 0 && game.turns <= 10 }),
    Object.freeze({ id: 'optimal-sort', name: '物以类聚', method: '在4-6中走出最优解', icon: 'crab-bucket', matches: game => game.state === 'won' && game.level.id === 36 && game.level.type === 'bucketSort' && Number.isInteger(game.level.optimalMoves) && game.turns === game.level.optimalMoves }),
    Object.freeze({ id: 'open-book', name: '开卷考试', method: '30s内通关5-6', icon: 'books', matches: game => game.state === 'won' && game.level.id === 46 && game.level.type === 'arithmetic' && Number.isFinite(game.activeTime) && game.activeTime <= 30000 }),
    Object.freeze({ id: 'thanks-for-playing', name: '谢谢参与', method: '在5-5中连续5次拉杆未获得奖励消除', icon: 'handshake', matches: game => ['playing', 'won', 'lost'].includes(game.state) && game.level.id === 45 && game.level.type === 'slotMachine' && game.fiveNoRewardPulls === true }),
    Object.freeze({ id: 'wave-rider', name: '浪里白条', method: '在同一波海浪冲刷时完成3组配对', icon: 'wave-catch', matches: game => ['playing', 'won', 'lost'].includes(game.state) && Boolean(game.level.surf) && game.threePairsInWave === true }),
    Object.freeze({ id: 'beyond-syllabus', name: '超纲', method: '在5-6中同一道题连续答错3次', icon: 'book-cross', matches: game => ['playing', 'won', 'lost'].includes(game.state) && game.level.id === 46 && game.level.type === 'arithmetic' && game.threeWrongInRound === true }),
    Object.freeze({ id: 'boxed-in', name: '回头是岸', method: '在2-6中把自己困住', icon: 'cage', matches: game => game.level.id === 16 && game.level.type === 'fogJourney' && ['playing','lost'].includes(game.state) && game.trapped === true }),
    Object.freeze({ id: 'one-pair-short', name: '差亿点', method: '在只剩最后一组配对时失败', icon: 'almost', matches: game => game.state === 'lost' && game.totalPairs > 0 && game.pairs === game.totalPairs - 1 }),
    Object.freeze({ id: 'crab-rush', name: '横行霸道', method: '10s内通关5-2', icon: 'crab-crowd', matches: game => game.level.id === 42 && game.state === 'won' && Number.isFinite(game.activeTime) && game.activeTime - (game.playStartedAt ?? 0) >= 0 && game.activeTime - (game.playStartedAt ?? 0) <= 10000 }),
    Object.freeze({ id: 'overgrown', name: '寸步难行', method: '让一关内全部格子都被海草覆盖', icon: 'grass-board', matches: game => ['playing', 'lost'].includes(game.state) && game.pairs === 0 && game.cards?.length > 0 && game.cards.every(card => (card.tangled === true || card.grass === true) && card.status !== 'matched') }),
    Object.freeze({ id: 'one-sided-love', name: '单相思', method: '', icon: 'heartbreak', matches: game => game.level.id === 50 && ['playing', 'won'].includes(game.state) && game.activeTime >= 30000 && (game.pairs === 0 || game.pairTimes?.[0] >= 30000) })
  ]);
  class BeachAchievements {
    static get revision() { return saveRevision; }
    get completedCount() { return definitions.filter(definition => this.earned.has(definition.id)).length; }
    get totalCount() { return definitions.length; }
    constructor(storage, onEarned = () => {}) {
      if (storage === undefined) {
        try { storage = root.localStorage; } catch (_) { /* Opaque origins can still keep session achievements. */ }
      }
      this.storage = storage;
      this.onEarned = onEarned;
      this.earned = new Set();
      this.firstTutorialEntered = false;
      this.firstTutorialRun = null;
      try { storage?.removeItem?.('beach-pairs-achievements'); }
      catch (_) { /* Legacy awards are ignored even if their old key cannot be removed. */ }
      try {
        if (storage?.getItem(versionKey) !== saveRevision) this.save();
        else {
          this.firstTutorialEntered = storage?.getItem(firstTutorialKey) === saveRevision;
          const saved = JSON.parse(storage?.getItem(storageKey) || '[]');
          if (Array.isArray(saved)) for (const id of saved) {
            if (definitions.some(definition => definition.id === id)) this.earned.add(id);
          }
        }
      } catch (_) { /* A missing or invalid save never blocks the game. */ }
    }
    recordWin(game) {
      if (game.state !== 'won') return false;
      return this.record(game);
    }
    record(game) {
      return this.award(definitions.filter(definition => !this.earned.has(definition.id) && definition.matches(game)));
    }
    beginTutorialVisit(game) {
      if (game.level.id !== 1) return false;
      const first = !this.firstTutorialEntered;
      this.firstTutorialEntered = true;
      this.firstTutorialRun = first ? game : null;
      try { this.storage?.setItem(firstTutorialKey, saveRevision); }
      catch (_) { /* A storage-blocked page still consumes the first visit for this session. */ }
      return first;
    }
    recordTutorialChoice(game, skipped) {
      if (this.firstTutorialRun !== game) return false;
      this.firstTutorialRun = null;
      return skipped ? this.award(definitions.filter(definition => definition.id === 'first-tutorial-skip')) : false;
    }
    award(candidates) {
      const newlyEarned = candidates.filter(definition => !this.earned.has(definition.id));
      if (!newlyEarned.length) return false;
      for (const definition of newlyEarned) this.earned.add(definition.id);
      this.save();
      for (const definition of newlyEarned) this.onEarned(definition);
      return true;
    }
    save() {
      try {
        this.storage?.setItem(storageKey, JSON.stringify([...this.earned]));
        this.storage?.setItem(versionKey, saveRevision);
      }
      catch (_) { /* Keep the award for this session when saving is unavailable. */ }
    }
    iconMarkup(definition, placement) {
      const suffix = `achievement-${definition.id}-${placement}`;
      if (definition.icon === 'crab') return root.BeachArt.item(1, suffix);
      if (definition.icon === 'grass-board') {
        const cells = Array.from({ length: 4 }, (_, i) => {
          const x = 9 + (i % 2) * 64, y = 9 + Math.floor(i / 2) * 64;
          const grass = root.BeachArt.seagrass(`${suffix}-${i}`).replace('class="seagrass-art" width="100" height="100"', `class="achievement-grass-sprig" x="${x + 2}" y="${y + 2}" width="54" height="54"`);
          return `<rect x="${x}" y="${y}" width="58" height="58" rx="9" fill="#edd8a1" stroke="#d5bd83" stroke-width="2"/>${grass}`;
        }).join('');
        return `<svg class="achievement-badge-art achievement-grass-board-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false"><rect x="4" y="4" width="132" height="132" rx="14" fill="#f8edcd" stroke="#baaa7f" stroke-width="2"/>${cells}</svg>`;
      }
      if (definition.icon === 'crab-crowd') {
        const crabs = [[3,14],[47,9],[91,14],[3,56],[47,51],[91,56],[25,95],[69,95]].map(([x,y],i) => root.BeachArt.item(1, `${suffix}-${i}`).replace('class="shell-art seaside-item"','class="seaside-item"').replace('<svg ', `<svg x="${x}" y="${y}" width="45" height="45" `)).join('');
        return `<svg class="achievement-badge-art achievement-crab-crowd-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false">${crabs}</svg>`;
      }
      if (definition.icon === 'heartbreak') {
        // Both halves use the very same crack, traversed in opposite directions.
        const crack = [[70,40],[64,58],[77,74],[64,92],[70,122]];
        const points = list => list.map(point => point.join(' ')).join(' ');
        const left = 'M70 40C40 5 10 28 18 55C25 80 50 103 70 122L' + points(crack.slice(0, -1).reverse()) + 'Z';
        const right = 'M' + points(crack) + 'C90 103 115 80 122 55C130 28 100 5 70 40Z';
        return `<svg class="achievement-badge-art achievement-heartbreak-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false"><g class="heartbreak-half" transform="translate(-4 0)"><path d="${left}" fill="#e7a193" stroke="#b87269" stroke-width="3" stroke-linejoin="round"/><path d="M29 44q0-12 12-14" fill="none" stroke="#ffe9d5" stroke-width="4" stroke-linecap="round"/></g><g class="heartbreak-half" transform="translate(4 0)"><path d="${right}" fill="#e7a193" stroke="#b87269" stroke-width="3" stroke-linejoin="round"/><path d="M111 44q0-12-12-14" fill="none" stroke="#ffe9d5" stroke-width="4" stroke-linecap="round"/></g></svg>`;
      }
      if (definition.icon === 'wave-catch') {
        const find = (kind, x, y, size, angle, index) => `<g transform="rotate(${angle} ${x + size / 2} ${y + size / 2})">${root.BeachArt.item(kind, `${suffix}-${index}`).replace('class="shell-art seaside-item"', 'class="seaside-item"').replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `)}</g>`;
        return `<svg class="achievement-badge-art achievement-wave-catch-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false"><path d="M7 119c21-15 9-39 24-58 11-16 29-9 30 6-10-10-21 1-15 13 11 24 51 36 86 32l-7 12H7Z" fill="#83b9ba" stroke="#5b969f" stroke-width="3"/><path d="M17 106c16-17 5-29 19-43 6-6 12-7 16-2" fill="none" stroke="#f7f5dd" stroke-width="4" stroke-linecap="round"/>${find(0,74,5,44,-22,0)}${find(1,57,42,53,20,1)}${find(4,75,82,49,-17,2)}<path d="m118 38 10-6m-12 15 13-1m-10 36 10-6M44 109q32 17 73 10" fill="none" stroke="#eaf3da" stroke-width="3" stroke-linecap="round"/></svg>`;
      }
      if (definition.icon === 'crab-bucket') {
        const crab = (x, y, index) => root.BeachArt.item(1, `${suffix}-${index}`)
          .replace('class="shell-art seaside-item"', 'class="seaside-item"')
          .replace('<svg ', `<svg x="${x}" y="${y}" width="49" height="49" `);
        return `<svg class="achievement-badge-art achievement-crab-bucket-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false"><ellipse cx="70" cy="126" rx="43" ry="6" fill="#ae9b6d" opacity=".17"/><path d="M35 57V38c0-34 70-34 70 0v19" fill="none" stroke="#819f8b" stroke-width="5"/><path d="m25 59 11 59q34 16 68 0l11-59Z" fill="#aacbb4" stroke="#719a88" stroke-width="3"/><ellipse cx="70" cy="59" rx="45" ry="12" fill="#5d8c79"/>${crab(30,29,0)}${crab(63,28,1)}${crab(47,45,2)}<path d="M28 72q42 16 84 0l-8 46q-34 16-68 0Z" fill="#aacbb4" stroke="#719a88" stroke-width="2.5"/><path d="M38 82l5 28" stroke="#e7efd8" stroke-width="4" stroke-linecap="round"/><path d="m71 86 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#e7cf8c" stroke="#b7a369" stroke-width="1.5"/></svg>`;
      }
      const badges = {
        cage: '<ellipse cx="70" cy="120" rx="54" ry="9" fill="#acac91" opacity=".2"/><path d="M21 36q49-22 98 0v75q-49 22-98 0Z" fill="#e5e7d5" fill-opacity=".7" stroke="#81978a" stroke-width="3"/><path d="M21 36q49 22 98 0M21 109q49 22 98 0" fill="none" stroke="#708a7b" stroke-width="5"/><g fill="#9fb2a1" stroke="#6e8878" stroke-width="2"><rect x="25" y="36" width="8" height="76" rx="4"/><rect x="45" y="41" width="8" height="77" rx="4"/><rect x="66" y="43" width="8" height="78" rx="4"/><rect x="87" y="41" width="8" height="77" rx="4"/><rect x="107" y="36" width="8" height="76" rx="4"/></g><path d="M21 31q49-24 98 0v7q-49 21-98 0Z" fill="#c5cfb9" stroke="#708a7b" stroke-width="3"/>',
        almost: '<rect x="8" y="32" width="124" height="75" rx="13" fill="#f6e4b6" stroke="#b79b69" stroke-width="3"/><text x="70" y="82" text-anchor="middle" font-family="Georgia,serif" font-size="36" font-weight="600" fill="#8f7954">17/18</text><rect x="22" y="115" width="96" height="5" rx="2.5" fill="#d9d5bc"/><rect x="22" y="115" width="90.67" height="5" rx="2.5" fill="#8ead93"/>',
        handshake: '<path d="M9 60 30 36 48 49 29 82Z" fill="#8fb8a0" stroke="#658c79" stroke-width="3"/><path d="m131 60-21-24-18 13 19 33Z" fill="#a0bbc8" stroke="#6f95a3" stroke-width="3"/><path d="m40 49 14-7q8-5 15 0l30 26q5 5 0 10-4 4-9 0l-3-3q6 5 1 10-5 4-10-1 5 5 0 10-5 4-10-1-1 8-8 6L29 75Z" fill="#ecc5a2" stroke="#bb9274" stroke-width="2.5" stroke-linejoin="round"/><path d="m100 49-14-8q-8-4-14 2L56 56q-5 5 0 9 5 4 10 0l8-6 25 21 12-8Z" fill="#f3d6b5" stroke="#bb9274" stroke-width="2.5" stroke-linejoin="round"/><path d="m53 72 13 12m-7-19 19 19m-28-3 10 10" fill="none" stroke="#bb9274" stroke-width="2" stroke-linecap="round"/>',
        'book-cross': '<path d="M12 42 10 116q30-10 60 5 30-15 60-5l-2-74" fill="#8daf99" stroke="#6e927d" stroke-width="3"/><path d="M16 35q26-12 54 5 28-17 54-5v72q-26-12-54 5-28-17-54-5Z" fill="#fff1d4" stroke="#b4a387" stroke-width="2.5"/><path d="M70 40v72M27 51l29 5M27 65l29 5m-29 9 29 5m28-28 29-5M84 70l29-5M84 84l29-5" fill="none" stroke="#d6c6a6" stroke-width="2"/><path d="m45 47 53 53m0-53-53 53" stroke="#fff7e6" stroke-width="14" stroke-linecap="round"/><path d="m45 47 53 53m0-53-53 53" stroke="#d94e49" stroke-width="9" stroke-linecap="round"/>',
        books: '<ellipse cx="70" cy="127" rx="54" ry="5" fill="#ad9a75" opacity=".15"/><g class="achievement-book"><path d="M18 97h104v25H18q-8-12 0-25Z" fill="#fff0d4" stroke="#6c9581" stroke-width="3"/><rect x="13" y="97" width="17" height="25" rx="4" fill="#91b49b" stroke="#6c9581" stroke-width="2"/><path d="M18 96h106M18 123h106" stroke="#6c9581" stroke-width="4" stroke-linecap="round"/><path d="M36 105h77m-77 9h77" stroke="#d4c7a7" stroke-width="1.5"/></g><g class="achievement-book"><path d="M27 70h91v25H27q-8-12 0-25Z" fill="#fff0d4" stroke="#ad7e6d" stroke-width="3"/><rect x="22" y="70" width="16" height="25" rx="4" fill="#d4a58e" stroke="#ad7e6d" stroke-width="2"/><path d="M27 69h93M27 96h93" stroke="#ad7e6d" stroke-width="4" stroke-linecap="round"/><path d="M44 78h65m-65 9h65" stroke="#d4c7a7" stroke-width="1.5"/></g><g class="achievement-book"><path d="M21 43h103v25H21q-8-12 0-25Z" fill="#fff0d4" stroke="#6f97a2" stroke-width="3"/><rect x="16" y="43" width="17" height="25" rx="4" fill="#a2c2c9" stroke="#6f97a2" stroke-width="2"/><path d="M21 42h105M21 69h105" stroke="#6f97a2" stroke-width="4" stroke-linecap="round"/><path d="M39 51h76m-76 9h76" stroke="#d4c7a7" stroke-width="1.5"/></g>',
        spray: '<rect x="40" y="46" width="56" height="78" rx="12" fill="#a5c39d" stroke="#6d9274" stroke-width="3"/><ellipse cx="68" cy="47" rx="28" ry="6" fill="#e0e8d8" stroke="#829e81" stroke-width="2"/><rect x="51" y="33" width="34" height="13" rx="4" fill="#c7d5c5" stroke="#829e81" stroke-width="2"/><rect x="58" y="18" width="21" height="17" rx="4" fill="#e6bb8e" stroke="#b18c65" stroke-width="2"/><rect x="75" y="22" width="9" height="7" rx="2" fill="#8a9b86"/><path d="m91 24 20-12m-17 15h25m-28 4 20 12" fill="none" stroke="#a4bead" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 6"/><rect x="47" y="65" width="42" height="39" rx="7" fill="#fff1d2" stroke="#c8d3af" stroke-width="2"/><path d="M68 95Q50 89 58 75q23 2 10 20Z" fill="#8ab58c" stroke="#5d8d70" stroke-width="2"/><path d="m62 101 8-19" fill="none" stroke="#5d8d70" stroke-width="2" stroke-linecap="round"/><path d="M47 54v9m0 47v5" stroke="#edf7df" stroke-width="3" stroke-linecap="round"/>',
        'fast-forward': '<g fill="#78a692" stroke="#507f6e" stroke-width="3" stroke-linejoin="round"><polygon points="12,39 12,101 65.693575,70"/><polygon points="74,39 74,101 127.693575,70"/></g>',
        clock: '<circle cx="70" cy="73" r="48" fill="#e7cd9c" stroke="#b59a6c" stroke-width="3"/><circle cx="70" cy="73" r="40" fill="#fff5dc" stroke="#d4bf93" stroke-width="2"/><path d="M70 39v6M104 73h-6M70 107v-6M36 73h6" stroke="#c2a679" stroke-width="3" stroke-linecap="round"/><path d="M70 49v25l20 12" fill="none" stroke="#608d82" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="73" r="4" fill="#608d82"/><path d="m48 21 8 6m28 0 8-6" stroke="#b59a6c" stroke-width="4" stroke-linecap="round"/>',
        eye: '<path d="M13 70Q70 6 127 70 70 134 13 70Z" fill="#fff7e6" stroke="#618b7c" stroke-width="4" stroke-linejoin="round"/><path d="M25 37Q70 8 115 37" fill="none" stroke="#7da08a" stroke-width="4" stroke-linecap="round"/><circle cx="70" cy="70" r="26" fill="#80b4a0" stroke="#527f73" stroke-width="3"/><circle cx="70" cy="70" r="14" fill="#355c54"/><circle cx="62" cy="59" r="7" fill="#fffdf1"/><circle cx="79" cy="79" r="3.5" fill="#e6f6e7"/><path d="m116 12 3 7 8 3-8 3-3 8-3-8-7-3 7-3Z" fill="#e8c77f"/>',
        trophy: '<path d="M39 39H23v17q0 27 26 28M101 39h16v17q0 27-26 28" fill="none" stroke="#c49b55" stroke-width="8"/><path d="M37 28h66v33q0 30-33 34-33-4-33-34Z" fill="#f1d398" stroke="#b78c4e" stroke-width="3"/><path d="m70 41 6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2Z" fill="#fff7da" stroke="#d3ac62" stroke-width="2"/><path d="M65 94h10v17H65Z" fill="#c69c62"/><path d="M47 111h46l8 11H39Z" fill="#dbb67a" stroke="#b78c4e" stroke-width="3"/><path d="m23 15 3 7 8 2-8 3-3 8-3-8-7-3 7-2ZM115 17l3 6 7 2-7 2-3 7-2-7-6-2 6-2Z" fill="#db8b74"/>',
        search: '<rect x="15" y="20" width="87" height="87" rx="12" fill="#efdbaf" stroke="#bd9f70" stroke-width="3"/><path d="M44 24v79M73 24v79M19 49h79M19 78h79" fill="none" stroke="#fff2d1" stroke-width="3"/><path d="m28 34 5-4 6 4-2 8h-7Z" fill="#df9d87"/><circle cx="77" cy="70" r="31" fill="#e1eee0" fill-opacity=".8" stroke="#618f84" stroke-width="7"/><path d="m99 94 25 27" stroke="#6e9b8c" stroke-width="13" stroke-linecap="round"/><path d="M77 50v21l13 9" fill="none" stroke="#648980" stroke-width="4" stroke-linecap="round"/><circle cx="77" cy="70" r="3" fill="#648980"/>',
        picky: '<ellipse cx="70" cy="74" rx="48" ry="35" fill="#fff4d9" stroke="#9eb39c" stroke-width="4"/><ellipse cx="70" cy="74" rx="36" ry="25" fill="#e8eed9" stroke="#c6d0af" stroke-width="2"/><g fill="#e8a18d" stroke="#bc796c" stroke-width="2"><path d="M48 79q-10-6-9-15 5-8 11-3 5-7 10 0 7-3 9 5 0 8-12 15Z"/><path d="M74 77q-8-6-6-13 5-7 10-3 6-6 10 1 7-2 8 5-1 8-13 13Z"/></g><path d="M12 37v22m8-22v22m8-22v22M12 52q8 12 16 0M20 61v56M121 38v79m0-79q-14 17 0 31" fill="none" stroke="#829f8b" stroke-width="4" stroke-linecap="round"/><g fill="#d8b776"><circle cx="45" cy="113" r="3"/><circle cx="55" cy="119" r="3"/><circle cx="65" cy="121" r="3"/><circle cx="75" cy="121" r="3"/><circle cx="85" cy="119" r="3"/><circle cx="95" cy="113" r="3"/></g>',
        zen: '<circle cx="70" cy="63" r="45" fill="#dce9da" stroke="#adc4ac" stroke-width="2"/><path d="M22 100q24-10 48 0t48 0M17 113q26-9 53 0t53 0" fill="none" stroke="#83aaa0" stroke-width="4" stroke-linecap="round"/><path d="M70 88Q44 65 70 36q26 29 0 52Z" fill="#ebc6ba" stroke="#bb968d" stroke-width="2.5"/><path d="M70 88Q37 88 32 59q30-2 38 29ZM70 88q33 0 38-29-30-2-38 29Z" fill="#f2d9c9" stroke="#c8a99a" stroke-width="2.5"/><path d="M44 91q26 12 52 0" fill="none" stroke="#91af96" stroke-width="4" stroke-linecap="round"/>'
      };
      if (badges[definition.icon]) return `<svg class="achievement-badge-art achievement-${definition.icon}-art" viewBox="0 0 140 140" aria-hidden="true" focusable="false">${badges[definition.icon]}</svg>`;
      const emblem = root.BeachArt.slotMachineEmblem(suffix);
      if (definition.id !== 'no-lever-clear') return emblem;
      return emblem.replace(/<\/svg>\s*$/, '<g class="achievement-prohibition-slash" fill="none" stroke-linecap="round"><path d="M24 24 118 118" stroke="#fff5e5" stroke-width="18"/><path d="M24 24 118 118" stroke="#d94e49" stroke-width="12"/></g></svg>');
    }
    render(container, summary = null) {
      container.replaceChildren(...definitions.map(definition => {
        const earned = this.earned.has(definition.id);
        const card = document.createElement('li');
        card.className = 'achievement-card' + (earned ? ' is-earned' : ' is-locked');
        card.dataset.achievement = definition.id;
        card.setAttribute('aria-label', `${definition.name}，${earned ? '已达成' : '未达成'}`);
        const icon = document.createElement('span');
        icon.className = 'achievement-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = this.iconMarkup(definition, 'list');
        const visual = document.createElement('div');
        visual.className = 'achievement-visual';
        visual.append(icon);
        const copy = document.createElement('div');
        copy.className = 'achievement-copy';
        const status = document.createElement('span');
        status.className = 'achievement-status';
        status.innerHTML = earned
          ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>'
          : '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="2"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7"/></svg>';
        status.append(document.createTextNode(earned ? '已达成' : '未达成'));
        const name = document.createElement('h2'), method = document.createElement('p');
        name.textContent = definition.name;
        method.textContent = definition.method;
        const identity = document.createElement('div');
        identity.className = 'achievement-identity';
        identity.append(status, visual);
        copy.append(name);
        if (definition.method) copy.append(method);
        card.append(identity, copy);
        return card;
      }));
      if (summary) summary.textContent = `已完成${this.completedCount} / ${this.totalCount}`;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = BeachAchievements;
  else root.BeachAchievements = BeachAchievements;
})(typeof globalThis !== 'undefined' ? globalThis : this);
