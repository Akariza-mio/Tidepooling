// DOM/input validation only; no screenshots and no user browser profile.
const { chromium }=require('./browser-support.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
const label='在2秒内完成2次配对';
(async()=>{
  const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch();
    for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-03T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T00:00:01Z'));
      await page.addInitScript(testing=>{if(testing)localStorage.setItem('beach-pairs-unlock-all','on');else localStorage.setItem('beach-pairs-completed-levels','[37]');Math.random=()=>0;},testing);
      await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
      const checked=async()=> (await state()).conditions[0].completed;
      const readDeck=()=>page.locator('.tile .seaside-item').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.kind)));
      const makePairs=deck=>[0,1,2,3,4,5].flatMap(kind=>{const cells=deck.flatMap((v,i)=>v===kind?[i]:[]);return [0,2,4].map(i=>({kind,cells:cells.slice(i,i+2)}));});
      await page.locator('#select-level-button').click();for(let i=0;i<3;i++)await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#level-41').isDisabled(),true);assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(),testing?10:1);
      await page.locator('#level-37').click();await action('我知道了');const seventh=makePairs(await readDeck()),octopus=seventh.find(p=>p.kind===3),conch=seventh.find(p=>p.kind===4),last=seventh.find(p=>p.kind===5);
      for(const pair of [...seventh.filter(p=>![octopus,conch,last].includes(p)),octopus,conch,last])for(const i of pair.cells)await tile(i).click();
      await page.clock.runFor(1000);await action('下一关');assert.equal((await state()).levelId,38);assert.equal(await page.locator('#play-number').innerText(),'08');
      assert.equal((await state()).conditions.length,1);assert.equal((await state()).conditions[0].count,2);assert.equal((await state()).conditions[0].window,2000);
      assert.equal(await page.locator('#modal-heading').innerText(),'本关胜利条件');assert.deepEqual(await page.locator('#modal-conditions .condition-item').allInnerTexts(),[label]);
      assert.deepEqual(await page.locator('#play-conditions .condition-item').allInnerTexts(),[label]);assert.equal(await page.locator('.condition-item-icon').count(),0);
      assert.equal(await page.locator('.tile').count(),36);assert.equal(await page.locator('.board-surf').count(),2);
      const deck=await readDeck();assert.deepEqual([0,1,2,3,4,5].map(kind=>deck.filter(k=>kind===k).length),[6,6,6,6,6,6]);
      await page.clock.fastForward(90000);assert.equal((await state()).remaining,60000);assert.equal((await state()).surf.time,0);await action('我知道了');
      const advance=async time=>page.clock.runFor(Math.max(0,time-(await state()).surf.time)+20);
      const pair=async()=>{const snap=await state();const a=deck.findIndex((kind,i)=>snap.statuses[i]==='hidden'&&!snap.surf.covered[i]&&deck.some((k,j)=>j!==i&&kind===k&&snap.statuses[j]==='hidden'&&!snap.surf.covered[j]));if(a<0)return false;
        const b=deck.findIndex((kind,i)=>i!==a&&kind===deck[a]&&snap.statuses[i]==='hidden'&&!snap.surf.covered[i]);await tile(a).click();await tile(b).click();return true;};
      await advance(5000);assert.equal(await pair(),true);assert.equal(await checked(),false);await advance(7200);assert.equal(await pair(),true);assert.equal(await checked(),false);
      await advance(10000);await pair();assert.equal(await checked(),false);await page.locator('#pause-button').click();const paused=await state();
      assert.deepEqual(await page.locator('#modal-conditions .condition-item').allInnerTexts(),[label]);await page.clock.fastForward(30000);assert.equal((await state()).remaining,paused.remaining);await action('继续赶海');
      await advance(11900);await pair();assert.equal(await checked(),true);assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'),'true');
      await advance(12100);assert.equal((await state()).surf.phase,'warning');assert.equal(await page.locator('.surf-warning:visible').count(),2);
      await advance(14900);const before=await state();await advance(15100);const wave=await state();assert.equal(wave.surf.phase,'arriving');assert.equal(wave.surf.targets.length,2);
      assert.equal(before.remaining-wave.remaining-(wave.surf.time-before.surf.time),6000);assert.equal(await checked(),true);
      for(let i=0;i<36;i++)if(wave.surf.covered[i])await tile(i).dispatchEvent('click');assert.equal((await state()).pairs,wave.pairs);
      for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
        await page.setViewportSize(viewport);await page.clock.runFor(30);assert.equal(await page.evaluate(()=>{
          const r=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.tile,#level-objectives,.collection')].every(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1;});
        }),true,JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);await advance(22250);assert.equal(await checked(),true);
      // Retry clears the previously earned check, and a deliberately slow full board fails it.
      await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).remaining,60000);assert.equal(await checked(),false);assert.deepEqual(await readDeck(),deck);await action('我知道了');
      for(let i=0;i<18;i++){if(!await pair()){await advance((await state()).surf.retreatUntil+1);assert.equal(await pair(),true);}if(i<17)await page.clock.runFor(2200);}
      await page.clock.runFor(1000);assert.equal((await state()).pairs,18);assert.equal((await state()).failureReason,'conditions');assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');assert.match(await page.locator('#modal-description').innerText(),/在2秒内完成2次配对/);
      await action('重新挑战');assert.equal(await checked(),false);await action('我知道了');
      await pair();assert.equal(await checked(),false);await page.clock.runFor(1000);await pair();assert.equal(await checked(),true);assert.equal((await state()).state,'playing');
      for(let i=2;i<18;i++)assert.equal(await pair(),true);await page.clock.runFor(1000);assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);
      assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?null:'[37,38]');
      await action('下一关');assert.equal((await state()).levelId,39);assert.equal((await state()).conditions[0].type,'maxMismatches');assert.equal((await state()).conditions[0].limit,20);
      assert.equal(await page.locator('#modal-heading').innerText(),'本关胜利条件');await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-38').click();assert.equal((await state()).conditions[0].completed,false);
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS: file/HTTP, seventh-to-eighth transition, independent six-kind 6x6 deck, two-in-two condition in entry/play/pause, rolling success after early misses, pause and double waves/6s penalty, five viewport sizes, retry clears check, slow-board condition failure and full win, normal/test progress isolation. No screenshots.');
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
