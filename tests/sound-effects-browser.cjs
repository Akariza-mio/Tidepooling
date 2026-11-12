// Exercise real Web Audio nodes; no recorded audio, screenshots, or external assets.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('./browser-support.cjs');
const levels=require('../levels.js');
function routeToTarget(level,state){
 const goal=state.targetIndex,blocked=new Set(level.treasures.filter(t=>!state.collected.includes(t.index)&&t.index!==goal).map(t=>t.index));
 const seen=new Set(level.noRevisit?state.visited:[]),queue=[[state.position]];seen.add(state.position);
 for(const route of queue){
  const last=route.at(-1);if(last===goal)return route.slice(1);
  for(const next of [last-level.columns,last+level.columns,last-1,last+1]){
   if(next<0||next>=level.layout.length||level.layout[next]<0||blocked.has(next)||seen.has(next)
    ||Math.abs(Math.floor(next/level.columns)-Math.floor(last/level.columns))+Math.abs(next%level.columns-last%level.columns)!==1)continue;
   seen.add(next);queue.push([...route,next]);
  }
 }
 throw Error('No safe route to the current pickup target');
}
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'beach-effects-'));
 fs.copyFileSync(path.join(__dirname,'../release/index1.html'),path.join(directory,'index.html'));
 const browser=await chromium.launch();
 try{
  for(const single of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,offline:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.effectRecords=[];window.effectContexts=new Set();window.liveEffectCount=0;window.effectGains=[];
    const originalGain=AudioContext.prototype.createGain;
    AudioContext.prototype.createGain=function(){const node=originalGain.call(this);window.effectGains.push(node);return node;};
    const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){
     window.effectContexts.add(this);const node=original.call(this),start=node.start;
     node.start=function(when){window.effectRecords.push(node.type);window.liveEffectCount++;return start.call(node,when);};
     node.addEventListener('ended',()=>window.liveEffectCount--);return node;
    };
    const originalBufferSource=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
     window.effectContexts.add(this);const node=originalBufferSource.call(this),start=node.start;
     node.start=function(when){window.effectRecords.push('sand');window.liveEffectCount++;return start.call(node,when);};
     node.addEventListener('ended',()=>window.liveEffectCount--);return node;
    };
   });
   await page.goto(pathToFileURL(single?path.join(directory,'index.html'):path.join(__dirname,'../index.html')).href);
   const action=name=>page.getByRole('button',{name,exact:true}).click(),tap=i=>page.locator('.tile').nth(i).click();
   const records=()=>page.evaluate(()=>[...window.effectRecords]),sines=async()=>(await records()).filter(t=>t==='sine').length;
   assert.deepEqual(await records(),[]);await page.locator('#guide-button').click(); await page.keyboard.press('Escape');
   await page.waitForFunction(()=>[...window.effectContexts][0]?.state==='running');assert.deepEqual(await records(),['triangle']);
   assert.equal(await page.evaluate(()=>window.effectGains[0].gain.value),1);
   assert.deepEqual(await page.locator('audio').evaluateAll(ns=>ns.map(n=>n.volume)),[.22,.22]);
   await page.locator('#music-switch').click();assert.equal(await page.locator('#music-switch').getAttribute('aria-checked'),'false');assert.equal((await records()).length,2);
   await page.locator('#sound-switch').click();const silent=await records();
   await page.locator('#start-button').click();await action('跳过教程');await tap(0);await tap(3);
   assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().pairs),1);assert.deepEqual(await records(),silent);
   await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-screen [data-menu]').click();await page.locator('#guide-button').click(); await page.keyboard.press('Escape');
   await page.locator('#sound-switch').click();assert.equal((await records()).length,silent.length+1);assert.equal(await page.locator('#music-switch').getAttribute('aria-checked'),'false');
   await page.locator('#start-button').click();await action('跳过教程');
   const before=await sines(),beforeFlip=await records();await tap(0);
   assert.deepEqual((await records()).slice(beforeFlip.length),['sand']);
   await page.locator('.tile').nth(0).dispatchEvent('click');assert.equal((await records()).length,beforeFlip.length+1);
   await tap(3);assert.equal(await sines(),before+2);
   assert.deepEqual((await records()).slice(beforeFlip.length),['sand','sand','sine','sine']);
   const deck=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   const hidden=await page.evaluate(()=>beachDiagnostics.snapshot().statuses);const a=hidden.findIndex(s=>s==='hidden'),b=hidden.findIndex((s,i)=>s==='hidden'&&deck[i]!==deck[a]);
   const beforeMismatch=await records();await tap(a);await tap(b);assert.equal(await sines(),before+2);
   assert.deepEqual((await records()).slice(beforeMismatch.length),['sand','sand']);
   await page.waitForFunction(()=>beachDiagnostics.snapshot().statuses.every(s=>s!=='open'));
   assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().mismatches),1);assert.equal(await sines(),before+2);
   const after=await records();await page.locator('.tile').nth(0).dispatchEvent('click');assert.deepEqual(await records(),after);
   await page.waitForFunction(()=>window.liveEffectCount===0);assert.equal(await page.evaluate(()=>window.effectContexts.size),1);
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForFunction(()=>[...window.effectContexts][0].state==='suspended');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
   await action('继续赶海');await page.waitForFunction(()=>[...window.effectContexts][0].state==='running');
   assert.equal(await page.locator('#level-music').evaluate(n=>n.paused),true);assert.deepEqual(errors,[]);
   console.log(`PASS ${single?'standalone offline':'source'}: distinct button/sand/match sounds, accepted flips only with no duplicate tap tone, mute, music independence, one context, voice cleanup, background suspend/resume.`);
   await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-screen [data-menu]').click();await page.locator('#guide-button').click(); await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#select-level-button').click();await page.locator('#chapter-next').click();
   for(const id of [15,16]){
    await page.locator(`#level-${id}`).click();
    const introRecords=await records();await page.locator('.journey-cell').nth(17).dispatchEvent('click');assert.deepEqual(await records(),introRecords);
    await action('我知道了');
    const previewRecords=await records();await page.locator('.journey-cell').nth(17).dispatchEvent('click');assert.deepEqual(await records(),previewRecords);
    await page.waitForFunction(()=>beachDiagnostics.snapshot().journey.phase==='exploring');
    const beforeMove=await records();await page.locator('.journey-cell').nth(17).click();
    assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().journey.position),17);
    assert.deepEqual((await records()).slice(beforeMove.length),['sine','sine'],'One low step sound; no button or sand sound');
    const movedRecords=await records();
    for(const index of [17,0,id===15?18:16])await page.locator('.journey-cell').nth(index).dispatchEvent('click');
    assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().journey.position),17);assert.deepEqual(await records(),movedRecords);
    await page.locator('.journey-cell').nth(24).dispatchEvent('click');
    assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().journey.position),id===15?24:17);
    assert.deepEqual((await records()).slice(movedRecords.length),id===15?['sine','sine']:[],'Spent cells in level 16 must be silent');
    const journey=await page.evaluate(()=>beachDiagnostics.snapshot().journey),route=routeToTarget(levels.find(l=>l.id===id),journey);
    for(const [step,index] of route.entries()){
     await page.waitForFunction(()=>window.liveEffectCount===0);
     const beforeStep=await records();await page.locator('.journey-cell').nth(index).click();
     assert.deepEqual((await records()).slice(beforeStep.length),Array(step===route.length-1?4:2).fill('sine'),'Only picking up a target adds the two-note match reward');
    }
    assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().journey.collectedCount),journey.collectedCount+1);
    await page.waitForFunction(()=>window.liveEffectCount===0);
    await page.locator('#pause-button').click();const pausedRecords=await records();await page.locator('.journey-cell').nth(23).dispatchEvent('click');assert.deepEqual(await records(),pausedRecords);
    await action('返回选关');
   }
   assert.equal(await page.evaluate(()=>window.effectContexts.size),1);assert.deepEqual(errors,[]);
   console.log(`PASS ${single?'standalone offline':'source'}: both journey levels play step sounds and add the match reward only on target pickup; invalid and paused inputs stay silent.`);
   await context.close();
  }
  const fallback=await browser.newPage(),errors=[];fallback.on('pageerror',e=>errors.push(e.message));
  await fallback.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  await fallback.goto(pathToFileURL(path.join(directory,'index.html')).href);await fallback.locator('#start-button').click();await fallback.getByRole('button',{name:'跳过教程',exact:true}).click();await fallback.locator('.tile').nth(0).click();await fallback.locator('.tile').nth(3).click();assert.equal(await fallback.evaluate(()=>beachDiagnostics.snapshot().pairs),1);assert.deepEqual(errors,[]);await fallback.close();console.log('PASS: unavailable Web Audio does not block gameplay.');
 }finally{await browser.close();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(String(e.message).slice(0,1500));process.exitCode=1;});
