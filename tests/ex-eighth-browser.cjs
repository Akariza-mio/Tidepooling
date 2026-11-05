// Alternating fog and opening sequence, with isolated storage and no screenshots.
const {chromium}=require('./browser-support.cjs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
const Arithmetic=require('../arithmetic.js'),previous=require('../levels.js').find(l=>l.id===47),label='前四组配对必须是海螺';
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
   await page.clock.install({time:new Date('2026-11-04T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
   await page.addInitScript(testing=>{localStorage.setItem('beach-pairs-completed-levels','[47]');if(testing)localStorage.setItem('beach-pairs-unlock-all','on');},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
   const intro=async()=>{assert.equal(await page.locator('#modal-conditions').innerText(),label);assert.equal(await page.locator('#modal-conditions .seaside-item').count(),1);await action('我知道了');};
   const reveal=async i=>{if((await state()).fog[i]?.covered)await tile(i).click();await tile(i).click();};
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),testing?10:1);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   if(testing)await page.locator('#level-48').click();else{
    assert.equal(await page.locator('#level-48').isDisabled(),true);await page.locator('#level-47').click();assert.equal((await state()).modalOpen,false);
    for(const round of previous.rounds){await page.locator('#arithmetic-answer').fill(String(Arithmetic.evaluate(round.target,round.values)));await page.locator('#arithmetic-answer').press('Enter');}await page.clock.runFor(1000);await action('下一关');
   }
   let snap=await state();assert.equal(snap.levelId,48);assert.equal(snap.mode,'matching');assert.equal(snap.duration,60000);assert.equal(snap.totalPairs,18);assert.equal(snap.modalOpen,true);await page.clock.fastForward(30000);assert.equal((await state()).remaining,60000);await intro();
   const deck=await page.locator('.tile .shell-face > .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   const pair=async kind=>{const s=await state(),indices=deck.flatMap((v,i)=>v===kind&&s.statuses[i]==='hidden'?[i]:[]);assert.ok(indices.length>=2);await reveal(indices[0]);await reveal(indices[1]);};
   assert.deepEqual(Array.from({length:6},(_,k)=>deck.filter(v=>v===k).length),[6,6,6,6,8,4]);assert.equal((await state()).rows,6);assert.equal((await state()).columns,6);assert.equal((await state()).seagrass,null);assert.equal((await state()).surf,null);assert.equal((await state()).arithmetic,null);
   const expected=Array.from({length:36},(_,i)=>i).filter(i=>(Math.floor(i/6)+i%6)%2===1);assert.deepEqual((await state()).fog.flatMap((f,i)=>f?[i]:[]),expected);assert.deepEqual(await page.locator('.fog-mask-cell').evaluateAll(ns=>ns.map(n=>Number(n.dataset.index))),expected);assert.equal(await page.locator('#play-conditions').innerText(),label);assert.equal(await page.locator('#arithmetic-panel').isVisible(),false);
   await reveal(0);await reveal(2);await page.clock.runFor(550);assert.equal((await state()).mismatches,1);assert.equal((await state()).conditions[0].current,0);
   await tile(1).click();assert.equal((await state()).fog[1].covered,false);assert.equal((await state()).statuses[1],'hidden');assert.equal((await state()).conditions[0].current,0);
   await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-conditions').innerText(),label);const paused=await state();await page.clock.fastForward(30000);assert.deepEqual((await state()).fog,paused.fog);assert.equal((await state()).remaining,paused.remaining);await action('继续赶海');await page.clock.runFor(5100);assert.equal((await state()).fog[1].covered,true);
   for(let i=0;i<3;i++)await pair(4);assert.equal((await state()).conditions[0].completed,false);await pair(0);snap=await state();assert.equal(snap.state,'lost');assert.equal(snap.failureReason,'conditions');assert.equal(snap.pairs,4);assert.equal(snap.modalOpen,true);assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),'[47]');
   await action('重新挑战');assert.equal((await state()).remaining,60000);assert.equal((await state()).conditions[0].current,0);assert.equal((await state()).fog.filter(f=>f?.covered).length,18);await intro();
   assert.deepEqual(await page.locator('.tile .shell-face > .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind))),deck);
   for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.clock.runFor(30);
    assert.deepEqual(await page.evaluate(()=>{const s=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.tile,.collection,#level-objectives')].flatMap(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1?[]:[{node:n.className,box:b.toJSON(),screen:s.toJSON()}];});}),[],JSON.stringify(viewport));
    assert.equal(await page.evaluate(()=>{const b=document.querySelector('.board-fog').getBoundingClientRect();return [...document.querySelectorAll('.fog-mask-cell')].every(n=>{const t=document.querySelector(`.tile[data-index="${n.dataset.index}"]`).getBoundingClientRect();return Math.abs(b.left+(Number(n.getAttribute('x'))+Number(n.getAttribute('width'))/2)*b.width/600-(t.left+t.width/2))<1&&Math.abs(b.top+(Number(n.getAttribute('y'))+Number(n.getAttribute('height'))/2)*b.height/600-(t.top+t.height/2))<1;});}),true);
   }
   await page.setViewportSize({width:390,height:844});for(let n=1;n<=4;n++){await pair(4);assert.equal((await state()).conditions[0].completed,n===4);}assert.equal((await state()).state,'playing');assert.equal(await page.locator('#play-conditions .is-completed').count(),1);
   await page.clock.runFor(5100);assert.equal((await state()).fog[10].covered,true);assert.equal((await state()).statuses[10],'matched');await tile(10).click();await tile(10).dispatchEvent('click');assert.equal((await state()).pairs,4);assert.equal((await state()).conditions[0].completed,true);
   for(const kind of [0,1,2,3,5])while((await state()).statuses.some((status,i)=>status==='hidden'&&deck[i]===kind))await pair(kind);assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);await page.clock.runFor(1000);
   assert.equal(await page.locator('#modal-heading').innerText(),'海的礼物，收好啦。');assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?'[47]':'[47,48]');await action('下一关');assert.equal((await state()).levelId,49);assert.equal((await state()).duration,10000);assert.equal((await state()).countdownRemaining,3000);assert.equal((await state()).modalOpen,false);await page.locator('#pause-button').click();await action('返回选关');assert.equal(await page.locator('#level-48').isEnabled(),true);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   await page.locator('#level-48').click();await intro();await page.clock.fastForward(60000);assert.equal((await state()).failureReason,'timeout');await action('重新挑战');await intro();assert.equal((await state()).remaining,60000);
   await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-47').click();assert.equal((await state()).mode,'arithmetic');assert.equal((await state()).modalOpen,false);assert.equal(await page.locator('.fog-mask-cell').count(),0);assert.equal(await page.locator('#arithmetic-panel').isVisible(),true);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  }
  console.log('PASS: EX eighth file/HTTP, arithmetic→matching, checkerboard fog and mask geometry, eight conches, first-four success rule and immediate failure, pause/refog/retry/deadline, five viewports, full victory and progress isolation. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
