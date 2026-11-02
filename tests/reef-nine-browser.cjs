// Functional and layout acceptance only. No screenshots, previews or archives.
const {chromium}=require('./browser-support.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-30T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-30T00:00:01Z'));
    await page.addInitScript(()=>localStorage.setItem('beach-pairs-unlock-all','on'));
    await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await page.emulateMedia({reducedMotion:'reduce'});
    const state=()=>page.evaluate(()=>beachDiagnostics.snapshot());
    const action=name=>page.getByRole('button',{name,exact:true}).click();
    const tile=i=>page.locator('.tile').nth(i);
    const pair=async(a,b)=>{await tile(a).click();await tile(b).click();};
    const label='至少在10个海草格上完成配对',live=n=>`${label}（${n} / 10）`;
    const grass=async()=>(await state()).seagrass.flatMap((card,i)=>card.grass?[i]:[]);
    await page.locator('#select-level-button').click();await page.locator('#chapter-next').click();await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-29').isEnabled(),true);assert.equal(await page.locator('#level-33').isDisabled(),true);
    await page.locator('#level-29').click();
    assert.equal((await state()).rows,6);assert.equal((await state()).columns,6);assert.equal((await state()).duration,60000);
    assert.equal(await page.locator('#play-number').innerText(),'09');assert.equal(await page.locator('#modal-art .notice-board-art').count(),1);
    assert.equal(await page.locator('#modal-conditions').innerText(),label);assert.deepEqual(await grass(),[7,10,25,28]);
    assert.equal((await state()).conditions.length,1);assert.equal((await state()).conditions[0].type,'minGrassMatches');
    const deck=await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind)));
    assert.equal(deck.includes(3),false);assert.deepEqual([0,1,2,4,5].map(kind=>deck.filter(value=>value===kind).length),[8,8,8,6,6]);
    await page.clock.fastForward(30000);assert.equal((await state()).remaining,60000);
    await action('我知道了');
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.clock.runFor(32);
      assert.equal(await page.evaluate(()=>{
        const rect=id=>document.getElementById(id).getBoundingClientRect();
        const rule=rect('level-objectives'),board=rect('board'),bucket=document.querySelector('.collection').getBoundingClientRect();
        return rule.bottom<=board.top && board.bottom<=bucket.top && bucket.bottom<=rect('app').bottom+1 && document.documentElement.scrollWidth<=innerWidth;
      }),true,JSON.stringify(viewport));
    }
    for(const kind of [0,1,2,4,5])for(let i=0;i<deck.length;i++)if(deck[i]===kind)await tile(i).click();
    await page.clock.runFor(800);
    assert.equal((await state()).pairs,18);assert.equal((await state()).conditions[0].current,4);
    assert.equal((await state()).failureReason,'conditions');assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(),1);
    await action('重新挑战');assert.equal((await state()).conditions[0].current,0);assert.deepEqual(await grass(),[7,10,25,28]);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind))),deck);
    await action('我知道了');await pair(7,0);await page.clock.runFor(520);await pair(10,35);await page.clock.runFor(520);
    assert.equal((await grass()).length,12);assert.equal((await state()).conditions[0].current,0);
    assert.equal(await page.locator('#play-conditions').innerText(),live(0));
    await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-conditions').innerText(),live(0));
    const paused=await state();await page.clock.fastForward(30000);assert.equal((await state()).activeTime,paused.activeTime);
    await action('继续赶海');await page.clock.fastForward(10000);
    while((await state()).conditions[0].current<10){
      const before=await state(),a=before.seagrass.findIndex((card,i)=>card.grass && before.statuses[i]==='hidden');
      const candidates=deck.flatMap((value,i)=>i!==a && value===deck[a] && before.statuses[i]==='hidden'?[i]:[]);
      const b=candidates.find(i=>before.seagrass[i].grass)??candidates[0];
      await pair(a,b);assert.equal((await state()).conditions[0].current,before.conditions[0].current+1+Number(before.seagrass[b].grass));
    }
    assert.ok((await state()).pairs<18);assert.equal((await state()).conditions[0].completed,true);
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'),'true');
    await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'),'true');
    await action('继续赶海');
    for(const kind of [0,1,2,4,5])for(let i=0;i<deck.length;i++)if(deck[i]===kind && (await state()).statuses[i]!=='matched')await tile(i).click();
    await page.clock.runFor(800);
    assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);assert.equal((await state()).conditions[0].current,12);
    assert.equal(await page.locator('#modal-art .bucket-find').count(),18);assert.equal(await page.locator('#modal-art .bucket-find[data-kind="3"]').count(),0);
    assert.ok((await state()).remaining<=60000);assert.deepEqual(errors,[]);
    await action('下一关');assert.equal((await state()).levelId,30);
    assert.equal(await page.locator('#modal-conditions').innerText(),'配对失败会导致潮水上涨');
    assert.deepEqual(await grass(),[0,1,7,8,14,15,21,22,28,29,35]);
    console.log('PASS: reef-nine five-kind exception, four exact grass cells, all condition displays, failure with only four grass harvests, spreading counts zero, unique per-cell harvest counts, live persistent checkmark, pause/retry and full victory after twelve grass harvests. No images captured.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
