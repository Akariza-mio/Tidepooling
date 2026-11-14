(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const canvas = $('tide-canvas');
  const ctx = canvas.getContext('2d');
  const surfReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const touchRendering = matchMedia('(pointer: coarse)');
  let game = new MemoryGame({ level: BeachLevels[0] });
  const screens = Array.from(document.querySelectorAll('.screen'));
  const guide = new BeachGuide();
  const achievements = new BeachAchievements(undefined, showAchievementToast);
  let currentScreen = 'menu';
  let achievementToastFrame = null;
  let achievementToastTimer = null;
  let achievementToastCleanup = null;
  const achievementToastQueue = [];
  const musicTracks = [$('theme-music'), $('level-music')];
  let musicEnabled = true;
  let musicUnlocked = false;
  let musicPageHidden = false;
  let musicTrack = null;
  let musicAttempt = 0;
  let soundEnabled = true;
  let soundContext = null;
  let soundOutput = null;
  let sandSoundBuffer = null;
  let waveSoundBuffer = null;
  let lastMatchSound = -Infinity;
  const soundVoices = new Set();
  function stopEffects(suspend = false) {
    for (const voice of soundVoices) {
      try { voice.source.stop(); } catch (_) { /* The short sound may have ended. */ }
      voice.nodes.forEach(node => node.disconnect());
    }
    soundVoices.clear();
    lastMatchSound = -Infinity;
    if (suspend && soundContext?.state === 'running') soundContext.suspend().catch(() => {});
  }
  function fillWaveTexture(samples, rate) {
    // Broad overlapping swells and soft foam, without a sharp impact transient.
    const swells = [[0, 1.45, .8], [.55, 1.55, .65], [1.15, 1.45, .45]];
    let waterBody = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate, noise = Math.random() * 2 - 1;
      waterBody = waterBody * .96 + noise * .04;
      let swell = 0;
      for (const [onset, length, strength] of swells) {
        const age = t - onset;
        if (age > 0 && age < length) swell += strength * (.5 - .5 * Math.cos(2 * Math.PI * age / length));
      }
      const foam = .8 + .12 * Math.sin(2 * Math.PI * 9 * t) + .08 * Math.sin(2 * Math.PI * 17 * t);
      samples[i] = (waterBody * 1.8 + noise * .38 * foam) * swell;
    }
    for (let drop = 0; drop < 36; drop++) {
      const onset = .25 + Math.random() * 1.8, decay = .045 + Math.random() * .045;
      const frequency = 300 + Math.random() * 650;
      const amplitude = .025 + Math.random() * .025;
      const first = Math.floor(onset * rate), last = Math.min(samples.length, first + Math.ceil(decay * 6 * rate));
      for (let i = first; i < last; i++) {
        const age = (i - first) / rate;
        const envelope = (1 - Math.exp(-age / .018)) * Math.exp(-age / decay);
        samples[i] += Math.sin(2 * Math.PI * frequency * (age + 2 * age * age)) * amplitude * envelope;
      }
    }
  }
  function playEffect(kind) {
    if (!soundEnabled || document.hidden || musicPageHidden) return;
    try {
      if (!soundContext) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        soundContext = new Audio({ latencyHint: 'interactive' });
        soundOutput = soundContext.createGain();
        soundOutput.gain.value = 1;
        soundOutput.connect(soundContext.destination);
      }
      if (soundContext.state !== 'running' && soundContext.state !== 'closed') soundContext.resume().catch(() => {});
      if (soundContext.state === 'closed') return;
      const now = soundContext.currentTime;
      if (kind === 'sand' || kind === 'wave') {
        if (soundVoices.size >= 12) return;
        // Cache the noise textures; the wave swells once, rather than looping.
        const wave = kind === 'wave', duration = wave ? 2.6 : .15;
        let buffer = wave ? waveSoundBuffer : sandSoundBuffer;
        if (!buffer) {
          const rate = wave ? Math.min(22050, soundContext.sampleRate) : soundContext.sampleRate;
          buffer = soundContext.createBuffer(1, Math.ceil(rate * duration), rate);
          const samples = buffer.getChannelData(0);
          if (wave) fillWaveTexture(samples, rate);
          else for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
          if (wave) waveSoundBuffer = buffer; else sandSoundBuffer = buffer;
        }
        const source = soundContext.createBufferSource(), filter = soundContext.createBiquadFilter(), gain = soundContext.createGain();
        source.buffer = buffer;
        filter.type = wave ? 'lowpass' : 'bandpass';
        filter.Q.value = wave ? .6 : .65;
        filter.frequency.setValueAtTime(wave ? 1800 : 2200, now);
        if (wave) filter.frequency.exponentialRampToValueAtTime(3200, now + .7);
        filter.frequency.exponentialRampToValueAtTime(wave ? 1200 : 800, now + duration);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(wave ? .5 : .22, now + (wave ? .45 : .012));
        if (wave) {
          gain.gain.linearRampToValueAtTime(.42, now + 1.2);
          gain.gain.linearRampToValueAtTime(.25, now + 1.85);
        }
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        source.connect(filter); filter.connect(gain); gain.connect(soundOutput);
        const voice = { source, nodes: [source, filter, gain] };
        soundVoices.add(voice);
        source.onended = () => { voice.nodes.forEach(node => node.disconnect()); soundVoices.delete(voice); };
        source.start(now); source.stop(now + duration);
        return;
      }
      // A bulk slot-machine clear should sound like one reward, not many stacked bells.
      if (kind === 'match' && now - lastMatchSound < .06) return;
      if (kind === 'match') lastMatchSound = now;
      const notes = {
        match: [[660, 0, .20, .12], [880, .07, .24, .10]],
        achievement: [[523.25, .12, .20, .095], [659.25, .23, .23, .095], [783.99, .34, .26, .105], [1046.5, .48, .44, .115], [1567.98, .51, .32, .035]],
        move: [[190, 0, .11, .20], [320, .014, .055, .04]],
        bucket: [[430, 0, .13, .17], [970, 0, .065, .055], [1530, 0, .035, .025]],
        lever: [[170, 0, .11, .18], [620, .055, .045, .09], [470, .11, .045, .075], [340, .18, .09, .11]],
        wrong: [[392, 0, .14, .12], [294, .10, .19, .14]],
        tap: [[520, 0, .055, .08]]
      }[kind];
      const pitchEndRatio = { achievement: 1, match: .97, move: .42, bucket: .92, wrong: .98 }[kind] ?? .65;
      for (const [frequency, delay, duration, volume] of notes) {
        if (soundVoices.size >= 12) break;
        const oscillator = soundContext.createOscillator(), gain = soundContext.createGain();
        const start = now + delay, end = start + duration;
        oscillator.type = kind === 'tap' || kind === 'lever' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * pitchEndRatio, end);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume * 1.5, start + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain); gain.connect(soundOutput);
        const voice = { source: oscillator, nodes: [oscillator, gain] };
        soundVoices.add(voice);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); soundVoices.delete(voice); };
        oscillator.start(start); oscillator.stop(end + .01);
      }
    } catch (_) { /* Audio support/permission must never block game input. */ }
  }
  musicTracks.forEach(track => { track.volume = .22; });
  function syncMusic() {
    const target = musicEnabled && musicUnlocked && !document.hidden && !musicPageHidden
      && !(currentScreen === 'play' && game.state === 'paused')
      ? musicTracks[currentScreen === 'play' ? 1 : 0] : null;
    musicTracks.forEach(track => { if (track !== target && !track.paused) track.pause(); });
    if (musicTrack !== target) musicAttempt++;
    musicTrack = target;
    if (target && target.paused) {
      // Play inside the click/key event. Rejected autoplay can retry on the next gesture.
      const request = ++musicAttempt;
      const attempt = target.play();
      if (attempt) attempt.then(() => {
        if (musicTrack !== target || !musicEnabled || document.hidden || musicPageHidden) target.pause();
      }).catch(() => { if (request === musicAttempt && musicTrack === target) musicTrack = null; });
    }
  }
  let cardElements = [];
  let lastVersion = -1;
  let previousStates = [];
  let resultShown = false;
  let modalOpen = false;
  let previousFocus = null;
  const completedLevels = new Set();
  const chapterNames = ['初入浅滩', '月下独捉', '礁间寻宝', '踏浪而寻', '挑战EX'];
  const chapterNumerals = ['一', '二', '三', '四', '五'];
  const levelNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  let currentChapter = 0;
  let chapterTransition = null;
  let viewWidth = 0;
  let viewHeight = 0;
  let tideClearTop = 0;
  let tideNeedsPaint = true;
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
  let lastJourneyPenalty = 0;
  let lastSurfWave = 0;
  let lastSurfMarker = '';
  let lastSlotAutoPairs = 0;
  try {
    const progressVersionKey = 'beach-pairs-progress-version';
    // Every exported update starts both achievement and level progress afresh once.
    if (localStorage.getItem(progressVersionKey) !== BeachAchievements.revision) {
      localStorage.setItem('beach-pairs-completed-levels', '[]');
      localStorage.removeItem('beach-pairs-level-one');
      localStorage.setItem(progressVersionKey, BeachAchievements.revision);
    } else {
      const stored = JSON.parse(localStorage.getItem('beach-pairs-completed-levels') || '[]');
      if (Array.isArray(stored)) stored.forEach(id => {
        if (Number.isInteger(id) && id >= 1 && id <= 50) completedLevels.add(id);
      });
      if (localStorage.getItem('beach-pairs-level-one') === 'won') completedLevels.add(1);
    }
  } catch (_) { /* Optional storage; this session still starts with all levels playable. */ }

  buildMenuPattern();
  $('chapter-day-scene').append(document.querySelector('.landscape').cloneNode(true));
  $('chapter-reef-scene').innerHTML = BeachArt.reefScene('chapter');
  $('chapter-surf-scene').innerHTML = BeachArt.surfScene('chapter');
  $('chapter-surf-bridge').innerHTML = BeachArt.surfBridge();
  buildChapterPages();
  $('puzzle-sand-background').innerHTML = BeachArt.sandMatrices();
  const playNight = $('chapter-night-scene').cloneNode(true);
  playNight.id = 'play-night-scene';
  playNight.style.opacity = '1';
  playNight.hidden = true;
  playNight.insertAdjacentHTML('beforeend', `<span class="play-night-moon">${BeachArt.moon('play-sky')}</span>`);
  $('play-screen').prepend(playNight);
  const playReef = document.createElement('div');
  playReef.id = 'play-reef-scene';
  playReef.className = 'chapter-reef-scene';
  playReef.setAttribute('aria-hidden', 'true');
  playReef.hidden = true;
  playReef.innerHTML = BeachArt.reefScene('play');
  $('play-screen').prepend(playReef);
  const playSurf = document.createElement('div');
  playSurf.id = 'play-surf-scene';
  playSurf.className = 'chapter-surf-scene';
  playSurf.setAttribute('aria-hidden', 'true');
  playSurf.hidden = true;
  playSurf.innerHTML = BeachArt.surfScene('play');
  $('play-screen').prepend(playSurf);

  function isPuzzle() { return game.level.type === 'diagonalPuzzle'; }
  function isGrassPuzzle() { return game.level.type === 'grassPuzzle'; }
  function isBucketSort() { return game.level.type === 'bucketSort'; }
  function isArithmetic() { return game.level.type === 'arithmetic'; }
  function isSlotMachine() { return game.level.type === 'slotMachine'; }
  function isJourney() { return game.level.type === 'fogJourney'; }

  function chapterEmblem(chapter, suffix) {
    if (chapter === 1) return BeachArt.moon(suffix);
    if (chapter === 2) return BeachArt.reefEmblem(suffix);
    if (chapter === 3) return BeachArt.surfEmblem(suffix);
    if (chapter === 4) return BeachArt.harvestEmblem(suffix);
    return BeachArt.item(1, suffix);
  }
  function buildChapterPages() {
    const lock = '<svg class="level-lock-mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
    const cleared = '<svg class="level-clear-mark" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
    chapterNames.forEach((name, chapter) => {
      const page = document.createElement('section');
      page.className = 'chapter-page';
      page.id = 'chapter-' + (chapter + 1);
      page.setAttribute('aria-labelledby', 'chapter-heading-' + chapter);
      const emblem = chapterEmblem(chapter, 'chapter-heading-' + chapter);
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
        button.innerHTML = `<span class="chapter-level-number">${String(slot + 1).padStart(2, '0')}</span><span class="chapter-level-copy"><span class="chapter-level-name">第${levelNumerals[slot]}关</span><span class="chapter-level-status"></span></span><span class="chapter-level-mark">${lock}${cleared}</span>`;
        button.addEventListener('click', () => {
          if (level && isLevelUnlocked(id)) startLevel(level);
        });
        grid.append(button);
      }
      $('chapter-pages').append(page);
      const indicator = document.createElement('span');
      indicator.className = 'chapter-indicator';
      indicator.innerHTML = `<span class="chapter-indicator-art" aria-hidden="true">${chapterEmblem(chapter, 'chapter-indicator-' + chapter)}</span>`;
      indicator.setAttribute('role', 'listitem');
      indicator.setAttribute('aria-label', `第${chapterNumerals[chapter]}大关，${name}`);
      $('chapter-indicators').append(indicator);
    });
    selectChapter(0);
  }
  function isLevelUnlocked(id) {
    return BeachLevels.some(level => level.id === id);
  }
  function selectChapter(chapter, moveFocus = false) {
    finishChapterTransition(false);
    const previousChapter = currentChapter;
    currentChapter = Math.max(0, Math.min(4, chapter));
    $('level-screen').classList.toggle('is-night-chapter', currentChapter === 1);
    $('level-screen').classList.toggle('is-reef-chapter', currentChapter === 2);
    $('level-screen').classList.toggle('is-surf-chapter', currentChapter === 3);
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
        const available = Boolean(level && isLevelUnlocked(id));
        if (won) completed++;
        button.disabled = !available;
        button.classList.toggle('is-completed', won);
        button.classList.toggle('is-unlocked', available);
        button.querySelector('.chapter-level-status').textContent = won ? '已通关' : available ? '可挑战' : '待开放';
        button.querySelector('.chapter-level-mark').hidden = available && !won;
      });
      page.querySelector('.chapter-progress').textContent = `已通关 ${completed} / 10`;
      page.querySelector('.chapter-note').hidden = true;
      page.querySelector('.chapter-note').textContent = '';
    });
    $('chapter-help').hidden = true;
    $('chapter-help').textContent = '';
    const animate = moveFocus && currentScreen === 'level' && Math.abs(previousChapter - currentChapter) === 1
      && Math.max(previousChapter, currentChapter) <= 4 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      const exCrossing = Math.min(previousChapter, currentChapter) === 3;
      const surfCrossing = Math.min(previousChapter, currentChapter) >= 2;
      const options = { duration: exCrossing ? 1000 : surfCrossing ? 900 : 720, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'both' };
      const outgoingScene = chapterScene(previousChapter);
      const incomingScene = chapterScene(currentChapter);
      outgoingScene.hidden = incomingScene.hidden = false;
      const animations = [
        from.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * 105}%)` }], options),
        to.animate([{ transform: `translateX(${direction * 105}%)` }, { transform: 'translateX(0)' }], options),
        outgoingScene.animate([
          { opacity: 1, transform: 'translateX(0) scale(1)' },
          { opacity: 0, transform: `translateX(${-direction * 3}%) scale(1.08)` }
        ], options),
        incomingScene.animate([
          { opacity: 0, transform: `translateX(${direction * 3}%) scale(1.08)` },
          { opacity: 1, transform: 'translateX(0) scale(1)' }
        ], options)
      ];
      if (surfCrossing) {
        const bridge = $('chapter-surf-bridge');
        bridge.hidden = false;
        animations.push(bridge.animate([
          { transform: `translateX(${direction * 110}%)`, opacity: 0 },
          { opacity: exCrossing ? .55 : .7, offset: .4 },
          { opacity: exCrossing ? .35 : .5, offset: .65 },
          { transform: `translateX(${-direction * 110}%)`, opacity: 0 }
        ], options));
      }
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
  function chapterScene(chapter) {
    return $(chapter === 1 ? 'chapter-night-scene' : chapter === 2 ? 'chapter-reef-scene' : chapter === 3 ? 'chapter-surf-scene' : 'chapter-day-scene');
  }
  function settleChapterBackground() {
    const selected = chapterScene(currentChapter);
    for (const scene of [$('chapter-day-scene'), $('chapter-night-scene'), $('chapter-reef-scene'), $('chapter-surf-scene')]) {
      scene.hidden = scene !== selected;
      scene.style.opacity = scene === selected ? '1' : '0';
    }
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
    $('chapter-surf-bridge').hidden = true;
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
  function hideAchievementToast(immediate = false) {
    if (immediate) achievementToastQueue.length = 0;
    clearTimeout(achievementToastTimer);
    clearTimeout(achievementToastCleanup);
    if (achievementToastFrame !== null) cancelAnimationFrame(achievementToastFrame);
    achievementToastFrame = achievementToastTimer = achievementToastCleanup = null;
    const toast = $('achievement-toast');
    toast.classList.remove('is-visible');
    const finish = () => {
      toast.hidden = true;
      $('achievement-toast-name').textContent = '';
      $('achievement-toast-icon').replaceChildren();
      achievementToastCleanup = null;
      if (!immediate) showNextAchievementToast();
    };
    if (immediate) finish();
    else achievementToastCleanup = setTimeout(finish, 350);
  }
  function showAchievementToast(achievement) {
    if (currentScreen !== 'play' || document.hidden) return;
    achievementToastQueue.push(achievement);
    if ($('achievement-toast').hidden) showNextAchievementToast();
  }
  function showNextAchievementToast() {
    if (currentScreen !== 'play' || document.hidden || !achievementToastQueue.length) return;
    const achievement = achievementToastQueue.shift();
    const toast = $('achievement-toast');
    $('achievement-toast-name').textContent = achievement.name;
    $('achievement-toast-icon').innerHTML = achievements.iconMarkup(achievement, 'toast');
    toast.hidden = false;
    playEffect('achievement');
    // Commit the off-screen starting position before sliding into view.
    toast.getBoundingClientRect();
    achievementToastFrame = requestAnimationFrame(() => {
      achievementToastFrame = null;
      toast.classList.add('is-visible');
      achievementToastTimer = setTimeout(() => hideAchievementToast(), 3000);
    });
  }
  function focusScreen(id) {
    const target = $(id + '-screen').querySelector('h1, button');
    if (target) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }
  function showScreen(id) {
    hideAchievementToast(true);
    finishChapterTransition(false);
    closeModal(false);
    clearCollectionEffects();
    if (id !== 'play' && tutorial) { tutorial.dispose(); tutorial = null; }
    if (currentScreen === 'play' && id !== 'play') game.state = 'idle';
    // A fresh visit from outside gameplay restarts level music. Next/retry stay
    // on the play screen, so the same track can continue uninterrupted.
    if (id === 'play' && currentScreen !== 'play') musicTracks[1].currentTime = 0;
    currentScreen = id;
    syncMusic();
    screens.forEach(screen => { screen.hidden = screen.id !== id + '-screen'; });
    canvas.style.display = id === 'play' ? 'block' : 'none';
    hideTideDanger();
    if (id !== 'play') $('start-countdown').hidden = true;
    if (id === 'level') selectChapter(currentChapter);
    if (id === 'achievements') achievements.render($('achievement-list'), $('achievement-summary'));
    focusScreen(id);
  }
  function startLevel(level) {
    game = level.type === 'arithmetic' ? new ArithmeticGame({ level }) : level.type === 'slotMachine' ? new SlotMachine({ level }) : level.type === 'bucketSort' ? new BucketSort({ level }) : level.surf ? new SurfGame({ level }) : level.type === 'grassPuzzle' ? new GrassPuzzle({ level }) : level.type === 'fogJourney' ? new FogJourney({ level }) : level.type === 'diagonalPuzzle' ? new DiagonalPuzzle({ level }) : new MemoryGame({ level });
    startGame();
  }
  function startGame() {
    tideNeedsPaint = true;
    if (tutorial) { tutorial.dispose(); tutorial = null; }
    currentChapter = Math.floor((game.level.id - 1) / 10);
    const now = performance.now();
    game.start(now);
    const chapterIndex = Math.floor((game.level.id - 1) / 10);
    const localLevelIndex = (game.level.id - 1) % 10;
    $('play-chapter').textContent = chapterNames[chapterIndex];
    $('play-number').textContent = String(localLevelIndex + 1).padStart(2, '0');
    $('play-screen').setAttribute('aria-label', `${chapterNames[chapterIndex]}，第${levelNumerals[localLevelIndex]}关`);
    if (isPuzzle() || isGrassPuzzle() || game.level.id === 1 || game.level.newItem || game.level.intro || game.conditions.length) game.setTimerRunning(false, now);
    $('play-screen').classList.toggle('is-night-play', chapterIndex === 1);
    $('play-night-scene').hidden = chapterIndex !== 1;
    $('play-screen').classList.toggle('is-reef-play', chapterIndex === 2);
    $('play-reef-scene').hidden = chapterIndex !== 2;
    $('play-screen').classList.toggle('is-surf-play', chapterIndex === 3);
    $('play-surf-scene').hidden = chapterIndex !== 3;
    $('play-screen').classList.toggle('is-puzzle', isPuzzle());
    $('play-screen').classList.toggle('is-grass-puzzle', isGrassPuzzle());
    $('play-screen').classList.toggle('is-bucket-sort', isBucketSort());
    $('play-screen').classList.toggle('is-slot-machine', isSlotMachine());
    $('play-screen').classList.toggle('is-finale', Boolean(game.level.endingMessage));
    $('play-screen').classList.toggle('is-arithmetic', isArithmetic());
    $('arithmetic-panel').hidden = !isArithmetic();
    $('arithmetic-panel').dataset.round = '';
    $('arithmetic-answer').value = '';
    $('slot-machine-panel').hidden = !isSlotMachine();
    $('slot-machine-progress').hidden = !isSlotMachine();
    $('sort-rules').hidden = !isBucketSort();
    $('sort-panel').hidden = !isBucketSort();
    $('play-screen').classList.remove('is-grass-solved');
    $('grass-puzzle-rules').hidden = !isGrassPuzzle();
    $('grass-puzzle-panel').hidden = !isGrassPuzzle();
    $('play-screen').classList.toggle('is-journey', isJourney());
    $('journey-panel').hidden = !isJourney();
    $('journey-target').hidden = !isJourney();
    $('play-screen').classList.toggle('is-dense-board', !isPuzzle() && Math.max(game.level.rows, game.level.columns) >= 8);
    $('play-screen').classList.toggle('has-conditions', game.conditions.length > 0);
    $('play-screen').classList.toggle('has-surf-conditions', Boolean(game.level.surf && game.conditions.length > 0));
    $('level-objectives').hidden = game.conditions.length === 0;
    $('puzzle-rules').hidden = !isPuzzle();
    $('puzzle-controls').hidden = !isPuzzle();
    document.querySelector('.collection').hidden = isPuzzle() || isJourney() || isGrassPuzzle() || isBucketSort() || isSlotMachine() || isArithmetic();
    document.querySelector('.board-caption').hidden = isPuzzle() || isJourney() || isGrassPuzzle() || isBucketSort() || isSlotMachine() || isArithmetic();
    // Sand-drawn numbers belong only to the first chapter's filling puzzles.
    $('puzzle-sand-background').hidden = !isPuzzle();
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
    lastJourneyPenalty = 0;
    lastSurfWave = 0;
    lastSurfMarker = '';
    lastSlotAutoPairs = 0;
    $('board').style.setProperty('--board-columns', game.level.columns);
    $('board').style.setProperty('--board-rows', game.level.rows);
    $('board').classList.toggle('has-surf', Boolean(game.level.surf));
    $('board').style.aspectRatio = `${game.level.columns} / ${game.level.rows}`;
    $('board').setAttribute('aria-label', isBucketSort() ? `${game.buckets.length}个收获桶，每桶最多${game.capacity}件物品` : `${game.level.rows}行${game.level.columns}列${isGrassPuzzle() ? '拔草解结棋盘' : isJourney() ? '迷雾寻物地图' : isPuzzle() ? '赶海填图棋盘' : '赶海配对棋盘'}`);
    $('pairs-total').textContent = ` / ${game.totalPairs} 对`;
    if (isPuzzle()) buildPuzzleTools();
    cardElements = isBucketSort() ? buildBucketSortBoard() : isGrassPuzzle() ? buildGrassPuzzleBoard() : isJourney() ? buildJourneyBoard() : isPuzzle() ? buildPuzzleBoard() : game.cards.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.index = card.index;
      button.dataset.status = 'hidden';
      button.setAttribute('aria-label', `第${Math.floor(card.index / game.level.columns) + 1}行第${card.index % game.level.columns + 1}列，未翻开的沙格`);
      button.innerHTML = `<span class="shell-face" data-kind="${card.value}">${BeachArt.item(card.value, 'card' + card.index)}</span><span class="sand-cover"></span>`;
      if (card.tangled) appendSeagrassArt(button, card.index);
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
        const oldMismatches = game.mismatches;
        const oldBonus = game.bonusTime;
        if (game.select(card.index, now)) {
          playEffect('sand');
          scatterSand(button);
          if (game.pairs > oldPairs) {
            const pair = game.cards.filter(c => c.status === 'matched' && previousStates[c.index] !== 'matched');
            const awardedTime = game.bonusTime - oldBonus;
            collectPair(pair, awardedTime);
            const rewardMessage = game.pairBonus === 0 ? '本关配对不奖励时间' : awardedTime > 0 ? `增加${Math.round(awardedTime / 100) / 10}秒` : '潮水已退到底';
            announce(`找到一对${BeachArt.names[card.value]}，${rewardMessage}，已经收集${game.pairs}对。`);
          }
          else if (game.mismatches > oldMismatches && game.conditions.some(condition => condition.type === 'mismatchSwap')) {
            announce('配对失败，盖回后这两个格子的物品会互换。');
          }
          else if (game.mismatches > oldMismatches && game.conditions.some(condition => condition.type === 'mismatchTideRise')) {
            tideRetreat = { from: displayedTide, start: animationTime, duration: 420 };
            announce('配对失败，潮水上涨了。');
          } else announce(`翻开了${BeachArt.names[card.value]}。`);
          syncGame();
          if (tutorial?.active) tutorial.onSelect();
        } else if (game.state === 'lost') syncGame();
      });
      $('board').append(button);
      return button;
    });
    if (game.level.fog) buildFogField();
    if (game.level.surf) buildSurfField();
    showScreen('play');
    $('bucket-contents').replaceChildren();
    arrivedPairs = 0;
    bucketImpactAt = -1000;
    $('harvest-bucket').style.transform = '';
    refreshBucketTarget();
    syncGame();
    drawTide(performance.now());
    if (isSlotMachine() && game.level.intro === 'slotMachine') {
      openModal({ eyebrow: '', heading: '老虎机！', art: 'slot-intro',
        description: '配对成功可以获得1次拉杆机会\n两个物品相同，则消除一对，三个相同则全部消除！',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (isBucketSort() && game.level.intro === 'bucketSort') {
      openModal({ eyebrow: '', heading: '把收获分好类吧！', art: 'sort-intro',
        description: '先点击一个桶，选中最上面的物品，再点击另一个桶放入。\n每次只能移动一件，且只能放进空桶或相同物品上方。\n每桶最多装四件，在涨潮前把每种收获分别装满一桶即可通关！',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (isGrassPuzzle()) {
      if (game.conditions.length) showLevelConditions();
      else openModal({ eyebrow: '', heading: '挑战！', art: 'seagrass',
        description: '点击任意沙格，本格及相邻的上下左右的海草状态都会切换。\n有海草的变成沙地，没有海草的则长出海草。\n在涨潮前清空全部海草！',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (isJourney()) {
      $('journey-panel').querySelector('p').textContent = game.level.noRevisit
        ? '点击相邻格移动 · 障碍所在处不可通过 · 走过的灰格不可再踩'
        : '点击上下左右相邻格子移动 · 障碍所在处不可通过';
      $('journey-satchel').innerHTML = game.level.treasures.map((item, i) => `<span class="journey-catch" data-index="${item.index}">${BeachArt.item(item.kind, 'journey-bag-' + i)}<span>${BeachArt.names[item.kind]}</span><b aria-hidden="true">✓</b></span>`).join('');
      syncJourney();
      refreshBucketTarget();
      openModal({ eyebrow: '', heading: '挑战！', art: 'journey',
        description: game.level.noRevisit ? '这次走过的格子将不能重复踏入' : '请在一定时间内寻找并拾起与屏幕上方展示对应的物品\n如若超时，物品会刷新，潮水会大幅上涨\n在游戏开始前，你可以暂时查看五种物品和障碍的位置\n随后雾会弥漫整个海滩，你的能见度会大大下降\n点击相邻格子移动，在涨潮前拾起全部物品，即可通关！\n注意：如果不小心拾起了与需求不符的物品，会直接失败！',
        emphasizeLastLine: !game.level.noRevisit,
        actions: [{ text: '我知道了', run: () => { closeModal(false); game.beginPreview(performance.now()); syncGame(); } }] });
    } else if (game.level.intro === 'doubleSurf') {
      openModal({ eyebrow: '', heading: '海浪会同时冲刷两处！', art: 'surf',
        description: '每次来浪会同时冲刷两行、两列，或一行一列。',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.intro === 'surf') {
      openModal({ eyebrow: '', heading: '你来到了风浪更大的海湾！', art: 'surf',
        description: '海浪每隔一定时间会随机冲刷某些行或列\n在海浪冲刷时，你不能对被冲刷的行或列进行操作！\n并且，海浪还会使潮水略微上涨。',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.intro === 'seagrass') {
      openModal({ eyebrow: '', heading: '当太阳升起，你发现自己到了礁石岸边！',
        description: '礁石间的沙格会有烦人的海草！\n被海草覆盖的格子可以直接翻开，如果配对成功则会正常消除\n如果配对失败，一段时间内该格将被海草缠绕，不可再翻开，且四面相邻的格子都会被海草覆盖',
        emphasizeLastLine: true,
        art: 'seagrass', fogIntro: true, actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.intro === 'nightFog') {
      openModal({ eyebrow: '', heading: '你一直忘我地赶海，不知不觉到了晚上！',
        description: '海边在夜间会起雾，雾可以点击拨开，但是它会在一定时间后恢复\n最好记住雾下面的格子是否已经被配对！',
        art: 'fog', fogIntro: true, actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.newItem) {
      const { kind, name } = game.level.newItem;
      openModal({ eyebrow: '', heading: `新品种增加 —— ${name}`, description: '', art: kind, artBelowHeading: true,
        actions: [{ text: '我知道了', run: () => game.conditions.length ? showLevelConditions() : beginTimedGame() }] });
    } else if (isPuzzle()) {
      openModal({ eyebrow: '', heading: '挑战！', art: game.level.id === 5 ? 'puzzle-intro' : 'notice-board',
        description: '在涨潮前选择物品填满棋盘，让每行，每列和对角线都不重复，即可完成挑战！',
        actions: [{ text: '我知道了', run: beginTimedGame }] });
    } else if (game.level.id === 1) {
      achievements.beginTutorialVisit(game);
      tutorial = new BeachTutorial({ game, tiles: cardElements, onLayout: refreshBucketTarget, announce,
        onComplete: () => { lastVersion = -1; syncGame(); refreshBucketTarget(); } });
      openModal({ eyebrow: '初入浅滩 · 第一关', heading: '一起试试怎么赶海？',
        description: '跟着箭头，认识配对和潮水。', art: 1,
        actions: [
          { text: '开始教学', run: () => { achievements.recordTutorialChoice(game, false); closeModal(false); tutorial.begin(); } },
          { text: '跳过教程', run: () => { closeModal(false); tutorial.finish(true); achievements.recordTutorialChoice(game, true); } }
        ] });
    } else if (game.conditions.length) showLevelConditions();
  }
  function arithmeticExpression(node, item, parentPrecedence = 0) {
    if ('kind' in node) return item(node.kind);
    if ('number' in node) return String(node.number);
    const precedence = node.op === '*' ? 2 : 1;
    const text = arithmeticExpression(node.left, item, precedence) + (node.op === '*' ? ' × ' : ' + ') + arithmeticExpression(node.right, item, precedence);
    return precedence < parentPrecedence ? `( ${text} )` : text;
  }
  function syncArithmetic() {
    const panel = $('arithmetic-panel'), round = game.round;
    if (panel.dataset.round !== String(game.roundIndex)) {
      panel.dataset.round = game.roundIndex;
      $('arithmetic-answer').value = '';
      let serial = 0;
      const item = kind => `<span class="arithmetic-item" aria-hidden="true">${BeachArt.item(kind, `arithmetic-${game.roundIndex}-${serial++}`)}</span>`;
      $('arithmetic-clues').replaceChildren();
      for (const clue of round.clues) {
        const row = document.createElement('div');
        row.className = 'arithmetic-equation';
        row.setAttribute('role', 'img');
        row.setAttribute('aria-label', clue.terms.map(term => `${term.coefficient === 1 ? '' : term.coefficient + '乘'}${BeachArt.names[term.kind]}`).join('加') + '等于' + clue.total);
        row.innerHTML = clue.terms.map(term => `<span class="arithmetic-term">${term.coefficient === 1 ? '' : `<span class="arithmetic-coefficient">${term.coefficient}×</span>`}${item(term.kind)}</span>`).join('<span aria-hidden="true">+</span>') + `<span aria-hidden="true">= ${clue.total}</span>`;
        $('arithmetic-clues').append(row);
      }
      const question = document.createElement('div');
      question.className = 'arithmetic-equation';
      question.setAttribute('role', 'img');
      question.setAttribute('aria-label', arithmeticExpression(round.target, kind => BeachArt.names[kind]) + '等于多少');
      question.innerHTML = arithmeticExpression(round.target, item) + '<span aria-hidden="true">= ?</span>';
      $('arithmetic-question').replaceChildren(question);
      $('arithmetic-order').textContent = game.roundIndex >= 7 ? '先算乘法，括号优先 · 本轮数值独立' : '每轮物品的数值独立';
      $('arithmetic-round').textContent = `第${game.roundIndex + 1}轮 / 共${game.totalRounds}轮`;
    }
    $('arithmetic-progress').replaceChildren(...Array.from({ length: game.totalRounds }, (_, i) => {
      const dot = document.createElement('span');
      dot.className = i < game.completed ? 'is-done' : i === game.completed ? 'is-current' : '';
      return dot;
    }));
    $('arithmetic-progress').setAttribute('aria-label', `已完成${game.completed}轮`);
    const messages = { ready: '看一看公式，再算出答案。', correct: game.state === 'won' ? '十轮全部答对啦！' : `上一题答对了！继续第${game.roundIndex + 1}轮。`, wrong: '答错了，再算一算。', invalid: '请输入一个整数答案。' };
    const message = game.state === 'lost' ? '潮水已经漫过沙滩。' : messages[game.feedback];
    if ($('arithmetic-feedback').textContent !== message) $('arithmetic-feedback').textContent = message;
    $('arithmetic-feedback').classList.toggle('is-wrong', game.feedback === 'wrong' || game.feedback === 'invalid');
    const disabled = game.state !== 'playing' || !game.timerRunning;
    $('arithmetic-form').querySelectorAll('button,input').forEach(control => { control.disabled = disabled; });
    if (game.state === 'lost' && !resultShown) { resultShown = true; showResult(); }
  }
  function syncSlotMachine() {
    const symbols = game.displayReels, stopped = game.stoppedReels;
    $('slot-machine-panel').classList.toggle('is-spinning', game.phase === 'spinning');
    $('slot-reels').setAttribute('aria-busy', String(game.phase === 'spinning'));
    $('slot-reels').querySelectorAll('.slot-reel').forEach((reel, index) => {
      const kind = surfReducedMotion.matches && !stopped[index] ? game.reels[index] : symbols[index];
      reel.classList.toggle('is-turning', !stopped[index]);
      reel.classList.toggle('is-winning', Boolean(game.result?.indices.length && game.reels[index] === game.result.kind));
      reel.setAttribute('aria-label', `第${index + 1}槽，${stopped[index] ? BeachArt.names[kind] : '转动中'}`);
      const item = reel.firstElementChild;
      if (item.dataset.kind !== String(kind)) { item.dataset.kind = kind; item.innerHTML = BeachArt.item(kind, 'slot-reel-' + index); }
    });
    game.cards.forEach(card => { cardElements[card.index].classList.toggle('is-slot-clearing', game.phase === 'matching' && game.result.indices.includes(card.index)); });
    if (game.autoPairs > lastSlotAutoPairs) {
      const cards = game.result.indices.map(index => game.cards[index]);
      for (let i = 0; i < cards.length; i += 2) collectPair(cards.slice(i, i + 2), 0, game.pairs - cards.length / 2 + i / 2 + 1);
      lastSlotAutoPairs = game.autoPairs;
    }
    $('slot-lever').disabled = game.state !== 'playing' || !game.timerRunning || game.phase !== 'idle' || game.credits < 1 || Boolean(game.pending) || game.selected.length > 0;
    const name = game.result?.kind == null ? '' : BeachArt.names[game.result.kind];
    const messages = { ready: '先翻格配对，获得拉杆机会。', earned: '配对成功！获得1次拉杆机会，可以累积。', spinning: '转转转......', mismatch: '这次没有配成一对，再找找吧。', miss: '这次没有相同物品，继续翻格配对吧。', pair: `两个${name}！自动消去一对。`, triple: `三个${name}！清除剩余的${game.result?.count / 2}对。`, empty: '这类物品已配完，继续寻找其他配对吧。', won: '棋盘上的收获全都配好啦！', timeout: '潮水已经漫过沙滩。' };
    const message = game.phase === 'idle' && game.selected.length && !game.pending ? '先完成当前配对，再使用拉杆。' : messages[game.feedback];
    if ($('slot-feedback').textContent !== message) $('slot-feedback').textContent = message;
    $('slot-count').textContent = `${game.pairs} / ${game.totalPairs}`;
    $('slot-credits').textContent = game.credits;
  }
  function buildJourneyBoard() {
    return game.cards.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile journey-cell';
      button.dataset.index = card.index;
      button.innerHTML = '<span class="journey-content"></span>';
      button.addEventListener('click', () => {
        if (modalOpen) return;
        const count = game.collectedCount;
        const moved = game.move(card.index, performance.now());
        if (moved) playEffect('move');
        if (moved || game.state === 'lost') announce(game.feedback);
        if (game.collectedCount > count) {
          playEffect('match');
          announce(`拾到${BeachArt.names[game.level.treasures.find(item => item.index === card.index).kind]}，已收集${game.collectedCount}件。`);
        }
        syncGame();
      });
      $('board').append(button);
      return button;
    });
  }
  function buildBucketSortBoard() {
    $('board').dataset.bucketCount = String(game.buckets.length);
    return game.buckets.map((bucket, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sort-bucket';
      button.dataset.index = index;
      button.addEventListener('click', () => {
        if (modalOpen) return;
        if (game.select(index, performance.now())) playEffect('bucket');
        syncGame();
      });
      $('board').append(button);
      return button;
    });
  }
  function syncBucketSort() {
    game.buckets.forEach((bucket, i) => {
      const button = cardElements[i];
      button.classList.toggle('is-selected', game.source === i);
      button.classList.toggle('is-sorted', game.isSorted(i));
      button.classList.toggle('can-receive', game.source !== null && game.canMove(game.source, i));
      button.setAttribute('aria-pressed', String(game.source === i));
      button.setAttribute('aria-label', `第${i + 1}桶，${bucket.length ? '从下到上：' + bucket.map(kind => BeachArt.names[kind]).join('、') : '空桶'}，${bucket.length} / ${game.capacity}件${game.isSorted(i) ? '，已分类完成' : ''}`);
      button.disabled = game.state !== 'playing' || !game.timerRunning;
      const contents = bucket.join(',');
      if (button.dataset.contents !== contents) {
        button.dataset.contents = contents;
        button.innerHTML = `<span class="sort-stack" aria-hidden="true">${Array.from({ length: game.capacity }, (_, slot) => `<span class="sort-slot ${slot >= bucket.length ? 'is-empty' : ''} ${slot === bucket.length - 1 ? 'is-top' : ''}">${slot < bucket.length ? BeachArt.item(bucket[slot], `sort-${i}-${slot}`) : ''}</span>`).join('')}</span><span class="sort-number" aria-hidden="true">${i + 1}</span><span class="sort-check" aria-hidden="true" ${game.isSorted(i) ? '' : 'hidden'}>✓</span>`;
        if (game.lastMove?.to === i) button.querySelector('.is-top')?.classList.add('sort-arrived');
      }
      const check = button.querySelector('.sort-check');
      if (check) check.hidden = !game.isSorted(i);
    });
    $('sort-count').textContent = `${game.sortedCount} / ${game.totalKinds}`;
    $('sort-moves').textContent = game.turns;
    $('sort-undo').disabled = !game.canUndo;
    if (game.state === 'lost' && !resultShown) { resultShown = true; showResult(); }
  }
  function buildGrassPuzzleBoard() {
    return game.cards.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile grass-cell';
      button.dataset.index = card.index;
      const kind = game.level.rewards[card.index % game.level.rewards.length];
      button.innerHTML = `<span class="shell-face">${BeachArt.item(kind, 'grass-reward-' + card.index)}</span><span class="sand-cover"></span><span class="seagrass-cover" aria-hidden="true">${BeachArt.seagrass('grass-puzzle-' + card.index)}</span>`;
      button.addEventListener('click', () => {
        if (modalOpen) return;
        if (game.select(card.index, performance.now())) {
          playEffect('sand');
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) game.lastAffected.forEach(index => {
            cardElements[index].animate([{ boxShadow: '0 0 0 3px #78a58bab, 0 0 14px #c3d69b99' }, { boxShadow: '0 0 0 0 #78a58b00' }], { duration: 260, easing: 'ease-out' });
          });
          announce(`已牵动本格及相邻海草，剩余${game.grassCount}格海草。`);
        }
        syncGame();
      });
      $('board').append(button);
      return button;
    });
  }
  function syncGrassPuzzle() {
    game.cards.forEach((card, i) => {
      const button = cardElements[i];
      button.dataset.status = card.status;
      button.setAttribute('aria-pressed', String(card.grass));
      button.setAttribute('aria-label', `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列，${card.grass ? '有海草' : '沙地'}，点击牵动本格与上下左右`);
      button.disabled = game.state !== 'playing' || !game.timerRunning;
    });
    $('play-screen').classList.toggle('is-grass-solved', game.state === 'won');
    $('grass-puzzle-count').textContent = game.grassCount;
    $('grass-puzzle-moves').textContent = game.turns;
    renderConditions($('play-conditions'));
    if (game.state === 'lost' && !resultShown) { resultShown = true; showResult(); }
  }
  function syncJourney() {
    game.cards.forEach((card, i) => {
      const button = cardElements[i];
      const visible = !card.fog.covered;
      const current = game.position === i;
      const spent = game.isSpent(i);
      const treasure = game.level.treasures.find(item => item.index === i);
      const itemHere = treasure && !game.collected.has(i);
      button.dataset.fog = visible ? 'clear' : 'covered';
      fogMasks.get(i).style.opacity = visible ? '0' : '1';
      button.dataset.terrain = visible ? card.value === -1 ? 'reef' : card.value === -2 ? 'pool' : 'sand' : 'unknown';
      button.classList.toggle('is-current', current);
      button.classList.toggle('is-spent', spent);
      button.classList.toggle('is-next', game.phase === 'exploring' && game.isAdjacent(i) && card.value === 0 && !spent);
      button.disabled = game.state !== 'playing' || game.phase !== 'exploring' || !game.isAdjacent(i) || spent;
      const key = `${visible}-${current}-${Boolean(itemHere)}`;
      if (button.dataset.paint !== key) {
        button.dataset.paint = key;
        button.firstElementChild.innerHTML = !visible ? '' : (card.value < 0 ? BeachArt.journeySymbol(card.value === -1 ? 'reef' : 'pool')
          : itemHere ? BeachArt.item(treasure.kind, 'journey-' + i) : '')
          + (current ? `<span class="journey-player">${BeachArt.journeySymbol('footprints')}</span>` : '');
      }
      const position = `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列`;
      const label = spent ? '已经走过的灰格，不可再次踏入' : !visible ? '迷雾遮蔽' : card.value < 0 ? card.value === -1 ? '礁石，不可通过' : '潮池，不可通过'
        : itemHere ? BeachArt.names[treasure.kind] : '沙滩通路';
      button.setAttribute('aria-label', `${position}，${label}${current ? '，你在这里' : ''}`);
    });
    const target = game.target;
    const targetArt = $('journey-target-art');
    const targetKey = target ? String(target.kind) : 'none';
    if (targetArt.dataset.kind !== targetKey) {
      targetArt.dataset.kind = targetKey;
      targetArt.innerHTML = target ? BeachArt.item(target.kind, 'journey-target') : BeachArt.journeySymbol('footprints');
    }
    const seconds = target ? Math.ceil(game.targetRemaining / 1000) : null;
    $('journey-target-name').textContent = target ? BeachArt.names[target.kind] : game.state === 'won' ? '全部找到' : '准备寻找';
    $('journey-target-seconds').textContent = seconds === null ? '—' : String(seconds).padStart(2, '0');
    $('journey-target-seconds').setAttribute('aria-label', seconds === null ? '观察阶段' : `本轮剩余 ${seconds} 秒`);
    $('journey-target').classList.toggle('is-urgent', seconds !== null && seconds <= 3 && seconds > 0);
    $('journey-target').classList.toggle('is-paused', game.state === 'paused');
    $('journey-target').classList.toggle('is-penalty', Boolean(game.penaltyActive));
    if (game.penalties > lastJourneyPenalty) {
      lastJourneyPenalty = game.penalties;
      tideRetreat = { from: displayedTide, start: animationTime, duration: 420 };
      announce('未按时找到目标，潮水上涨，剩余时间减少20秒。');
    }
    $('journey-count').textContent = `${game.collectedCount} / ${game.totalTreasures} 件`;
    $('journey-satchel').querySelectorAll('.journey-catch').forEach(chip => {
      const picked = game.collected.has(Number(chip.dataset.index));
      chip.classList.toggle('is-picked', picked);
      chip.setAttribute('aria-label', `${chip.querySelector('span').textContent}，${picked ? '已拾取' : '未拾取'}`);
    });
    if ((game.state === 'won' || game.state === 'lost') && !resultShown) { resultShown = true; showResult(); }
  }
  function buildPuzzleTools() {
    selectedPuzzleKind = game.level.kinds[0];
    $('puzzle-toolbar').replaceChildren();
    $('puzzle-toolbar').style.setProperty('--puzzle-tool-count', game.level.kinds.length + 1);
    const labels = BeachArt.names;
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
    openModal({ eyebrow: '留意这次赶海的要求', heading: '本关胜利条件', description: isGrassPuzzle() ? '在涨潮前清空全部海草，并达成以下要求。' : '在涨潮前完成全部配对，并达成以下要求。',
      art: 'notice-board', showConditions: true, conditionProgress: false,
      actions: [{ text: '我知道了', run: beginTimedGame }] });
  }
  function buildSurfField(targetCount = game.level.surf.targetCount ?? 1) {
    for (let index = $('board').querySelectorAll('.board-surf').length; index < targetCount; index++) {
      const layer = document.createElement('div');
      layer.className = 'board-surf';
      layer.dataset.target = index;
      layer.setAttribute('aria-hidden', 'true');
      layer.hidden = true;
      layer.innerHTML = '<div class="surf-warning"><span>!</span><span>!</span></div><div class="surf-visual"><div class="surf-band"></div></div>';
      $('board').append(layer);
    }
  }
  function layoutSurfField() {
    $('board').querySelectorAll('.board-surf').forEach((layer, targetIndex) => {
      const target = game.surfTargets[targetIndex];
      if (!target) return;
      const { axis, index } = target;
      // Anchor to grid lines so resizing never leaves stale exposed sand.
      layer.style.gridRow = axis === 'row' ? `${index + 1} / span 1` : '1 / -1';
      layer.style.gridColumn = axis === 'column' ? `${index + 1} / span 1` : '1 / -1';
      layer.classList.toggle('is-column', axis === 'column');
    });
  }
  function syncSurf() {
    buildSurfField(game.surfTargets.length);
    const layers = $('board').querySelectorAll('.board-surf');
    if (!layers.length) return;
    $('play-screen').classList.toggle('is-surf-paused', game.state !== 'playing' || !game.timerRunning);
    const active = ['arriving', 'washing', 'retreating'].includes(game.surfPhase);
    let travel = 0, opacity = 1;
    if (active) {
      // Drive the long arrival/retreat with play time so pause freezes them exactly.
      const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
      const arrival = smooth((game.surfTime - game.waveStartedAt) / game.level.surf.arrival);
      const retreat = smooth((game.surfTime - game.waveUntil) / game.level.surf.departure);
      travel = surfReducedMotion.matches ? 0 : (retreat - (1 - arrival)) * 105;
      opacity = surfReducedMotion.matches ? 1 : arrival * (1 - retreat);
    }
    layers.forEach((layer, targetIndex) => {
      const target = game.surfTargets[targetIndex];
      layer.hidden = game.surfPhase === 'calm' || !target;
      layer.dataset.phase = game.surfPhase;
      if (!target) return;
      const band = layer.querySelector('.surf-band');
      if (band.dataset.axis !== target.axis) {
        band.dataset.axis = target.axis;
        band.innerHTML = BeachArt.surfBand(target.axis, 'target-' + targetIndex);
      }
      if (active) {
        band.style.transform = `${target.axis === 'column' ? 'translateY' : 'translateX'}(${travel.toFixed(3)}%)`;
        band.style.opacity = opacity.toFixed(3);
      }
    });
    const marker = [game.surfPhase, ...game.surfTargets.map(target => target.axis + target.index), game.nextWaveAt].join(':');
    if (marker !== lastSurfMarker) {
      layoutSurfField();
      if (game.surfPhase === 'warning') announce(`注意，${game.surfTargets.map(target => `第${target.index + 1}${target.axis === 'row' ? '行' : '列'}`).join('、')}即将被海浪冲刷。`);
      lastSurfMarker = marker;
    }
    if (game.waveCount > lastSurfWave) {
      lastSurfWave = game.waveCount;
      playEffect('wave');
      tideRetreat = { from: displayedTide, start: animationTime, duration: 420 };
      announce('海浪来了，潮水上涨了。');
    }
  }
  function conditionLabel(condition, showProgress = true) {
    if (showProgress && condition.type === 'minGrassMatches') return `${condition.label}（${condition.current} / ${condition.target}）`;
    if (showProgress && condition.type === 'maxTurns') return `总翻动次数不能超过 ${condition.current} / ${condition.limit}次`;
    if (showProgress && condition.type === 'maxGrass') return `海草覆盖的格子不能超过 ${condition.current} / ${condition.limit} 格`;
    return showProgress && condition.type === 'maxMismatches'
      ? condition.label.replace(/\d+(?=次)/, ` ${condition.current} / ${condition.limit}`) : condition.label;
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
    if ((isJourney() || isGrassPuzzle()) && currentScreen === 'play') {
      const screen = $('play-screen');
      const style = getComputedStyle(screen);
      const width = screen.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const occupied = [...screen.children].filter(child => !child.classList.contains('board-wrap'))
        .reduce((total, child) => {
          const css = getComputedStyle(child);
          return total + (css.display === 'none' || css.position === 'absolute' ? 0 : child.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom));
        }, 0);
      const height = screen.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - occupied - 4;
      screen.style.setProperty(isGrassPuzzle() ? '--grass-board-size' : '--journey-board-size', Math.floor(Math.max(0, Math.min(width, height))) + 'px');
    }
    layoutFogField();
    layoutSurfField();
    const layer = $('catch-effects').getBoundingClientRect();
    const target = (isSlotMachine() ? $('slot-count') : $('bucket-target')).getBoundingClientRect();
    bucketTarget = { x: target.left - layer.left + (isSlotMachine() ? target.width / 2 : 0), y: target.top - layer.top + (isSlotMachine() ? target.height / 2 : 0) };
    if (!$('puzzle-sand-background').hidden) {
      const board = $('board').getBoundingClientRect();
      const controls = (isPuzzle() ? $('puzzle-controls') : document.querySelector('.collection')).getBoundingClientRect();
      const screen = $('play-screen').getBoundingClientRect();
      const artHeight = screen.width * 100 / 480;
      const top = board.bottom + Math.max(0, (controls.top - board.bottom - artHeight) / 2);
      $('puzzle-sand-background').style.setProperty('--sand-doodle-top', (top - screen.top) + 'px');
    }
  }
  function collectPair(pair, awardedTime, pairNumber = game.pairs) {
    playEffect('match');
    refreshBucketTarget();
    const layer = $('catch-effects').getBoundingClientRect();
    const group = { kind: pair[0].value, number: pairNumber, delivered: false };
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
    if (awardedTime > 0 && game.progress < displayedTide) tideRetreat = { from: displayedTide, start: animationTime, duration: 480 };
    if (awardedTime > 0) {
      rewardSeconds = animationTime < rewardUntil ? rewardSeconds + awardedTime / 1000 : awardedTime / 1000;
      rewardUntil = animationTime + 1000;
      const seconds = Math.round(rewardSeconds * 10) / 10;
      $('time-reward').textContent = seconds > 0 ? '+' + seconds + ' 秒' : '潮水已退到底';
      $('time-reward').hidden = false;
    }
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
  function appendSeagrassArt(button, index) {
    button.insertAdjacentHTML('beforeend', `<span class="seagrass-cover" aria-hidden="true">${BeachArt.seagrass('card-' + index)}${BeachArt.lockedSeagrass('card-' + index)}</span>`);
  }
  function syncStartCountdown() {
    const overlay = $('start-countdown');
    const seconds = Math.ceil(game.countdownRemaining / 1000);
    const visible = seconds > 0 && game.state === 'playing';
    const wasVisible = !overlay.hidden;
    overlay.hidden = !visible;
    if (visible && $('start-countdown-number').textContent !== String(seconds)) $('start-countdown-number').textContent = seconds;
    if (wasVisible && seconds === 0 && game.state === 'playing') announce('准备结束，可以开始翻格了。');
  }
  function syncGame() {
    if (game.level.surf) syncSurf();
    if (currentScreen === 'play' && game.state === 'playing') achievements.record(game);
    if (lastVersion === game.version) return;
    lastVersion = game.version;
    syncStartCountdown();
    if (isSlotMachine()) syncSlotMachine();
    if (isArithmetic()) { syncArithmetic(); return; }
    if (isBucketSort()) { syncBucketSort(); return; }
    if (isGrassPuzzle()) { syncGrassPuzzle(); return; }
    if (isJourney()) { syncJourney(); return; }
    if (isPuzzle()) { syncPuzzle(); return; }
    game.cards.forEach((card, i) => {
      const element = cardElements[i];
      if (!element) return;
      const face = element.querySelector('.shell-face');
      if (face.dataset.kind !== String(card.value)) {
        face.dataset.kind = card.value;
        face.innerHTML = BeachArt.item(card.value, 'card' + i);
      }
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
      if (game.level.seagrass) {
        const locked = game.isGrassLocked(card);
        if (card.tangled && !element.querySelector('.seagrass-cover')) appendSeagrassArt(element, i);
        element.classList.toggle('is-tangled', card.tangled);
        element.classList.toggle('is-grass-locked', locked);
        element.dataset.tangled = String(card.tangled);
        element.disabled = game.state !== 'playing' || (!card.fog?.covered && (locked || card.status !== 'hidden'));
        if (card.tangled && card.status === 'hidden' && !card.fog?.covered) element.setAttribute('aria-label', `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列，${locked ? '紫色交叉海草，暂时不能翻开' : '绿色海草格，可以翻开'}`);
      }
      if (game.level.surf) {
        const washed = game.isWashed(i);
        element.classList.toggle('is-surf-covered', washed);
        // Uniform hit targets and labels conceal collected holes as well as sand.
        element.disabled = !washed && (game.state !== 'playing' || card.status !== 'hidden');
        element.setAttribute('aria-disabled', String(washed || element.disabled));
        const position = `第${Math.floor(i / game.level.columns) + 1}行第${i % game.level.columns + 1}列`;
        element.setAttribute('aria-label', washed ? `${position}，海浪冲刷中，暂时无法翻开` : card.status === 'hidden'
          ? `${position}，未翻开的沙格` : `${position}，${BeachArt.names[card.value]}${card.status === 'matched' ? '，已收集' : ''}`);
      }
      if (isSlotMachine()) element.disabled = game.state !== 'playing' || game.phase !== 'idle' || card.status !== 'hidden';
      if (game.level.startCountdown) element.disabled = game.state !== 'playing' || game.countdownRemaining > 0 || card.status !== 'hidden';
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
    } else if (art === 'puzzle-result' || art === 'grass-result') {
      container.classList.add('modal-puzzle-art');
      const board = document.createElement('div');
      board.className = 'puzzle-complete-art';
      board.style.setProperty('--puzzle-columns', game.level.columns);
      game.cards.forEach(card => {
        const cell = document.createElement('span');
        const kind = art === 'grass-result' ? game.level.rewards[card.index % game.level.rewards.length] : card.value;
        cell.innerHTML = BeachArt.item(kind, 'puzzle-result-' + card.index);
        board.append(cell);
      });
      container.append(board);
    } else if (art === 'journey' || art === 'journey-result') {
      container.classList.add('modal-journey-art');
      container.innerHTML = BeachArt.journeySymbol(art === 'journey' ? 'footprints' : 'bucket');
      if (art === 'journey-result') container.insertAdjacentHTML('beforeend', `<span class="journey-result-items">${game.level.treasures.map((item, i) => BeachArt.item(item.kind, 'journey-result-' + i)).join('')}</span><span class="journey-result-front">${BeachArt.journeySymbol('bucket-front')}</span>`);
    } else if (art === 'slot-result') {
      container.classList.add('modal-slot-art');
      container.innerHTML = `<div class="slot-result-art">${game.level.kinds.map(kind => BeachArt.item(kind, 'slot-result-' + kind)).join('')}</div>`;
    } else if (art === 'sort-result') {
      container.classList.add('modal-sort-art');
      container.innerHTML = `<div class="sort-result" style="--sort-kinds:${game.totalKinds}">${game.buckets.filter(bucket => bucket.length).map((bucket, i) => `<span>${bucket.map((kind, slot) => BeachArt.item(kind, `sort-result-${i}-${slot}`)).join('')}</span>`).join('')}</div>`;
    } else if (art === 'puzzle-intro') {
      container.innerHTML = BeachArt.puzzleEmblem('intro');
    } else if (art === 'slot-intro') {
      container.innerHTML = BeachArt.slotMachineEmblem('intro');
    } else if (art === 'sort-intro') {
      container.innerHTML = BeachArt.harvestEmblem('sort-intro', [0, 2, 1, 4]);
    } else if (art === 'notice-board') {
      container.innerHTML = BeachArt.noticeBoard();
    } else if (art === 'perfect-score') {
      container.innerHTML = BeachArt.perfectScore();
    } else if (art === 'fog') {
      container.innerHTML = BeachArt.fog('modal');
    } else if (art === 'seagrass') {
      container.innerHTML = BeachArt.reefEmblem('modal');
    } else if (art === 'condition-failure') {
      container.innerHTML = BeachArt.conditionFailure();
    } else if (art === 'surf') {
      container.innerHTML = BeachArt.surfEmblem('intro');
    } else if (art === 'washed-bucket') {
      container.classList.add('modal-failure-art');
      container.innerHTML = BeachArt.washedBucket();
    } else container.innerHTML = BeachArt.item(art, 'modal');
  }
  function openModal({ eyebrow, heading, description, emphasizeLastLine = false, art = 0, result = false, immediateResult = false, artBelowHeading = false, fogIntro = false, showConditions = false, conditionProgress = true, ending = false, actions }) {
    previousFocus = document.activeElement;
    modalOpen = true;
    $('modal-eyebrow').textContent = eyebrow;
    $('modal-eyebrow').hidden = !eyebrow;
    $('modal-heading').textContent = heading;
    $('modal-description').textContent = description;
    if (emphasizeLastLine) {
      const lines = description.split('\n');
      const warning = document.createElement('strong');
      warning.textContent = lines.pop();
      $('modal-description').replaceChildren(document.createTextNode(lines.join('\n') + '\n'), warning);
    }
    renderModalArt(art);
    $('modal-card').classList.toggle('ending-card', ending);
    $('modal-card').classList.toggle('result-card', result);
    $('modal-card').classList.toggle('immediate-result', immediateResult);
    $('modal-card').classList.toggle('species-card', artBelowHeading);
    $('modal-card').classList.toggle('fog-intro-card', fogIntro);
    $('modal-card').classList.toggle('journey-intro-card', emphasizeLastLine);
    $('modal-card').scrollTop = 0;
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
    syncMusic();
    syncGame();
  }
  function pauseGame() {
    if (currentScreen !== 'play' || modalOpen || !game.pause(performance.now())) { syncGame(); return; }
    syncMusic();
    syncGame();
    hideTideDanger();
    openModal({ eyebrow: '', heading: '歇一歇，潮水等等', description: isArithmetic() ? `游戏已暂停\n已完成 ${game.completed} / ${game.totalRounds} 轮` : isSlotMachine() ? `游戏已暂停\n已配对 ${game.pairs} / ${game.totalPairs} 对，拉杆机会 ${game.credits} 次` : isBucketSort() ? `游戏已暂停\n已整理 ${game.sortedCount} / ${game.totalKinds} 桶，已移动 ${game.turns} 次` : isGrassPuzzle() ? `游戏已暂停\n剩余海草 ${game.grassCount} 格，已拨动 ${game.turns} 次` : isJourney() ? `游戏已暂停\n当前已拾取 ${game.collectedCount} / ${game.totalTreasures} 件收获` : isPuzzle() ? `游戏已暂停\n当前已填 ${game.filledCount} / ${game.cards.length} 格` : `游戏已暂停\n当前已收集 ${game.pairs} / ${game.totalPairs} 对`, art: null, showConditions: true,
      actions: [{ text: '继续赶海', run: resumeGame }, { text: '重新开始', run: startGame }, { text: '返回选关', run: () => showScreen('level') }] });
  }
  function showResult() {
    const won = game.state === 'won';
    const conditionFailure = game.failureReason === 'conditions';
    hideTideDanger();
    achievements.record(game);
    if (won) {
      completedLevels.add(game.level.id);
      try {
        localStorage.setItem('beach-pairs-completed-levels', JSON.stringify([...completedLevels]));
        if (game.level.id === 1) localStorage.setItem('beach-pairs-level-one', 'won');
      } catch (_) { /* In-memory progress still permits replay this session. */ }
      announce(game.level.endingMessage ? game.level.endingMessage[0] : isArithmetic() ? '挑战成功！十轮速算全部完成。' : isBucketSort() ? '挑战成功！所有收获都分好类了。' : isGrassPuzzle() ? '挑战成功！海草已全部清空。' : isJourney() ? '挑战成功！五种目标全部找到。' : isPuzzle() ? '挑战成功！棋盘已填满，横、纵和两条对角线均无重复。' : `通关成功！${game.totalPairs}对赶海收获全部收集完成。`);
    } else announce(game.failureReason === 'wrongTarget' ? '碰到了当前目标以外的物品，本次挑战结束。' : conditionFailure ? '未完成全部的条件，本次挑战未通过。' : '潮水已经漫过沙滩，本次赶海结束。');
    if (won && game.level.endingMessage) {
      openModal({ eyebrow: '', heading: game.level.endingMessage[0], description: game.level.endingMessage.slice(1).join('\n'),
        art: 6, result: true, ending: true,
        actions: [{ text: '返回主菜单', run: () => showScreen('menu') }, { text: '返回选关', run: () => showScreen('level') }] });
      return;
    }
    if (isArithmetic()) {
      openModal({ eyebrow: '',
        heading: won ? '挑战成功！' : '潮水先到了一步',
        description: won ? '你在涨潮前答出了所有题目！' : `这次完成了 ${game.completed} / ${game.totalRounds} 轮。\n记住这次的答案，重新挑战吧。`,
        art: won ? 'perfect-score' : 'washed-bucket', result: true,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    if (isBucketSort()) {
      openModal({ eyebrow: '', heading: won ? '收获都分好类啦！' : '潮水先到了一步',
        description: won ? `所有收获已经各自装满一桶！\n共移动了 ${game.turns} 次。` : `已整理 ${game.sortedCount} / ${game.totalKinds} 桶。\n利用空桶腾挪位置，再试一次吧。`,
        art: won ? 'sort-result' : 'washed-bucket', result: true,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    if (isGrassPuzzle()) {
      openModal({ eyebrow: '', heading: won ? '挑战成功！' : conditionFailure ? '未完成全部的条件' : '潮水先到了一步',
        description: won ? `海草清空了，礁石间的收获露出来啦！\n共拨动了 ${game.turns} 次。` : conditionFailure ? `未满足：${game.conditionStates.filter(condition => !condition.completed).map(condition => conditionLabel(condition)).join('\n')}` : `还剩 ${game.grassCount} 格海草。\n理清相邻的根系，再试一次吧。`,
        art: won ? 'grass-result' : conditionFailure ? 'condition-failure' : 'washed-bucket', result: true, immediateResult: conditionFailure,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    if (isJourney()) {
      const wrong = game.failureReason === 'wrongTarget';
      openModal({ eyebrow: '', heading: won ? '目标全部找齐啦！' : wrong ? '碰错物品了' : '潮水先到了一步',
        description: won ? `你找齐了 ${game.totalTreasures} 种物品，共走了 ${game.turns} 步。` : wrong ? `当前目标是${BeachArt.names[game.target.kind]}，却碰到了${BeachArt.names[game.wrongKind]}。\n已找到 ${game.collectedCount} / ${game.totalTreasures} 种，记住位置再试一次吧。` : `已找到 ${game.collectedCount} / ${game.totalTreasures} 种物品。\n留意目标刷新和潮水，再试一次吧。`,
        art: won ? 'journey-result' : wrong ? 'condition-failure' : 'washed-bucket', result: true, immediateResult: wrong,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    if (isPuzzle()) {
      openModal({ eyebrow: '',
        heading: won ? '挑战成功！' : '潮水先到了一步',
        description: won ? '你在涨潮前完成了填图挑战！' : `这次填入了 ${game.filledCount} / ${game.cards.length} 格。\n整理一下思路，再挑战一次吧。`,
        art: won ? 'puzzle-result' : 'washed-bucket', result: true,
        actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
      return;
    }
    const failedConditions = game.conditionStates.filter(condition => !condition.completed).map(condition => conditionLabel(condition)).join('\n');
    const immediateFailure = conditionFailure && game.pairs < game.totalPairs;
    openModal({ eyebrow: won ? '' : conditionFailure ? immediateFailure ? '这次没有达成赶海的要求' : '收获齐了，再留意一下要求' : '',
      heading: won ? '海的礼物，收好啦。' : conditionFailure ? '未完成全部的条件' : '潮水先到了一步',
      description: won ? `你在涨潮前找到了全部赶海收获。\n这一程，共翻找了 ${game.turns} 次。` : conditionFailure ? `已收集 ${game.pairs} / ${game.totalPairs} 对。\n未满足：${failedConditions}` : `这次收集了 ${game.pairs} / ${game.totalPairs} 对赶海收获。\n记住刚才的发现，再试一次吧。`,
      art: won ? 'harvest' : conditionFailure ? 'condition-failure' : 'washed-bucket', result: true, immediateResult: immediateFailure,
      actions: [{ text: won ? '下一关' : '重新挑战', run: won ? goToNextLevel : startGame }, { text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
  }
  function goToNextLevel() {
    const nextLevel = BeachLevels.find(level => level.id === game.level.id + 1);
    if (nextLevel) { startLevel(nextLevel); return; }
    openModal({ eyebrow: '下一片海岸，稍后相见', heading: '下一关即将开放', description: '你已经完成了当前开放的关卡。', art: isArithmetic() ? 'notice-board' : isSlotMachine() ? 'slot-result' : isBucketSort() ? 'sort-result' : isGrassPuzzle() ? 'grass-result' : isJourney() ? 'journey-result' : isPuzzle() ? 'puzzle-result' : 'harvest',
      actions: [{ text: '返回选关', run: () => showScreen('level') }, { text: '返回主菜单', run: () => showScreen('menu') }] });
  }
  function resizeCanvas() {
    const box = app.getBoundingClientRect();
    viewWidth = box.width;
    viewHeight = box.height;
    // Water is a translucent decoration; avoid a full-screen 4x pixel buffer on phones.
    const dpr = Math.min(window.devicePixelRatio || 1, touchRendering.matches ? 1 : 2);
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tideClearTop = 0;
    tideNeedsPaint = true;
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
    if (game.state !== 'playing' || modalOpen || game.countdownRemaining > 0 || game.level.untimed) { hideTideDanger(); return; }
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
    if (!tideNeedsPaint && (modalOpen || game.state === 'paused')) return;
    tideNeedsPaint = false;
    const progress = displayedTide;
    const y = viewHeight - 9 - progress * (viewHeight + 5);
    const phase = animationTime * .001;
    const amplitude = 5 + progress * 2;
    // Only the current and previous water area can contain pixels to erase.
    const nextTop = Math.max(0, y - amplitude - 8);
    const clearTop = Math.min(tideClearTop, nextTop);
    ctx.clearRect(0, clearTop, viewWidth, viewHeight - clearTop);
    tideClearTop = nextTop;
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
  for (const value of ['1','2','3','4','5','6','7','8','9','clear','0','delete']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'arithmetic-key';
    button.dataset.value = value;
    button.textContent = value === 'clear' ? '清空' : value === 'delete' ? '删除' : value;
    button.addEventListener('click', () => {
      if (!isArithmetic() || modalOpen || game.state !== 'playing' || !game.timerRunning) return;
      const input = $('arithmetic-answer');
      input.value = value === 'clear' ? '' : value === 'delete' ? input.value.slice(0, -1) : (input.value + value).slice(0, 3);
    });
    $('arithmetic-keypad').append(button);
  }
  function submitArithmeticAnswer() {
    if (!isArithmetic() || modalOpen || game.state !== 'playing' || !game.timerRunning) return;
    const wrongBefore = game.wrongAnswers;
    if (game.submit($('arithmetic-answer').value, performance.now())) playEffect('match');
    if (game.wrongAnswers > wrongBefore) {
      playEffect('wrong');
      if (game.state === 'playing') tideRetreat = { from: displayedTide, start: animationTime, duration: 420 };
    }
    if (game.feedback !== 'invalid') $('arithmetic-answer').value = '';
    syncGame();
  }
  // Hosted previews can allow scripts while forbidding native form submission.
  $('arithmetic-submit').addEventListener('click', submitArithmeticAnswer);
  $('slot-lever').addEventListener('click', () => {
    if (modalOpen || !isSlotMachine()) return;
    if (game.spin(performance.now())) playEffect('lever');
    syncGame();
  });
  $('sort-undo').addEventListener('click', () => {
    if (modalOpen || !isBucketSort()) return;
    game.undo(performance.now());
    syncGame();
  });
  $('start-button').addEventListener('click', () => startLevel(BeachLevels[0]));
  $('select-level-button').addEventListener('click', () => { currentChapter = 0; showScreen('level'); });
  $('chapter-previous').addEventListener('click', () => selectChapter(currentChapter - 1, true));
  $('chapter-next').addEventListener('click', () => selectChapter(currentChapter + 1, true));
  $('guide-button').addEventListener('click', () => { guide.open(); showScreen('guide'); });
  function returnFromGuide() {
    showScreen('menu');
    $('guide-button').focus({ preventScroll: true });
  }
  $('guide-back').addEventListener('click', returnFromGuide);
  $('achievements-button').addEventListener('click', () => showScreen('achievements'));
  function returnFromAchievements() {
    showScreen('menu');
    $('achievements-button').focus({ preventScroll: true });
  }
  $('achievements-back').addEventListener('click', returnFromAchievements);
  // Sound effects and background music have independent switches.
  document.querySelectorAll('.setting-switch').forEach(button => {
    button.addEventListener('click', () => {
      const enabled = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(enabled));
      button.querySelector('.switch-state').textContent = enabled ? 'ON' : 'OFF';
      if (button.id === 'music-switch') { musicEnabled = enabled; syncMusic(); }
      if (button.id === 'sound-switch') {
        soundEnabled = enabled;
        if (enabled) playEffect('tap'); else stopEffects();
      }
    });
  });
  document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => showScreen('menu')));
  $('pause-button').addEventListener('click', pauseGame);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert]')) return;
    if (button.id === 'sound-switch') return; // Its updated state decides its feedback.
    if (button.id === 'slot-lever') return; // The mechanism sounds only when a pull starts.
    if (button.classList.contains('sort-bucket')) return; // Accepted bucket actions have a wooden knock.
    if (button.classList.contains('tile')) {
      if (game.state !== 'playing' || game.pending || game.countdownRemaining > 0) return;
      // Board actions with their own sounds play them only after being accepted.
      if (!isPuzzle()) return;
    }
    playEffect('tap');
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopEffects(true); hideAchievementToast(true); }
    if (document.hidden && game.state === 'playing') pauseGame();
    syncMusic();
  });
  window.addEventListener('pagehide', () => {
    hideAchievementToast(true);
    stopEffects(true);
    musicPageHidden = true;
    if (game.state === 'playing' && !modalOpen) game.pause(performance.now());
    syncMusic();
  });
  window.addEventListener('pageshow', () => { musicPageHidden = false; syncMusic(); });
  for (const eventName of ['click', 'keydown']) document.addEventListener(eventName, () => {
    musicUnlocked = true;
    syncMusic();
  });
  document.addEventListener('keydown', event => {
    if (currentScreen === 'guide' && !event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      guide.turn(event.key === 'ArrowLeft' ? -1 : 1);
    }
    if (event.key === 'Escape') {
      if (currentScreen === 'guide') returnFromGuide();
      else if (currentScreen === 'achievements') returnFromAchievements();
      else if (modalOpen && game.state === 'paused') resumeGame();
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
    snapshot: () => ({ countdownRemaining: game.countdownRemaining, arithmetic: isArithmetic() ? { completed: game.completed, total: game.totalRounds, round: game.roundIndex + 1, wrongAnswers: game.wrongAnswers, feedback: game.feedback } : null, slotMachine: isSlotMachine() ? { phase: game.phase, hasSpun: game.hasSpun, reels: game.displayReels, stopped: game.stoppedReels, credits: game.credits, manualPairs: game.manualPairs, autoPairs: game.autoPairs, result: game.result ? { ...game.result, indices: [...game.result.indices] } : null, collected: game.collectedCount, total: game.totalItems, matchProgress: game.matchProgress, feedback: game.feedback } : null, surf: game.level.surf ? { phase: game.surfPhase, target: game.surfTarget ? { ...game.surfTarget } : null, targets: game.surfTargets.map(target => ({ ...target })), time: game.surfTime, nextWaveAt: game.nextWaveAt, until: game.waveUntil, startedAt: game.waveStartedAt, retreatUntil: game.waveRetreatUntil, count: game.waveCount, covered: game.cards.map(card => game.isWashed(card.index)) } : null, screen: currentScreen, levelId: game.level.id, seagrass: game.level.seagrass ? game.cards.map(card => ({ grass: card.tangled, locked: game.isGrassLocked(card), until: card.grassLockedUntil })) : null, mode: game.level.type || 'matching', bucketSort: isBucketSort() ? { buckets: game.buckets.map(bucket => [...bucket]), source: game.source, capacity: game.capacity, sorted: game.sortedCount, history: game.history.length, feedback: game.feedback } : null, grassPuzzle: isGrassPuzzle() ? { grass: game.cards.map(card => card.grass), remaining: game.grassCount, affected: [...game.lastAffected] } : null, journey: isJourney() ? { phase: game.phase, position: game.position, noRevisit: Boolean(game.level.noRevisit), visited: [...game.visited], targetKind: game.target?.kind ?? null, targetIndex: game.target?.index ?? null, targetRemaining: game.targetRemaining, targetHistory: [...game.targetHistory], penalties: game.penalties, wrongKind: game.wrongKind, collected: [...game.collected], collectedCount: game.collectedCount, totalTreasures: game.totalTreasures, previewSeconds: game.previewSeconds } : null, filledCount: isPuzzle() ? game.filledCount : null, values: isPuzzle() ? game.cards.map(card => card.value) : null, fixed: isPuzzle() ? game.cards.map(card => card.fixed) : null, conflicts: isPuzzle() ? [...game.conflicts] : null, rows: game.level.rows, columns: game.level.columns, totalPairs: game.totalPairs, state: game.state, failureReason: game.failureReason, conditions: game.conditionStates, lastMatchedKind: game.lastMatchedKind, pairs: game.pairs, mismatches: game.mismatches, turns: game.turns, elapsed: game.elapsed, duration: game.duration, bonusTime: game.bonusTime, remaining: game.remaining, progress: game.progress, displayedTide, flights: flights.length, bucketPairs: arrivedPairs, fps: measuredFps, statuses: game.cards.map(card => card.status), fog: game.cards.map(card => card.fog ? { ...card.fog } : null), activeTime: game.activeTime, modalOpen, timerRunning: game.timerRunning, tutorialStep: tutorial?.active ? tutorial.step : null, tutorialTarget: tutorial?.active ? tutorial.target : null })
  });
})();
