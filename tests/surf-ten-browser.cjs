// Functional/DOM checks only; isolated contexts, no screenshots or installations.
const {chromium}=require('./browser-support.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
const label='配对失败会导致潮水上涨';
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-03T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T00:00:01Z'));
   await page.addInitScript(testing=>{if(testing)localStorage.setItem('beach-pairs-unlock-all','on');else localStorage.setItem('beach-pairs-completed-levels','[39]');window.surfDraws=[];Math.random=()=>window.surfDraws.length?window.surfDraws.shift():0;},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
   const pair=async(a,b)=>{await tile(a).click();await tile(b).click();},readDeck=()=>page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   await page.locator('#select-level-button').click();for(let i=0;i<3;i++)await page.locator('#chapter-next').click();assert.equal(await page.locator('#level-50').isDisabled(),false);
   await page.locator('#level-39').click();await action('我知道了');const ninth=await readDeck();for(const kind of [0,1,2,3,4,5])for(let i=0;i<36;i++)if(ninth[i]===kind)await tile(i).click();
   await page.clock.runFor(1000);await action('下一关');assert.equal((await state()).levelId,40);assert.equal(await page.locator('#play-number').innerText(),'10');
   assert.deepEqual((await state()).conditions.map(c=>[c.type,c.penalty]),[['mismatchTideRise',3000]]);assert.equal(await page.locator('#modal-conditions').innerText(),label);assert.equal(await page.locator('#play-conditions').innerText(),label);
   assert.equal(await page.locator('.board-surf').count(),3);const deck=await readDeck();assert.deepEqual([0,1,2,3,4,5].map(kind=>deck.filter(k=>k===kind).length),[6,6,6,6,6,6]);
   const advance=async time=>page.clock.runFor(Math.max(0,time-(await state()).surf.time)+20);
   const availablePair=async(exclude=[])=>{const snap=await state();const a=deck.findIndex((kind,i)=>!exclude.includes(i)&&snap.statuses[i]==='hidden'&&!snap.surf.covered[i]&&deck.some((k,j)=>j!==i&&!exclude.includes(j)&&k===kind&&snap.statuses[j]==='hidden'&&!snap.surf.covered[j]));assert.ok(a>=0);const b=deck.findIndex((kind,i)=>i!==a&&!exclude.includes(i)&&kind===deck[a]&&snap.statuses[i]==='hidden'&&!snap.surf.covered[i]);await pair(a,b);};
   const restart=async()=>{await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).remaining,60000);assert.equal((await state()).mismatches,0);assert.equal((await state()).surf.count,0);assert.deepEqual(await readDeck(),deck);assert.equal(await page.locator('#modal-conditions').innerText(),label);};
   await page.clock.fastForward(90000);assert.equal((await state()).remaining,60000);assert.equal((await state()).surf.time,0);await action('我知道了');
   await tile(0).click();const one=await state();await tile(0).dispatchEvent('click');assert.equal((await state()).remaining,one.remaining);assert.equal((await state()).mismatches,0);await tile(1).click();const miss=await state();
   assert.equal(one.remaining-miss.remaining-(miss.activeTime-one.activeTime),3000);assert.equal(miss.mismatches,1);await tile(2).dispatchEvent('click');assert.equal((await state()).mismatches,1);
   await page.clock.runFor(550);assert.equal((await state()).statuses[0],'hidden');assert.ok((await state()).displayedTide>0);
   await restart();
   const fixtures=[{draws:[0,0,0],count:18},{draws:[.99,.99,.99],count:18},{draws:[0,0,.99],count:16},{draws:[0,.99,.99],count:16}];
   for(const [index,fixture]of fixtures.entries()){
    await action('我知道了');if(index===0)await pair(0,2);
    await page.evaluate(draws=>window.surfDraws=draws,fixture.draws);await advance(12100);assert.equal((await state()).surf.phase,'warning');assert.equal(await page.locator('.surf-warning:visible').count(),3);
    const ids=await page.locator('.board-surf [id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
    await advance(14900);const before=await state();await advance(15100);const wave=await state();assert.equal(wave.surf.phase,'arriving');assert.equal(wave.surf.targets.length,3);assert.equal(wave.surf.covered.filter(Boolean).length,fixture.count);
    assert.equal(before.remaining-wave.remaining-(wave.surf.time-before.surf.time),5000);assert.equal(wave.surf.count,1);
    for(let i=0;i<36;i++)if(wave.surf.covered[i]){assert.match(await tile(i).getAttribute('aria-label'),/海浪冲刷中/);assert.doesNotMatch(await tile(i).getAttribute('aria-label'),/已收集|螃蟹|八爪鱼/);await tile(i).dispatchEvent('click');}
    assert.equal((await state()).mismatches,0);assert.equal((await state()).pairs,wave.pairs);
    await availablePair();const snap=await state(),a=deck.findIndex((_,i)=>snap.statuses[i]==='hidden'&&!snap.surf.covered[i]),b=deck.findIndex((kind,i)=>snap.statuses[i]==='hidden'&&!snap.surf.covered[i]&&kind!==deck[a]);
    await tile(a).click();const first=await state();await tile(b).click();const failed=await state();assert.equal(first.remaining-failed.remaining-(failed.activeTime-first.activeTime),3000);assert.equal(failed.mismatches,1);assert.equal(failed.surf.count,1);
    await page.clock.runFor(550);await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-conditions').innerText(),label);const paused=await state();await page.clock.fastForward(30000);assert.equal((await state()).remaining,paused.remaining);assert.deepEqual((await state()).surf.targets,paused.surf.targets);await action('继续赶海');
    if(index===3)for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
     await page.setViewportSize(viewport);await page.clock.runFor(30);assert.equal(await page.evaluate(()=>{const r=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.tile,#level-objectives,.collection')].every(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1;});}),true,JSON.stringify(viewport));
    }
    await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);await advance(16000);assert.equal((await state()).surf.phase,'washing');await advance(21000);assert.equal((await state()).surf.phase,'retreating');await advance(22250);assert.equal((await state()).surf.phase,'calm');await restart();
   }
   // A mismatch that consumes the last seconds uses the ordinary timeout result.
   await action('我知道了');await pair(0,1);await page.clock.runFor(550);await advance(44500);assert.ok((await state()).remaining>0&&(await state()).remaining<3000);await pair(0,1);assert.equal((await state()).failureReason,'timeout');assert.equal((await state()).remaining,0);assert.equal((await state()).mismatches,2);await page.clock.runFor(1000);
   assert.equal(await page.locator('#modal-heading').innerText(),'潮水先到了一步');assert.equal(await page.locator('#modal-art .condition-failure-art').count(),0);await action('重新挑战');await action('我知道了');
   // Legal rewards keep enough time to demonstrate removal of the old mistake cap.
   for(let i=0;i<21;i++){await pair(0,1);await page.clock.runFor(550);if(i%4===3)await availablePair([0,1]);}
   assert.equal((await state()).mismatches,21);assert.equal((await state()).state,'playing');assert.equal((await state()).conditions[0].completed,false);
   for(const kind of [0,1,2,3,4,5])for(let i=0;i<36;i++)if(deck[i]===kind&&(await state()).statuses[i]==='hidden')await tile(i).click();
   assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);assert.equal((await state()).conditions[0].completed,true);await page.clock.runFor(1000);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),'[39,40]');await action('下一关');assert.equal((await state()).levelId,41);assert.equal(await page.locator('#modal-conditions').innerText(),'配对失败的次数不得超过1次');await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');await page.locator('#chapter-previous').click();await page.locator('#level-40').click();assert.equal((await state()).mismatches,0);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: file/HTTP, ninth-to-tenth entry, triple rows/columns/mixed warnings and waves, unique SVG IDs, 5s arrival and independent 3s mismatch penalties, mask/invalid input/collected holes, pause/retry, five viewports, penalty timeout and 21-mistake victory without old cap, normal/test progress isolation. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
