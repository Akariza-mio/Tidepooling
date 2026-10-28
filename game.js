(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const canvas = $('tide-canvas');
  const ctx = canvas.getContext('2d');
  let game = new MemoryGame({ level: BeachLevels[0] });
  const screens = Array.from(document.querySelectorAll('.screen'));
  let currentScreen = 'menu';
  let cardElements = [];
  let lastVersion = -1;
  let previousStates = [];
  let resultShown = false;
  let modalOpen = false;
  let previousFocus = null;
  const completedLevels = new Set();
  let unlockAll = false;
  const chapterNames = ['初入浅滩', '月下独捉', '第三大关', '第四大关', '第五大关'];
  const chapterNumerals = ['一', '二', '三', '四', '五'];
  const levelNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  let currentChapter = 0;
  let chapterTransition = null;
  let viewWidth = 0;
  let viewHeight = 0;
  let previousFrame = 0;
  let animationTime = 0;
  let renderedFrames = 0;
  let metricsStart = performance.now();
  let measuredFps = 0;
  let displayedTide = 0;
  let tideRetreat = null;
  let flights = [];
  let flightSerial = 0;
  let bucketTarget = { x: 0, y: 0 };
  let bucketImpactAt = -1000;
  let rewardUntil = 0;
  let rewardSeconds = 0;
  let arrivedPairs = 0;
  let dangerStrength = 0;
  let dangerPhase = 0;
  let menuOffset = 0;
  let tutorial = null;
  let selectedPuzzleKind = 0;
  let fogMasks = new Map();
  try {
    const stored = JSON.parse(localStorage.getItem('beach-pairs-completed-levels') || '[]');
    if (Array.isArray(stored)) stored.forEach(id => {
      if (Number.isInteger(id) && id >= 1 && id <= 50) completedLevels.add(id);
    });
  } catch (_) { /* Optional storage; malformed data must not prevent play. */ }
  try {
    if (localStorage.getItem('beach-pairs-level-one') === 'won') completedLevels.add(1);
  } catch (_) { /* Keep progress in memory when storage is unavailable. */ }
  try { unlockAll = localStorage.getItem('beach-pairs-unlock-all') === 'on'; } catch (_) { /* Session-only fallback. */ }
  $('unlock-switch').setAttribute('aria-checked', String(unlockAll));
  $('unlock-switch').querySelector('.switch-state').textContent = unlockAll ? 'ON' : 'OFF';

  buildMenuPattern();
  $('chapter-day-scene').append(document.querySelector('.landscape').cloneNode(true));
  buildChapterPages();
  $('puzzle-sand-background').innerHTML = BeachArt.sandMatrices();
  const playNight = $('chapter-night-scene').cloneNode(true);
  playNight.id = 'play-night-scene';
  playNight.style.opacity = '1';
  playNight.hidden = true;
  playNight.insertAdjacentHTML('beforeend', `<span class="play-night-moon">${BeachArt.moon('play-sky')}</span>`);
  $('play-screen').prepend(playNight);

  function isPuzzle() { return game.level.type === 'diagonalPuzzle'; }

  function buildChapterPages() {
    const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
    chapterNames.forEach((name, chapter) => {
      const page = document.createElement('section');
      page.className = 'chapter-page';
      page.id = 'chapter-' + (chapter + 1);
      page.setAttribute('aria-labelledby', 'chapter-heading-' + chapter);
      const emblem = chapter === 1 ? BeachArt.moon('chapter-two') : BeachArt.item([1, 0, 4, 5, 3][chapter], 'chapter-' + chapter);
      page.innerHTML = `<header class="chapter-heading"><span class="chapter-emblem" aria-hidden="true">${emblem}</span><p class="eyebrow">第${chapterNumerals[chapter]}大关 · 10 关</p><h1 id="chapter-heading-${chapter}">${name}</h1><p class="chapter-progress"></p></header><div class="chapter-grid"></div><p class="chapter-note"></p>`;
      const grid = page.querySelector('.chapter-grid');
      for (let slot = 0; slot < 10; slot++) {
        const id = chapter * 10 + slot + 1;
        const level = BeachLevels.find(item => item.id === id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chapter-level';
        button.classList.toggle('is-minigame', slot === 4 || slot === 5);
        button.dataset.level = id;
        button.id = id === 1 ? 'level-one' : 'level-' + id;
        button.innerHTML = `<span class="chapter-level-number">${String(slot + 1).padStart(2, '0')}</span><span class="chapter-level-copy"><span class="chapter-level-name">第${levelNumerals[slot]}关</span><span class="chapter-level-status"></span></span><span class="chapter-level-mark">${lock}</span>`;
        button.addEventListener('click', () => {
          if (level && (unlockAll || completedLevels.has(id))) startLevel(level);
        });
        grid.append(button);
      }
      $('chapter-pages').append(page);
      const indicator = document.createElement('span');
      indicator.className = 'chapter-indicator';
      indicator.textContent = chapterNumerals[chapter];
      indicator.setAttribute('role', 'listitem');
      indicator.setAttribute('aria-label', `第${chapterNumerals[chapter]}大关，${name}`);
      $('chapter-indicators').append(indicator);
    });
    selectChapter(0);
  }
  function selectChapter(chapter, moveFocus = false) {
    finishChapterTransition(false);
    const previousChapter = currentChapter;
    currentChapter = Math.max(0, Math.min(4, chapter));
    $('level-screen').classList.toggle('is-night-chapter', currentChapter === 1);
    Array.from($('chapter-indicators').children).forEach((indicator, index) => {
      if (index === currentChapter) indicator.setAttribute('aria-current', 'page');
      else indicator.removeAttribute('aria-current');
    });
    Array.from($('chapter-pages').children).forEach((page, index) => {
      page.hidden = index !== currentChapter;
      let completed = 0;
      page.querySelectorAll('.chapter-level').forEach(button => {
        const id = Number(button.dataset.level);
        const level = BeachLevels.find(item => item.id === id);
        const won = Boolean(level && completedLevels.has(id));
        const available = Boolean(level && (won || unlockAll));
        if (won) completed++;
        button.disabled = !available;
        button.classList.toggle('is-completed', won);
        button.classList.toggle('is-unlocked', available && !won);
        button.querySelector('.chapter-level-status').textContent = won ? '已通关 · 重玩' : available ? '可挑战' : level ? '尚未通关' : '待开放';
        button.querySelector('.chapter-level-mark').hidden = available;
      });
      page.querySelector('.chapter-progress').textContent = `已通关 ${completed} / 10`;
      page.querySelector('.chapter-note').hidden = unlockAll;
      const hasLevels = BeachLevels.some(level => Math.floor((level.id - 1) / 10) === index);
      page.querySelector('.chapter-note').textContent = unlockAll ? '' : hasLevels
        ? completed ? `已通关 ${completed} 关，点击已点亮的关卡再次赶海。` : index === 0 ? '第一关从主页“开始游戏”进入，通关后可在此重玩。' : '通关上一大关后，继续探索这片海岸。'
        : '这片海岸尚待探索，关卡将陆续开放。';
    });
    $('chapter-help').hidden = unlockAll;
    $('chapter-help').textContent = unlockAll ? '' : '已通关的关卡可重玩 · 新挑战从主页开始';
    const animate = moveFocus && currentScreen === 'level' && Math.min(previousChapter, currentChapter) === 0
      && Math.max(previousChapter, currentChapter) === 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) {
      const stage = $('chapter-pages');
      const from = $('chapter-' + (previousChapter + 1));
      const to = $('chapter-' + (currentChapter + 1));
      const scrollTop = stage.scrollTop;
      stage.scrollTop = 0;
      stage.classList.add('is-sliding');
      stage.setAttribute('aria-busy', 'true');
      from.hidden = false;
      from.inert = to.inert = true;
      from.setAttribute('aria-hidden', 'true');
      from.style.top = -scrollTop + 'px';
      const direction = currentChapter > previousChapter ? 1 : -1;
      const options = { duration: 720, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'both' };
      const night = $('chapter-night-scene');
      const toNight = currentChapter === 1;
      night.hidden = false;
      const animations = [
        from.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * 105}%)` }], options),
        to.animate([{ transform: `translateX(${direction * 105}%)` }, { transform: 'translateX(0)' }], options),
        $('chapter-day-scene').animate([
          { transform: toNight ? 'translateX(0) scale(1)' : 'translateX(-3%) scale(1.08)' },
          { transform: toNight ? 'translateX(-3%) scale(1.08)' : 'translateX(0) scale(1)' }
        ], options),
        night.animate([
          { opacity: toNight ? 0 : 1, transform: toNight ? 'translateX(3%) scale(1.08)' : 'translateX(0) scale(1)' },
          { opacity: toNight ? 1 : 0, transform: toNight ? 'translateX(0) scale(1)' : 'translateX(3%) scale(1.08)' }
        ], options)
      ];
      const transition = { from, to, animations };
      chapterTransition = transition;
      Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (chapterTransition === transition) finishChapterTransition(moveFocus);
      }, () => { /* Leaving the page cancels the animations after cleanup. */ });
    } else {
      settleChapterBackground();
      $('chapter-pages').scrollTop = 0;
      if (moveFocus) focusChapter();
    }
    updateChapterArrows();
  }
  function settleChapterBackground() {
    $('chapter-night-scene').hidden = currentChapter !== 1;
    $('chapter-night-scene').style.opacity = currentChapter === 1 ? '1' : '0';
  }
  function updateChapterArrows() {
    $('chapter-previous').disabled = Boolean(chapterTransition) || currentChapter === 0;
    $('chapter-next').disabled = Boolean(chapterTransition) || currentChapter === 4;
  }
  function focusChapter() {
    const heading = $('chapter-' + (currentChapter + 1)).querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    announce(chapterNames[currentChapter]);
  }
  function finishChapterTransition(moveFocus) {
    if (!chapterTransition) return;
    const { from, to, animations } = chapterTransition;
    chapterTransition = null;
    settleChapterBackground();
    from.hidden = true;
    from.inert = to.inert = false;
    from.removeAttribute('aria-hidden');
    from.style.top = '';
    $('chapter-pages').classList.remove('is-sliding');
    $('chapter-pages').removeAttribute('aria-busy');
    animations.forEach(animation => animation.cancel());
    updateChapterArrows();
    if (moveFocus && currentScreen === 'level') focusChapter();
  }

  function buildMenuPattern() {
    const rows = [[1, 2, 0], [4, 5, 3], [2, 0, 1], [5, 3, 4]];
    const pieces = [];
    rows.forEach((row, r) => {
      const staggered = r % 2 === 1;
      const count = staggered ? 4 : 3;
      for (let c = 0; c < count; c++) {
        const kind = row[c % 3];
        const x = c * 92 + (staggered ? 0 : 46);
        const y = r * 82 + 41;
        const angle = ((r * 7 + c % 3 * 11) % 25) - 12;
        const svg = BeachArt.item(kind, `pattern-${r}-${c}`).replace('<svg ', '<svg width="88" height="88" ');
        pieces.push(`<g transform="translate(${x - 44} ${y - 44}) rotate(${angle} 44 44)">${svg}</g>`);
      }
    });
    const pattern = `<svg xmlns="http://www.w3.org/2000/svg" width="276" height="328" viewBox="0 0 276 328">${pieces.join('')}</svg>`;
    $('menu-pattern-scroll').style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(pattern)}")`;
  }
  function announce(message) { $('announcement').textContent = message; }
  function focusScreen(id) {
    const target = $(id + '-screen').querySelector('h1, button');
    if (target) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }
  function showScreen(id) {
    finishChapterTransition(false);
    closeModal(false);
    clearCollectionEffects();
    if (id !== 'play' && tutorial) { tutorial.dispose(); tutorial = null; }
    if (currentScreen === 'play' && id !== 'play') game.state = 'idle';
    currentScreen = id;
    screens.forEach(screen => { screen.hidden = screen.id !== id + '-screen'; });
    canvas.style.display = id === 'play' ? 'block' : 'none';
    hideTideDanger();
    if (id === 'level') selectChapter(currentChapter);
    focusScreen(id);
  }
  function startLevel(level) {
    game = level.type === 'diagonalPuzzle' ? new DiagonalPuzzle({ level }) : new MemoryGame({ level });
    startGame();
  }
  function startGame() {
    if (tutorial) { tutorial.dispose(); tutorial = null; }
    currentChapter = Math.floor((game.level.id - 1) / 10);
    const now = performance.now();
    game.start(now);
    const chapterIndex = Math.floor((game.level.id - 1) / 10);
    const localLevelIndex = (game.level.id - 1) % 10;
    $('play-chapter').textContent = chapterNames[chapterIndex];
    $('play-number').textContent = String(localLevelIndex + 1).padStart(2, '0');
    $('play-screen').setAttribute('aria-label', `${chapterNames[chapterIndex]}，第${levelNumerals[localLevelIndex]}关`);
    if (isPuzzle() || game.level.id === 1 || game.level.newItem || game.level.intro || game.conditions.length) game.setTimerRunning(false, now);
    $('play-screen').classList.toggle('is-night-play', chapterIndex === 1);
    $('play-night-scene').hidden = chapterIndex !== 1;
    $('play-screen').classList.toggle('is-puzzle', isPuzzle());
    $('play-screen').classList.toggle('is-dense-board', !isPuzzle() && Math.max(game.level.rows, game.level.columns) >= 8);
    $('play-screen').classList.toggle('has-conditions', game.conditions.length > 0);
    $('level-objectives').hidden = game.conditions.length === 0;
    $('puzzle-rules').hidden = !isPuzzle();
    $('puzzle-controls').hidden = !isPuzzle();
    document.querySelector('.collection').hidden = isPuzzle();
    document.querySelector('.board-caption').hidden = isPuzzle();
    // The fifth and sixth slots of every chapter share the sand-drawn puzzle setting.
    $('puzzle-sand-background').hidden = localLevelIndex !== 4 && localLevelIndex !== 5;
    metricsStart = previousFrame = now;
    renderedFrames = measuredFps = 0;
    animationTime = 0;
    displayedTide = 0;
    tideRetreat = null;
    lastVersion = -1;
    previousStates = [];
    resultShown = false;
    $('board').replaceChildren();
    fogMasks = new Map();
    $('board').style.setProperty('--board-columns', game.level.columns);
    $('board').style.aspectRatio = `${game.level.columns} / ${game.level.rows}`;
    $('board').setAttribute('aria-label', `${game.level.rows}行${game.level.columns}列赶海${isPuzzle() ? '填图' : '配对'}棋盘`);
    $('pairs-total').textContent = ` / ${game.totalPairs} 对`;
    if (isPuzzle()) buildPuzzleTools();
    cardElements = isPuzzle() ? buildPuzzleBoard() : game.cards.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.index = card.index;
      button.dataset.status = 'hidden';
      button.setAttribute('aria-label', `第${Math.floor(card.index / game.level.columns) + 1}行第${card.index % game.level.columns + 1}列，未翻开的沙格`);
      button.innerHTML = `<span class="shell-face">${BeachArt.item(card.value, 'card' + card.index)}</span><span class="sand-cover"></span>`;
      if (card.fog) {
        button.classList.add('has-fog');
      }
      button.addEventListener('click', () => {
        if (modalOpen || (tutorial?.active && !tutorial.canSelect(card.index))) return;
        const now = performance.now();
        if (game.clearFog(card.index, now)) {
          announce('雾拨开了，可以查看这格。');
          syncGame();
          return;
        }
        const oldPairs = game.pairs;
        if (game.select(card.index, now)) {
          scatterSand(button);
          if (game.pairs > oldPairs) {
            const pair = game.cards.filter(c => c.status === 'matched' && previousStates[c.index] !== 'matched');
            collectPair(pair);
            announce(`找到一对${BeachArt.names[card.value]}，增加5秒，已经收集${game.pairs}对。`);
          }
          else announce(`翻开了${BeachArt.names[card.value]}。`);
          syncGame();
          if (tutorial?.active) tutorial.onSelect();
        } else if (game.state === 'lost') syncGame();
      });
      $('board').append(button);
      return button;
    });
    if (game.level.fog) buildFogField();
    showScreen('play');
    $('bucket-contents').replaceChildren();
    arrivedPairs = 0;
    bucketImpactAt = -1000;
    $('harvest-bucket').style.transform = '';
    refreshBucketTarget();
    syncGame();
    drawTide(performance.now());
    if (game.level.intro === 'nightFog') {
      openModal({ eyebrow: '', heading: '你一直忘我地赶海，不知不觉到了晚上！',
        description: '海边在夜间会起雾，雾可以点击拨开，但是它会在一定时间后恢复\n最好记住雾下面的格子是否已经被配对！',
        art: 'fog', fogIntro: true, actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.newItem) {
      const { kind, name } = game.level.newItem;
      openModal({ eyebrow: '', heading: `新品种增加 —— ${name}`, description: '', art: kind, artBelowHeading: true,
        actions: [{ text: '我知道了', run: () => game.conditions.length ? showLevelConditions() : beginTimedGame() }] });
    } else if (isPuzzle()) {
      openModal({ eyebrow: '', heading: '挑战！', art: 'notice-board',
        description: '在涨潮前选择物品填满棋盘，让每行，每列和对角线都不重复，即可完成挑战！',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.id === 1) {
      tutorial = new BeachTutorial({ game, tiles: cardElements, onLayout: refreshBucketTarget, announce,
        onComplete: () => { lastVersion = -1; syncGame(); refreshBucketTarget(); } });
      openModal({ eyebrow: '初入浅滩 · 第一关', heading: '一起试试怎么赶海？',
        description: '跟着箭头，认识配对和潮水。', art: 1,
        actions: [
          { text: '开始教学', run: () => { closeModal(false); tutorial.begin(); } },
          { text: '跳过教程', run: () => { closeModal(false); tutorial.finish(true); } }
        ] });
    } else if (game.conditions.length) showLevelConditions();
  }
  function buildPuzzleTools() {
    selectedPuzzleKind = game.level.kinds[0];
    $('puzzle-toolbar').replaceChildren();
    $('puzzle-toolbar').style.setProperty('--puzzle-tool-count', game.level.kinds.length + 1);
    const labels = { 0: '扇贝', 1: '螃蟹', 2: '小虾', 4: '海螺', 5: '鱼儿' };
    [...game.level.kinds, null].forEach(kind => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'puzzle-tool';
      button.dataset.kind = kind === null ? 'erase' : kind;
      button.setAttribute('aria-label', kind === null ? '拾起' : `选择${labels[kind]}`);
      button.setAttribute('aria-pressed', String(kind === selectedPuzzleKind));
      const glove = '<svg class="glove-art" viewBox="0 0 40 40" aria-hidden="true"><path d="M13 34v-5L6 21q-3-3-1-5t5 1l3 4V10q0-3 2.5-3t2.5 3v9V6q0-3 2.5-3T23 6v13V8q0-3 2.5-3T28 8v12-8q0-3 2.5-3T33 12v13q0 5-4 8v3H13Z" fill="#c8ddc0" stroke="#7f9f8a" stroke-width="1.4" stroke-linejoin="round"/><path d="M17 23q5-3 10 0m-6 1v4" fill="none" stroke="#95b199" stroke-width="1.2" stroke-linecap="round"/><path d="M16 10v7m5-10v9m5-7v8" fill="none" stroke="#f4f4d9" stroke-width="1.5" stroke-linecap="round"/><rect x="12" y="31" width="18" height="6" rx="2" fill="#f3d8b4" stroke="#b9a17f" stroke-width="1.3"/><path d="M16 33v2m4-2v2m4-2v2" stroke="#fff3d5" stroke-width="1.3" stroke-linecap="round"/></svg>';
      button.innerHTML = (kind === null ? glove : BeachArt.item(kind, 'puzzle-tool-' + kind)) + `<span>${kind === null ? '拾起' : labels[kind]}</span>`;
      button.addEventListener('click', () => {
        if (modalOpen || game.state !== 'playing') return;
        game.update(performance.now());
        syncGame();
        if (game.state !== 'playing') return;
        selectedPuzzleKind = kind;
        $('puzzle-toolbar').querySelectorAll('button').forEach(tool => tool.setAttribute('aria-pressed', String(tool === button)));
      });
      $('puzzle-toolbar').append(button);
    });
  }
  function buildPuzzleBoard() {
    return game.cards.map(card => {
      const button = document.createElement('button');
      const row = Math.floor(card.index / game.level.columns), column = card.index % game.level.columns;
      button.type = 'button';
      button.className = 'tile puzzle-cell';
      button.classList.toggle('puzzle-diagonal', row === column || row + column === game.level.columns - 1);
      button.dataset.index = card.index;
      button.addEventListener('click', () => {
        if (modalOpen) return;
        if (game.place(card.index, selectedPuzzleKind, performance.now())) {
          announce(selectedPuzzleKind === null ? '已拾起这一格的物品。' : `已填入${BeachArt.names[selectedPuzzleKind]}。`);
        }
        syncGame();
      });
      $('board').append(button);
      return button;
    });
  }
  function syncPuzzle() {
    const conflicts = game.conflicts;
    game.cards.forEach((card, index) => {
      const button = cardElements[index];
      if (button.dataset.value !== String(card.value)) {
        button.innerHTML = card.value === null ? '' : `<span class="puzzle-item">${BeachArt.item(card.value, 'puzzle-cell-' + index)}</span>`;
        button.dataset.value = String(card.value);
      }
      button.dataset.status = card.status;
      button.disabled = card.fixed || game.state !== 'playing';
      button.classList.toggle('puzzle-conflict', conflicts.has(index));
      button.setAttribute('aria-invalid', String(conflicts.has(index)));
      button.setAttribute('aria-label', `第${Math.floor(index / game.level.columns) + 1}行第${index % game.level.columns + 1}列，${card.value === null ? '空格' : BeachArt.names[card.value]}${card.fixed ? '，预放物品，不可修改' : ''}${conflicts.has(index) ? '，存在重复' : ''}`);
    });
    $('puzzle-feedback').classList.toggle('has-conflicts', conflicts.size > 0);
    $('puzzle-feedback').textContent = conflicts.size ? '标红的格子存在重复，换一种物品试试' : '选择物品，再点格子填入；拾起可改错';
    if (game.state === 'lost' && !resultShown) { resultShown = true; showResult(); }
  }
  function beginTimedGame() {
    closeModal(false);
    game.setTimerRunning(true, performance.now());
    syncGame();
    cardElements.find(tile => !tile.disabled)?.focus({ preventScroll: true });
  }
  function buildFogField() {
    const layer = document.createElement('div');
    layer.className = 'board-fog';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = BeachArt.fogField('board');
    const mask = layer.querySelector('.fog-mask-shape');
    game.cards.forEach(card => {
      if (!card.fog) return;
      const window = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      window.classList.add('fog-mask-cell');
      window.dataset.index = card.index;
      window.setAttribute('fill', 'white');
      window.setAttribute('rx', '15');
      window.style.opacity = '1';
      mask.append(window);
      fogMasks.set(card.index, window);
    });
    $('board').append(layer);
  }
  function layoutFogField() {
    if (!fogMasks.size) return;
    const board = $('board').querySelector('.board-fog').getBoundingClientRect();
    if (!board.width || !board.height) return;
    const style = getComputedStyle($('board'));
    // Meet at the middle of each gutter, with a tiny overlap to avoid seams.
    const spreadX = (parseFloat(style.columnGap) || 0) / 2 + .6;
    const spreadY = (parseFloat(style.rowGap) || 0) / 2 + .6;
    fogMasks.forEach((window, index) => {
      const tile = cardElements[index].getBoundingClientRect();
      window.setAttribute('x', (tile.left - board.left - spreadX) * 600 / board.width);
      window.setAttribute('y', (tile.top - board.top - spreadY) * 600 / board.height);
      window.setAttribute('width', (tile.width + spreadX * 2) * 600 / board.width);
      window.setAttribute('height', (tile.height + spreadY * 2) * 600 / board.height);
    });
  }
  function showLevelConditions() {
    openModal({ eyebrow: '留意这次赶海的要求', heading: '本关胜利条件', description: '在涨潮前完成全部配对，并达成以下要求。',
      art: 'notice-board', showConditions: true, conditionProgress: false,
      actions: [{ text: '我知道了', run: beginTimedGame }] });
  }
  function conditionLabel(condition, showProgress = true) {
    return showProgress && condition.type === 'maxMismatches'
      ? `配对失败的次数不得超过 ${condition.current} / ${condition.limit}次` : condition.label;
  }
  function renderConditions(container, showProgress = true) {
    container.replaceChildren();
    game.conditionStates.forEach(condition => {
      const label = conditionLabel(condition, showProgress);
      const row = document.createElement('li');
      row.className = 'condition-item';
      row.dataset.condition = condition.id;
      row.dataset.completed = String(condition.completed);
      row.classList.toggle('is-completed', condition.completed);
      row.classList.toggle('is-failed', condition.failed);
      row.setAttribute('aria-label', `${label}，${condition.completed ? '已完成' : '未完成'}`);
      const box = document.createElement('span');
      box.className = 'condition-box';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg>';
      const text = document.createElement('span');
      renderConditionText(text, { ...condition, label }, container.id);
      row.append(box, text);
      container.append(row);
    });
  }
  function renderConditionText(container, condition, placement) {
    const references = condition.itemRefs ?? [];
    let cursor = 0;
    let occurrence = 0;
    while (cursor < condition.label.length) {
      let next = null;
      references.forEach(reference => {
        if (!reference.text) return;
        const index = condition.label.indexOf(reference.text, cursor);
        if (index >= 0 && (!next || index < next.index)) next = { ...reference, index };
      });
      if (!next) { container.append(document.createTextNode(condition.label.slice(cursor))); break; }
      container.append(document.createTextNode(condition.label.slice(cursor, next.index)));
      const mention = document.createElement('span');
      mention.className = 'condition-item-mention';
      mention.append(document.createTextNode(next.text));
      const icon = document.createElement('span');
      icon.className = 'condition-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = BeachArt.item(next.kind, `condition-${placement}-${condition.id}-${occurrence++}`);
      mention.append(icon);
      container.append(mention);
      cursor = next.index + next.text.length;
    }
  }
  function scatterSand(button) {
    for (let i = 0; i < 7; i++) {
      const grain = document.createElement('i');
      grain.className = 'sand-particle';
      const size = 2 + Math.random() * 2;
      grain.style.cssText = `width:${size}px;height:${size}px;left:${30 + Math.random() * 40}%;top:${30 + Math.random() * 35}%;--dx:${(Math.random() - .5) * 65}px;--dy:${-10 - Math.random() * 40}px;`;
      button.append(grain);
      grain.addEventListener('animationend', () => grain.remove(), { once: true });
    }
  }
  function clearCollectionEffects() {
    flights.forEach(flight => flight.element.remove());
    flights = [];
    $('catch-effects').replaceChildren();
    $('time-reward').hidden = true;
    rewardUntil = rewardSeconds = 0;
  }
  function refreshBucketTarget() {
    layoutFogField();
    const layer = $('catch-effects').getBoundingClientRect();
    const target = $('bucket-target').getBoundingClientRect();
    bucketTarget = { x: target.left - layer.left, y: target.top - layer.top };
    if (!$('puzzle-sand-background').hidden) {
      const board = $('board').getBoundingClientRect();
      const controls = (isPuzzle() ? $('puzzle-controls') : document.querySelector('.collection')).getBoundingClientRect();
      const screen = $('play-screen').getBoundingClientRect();
      const artHeight = screen.width * 100 / 480;
      const top = board.bottom + Math.max(0, (controls.top - board.bottom - artHeight) / 2);
      $('puzzle-sand-background').style.setProperty('--sand-doodle-top', (top - screen.top) + 'px');
    }
  }
  function collectPair(pair) {
    refreshBucketTarget();
    const layer = $('catch-effects').getBoundingClientRect();
    const group = { kind: pair[0].value, number: game.pairs, delivered: false };
    pair.forEach((card, i) => {
      const rect = cardElements[card.index].getBoundingClientRect();
      const size = Math.min(rect.width - 4, 72);
      const element = document.createElement('span');
      element.className = 'catch-flight';
      element.dataset.kind = card.value;
      element.innerHTML = BeachArt.item(card.value, 'flight' + (++flightSerial));
      element.style.width = element.style.height = size + 'px';
      const x = rect.left - layer.left + rect.width / 2;
      const y = rect.top - layer.top + rect.height / 2;
      element.style.transform = `translate(${x - size / 2}px,${y - size / 2}px)`;
      $('catch-effects').append(element);
      flights.push({ element, x, y, size, start: animationTime + i * 30, duration: 480, last: i === pair.length - 1, group });
    });
    if (game.progress < displayedTide) tideRetreat = { from: displayedTide, start: animationTime, duration: 480 };
    rewardSeconds = animationTime < rewardUntil ? rewardSeconds + game.pairBonus / 1000 : game.pairBonus / 1000;
    rewardUntil = animationTime + 1000;
    $('time-reward').textContent = '+' + rewardSeconds + ' 秒';
    $('time-reward').hidden = false;
  }
  function deliverToBucket(group) {
    if (group.delivered) return;
    group.delivered = true;
    const find = document.createElement('span');
    const index = arrivedPairs++;
    find.className = 'bucket-find';
    find.dataset.kind = group.kind;
    find.innerHTML = BeachArt.item(group.kind, 'bucket' + group.number);
    const columns = Math.min(4, Math.ceil(Math.sqrt(game.totalPairs)));
    const rows = Math.ceil(game.totalPairs / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    find.style.width = find.style.height = (100 / columns + 8) + '%';
    find.style.left = (column * 100 / columns - 2 + (row % 2 ? 2 : 0)) + '%';
    find.style.top = (rows === 1 ? 45 : 72 - row * 72 / (rows - 1)) + '%';
    find.style.transform = `rotate(${(index * 13 % 29) - 14}deg)`;
    $('bucket-contents').append(find);
    bucketImpactAt = animationTime;
  }
  function updateCollectionEffects() {
    flights = flights.filter(flight => {
      const t = Math.max(0, Math.min(1, (animationTime - flight.start) / flight.duration));
      if (t >= 1) {
        flight.element.remove();
        if (flight.last) deliverToBucket(flight.group);
        return false;
      }
      let x = flight.x, y = flight.y, scale = 1, rotation = 0;
      if (t < .18) {
        const pop = Math.sin(t / .18 * Math.PI);
        y -= pop * 8;
        scale += pop * .14;
        rotation = pop * (flight.last ? 7 : -7);
      } else {
        const u = (t - .18) / .82;
        const controlX = flight.x + (bucketTarget.x - flight.x) * .22 + (flight.last ? 20 : -20);
        const controlY = Math.min(flight.y, bucketTarget.y) - 65;
        x = (1 - u) ** 2 * flight.x + 2 * (1 - u) * u * controlX + u ** 2 * bucketTarget.x;
        y = (1 - u) ** 2 * flight.y + 2 * (1 - u) * u * controlY + u ** 2 * bucketTarget.y;
        scale = 1 - .52 * u;
        rotation = u * (flight.last ? 16 : -16);
      }
      flight.element.style.transform = `translate(${x - flight.size / 2}px,${y - flight.size / 2}px) rotate(${rotation}deg) scale(${scale})`;
      flight.element.style.opacity = Math.min(1, (1 - t) * 12);
      return true;
    });
    const impact = Math.max(0, animationTime - bucketImpactAt);
    if (impact < 360) {
      const swing = Math.sin(impact / 360 * Math.PI * 3) * (1 - impact / 360);
      $('harvest-bucket').style.transform = `rotate(${swing * 3}deg) translateY(${Math.abs(swing) * 2}px)`;
    } else $('harvest-bucket').style.transform = '';
    if (animationTime >= rewardUntil) $('time-reward').hidden = true;
    else {
      $('time-reward').style.opacity = Math.min(1, (rewardUntil - animationTime) / 180);
      $('time-reward').style.transform = `translateY(${-3 * (1 - (rewardUntil - animationTime) / 1000)}px)`;
    }
  }
  function syncGame() {
    if (lastVersion === game.version) return;
    lastVersion = game.version;
    if (isPuzzle()) { syncPuzzle(); return; }
    game.cards.forEach((card, i) => {
      const element = cardElements[i];
      if (!element) return;
      if (previousStates[i] === 'open' && card.status === 'hidden') {
        element.classList.add('just-covered');
        element.addEventListener('animationend', event => {
          if (event.target.classList.contains('sand-cover')) element.classList.remove('just-covered');
        }, { once: true });
      }
      if (card.status !== previousStates[i]) {
        if (card.status !== 'hidden') element.classList.remove('just-covered');
        element.dataset.status = card.status;
        element.disabled = card.status !== 'hidden';
        const position = `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列`;
        element.setAttribute('aria-label', card.status === 'hidden' ? `${position}，未翻开的沙格` : `${position}，${BeachArt.names[card.value]}${card.status === 'matched' ? '，已收集' : ''}`);
      }
      if (card.fog) {
        element.dataset.fog = card.fog.covered ? 'covered' : 'clear';
        fogMasks.get(i).style.opacity = card.fog.covered ? '1' : '0';
        element.disabled = game.state !== 'playing' || (!card.fog.covered && card.status !== 'hidden');
        const position = `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列`;
        element.setAttribute('aria-label', card.fog.covered ? `${position}，雾遮蔽的格子，点击拨开` : card.status === 'matched' ? `${position}，雾已拨开，已收集的空格` : `${position}，雾已拨开，${card.status === 'hidden' ? '未翻开的沙格' : BeachArt.names[card.value]}`);
      }
      previousStates[i] = card.status;
    });
    $('pairs-count').textContent = game.pairs;
    $('harvest-bucket').setAttribute('aria-label', `收获桶，已收集${game.pairs}对，共${game.totalPairs}对`);
    $('level-objectives').hidden = game.conditions.length === 0;
    $('play-screen').classList.toggle('has-conditions', game.conditions.length > 0);
    renderConditions($('play-conditions'));
    if (tutorial?.active) tutorial.applyLocks();
    if (game.state === 'lost' && !resultShown && (game.failureReason !== 'conditions' || game.pairs < game.totalPairs || flights.length === 0)) {
      resultShown = true;
      showResult();
    }
  }
  function renderModalArt(art) {
    const container = $('modal-art');
    container.replaceChildren();
    container.className = 'modal-art';
    container.hidden = art === null;
    if (art === null) return;
    if (art === 'harvest') {
      // Reuse this run's actual collected items and pile positions in a static snapshot.
      const bucket = $('harvest-bucket').cloneNode(true);
      bucket.removeAttribute('id');
      bucket.style.transform = '';
      bucket.querySelector('#bucket-target')?.remove();
      const ids = new Map();
      bucket.querySelectorAll('[id]').forEach(element => {
        ids.set(element.id, 'result-' + element.id);
        element.id = ids.get(element.id);
      });
      bucket.querySelectorAll('*').forEach(element => {
        for (const attribute of Array.from(element.attributes)) {
          const value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
          if (value !== attribute.value) element.setAttribute(attribute.name, value);
        }
      });
      container.classList.add('modal-bucket-art');
      container.append(bucket);
    } else if (art === 'puzzle-result') {
      container.classList.add('modal-puzzle-art');
      const board = document.createElement('div');
      board.className = 'puzzle-complete-art';
      board.style.setProperty('--puzzle-columns', game.level.columns);
      game.cards.forEach(card => {
        const cell = document.createElement('span');
        cell.innerHTML = BeachArt.item(card.value, 'puzzle-result-' + card.index);
        board.append(cell);
      });
      container.append(board);
    } else if (art === 'notice-board') {
      container.innerHTML = BeachArt.noticeBoard();
    } else if (art === 'fog') {
      container.innerHTML = BeachArt.fog('modal');
    } else if (art === 'condition-failure') {
      container.innerHTML = BeachArt.conditionFailure();
    } else if (art === 'washed-bucket') {
      container.classList.add('modal-failure-art');
      container.innerHTML = BeachArt.washedBucket();
    } else container.innerHTML = BeachArt.item(art, 'modal');
  }
  function openModal({ eyebrow, heading, description, art = 0, result = false, immediateResult = false, artBelowHeading = false, fogIntro = false, showConditions = false, conditionProgress = true, actions }) {
    previousFocus = document.activeElement;
    modalOpen = true;
    $('modal-eyebrow').textContent = eyebrow;
    $('modal-eyebrow').hidden = !eyebrow;
    $('modal-heading').textContent = heading;
    $('modal-description').textContent = description;
    renderModalArt(art);
    $('modal-card').classList.toggle('result-card', result);
    $('modal-card').classList.toggle('immediate-result', immediateResult);
    $('modal-card').classList.toggle('species-card', artBelowHeading);
    $('modal-card').classList.toggle('fog-intro-card', fogIntro);
    $('modal-objectives').hidden = !showConditions || game.conditions.length === 0;
    if (showConditions) renderConditions($('modal-conditions'), conditionProgress);
    else $('modal-conditions').replaceChildren();
    $('modal-actions').replaceChildren();
    actions.forEach((action, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button ' + (i === 0 ? 'button-primary' : 'button-secondary');
      button.textContent = action.text;
      button.addEventListener('click', action.run);
      $('modal-actions').append(button);
    });
    $('modal-layer').hidden = false;
    screens.forEach(screen => { screen.inert = true; });
    $('modal-card').focus({ preventScroll: true });
  }
  function closeModal(restoreFocus = true) {
    $('modal-layer').hidden = true;
    modalOpen = false;
    screens.forEach(screen => { screen.inert = false; });
    if (restoreFocus && previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function resumeGame() {
    closeModal();
    game.resume(performance.now());
    syncGame();
  }
  function pauseGame() {
    if (currentScreen !== 'play' || modalOpen || !game.pause(performance.now())) { syncGame(); return; }
    syncGame();
    hideTideDanger();
    openModal({ eyebrow: '把这一刻，留在沙滩上', heading: '歇一歇，潮水等等。', description: isPuzzle() ? `游戏已暂停\n当前已填 ${game.filledCount} / ${game.cards.length} 格` : `游戏已暂停\n当前已收集 ${game.pairs} / ${game.totalPairs} 对`, art: null, showConditions: true,
      actions: [{ text: '继续赶海', run: resumeGame }, { text: '重新开始', run: startGame }, { text: '返回选关', run: () => showScreen('level') }] });
  }
  function showResult() {
    const won = game.state === 'won';
    const conditionFailure = game.failureReason === 'conditions';
    hideTideDanger();
    if (won) {
      if (!unlockAll) {
        completedLevels.add(game.level.id);
        try {
          localStorage.setItem('beach-pairs-completed-levels', JSON.stringify([...completedLevels]));
          if (game.level.id === 1) localStorage.setItem('beach-pairs-level-one', 'won');
        } catch (_) { /* In-memory progress still permits replay this session. */ }
      }
      announce(isPuzzle() ? '挑战成功！棋盘已填满，横、纵和两条对角线均无重复。' : `通关成功！${game.totalPairs}对赶海收获全部收集完成。`);
    } else announce(conditionFailure ? '未完成全部的条件，本次挑战未通过。' : '潮水已经漫过沙滩，本次赶海结束。');
    if (isPuzzle()) {
      openModal({ eyebrow: won ? '' : '潮起潮落，总有下一次',
        heading: won ? '挑战成功！' : '潮水先到了一步。',
        description: won ? '你在涨潮前完成了填图挑战！' : `这次填入了 ${game.filledCount} / ${game.cards.length} 格。\n整理一下思路，再挑战一次吧。`,
        art: won ? 'puzzle-result' : 'washed-bucket', result: true,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    const failedConditions = game.conditionStates.filter(condition => !condition.completed).map(condition => conditionLabel(condition)).join('\n');
    const immediateFailure = conditionFailure && game.pairs < game.totalPairs;
    openModal({ eyebrow: won ? `${game.totalPairs} 对收获，一份完整的海边记忆` : conditionFailure ? immediateFailure ? '这次没有达成赶海的要求' : '收获齐了，再留意一下要求' : '潮起潮落，总有下一次',
      heading: won ? '海的礼物，收好啦。' : conditionFailure ? '未完成全部的条件' : '潮水先到了一步。',
      description: won ? `你在涨潮前找到了全部赶海收获。\n这一程，共翻找了 ${game.turns} 次。` : conditionFailure ? `已收集 ${game.pairs} / ${game.totalPairs} 对。\n未满足：${failedConditions}` : `这次收集了 ${game.pairs} / ${game.totalPairs} 对赶海收获。\n记住刚才的发现，再试一次吧。`,
      art: won ? 'harvest' : conditionFailure ? 'condition-failure' : 'washed-bucket', result: true, immediateResult: immediateFailure,
      actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
  }
  function goToNextLevel() {
    const nextLevel = BeachLevels.find(level => level.id === game.level.id + 1);
    if (nextLevel) { startLevel(nextLevel); return; }
    openModal({ eyebrow: '下一片海岸，稍后相见', heading: '下一关即将开放', description: '你已经完成了当前开放的关卡。', art: isPuzzle() ? 'puzzle-result' : 'harvest',
      actions: [{ text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
  }
  function resizeCanvas() {
    const box = app.getBoundingClientRect();
    viewWidth = box.width;
    viewHeight = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    refreshBucketTarget();
    if (currentScreen === 'play') drawTide(performance.now());
  }
  function wavePath(y, phase, amplitude) {
    ctx.beginPath();
    for (let x = -10; x <= viewWidth + 10; x += 7) {
      const dy = Math.sin(x * .019 + phase) * amplitude + Math.sin(x * .037 - phase * .7) * amplitude * .34;
      if (x === -10) ctx.moveTo(x, y + dy); else ctx.lineTo(x, y + dy);
    }
  }
  function hideTideDanger() {
    dangerStrength = dangerPhase = 0;
    $('tide-danger').hidden = true;
    $('tide-danger').style.opacity = '0';
  }
  function updateTideDanger(frameMs) {
    if (game.state !== 'playing' || modalOpen) { hideTideDanger(); return; }
    const warningWindow = 10000;
    const urgency = Math.max(0, Math.min(1, 1 - game.remaining / warningWindow));
    const target = game.remaining <= warningWindow ? .42 + .58 * urgency : 0;
    const step = Math.min(frameMs, 50);
    dangerStrength += (target - dangerStrength) * (1 - Math.exp(-step / 150));
    if (target === 0 && dangerStrength < .005) { hideTideDanger(); return; }
    // Slow, soft pulses; rising urgency increases their strength and pace.
    dangerPhase += step * Math.PI * 2 / (1250 - urgency * 350);
    const pulse = .48 + .52 * (.5 - .5 * Math.cos(dangerPhase));
    $('tide-danger').hidden = false;
    $('tide-danger').style.opacity = (dangerStrength * pulse).toFixed(3);
  }
  function drawTide(now) {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    const progress = displayedTide;
    const y = viewHeight - 9 - progress * (viewHeight + 5);
    const phase = animationTime * .001;
    const amplitude = 5 + progress * 2;
    wavePath(y + 5, phase + .8, amplitude + 2);
    ctx.lineTo(viewWidth + 10, viewHeight + 10);
    ctx.lineTo(-10, viewHeight + 10);
    ctx.closePath();
    ctx.fillStyle = 'rgba(82,170,173,0.065)';
    ctx.fill();
    wavePath(y, phase, amplitude);
    ctx.lineTo(viewWidth + 10, viewHeight + 10);
    ctx.lineTo(-10, viewHeight + 10);
    ctx.closePath();
    const water = ctx.createLinearGradient(0, Math.max(0, y), 0, viewHeight + 1);
    water.addColorStop(0, 'rgba(79,173,181,0.14)');
    water.addColorStop(1, 'rgba(68,157,171,0.20)');
    ctx.fillStyle = water;
    ctx.fill();
    wavePath(y, phase, amplitude);
    ctx.strokeStyle = 'rgba(255,255,243,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    wavePath(y + 4, phase + .22, amplitude);
    ctx.strokeStyle = 'rgba(240,255,246,0.34)';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const rippleY = y + 35 + i * 69;
      if (rippleY > viewHeight) break;
      const rippleX = ((i * 83 + animationTime * .007) % (viewWidth + 70)) - 40;
      ctx.beginPath();
      ctx.ellipse(rippleX, rippleY, 30 + i % 3 * 5, 3, -.12, .15, 2.8);
      ctx.strokeStyle = 'rgba(248,255,238,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    // Time-based progression; render at 60 FPS even on higher-refresh displays.
    const interval = 1000 / 60;
    const delta = now - previousFrame;
    const elapsedFrames = Math.floor((delta + .7) / interval);
    if (elapsedFrames < 1) return;
    previousFrame += elapsedFrames * interval;
    if (currentScreen === 'menu') {
      menuOffset = (menuOffset + elapsedFrames * interval * .016) % 328;
      $('menu-pattern-scroll').style.transform = `translate3d(0,${-menuOffset}px,0)`;
      return;
    }
    if (currentScreen !== 'play') return;
    if (game.state === 'playing' || game.state === 'won' || game.state === 'lost') {
      animationTime += Math.min(elapsedFrames * interval, 50);
    }
    if (game.state === 'playing') {
      game.update(now);
      syncGame();
      if (tutorial?.active && !modalOpen) tutorial.update();
    }
    if (game.state !== 'paused') {
      if (game.state === 'lost' && game.failureReason === 'timeout') { displayedTide = 1; tideRetreat = null; }
      else if (tideRetreat) {
        const t = Math.min(1, (animationTime - tideRetreat.start) / tideRetreat.duration);
        const ease = 1 - (1 - t) ** 3;
        displayedTide = tideRetreat.from + (game.progress - tideRetreat.from) * ease;
        if (t >= 1) tideRetreat = null;
      } else displayedTide = game.progress;
    }
    updateCollectionEffects();
    updateTideDanger(elapsedFrames * interval);
    if ((game.state === 'won' || (game.state === 'lost' && game.failureReason === 'conditions')) && flights.length === 0 && !resultShown) {
      resultShown = true;
      showResult();
    }
    drawTide(now);
    renderedFrames++;
    if (now - metricsStart >= 1000) {
      measuredFps = renderedFrames * 1000 / (now - metricsStart);
      metricsStart = now;
      renderedFrames = 0;
    }
  }
  $('start-button').addEventListener('click', () => startLevel(BeachLevels[0]));
  $('select-level-button').addEventListener('click', () => { currentChapter = 0; showScreen('level'); });
  $('chapter-previous').addEventListener('click', () => selectChapter(currentChapter - 1, true));
  $('chapter-next').addEventListener('click', () => selectChapter(currentChapter + 1, true));
  $('settings-button').addEventListener('click', () => showScreen('settings'));
  // Audio remains interface-only; free testing does not mutate genuine progress.
  document.querySelectorAll('.setting-switch').forEach(button => {
    button.addEventListener('click', () => {
      const enabled = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(enabled));
      button.querySelector('.switch-state').textContent = enabled ? 'ON' : 'OFF';
      if (button.id === 'unlock-switch') {
        unlockAll = enabled;
        try { localStorage.setItem('beach-pairs-unlock-all', enabled ? 'on' : 'off'); } catch (_) { /* Session-only fallback. */ }
        selectChapter(currentChapter);
        announce(enabled ? '自由测试已开启，已开放关卡均可选择，测试通关不改变原有进度。' : '自由测试已关闭，已恢复原有通关进度。');
      }
    });
  });
  document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => showScreen('menu')));
  $('pause-button').addEventListener('click', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pauseGame(); });
  window.addEventListener('pagehide', () => { if (game.state === 'playing' && !modalOpen) game.pause(performance.now()); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (modalOpen && game.state === 'paused') resumeGame();
      else if (currentScreen === 'play') pauseGame();
      else if (currentScreen !== 'menu') showScreen('menu');
    }
    if (event.key === 'Tab' && modalOpen) {
      const buttons = Array.from($('modal-actions').querySelectorAll('button'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('modal-card'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === $('modal-card'))) { event.preventDefault(); first.focus(); }
    }
  });
  new ResizeObserver(resizeCanvas).observe(app);
  resizeCanvas();
  requestAnimationFrame(frame);
  // Read-only diagnostics for local acceptance checks; no hidden in-game controls.
  window.beachDiagnostics = Object.freeze({
    snapshot: () => ({ screen: currentScreen, levelId: game.level.id, mode: game.level.type || 'matching', filledCount: isPuzzle() ? game.filledCount : null, values: isPuzzle() ? game.cards.map(card => card.value) : null, fixed: isPuzzle() ? game.cards.map(card => card.fixed) : null, conflicts: isPuzzle() ? [...game.conflicts] : null, rows: game.level.rows, columns: game.level.columns, totalPairs: game.totalPairs, state: game.state, failureReason: game.failureReason, conditions: game.conditionStates, lastMatchedKind: game.lastMatchedKind, pairs: game.pairs, mismatches: game.mismatches, turns: game.turns, elapsed: game.elapsed, duration: game.duration, bonusTime: game.bonusTime, remaining: game.remaining, progress: game.progress, displayedTide, flights: flights.length, bucketPairs: arrivedPairs, fps: measuredFps, statuses: game.cards.map(card => card.status), fog: game.cards.map(card => card.fog ? { ...card.fog } : null), activeTime: game.activeTime, modalOpen, timerRunning: game.timerRunning, tutorialStep: tutorial?.active ? tutorial.step : null, tutorialTarget: tutorial?.active ? tutorial.target : null })
  });
})();
