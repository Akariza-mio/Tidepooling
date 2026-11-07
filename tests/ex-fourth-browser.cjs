// File/HTTP functional and DOM checks only, without screenshots.
const {chromium}=require('./browser-support.cjs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-04T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
   await page.addInitScript(testing=>{localStorage.setItem('beach-pairs-completed-levels','[43]');if(testing)localStorage.setItem('beach-pairs-unlock-all','on');window.waveDraws=[];Math.random=()=>window.waveDraws.shift()??0;},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),testing?10:2);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   await page.locator('#level-43').click();const third=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   for(const kind of [0,1,2,4])for(let i=0;i<36;i++)if(third[i]===kind){await tile(i).click();await tile(i).click();}
   await page.clock.runFor(1000);await action('下一关');assert.equal((await state()).levelId,44);assert.equal(await page.locator('#play-number').innerText(),'04');
   assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);
   const deck=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   assert.deepEqual([0,1,2,4,5].map(k=>deck.filter(v=>v===k).length),[8,8,8,6,6]);assert.deepEqual((await state()).conditions,[]);assert.equal((await state()).seagrass,null);assert.ok((await state()).fog.every(f=>f===null));
   assert.equal((await state()).remaining,60000);assert.equal((await state()).surf.phase,'warning');assert.equal(await page.locator('.surf-warning:visible').count(),1);await page.clock.runFor(30);assert.ok((await state()).remaining<60000);assert.ok((await state()).surf.time>0);
   const waveAt=n=>3000+(n-1)*15000;
   const advance=async time=>page.clock.fastForward(Math.max(0,time-(await state()).surf.time)+20);
   const checkWaveBounds=async selector=>{
    const measurements=await page.evaluate(selector=>{
     const {surf,columns,rows}=beachDiagnostics.snapshot(),tiles=[...document.querySelectorAll('.tile')],layers=[...document.querySelectorAll('.board-surf')];
     return surf.targets.map((target,i)=>{
      const cells=tiles.filter((_,index)=>(target.axis==='row'?Math.floor(index/columns):index%columns)===target.index).map(n=>n.getBoundingClientRect());
      const rect=layers[i].querySelector(selector).getBoundingClientRect();
      const covered=cells.every(b=>rect.left<=b.left+1&&rect.right>=b.right-1&&rect.top<=b.top+1&&rect.bottom>=b.bottom-1);
      const thin=target.axis==='row'?rect.height<=cells[0].height+10:rect.width<=cells[0].width+10;
      return {target,count:cells.length,expected:target.axis==='row'?columns:rows,covered,thin,rect:rect.toJSON(),first:cells[0].toJSON(),last:cells[cells.length-1].toJSON()};
     });
    },selector);
    for(const m of measurements){assert.equal(m.count,m.expected);assert.ok(m.covered&&m.thin,JSON.stringify({selector,...m}));}
   };
   const collectPair=async()=>{const s=await state();const a=deck.findIndex((k,i)=>s.statuses[i]==='hidden'&&!s.surf.covered[i]&&deck.some((v,j)=>j!==i&&v===k&&s.statuses[j]==='hidden'&&!s.surf.covered[j]));assert.ok(a>=0);const b=deck.findIndex((k,i)=>i!==a&&k===deck[a]&&s.statuses[i]==='hidden'&&!s.surf.covered[i]);await tile(a).click();await tile(b).click();};
   await tile(0).click();await tile(5).click();
   const fixtures=[[0,0],[0,.99],[.99,.99,0],[0,.99,0,.99]];
   const viewports=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}];
   for(let n=1;n<=4;n++){
    await page.evaluate(draws=>window.waveDraws=draws,fixtures[n-1]);await advance(waveAt(n)-2900);
    assert.equal((await state()).surf.phase,'warning');assert.equal((await state()).surf.targets.length,n);assert.equal(await page.locator('.surf-warning:visible').count(),n);assert.equal(await page.locator('.board-surf').count(),n);
    await checkWaveBounds('.surf-warning');
    if(n===2){
     for(const viewport of viewports){await page.setViewportSize(viewport);await page.clock.runFor(30);await checkWaveBounds('.surf-warning');}
     await page.setViewportSize({width:390,height:844});
     await page.emulateMedia({reducedMotion:'no-preference'});
     const flashes=await page.locator('.surf-warning:visible').evaluateAll(nodes=>nodes.map(node=>{
      const animation=node.getAnimations()[0];if(!animation)return null;
      animation.pause();animation.currentTime=0;const bright=Number(getComputedStyle(node).opacity);
      animation.currentTime=450;const dim=Number(getComputedStyle(node).opacity);return {bright,dim};
     }));
     assert.equal(flashes.length,2);assert.ok(flashes.every(f=>f&&f.bright-f.dim>.5),JSON.stringify(flashes));
     await page.emulateMedia({reducedMotion:'reduce'});
    }
    const ids=await page.locator('.board-surf [id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
    await advance(waveAt(n)-100);const before=await state();await advance(waveAt(n)+100);const arrived=await state();
    assert.equal(arrived.surf.phase,'arriving');assert.equal(arrived.surf.count,n);assert.equal(before.remaining-arrived.remaining-(arrived.surf.time-before.surf.time),5000);
    assert.equal(new Set(arrived.surf.targets.map(t=>t.axis+t.index)).size,n);
    for(let i=0;i<36;i++)if(arrived.surf.covered[i]){await tile(i).dispatchEvent('click');assert.match(await tile(i).getAttribute('aria-label'),/海浪冲刷中/);}
    assert.equal((await state()).pairs,arrived.pairs);assert.equal((await state()).mismatches,0);
    await advance(waveAt(n)+1000);assert.equal((await state()).surf.phase,'washing');
    await checkWaveBounds('.surf-visual');
    await checkWaveBounds('.surf-band-art');
    if(n===4){for(const viewport of viewports){await page.setViewportSize(viewport);await page.clock.runFor(30);await checkWaveBounds('.surf-visual');await checkWaveBounds('.surf-band-art');}await page.setViewportSize({width:390,height:844});}
    if(n===2){await page.locator('#pause-button').click();const paused=await state();await page.clock.fastForward(30000);assert.deepEqual((await state()).surf,paused.surf);assert.equal((await state()).remaining,paused.remaining);await action('继续赶海');}
    await advance(waveAt(n)+5900);assert.equal((await state()).surf.phase,'washing');await advance(waveAt(n)+6020);assert.equal((await state()).surf.phase,'retreating');await advance(waveAt(n)+7220);assert.equal((await state()).surf.phase,'calm');
    if(n<4){await collectPair();await collectPair();}
   }
   for(const kind of [0,1,2,4,5])for(let i=0;i<36;i++)if(deck[i]===kind&&(await state()).statuses[i]==='hidden')await tile(i).click();
   assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);await page.clock.runFor(1000);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?'[43]':'[43,44]');await action('下一关');assert.equal((await state()).levelId,45);assert.equal((await state()).mode,'slotMachine');assert.equal((await state()).duration,120000);assert.equal(await page.locator('#modal-heading').innerText(),'老虎机！');await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');
   await page.locator('#level-44').click();assert.equal((await state()).surf.count,0);assert.equal((await state()).remaining,60000);assert.equal(await page.locator('.board-surf').count(),1);assert.equal((await state()).modalOpen,false);assert.equal((await state()).surf.phase,'warning');assert.equal((await state()).surf.targets.length,1);await advance(3100);assert.equal((await state()).surf.phase,'arriving');
   await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);assert.equal((await state()).surf.count,0);assert.equal((await state()).remaining,60000);assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind))),deck);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: EX fourth file/HTTP, 43→44, 1/2/3/4-line warnings and waves, full six-cell row/column geometry for warning/visual/SVG across five viewports, actual warning pulses, unique SVG IDs, fixed 5s charge and separate entry/exit, masks, pause/retry/re-entry, victory and progress isolation. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
