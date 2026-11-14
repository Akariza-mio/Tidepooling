const test = require('node:test'), assert = require('node:assert/strict');
const Achievements = require('../achievements.js'), SlotMachine = require('../slot-machine.js');
const level = require('../levels.js').find(level => level.id === 45);
const key = 'beach-pairs-achievements-v2';
function storage(saved) {
  const values = new Map([['beach-pairs-achievements-version', Achievements.revision], ...(saved || [])]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function game() { const game = new SlotMachine({ level, random: () => 0 }); game.start(0); return game; }
function finish(game, now = 0) {
  for (const kind of level.kinds) for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) assert.equal(game.select(card.index, now), true);
  assert.equal(game.state, 'won');
}
test('a real 5-5 win without a pull awards once and persists independently of level progress', () => {
  const saved = storage([['beach-pairs-completed-levels', '[1,45]']]), achievements = new Achievements(saved), run = game();
  assert.equal(achievements.earned.size, 0, 'Past wins cannot prove the number of pulls.');
  assert.equal(run.spin(0), false); // A rejected pull with no credits is not a performed spin.
  finish(run); assert.equal(run.hasSpun, false); assert.equal(achievements.recordWin(run), true);
  assert.equal(achievements.recordWin(run), false); assert.deepEqual(JSON.parse(saved.getItem(key)), ['no-lever-clear', 'flawless-clear', 'picky-eater']);
  assert.equal(saved.getItem('beach-pairs-completed-levels'), '[1,45]');
  assert.equal(new Achievements(saved).earned.has('no-lever-clear'), true);
});
test('using even one pull disqualifies that run, while a fresh zero-pull retry can earn it', () => {
  const achievements = new Achievements(storage()), run = game();
  const pair = run.cards.filter(card => card.value === 1).slice(0, 2);
  for (const card of pair) run.select(card.index, 0);
  assert.equal(run.spin(0), true); run.update(1360); finish(run, 1360);
  assert.equal(run.hasSpun, true); assert.equal(achievements.recordWin(run), true); assert.equal(achievements.earned.has('no-lever-clear'), false);
  run.start(2000); finish(run, 2000); assert.equal(run.hasSpun, false); assert.equal(achievements.recordWin(run), true);
});
test('starting, pausing, losing or winning a different level cannot earn the achievement', () => {
  const achievements = new Achievements(storage());
  for (const state of ['idle', 'playing', 'paused', 'lost']) assert.equal(achievements.recordWin({ level, state, hasSpun: false }), false);
  assert.equal(achievements.recordWin({ level: { ...level, id: 44 }, state: 'won', hasSpun: false }), false);
  assert.equal(achievements.recordWin({ level: { ...level, type: 'matching' }, state: 'won', hasSpun: false }), false);
  assert.equal(achievements.recordWin({ level, state: 'won' }), false);
  assert.equal(achievements.earned.size, 0);
});
test('malformed and unknown achievement saves are ignored without breaking or clearing existing progress', () => {
  for (const value of ['broken JSON', '{}', 'null', '"no-lever-clear"', '[false,1,"unknown"]']) assert.equal(new Achievements(storage([[key, value]])).earned.size, 0);
  assert.equal(new Achievements(storage([[key, '["unknown","no-lever-clear","no-lever-clear"]']])).earned.size, 1);
});
test('blocked storage keeps an earned achievement for the session and later failures never revoke it', () => {
  const achievements = new Achievements({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }), run = game();
  finish(run); assert.equal(achievements.recordWin(run), true); run.start(1000);
  assert.equal(achievements.recordWin(run), false); assert.equal(achievements.earned.has('no-lever-clear'), true);
});
test('only a newly earned achievement emits its definition, after saving; loaded or repeated awards stay silent', () => {
  const saved = storage(), notices = [];
  const achievements = new Achievements(saved, definition => {
    assert.deepEqual(JSON.parse(saved.getItem(key)), ['no-lever-clear', 'flawless-clear', 'picky-eater']);
    notices.push(definition);
  });
  const run = game(); assert.equal(achievements.recordWin(run), false); finish(run);
  assert.equal(achievements.recordWin(run), true); assert.equal(notices.length, 3);
  assert.equal(notices[0].name, '反赌战士');
  assert.equal(achievements.recordWin(run), false); assert.equal(notices.length, 3);
  const loaded = new Achievements(saved, definition => notices.push(definition));
  assert.equal(loaded.recordWin(run), false); assert.equal(notices.length, 3);
});
test('a real first-level win unlocks the crab achievement once and persists it alongside an existing slot achievement', () => {
  const saved = storage([[key, '["no-lever-clear"]']]), notices = [];
  const achievements = new Achievements(saved, definition => notices.push(definition));
  const run = new (require('../core.js'))(); run.start(0);
  assert.equal(achievements.recordWin(run), false);
  const kinds = new Set(run.cards.map(card => card.value));
  for (const kind of kinds) for (const card of run.cards.filter(card => card.value === kind)) run.select(card.index, 0);
  assert.equal(run.state, 'won'); assert.equal(achievements.recordWin(run), true);
  assert.equal(notices[0].name, '初出茅庐'); assert.equal(notices[0].icon, 'crab'); assert.equal(notices[0].method, '通关1-1');
  assert.equal(achievements.recordWin(run), false); assert.equal(notices.length, 2);
  assert.deepEqual(JSON.parse(saved.getItem(key)), ['no-lever-clear', 'first-clear', 'flawless-clear']);
  assert.equal(new Achievements(saved).earned.has('first-clear'), true);
});
test('the new save generation clears all old awards without regranting from progress, then preserves newly earned awards', () => {
  const saved = storage([['beach-pairs-completed-levels', '[1,45]'], ['beach-pairs-level-one', 'won'], ['beach-pairs-achievements', '["first-clear","no-lever-clear"]'], [key, '["first-clear","no-lever-clear"]'], ['beach-pairs-achievements-version', 'previous-release']]), notices = [];
  const achievements = new Achievements(saved, definition => notices.push(definition));
  assert.equal(achievements.earned.size, 0); assert.equal(notices.length, 0);
  assert.equal(saved.getItem('beach-pairs-achievements'), null);
  assert.equal(saved.getItem('beach-pairs-completed-levels'), '[1,45]');
  assert.equal(saved.getItem('beach-pairs-level-one'), 'won');
  assert.equal(saved.getItem('beach-pairs-achievements-version'), Achievements.revision);
  const run = game(); finish(run); assert.equal(achievements.recordWin(run), true);
  assert.equal(notices.length, 3); assert.deepEqual([...new Achievements(saved).earned], ['no-lever-clear', 'flawless-clear', 'picky-eater']);
});

test('a flawless clear requires a completed pairing win and zero mismatches; filling puzzles never qualify', () => {
  const Game = require('../core.js');
  for (const mismatch of [false, true]) {
    const a = new Achievements(storage()), run = new Game(); run.start(0);
    if (mismatch) {
      const one = run.cards[0], other = run.cards.find(card => card.value !== one.value);
      run.select(one.index, 0); run.select(other.index, 0); run.update(500);
    }
    finish(run, 600); a.record(run);
    assert.equal(a.earned.has('flawless-clear'), !mismatch);
  }
  const puzzle = new (require('../puzzle.js'))({ level: require('../levels.js').find(l => l.id === 5) }); puzzle.start(0);
  [0,1,2,4,2,4,0,1,4,2,1,0,1,0,4,2].forEach((value, index) => { if (!puzzle.cards[index].fixed) puzzle.place(index, value, 100); });
  const a = new Achievements(storage()); assert.equal(puzzle.state, 'won'); a.record(puzzle); assert.equal(a.earned.has('flawless-clear'), false);
});

test('non-pairing minigame result fixtures cannot earn a flawless pairing achievement', () => {
  for (const [file, id] of [['puzzle', 5], ['journey', 15], ['grass-puzzle', 25], ['bucket-sort', 35], ['arithmetic', 46]]) {
    const Game = require(`../${file}.js`), level = require('../levels.js').find(l => l.id === id), run = new Game({ level }); run.start(0);
    // Isolate award eligibility after an already-validated game result.
    run.state = 'won'; assert.equal(run.mismatches, 0); assert.equal(run.totalPairs, 0);
    const a = new Achievements(storage()); a.record(run); assert.equal(a.earned.has('flawless-clear'), false, file);
  }
});

test('3-5 weeding awards for a real ten-move win, rejects longer/incomplete runs and persists without a flawless award', () => {
  const Grass = require('../grass-puzzle.js'), level = require('../levels.js').find(l => l.id === 25), solution = [0,4,5,7,10,11,12,15,18,23];
  for (const moves of [solution, [0,0,...solution]]) {
    const saved = storage(), notices = [], a = new Achievements(saved, d => notices.push(d)), run = new Grass({ level }); run.start(0);
    moves.forEach(i => assert.equal(run.select(i, 100), true)); assert.equal(run.state, 'won'); a.record(run);
    assert.equal(a.earned.has('weed-master'), moves.length === 10); assert.equal(a.earned.has('flawless-clear'), false);
    assert.equal(new Achievements(saved).earned.has('weed-master'), moves.length === 10);
    if (moves.length === 10) { assert.deepEqual(notices.map(d => d.name), ['除草技']); assert.equal(notices[0].icon, 'spray'); assert.equal(a.record(run), false); }
  }
  const a = new Achievements(storage()), run = new Grass({ level }); run.start(0);
  solution.slice(0, 9).forEach(i => run.select(i, 0)); assert.equal(a.record(run), false); assert.equal(a.earned.has('weed-master'), false);
  a.record({ level: { id: 26, type: 'grassPuzzle' }, state: 'won', turns: 10 }); assert.equal(a.earned.has('weed-master'), false);
});

test('1-6 speed clear includes exactly thirty active seconds, excludes pause time and rejects late or unfinished runs', () => {
  const Puzzle = require('../puzzle.js'), level = require('../levels.js').find(l => l.id === 6);
  const solution = [0,2,5,1,4,1,4,0,2,5,2,5,1,4,0,4,0,2,5,1,5,1,4,0,2];
  for (const [active, paused] of [[29999, 0], [30000, 100000], [30001, 0]]) {
    const a = new Achievements(storage()), run = new Puzzle({ level }); run.start(0);
    run.pause(100); run.resume(100 + paused);
    assert.equal(a.record(run), false);
    solution.forEach((value, index) => { if (!run.cards[index].fixed) run.place(index, value, active + paused); });
    assert.equal(run.state, 'won'); assert.equal(run.activeTime, active); a.record(run);
    assert.equal(a.earned.has('quick-search'), active <= 30000);
  }
  const a = new Achievements(storage()); a.record({ level: { id: 5 }, state: 'won', activeTime: 1000, mismatches: 0 });
  assert.equal(a.earned.has('quick-search'), false);
});

test('six consecutive successful pairs of the same kind award mid-run; another kind and a new run reset the sequence', () => {
  const a = new Achievements(storage()), run = game();
  function pair(kind) { const cards = run.cards.filter(c => c.value === kind && c.status === 'hidden').slice(0, 2); cards.forEach(c => run.select(c.index, 0)); a.record(run); }
  for (let i = 0; i < 5; i++) pair(0);
  assert.equal(a.earned.has('picky-eater'), false); pair(1); pair(0);
  assert.equal(a.earned.has('picky-eater'), false);
  run.start(0); for (let i = 0; i < 5; i++) pair(1);
  assert.equal(a.earned.has('picky-eater'), false); pair(1);
  assert.equal(run.state, 'playing'); assert.equal(a.earned.has('picky-eater'), true);
  assert.equal(a.record(run), false); assert.equal(new Achievements(a.storage).earned.has('picky-eater'), true);
});

test('zen awards only on a pairing level with zero pairs at tide timeout, never minigames, entry or other failures', () => {
  const Game = require('../core.js');
  for (const paired of [false, true]) {
    const a = new Achievements(storage()), run = new Game(); run.start(0); assert.equal(a.record(run), false);
    if (paired) run.cards.filter(c => c.value === run.cards[0].value).slice(0, 2).forEach(c => run.select(c.index, 0));
    run.update(run.duration); a.record(run); assert.equal(a.earned.has('zen-mode'), !paired);
  }
  const run = new (require('../puzzle.js'))({ level: require('../levels.js').find(l => l.id === 5) }); run.start(0); run.update(run.duration);
  const a = new Achievements(storage()); a.record(run); assert.equal(a.earned.has('zen-mode'), false);
  for (const failureReason of ['conditions', 'wrongTarget']) {
    const a = new Achievements(storage()); a.record({ level, state: 'lost', failureReason, pairs: 0 }); assert.equal(a.earned.size, 0);
  }
});

test('only skipping the first 1-1 visit earns the tutorial achievement; starting or abandoning it consumes the visit across reloads', () => {
  for (const choice of [true, false, null]) {
    const saved = storage(), a = new Achievements(saved), run = new (require('../core.js'))(); run.start(0);
    assert.equal(a.beginTutorialVisit({ level: { id: 2 } }), false);
    assert.equal(a.beginTutorialVisit(run), true);
    assert.equal(a.recordTutorialChoice({ level: { id: 1 } }, true), false);
    assert.equal(a.record(run), false);
    if (choice !== null) assert.equal(a.recordTutorialChoice(run, choice), choice);
    assert.equal(a.earned.has('first-tutorial-skip'), choice === true);
    if (choice !== null) assert.equal(a.recordTutorialChoice(run, true), false);
    const reloaded = new Achievements(saved); run.start(1000);
    assert.equal(reloaded.beginTutorialVisit(run), false);
    assert.equal(reloaded.recordTutorialChoice(run, true), false);
    assert.equal(reloaded.earned.has('first-tutorial-skip'), choice === true);
  }
});

test('a release reset restores first-tutorial eligibility while unavailable storage still consumes it for the session', () => {
  const run = new (require('../core.js'))(); run.start(0);
  const saved = storage([['beach-pairs-achievements-version', 'old-version'], ['beach-pairs-achievements-first-tutorial', 'old-version'], [key, '["first-tutorial-skip"]'], ['beach-pairs-completed-levels', '[1]']]);
  const a = new Achievements(saved);
  assert.equal(a.earned.size, 0); assert.equal(a.beginTutorialVisit(run), true); assert.equal(a.recordTutorialChoice(run, true), true);
  assert.equal(saved.getItem('beach-pairs-completed-levels'), '[1]');
  const blocked = new Achievements({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.equal(blocked.beginTutorialVisit(run), true); assert.equal(blocked.recordTutorialChoice(run, false), false);
  assert.equal(blocked.beginTutorialVisit(run), false); assert.equal(blocked.recordTutorialChoice(run, true), false);
});

test('clutch wins use the final action time before its pair reward, include exactly three seconds, and reject timeout or untimed play', () => {
  const Game = require('../core.js');
  for (const remaining of [3001, 3000, 1, 0]) {
    const a = new Achievements(storage()), run = new Game(); run.start(0);
    const last = run.cards.filter(c => c.value === run.cards[0].value).slice(0, 2), held = new Set(last.map(c => c.index));
    for (const kind of new Set(run.cards.map(c => c.value))) for (const c of run.cards.filter(c => c.value === kind && !held.has(c.index))) run.select(c.index, 0);
    last.forEach(c => run.select(c.index, run.duration - remaining));
    a.record(run); assert.equal(a.earned.has('last-second-clear'), remaining > 0 && remaining <= 3000);
    if (remaining > 0) { assert.equal(run.winRemaining, remaining); assert.equal(run.remaining, remaining + 5000); }
    run.start(100000); assert.equal(run.winRemaining, null);
  }
  const a = new Achievements(storage()); a.record({ level: { id: 50, untimed: true }, state: 'won', remaining: 1000 });
  assert.equal(a.earned.has('last-second-clear'), false);
  const b = new Achievements(storage()); b.record({ level: { id: 6 }, state: 'won', activeTime: 88000, remaining: 2000 });
  assert.equal(b.earned.has('last-second-clear'), true);
});

function journeyRoute(run) {
  const target = run.target.index, blocked = new Set(run.level.treasures.filter(t => !run.collected.has(t.index) && t.index !== target).map(t => t.index));
  const queue = [[run.position]], seen = new Set([run.position]);
  for (const route of queue) {
    if (route.at(-1) === target) return route.slice(1);
    for (const next of run.walkNeighbors[route.at(-1)]) if (!seen.has(next) && !blocked.has(next)) { seen.add(next); queue.push([...route, next]); }
  }
  throw Error('No route to the current target');
}
test('quick 2-5 search counts exploring time, excludes preview and pause, and requires a completed win within twenty seconds', () => {
  const Journey = require('../journey.js'), level = require('../levels.js').find(l => l.id === 15);
  for (const [time, pause] of [[19999, 0], [20000, 90000], [20001, 0]]) {
    const a = new Achievements(storage()), run = new Journey({ level, random: () => 0 }); run.start(0); run.beginPreview(0); run.update(level.previewDuration);
    assert.equal(a.record(run), false); run.pause(level.previewDuration); run.resume(level.previewDuration + pause);
    while (run.state === 'playing' && run.collectedCount < 5) {
      const now = level.previewDuration + pause + Math.floor((run.collectedCount + 1) * time / 5);
      journeyRoute(run).forEach(index => assert.equal(run.move(index, now), true));
    }
    assert.equal(run.state, 'won'); assert.equal(run.activeTime - run.previewElapsed, time);
    a.record(run); assert.equal(a.earned.has('quick-fog-search'), time <= 20000);
  }
  const a = new Achievements(storage()); a.record({ level: { id: 16, type: 'fogJourney' }, state: 'won', activeTime: 5000, previewElapsed: 5000 });
  assert.equal(a.earned.has('quick-fog-search'), false);
});

test('4-6 optimal sorting accepts different shortest routes, but an undo/replay cannot erase cumulative moves', () => {
  const Sort = require('../bucket-sort.js'), level = require('../levels.js').find(l => l.id === 36), solution = require('./bucket-sort-six-solution.cjs');
  for (const rotate of [false, true]) {
    const a = new Achievements(storage()), run = new Sort({ level }); run.start(0);
    const map = i => rotate && i < 6 ? (i + 1) % 6 : i;
    solution.forEach(([from, to]) => { run.select(map(from), 0); run.select(map(to), 0); });
    assert.equal(run.state, 'won'); assert.equal(run.turns, 34); a.record(run);
    assert.equal(a.earned.has('optimal-sort'), true); assert.equal(a.earned.has('flawless-clear'), false);
    assert.equal(new Achievements(a.storage).earned.has('optimal-sort'), true); assert.equal(a.record(run), false);
  }
  const a = new Achievements(storage()), run = new Sort({ level }); run.start(0);
  run.select(0, 0); run.select(6, 0); assert.equal(run.undo(0), true);
  solution.forEach(([from, to]) => { run.select(from, 0); run.select(to, 0); });
  assert.equal(run.state, 'won'); assert.equal(run.turns, 35); a.record(run); assert.equal(a.earned.has('optimal-sort'), false);
  assert.equal(new Achievements(storage()).record({ level, state: 'playing', turns: 34 }), false);
});

test('5-6 open-book clear includes thirty actual seconds, excludes pause and does not confuse wrong-answer penalties with elapsed play', () => {
  const MathGame = require('../arithmetic.js'), level = require('../levels.js').find(l => l.id === 46);
  for (const [time, pause] of [[29999, 0], [30000, 90000], [30001, 0]]) {
    const a = new Achievements(storage()), run = new MathGame({ level }); run.start(0);
    assert.equal(run.submit(999, 0), false);
    for (let i = 0; i < 9; i++) assert.equal(run.submit(MathGame.evaluate(run.round.target, run.round.values), 0), true);
    assert.equal(a.record(run), false); run.pause(1000); run.resume(1000 + pause);
    assert.equal(run.submit(MathGame.evaluate(run.round.target, run.round.values), time + pause), true);
    assert.equal(run.state, 'won'); assert.equal(run.activeTime, time); a.record(run);
    assert.equal(a.earned.has('open-book'), time <= 30000); assert.equal(a.earned.has('flawless-clear'), false);
    assert.equal(new Achievements(a.storage).earned.has('open-book'), time <= 30000);
  }
  const a = new Achievements(storage()); a.record({ level: { id: 47, type: 'arithmetic' }, state: 'won', activeTime: 1000 });
  assert.equal(a.earned.has('open-book'), false);
});
