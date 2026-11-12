/* Read-only field guide. These examples never create or alter a live game. */
(function (root) {
  'use strict';
  function grassSample(locked) {
    const suffix = locked ? 'guide-locked' : 'guide-green';
    return `<figure><span class="guide-demo-tile is-tangled${locked ? ' is-grass-locked' : ''}"><span class="sand-cover"></span><span class="seagrass-cover">${BeachArt.seagrass(suffix)}${BeachArt.lockedSeagrass(suffix)}</span></span></figure>`;
  }
  function surfSample() {
    // Crop one tile's worth of the actual board strip, without compressing six tiles into one.
    const wave = BeachArt.surfBand('row', 'guide').replace('viewBox="0 0 600 100"', 'viewBox="200 0 100 100"');
    return `<div class="guide-surf-sample"><span class="guide-demo-tile is-surf-covered"><span class="sand-cover"></span><span class="guide-surf-water">${wave}</span></span></div>`;
  }
  function bucketSample() {
    return `<span class="sort-bucket guide-sort-bucket"><span class="sort-stack">${[0, 1, 2, 4].map((kind, slot) => `<span class="sort-slot">${BeachArt.item(kind, 'guide-sort-slot-' + slot)}</span>`).join('')}</span><span class="sort-number">1</span></span>`;
  }
  const pages = [
    {
      id: 'basics', title: '基本玩法', category: '赶海入门',
      art: () => `<div class="guide-pair">${BeachArt.item(0, 'guide-pair-a')}${BeachArt.item(0, 'guide-pair-b')}</div>`,
      sections: [
        ['翻沙配对', '点击沙格，记住里面的物品。连续翻开的两件物品相同，就能配成一对、收入桶中；不同则会在短暂展示后重新盖住。'],
        ['赶在潮水之前', '潮水上涨代表时间流逝，漫过整个画面就会失败。潮水线下的沙格也能操作，涨潮前配完全部物品即可通关。'],
        ['留意本关要求', '配对成功会有时间奖励，剩余时间将不会超过本关初始时长。部分关卡会带有额外的通关条件，请留意提示。在暂停时也可以查看本关条件']
      ]
    },
    {
      id: 'fog', title: '迷雾', category: '特殊机制 · 月下独捉',
      art: () => BeachArt.fog('guide'),
      sections: [
        ['先拨雾，再翻沙', '第一次点击有雾的位置只会拨开雾，不会同时翻开沙格。雾散开后，再次点击才能翻开下面的物品。'],
        ['短暂的观察窗口', '每格的雾拨开后，5秒便会恢复。雾会遮住物品和已配对的空位。雾后仍是同一片沙滩，不会影响配对的状态。']
      ]
    },
    {
      id: 'seagrass', title: '海草', category: '特殊机制 · 礁间寻宝',
      art: () => `<div class="guide-grass-samples">${grassSample(false)}${grassSample(true)}</div>`,
      sections: [
        ['绿色海草可以翻开', '有海草的沙格也能直接点击。成功配对时，物品和海草一同清除，照常收入收获桶。'],
        ['失败会缠绕和蔓延', '海草格配对失败后，会被紫色海草锁住10秒，暂时无法翻开；它上下左右尚未翻开、尚未配对的普通沙格也会长出海草。']
      ]
    },
    {
      id: 'surf', title: '海浪', category: '特殊机制 · 踏浪而寻',
      art: surfSample,
      sections: [
        ['留意闪烁预警', '海浪间隔一定时间随机冲刷某些行或列。即将来浪的位置会先闪烁预警。'],
        ['浪中暂时无法操作', '正在被冲刷的位置将无法进行操作，也无法看出当前的状态。需要等待海浪退去后，才能恢复正常。'],
        ['潮水也会被推高', '每次的海浪还会扣除一定的时间，让潮水升高，具体时间和关卡设计与海浪数量有关']
      ]
    },
    {
      id: 'fill', title: '填图挑战', category: '小游戏 · 1-5',
      art: () => BeachArt.puzzleEmblem('guide'),
      sections: [
        ['选物品，填棋盘', '先从下方工具栏选择物品，再点击格子填入或替换。红色背景的预放格已经固定，不能修改。'],
        ['横、纵、斜都不重复', '在涨潮前填满棋盘，让每行、每列和两条贯穿棋盘的对角线都没有重复物品。不需要满足额外的宫格规则。'],
        ['可以修改，也不止一个答案', '用手套“拾起”工具可取走自己填入的物品。冲突格会标红，修正后仍可继续；任何符合规则的完整棋盘都能通关。']
      ]
    },
    {
      id: 'journey', title: '迷雾寻物', category: '小游戏 · 2-5',
      art: () => BeachArt.journeySymbol('footprints'),
      sections: [
        ['先观察，再出发', '确认介绍后，先用5秒记住物品和障碍的位置。随后迷雾弥漫，只能看见自己与上下左右相邻的格子。'],
        ['沿路寻找当前目标', '点击上下左右相邻的沙格移动，礁石和潮池不能通过。走到上方展示的目标处即可拾取；碰到其他未收集物品会直接失败。'],
        ['两只时钟都要留意', '总时限60秒，每个目标另有15秒寻找时间。目标超时会刷新，并扣除大量时间；涨潮前找齐五件即可通关。']
      ]
    },
    {
      id: 'grass-puzzle', title: '海草翻转', category: '小游戏 · 3-5',
      art: () => `<div class="guide-grass-grid">${Array.from({ length: 9 }, (_, i) => `<span class="${[1, 3, 4, 5, 7].includes(i) ? 'is-cross' : ''}">${[0, 1, 4, 7, 8].includes(i) ? BeachArt.seagrass('guide-grid-' + i) : ''}</span>`).join('')}</div>`,
      sections: [
        [null, '点击任意沙格，会同时切换本格及相邻的上下左右格的状态：海草格变为沙地，沙地则会长出海草，棋盘外不会受到影响。在一定时间内清空所有海草即可通关。']
      ]
    },
    {
      id: 'buckets', title: '分类装桶', category: '小游戏 · 4-5',
      art: bucketSample,
      sections: [
        ['移动桶顶的一件物品', '先点击一个非空桶选中它，再点另一个桶，把最上面的一件物品移过去。目标必须是空桶，或顶部放着同种物品且还没装满的桶。'],
        ['同类收获装满一桶', '每桶最多四件。在涨潮前，把每种物品分别装满一个桶即可通关，空桶可以留着周转。放错了可以点击“撤回一步”调整。']
      ]
    },
    {
      id: 'slots', title: '老虎机', category: '小游戏 · 5-5',
      art: () => BeachArt.slotMachineEmblem('guide'),
      sections: [
        ['先配对，赚拉杆机会', '下方仍是记忆配对棋盘。每次手动配对成功，获得1次拉杆机会，可以积累；配对成功不会增加时间。'],
        ['看看三槽停下的结果', '点击拉杆消耗1次机会。两个物品相同，自动消除棋盘上该物品的一对；三个相同，清除该种物品的全部剩余配对。自动消除不奖励拉杆机会。三个各不相同或摇中的物品已经清空，则没有消除效果。']
      ]
    },
    {
      id: 'arithmetic', title: '数学而已', category: '小游戏 · 5-6',
      art: () => `<div class="guide-equations"><div>${BeachArt.item(1, 'guide-math-a')}<span>+</span>${BeachArt.item(1, 'guide-math-b')}<span>= 10</span></div><div>${BeachArt.item(1, 'guide-math-c')}<span>+ 2 = ?</span></div></div>`,
      sections: [
        [null, '每轮会给出若干公式，用赶海的物品代替数字，每一轮的数字都独立。根据公式推算出问号代表的数字并填入答案框中，点击确认即可。答对可以进入下一轮，答错会扣除时间，在一定时间内完成10组计算即可通关。']
      ]
    }
  ];

  class BeachGuide {
    constructor() {
      this.index = 0;
      this.previous = document.getElementById('guide-previous');
      this.next = document.getElementById('guide-next');
      this.previous.addEventListener('click', () => this.turn(-1));
      this.next.addEventListener('click', () => this.turn(1));
    }
    open() { this.render(0); }
    turn(direction) {
      const next = Math.max(0, Math.min(pages.length - 1, this.index + direction));
      if (next !== this.index) this.render(next, true);
    }
    render(index, focus = false) {
      this.index = index;
      const entry = pages[index], page = document.getElementById('guide-page');
      page.dataset.page = entry.id;
      const art = document.getElementById('guide-art');
      art.className = 'guide-art guide-art--' + entry.id;
      art.innerHTML = entry.art();
      document.getElementById('guide-category').textContent = entry.category;
      const title = document.getElementById('guide-title');
      title.textContent = entry.title;
      const copy = document.getElementById('guide-copy');
      copy.replaceChildren(...entry.sections.map(([heading, text]) => {
        const section = document.createElement('section');
        const p = document.createElement('p');
        if (heading) {
          const h3 = document.createElement('h3');
          h3.textContent = heading;
          section.append(h3);
        }
        p.textContent = text;
        section.append(p);
        return section;
      }));
      const count = document.getElementById('guide-page-count');
      count.textContent = `${index + 1} / ${pages.length}`;
      count.setAttribute('aria-label', `第${index + 1}页，共${pages.length}页：${entry.title}`);
      this.previous.disabled = index === 0;
      this.next.disabled = index === pages.length - 1;
      if (focus) title.focus({ preventScroll: true });
      page.scrollTop = 0;
    }
  }
  root.BeachGuide = BeachGuide;
})(globalThis);
