(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const canvas = $('tide-canvas');
  const ctx = canvas.getContext('2d');
  const game = new MemoryGame({ level: BeachLevels[0] });
  const screens = Array.from(document.querySelectorAll('.screen'));
  let currentScreen = 'menu';
  let cardElements = [];
  let lastVersion = -1;
  let previousStates = [];
  let resultShown = false;
  let modalOpen = false;
  let previousFocus = null;
  let savedProgress = false;
  let viewWidth = 0;
  let viewHeight = 0;
  let previousFrame = 0;
  let animationTime = 0;
  let renderedFrames = 0;
  let metricsStart = performance.now();
  let measuredFps = 0;
  try { savedProgress = localStorage.getItem('beach-pairs-level-one') === 'won'; } catch (_) { /* Optional storage. */ }

  $('menu-art').innerHTML = BeachArt.item(0, 'menu');
  $('level-art').innerHTML = BeachArt.item(1, 'level');
  $('exit-art').innerHTML = BeachArt.item(2, 'exit');
  $('collection-track').innerHTML = Array.from({ length: 18 }, () => '<span class="collection-slot"></span>').join('');
  const progressSlots = Array.from($('collection-track').children);
  if (savedProgress) $('level-note').textContent = '这片浅湾已被你点亮，随时可以再来。';

  function announce(message) { $('announcement').textContent = message; }
  function focusScreen(id) {
    const target = $(id + '-screen').querySelector('h1, button');
    if (target) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }
  function showScreen(id) {
    closeModal(false);
    if (currentScreen === 'play' && id !== 'play') game.state = 'idle';
    currentScreen = id;
    screens.forEach(screen => { screen.hidden = screen.id !== id + '-screen'; });
    canvas.style.display = id === 'play' ? 'block' : 'none';
    $('tide-warning').hidden = true;
    focusScreen(id);
  }
  function startGame() {
    const now = performance.now();
    game.start(now);
    metricsStart = previousFrame = now;
    renderedFrames = measuredFps = 0;
    animationTime = 0;
    lastVersion = -1;
    previousStates = [];
    resultShown = false;
    $('board').replaceChildren();
    cardElements = game.cards.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.index = card.index;
      button.dataset.status = 'hidden';
      button.setAttribute('aria-label', `第${Math.floor(card.index / 6) + 1}行第${card.index % 6 + 1}列，未翻开的沙格`);
      button.innerHTML = `<span class="shell-face">${BeachArt.item(card.value, 'card' + card.index)}</span><span class="sand-cover"></span>`;
      button.addEventListener('click', () => {
        const oldPairs = game.pairs;
        if (game.select(card.index, performance.now())) {
          scatterSand(button);
          if (game.pairs > oldPairs) announce(`找到一对${BeachArt.names[card.value]}，已经收集${game.pairs}对。`);
          else announce(`翻开了${BeachArt.names[card.value]}。`);
          syncGame();
        } else if (game.state === 'lost') syncGame();
      });
      $('board').append(button);
      return button;
    });
    showScreen('play');
    syncGame();
    drawTide(performance.now());
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
  function syncGame() {
    if (lastVersion === game.version) return;
    lastVersion = game.version;
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
        const position = `第${Math.floor(i / 6) + 1}行第${i % 6 + 1}列`;
        element.setAttribute('aria-label', card.status === 'hidden' ? `${position}，未翻开的沙格` : `${position}，${BeachArt.names[card.value]}${card.status === 'matched' ? '，已收集' : ''}`);
      }
      previousStates[i] = card.status;
    });
    $('pairs-count').textContent = game.pairs;
    progressSlots.forEach((slot, i) => slot.classList.toggle('filled', i < game.pairs));
    $('collection-track').setAttribute('aria-label', `已收集${game.pairs}对，共18对`);
    $('play-hint').textContent = game.pending ? '记住它们的位置，薄沙很快会重新覆盖' : game.selected.length ? '再翻开一格，找找它的另一半' : game.pairs ? '又一份海的礼物，继续寻找吧' : '翻开两格，寻找相同的赶海收获';
    if ((game.state === 'won' || game.state === 'lost') && !resultShown) {
      resultShown = true;
      showResult();
    }
  }
  function openModal({ eyebrow, heading, description, art = 0, result = false, actions }) {
    previousFocus = document.activeElement;
    modalOpen = true;
    $('modal-eyebrow').textContent = eyebrow;
    $('modal-heading').textContent = heading;
    $('modal-description').textContent = description;
    $('modal-art').innerHTML = BeachArt.item(art, 'modal');
    $('modal-card').classList.toggle('result-card', result);
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
    openModal({ eyebrow: '把这一刻，留在沙滩上', heading: '歇一歇，潮水等等。', description: '游戏已暂停，潮水暂时停止上涨。\n回来时，接着寻找刚才的发现。', art: 2,
      actions: [{ text: '继续赶海', run: resumeGame }, { text: '重新开始', run: startGame }, { text: '返回选关', run: () => showScreen('level') }] });
  }
  function showResult() {
    const won = game.state === 'won';
    $('tide-warning').hidden = true;
    if (won) {
      try { localStorage.setItem('beach-pairs-level-one', 'won'); } catch (_) { /* Not required to play. */ }
      $('level-note').textContent = '这片浅湾已被你点亮，随时可以再来。';
      announce('通关成功！18对赶海收获全部收集完成。');
    } else announce('潮水已经漫过沙滩，本次赶海结束。');
    openModal({ eyebrow: won ? '18 对收获，一份完整的海边记忆' : '潮起潮落，总有下一次', heading: won ? '海的礼物，收好啦。' : '潮水先到了一步。', description: won ? `你在涨潮前找到了全部赶海收获。\n这一程，共翻找了 ${game.turns} 次。` : `这次收集了 ${game.pairs} / 18 对赶海收获。\n记住刚才的发现，再试一次吧。`, art: won ? 0 : 3, result: true,
      actions: [{ text: won ? '再来一次' : '重新挑战', run: startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
  }
  function resizeCanvas() {
    const box = app.getBoundingClientRect();
    viewWidth = box.width;
    viewHeight = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (currentScreen === 'play') drawTide(performance.now());
  }
  function wavePath(y, phase, amplitude) {
    ctx.beginPath();
    for (let x = -10; x <= viewWidth + 10; x += 7) {
      const dy = Math.sin(x * .019 + phase) * amplitude + Math.sin(x * .037 - phase * .7) * amplitude * .34;
      if (x === -10) ctx.moveTo(x, y + dy); else ctx.lineTo(x, y + dy);
    }
  }
  function drawTide(now) {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    const progress = game.progress;
    const y = viewHeight + 13 - progress * (viewHeight + 27);
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
    if (currentScreen !== 'play') return;
    if (game.state === 'playing') {
      animationTime += Math.min(elapsedFrames * interval, 50);
      game.update(now);
      syncGame();
      $('tide-warning').hidden = game.progress < .83 || game.state !== 'playing';
    }
    drawTide(now);
    renderedFrames++;
    if (now - metricsStart >= 1000) {
      measuredFps = renderedFrames * 1000 / (now - metricsStart);
      metricsStart = now;
      renderedFrames = 0;
    }
  }
  $('start-button').addEventListener('click', () => showScreen('level'));
  $('settings-button').addEventListener('click', () => showScreen('settings'));
  $('exit-button').addEventListener('click', () => {
    showScreen('exit');
    if (window.opener) window.close();
  });
  document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => showScreen('menu')));
  $('level-one').addEventListener('click', startGame);
  $('pause-button').addEventListener('click', pauseGame);
  $('back-button').addEventListener('click', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pauseGame(); });
  window.addEventListener('pagehide', () => { if (game.state === 'playing') game.pause(performance.now()); });
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
    snapshot: () => ({ screen: currentScreen, state: game.state, pairs: game.pairs, turns: game.turns, elapsed: game.elapsed, duration: game.duration, progress: game.progress, fps: measuredFps, statuses: game.cards.map(card => card.status), modalOpen })
  });
})();
