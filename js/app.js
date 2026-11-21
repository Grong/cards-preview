/* app.js — 界面层（HTML 版 demo / 预览）。
 *
 * 只做展示与交互，规则/概率/存档/埋点都在 config.js、draw.js、store.js、track.js 里。
 * ⚠ 微信小游戏没有 DOM：这层到时换成 Canvas 渲染，下面这些模块可以原样复用。
 */
(function (global) {
  'use strict';
  var LC = global.LC;
  var cfg = LC.Config;
  var el = {};
  var state = null;
  var filter = 'all';
  var timer = null;
  var lastDupAt = 0;
  var dexOpenedAt = 0;
  var currentView = 'draw';
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function save() { LC.Store.save(state); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtMs(ms) {
    var s = Math.ceil(ms / 1000);
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }
  function rarityOf(key) {
    for (var i = 0; i < cfg.RARITY.length; i++) {
      if (cfg.RARITY[i].key === key) return cfg.RARITY[i];
    }
    return cfg.RARITY[0];
  }
  function track(event, fields) { LC.Track.log(state, event, fields); }

  /* ---------- 卡牌 ---------- */
  function cardHtml(card, size) {
    var r = rarityOf(card.rarity);
    return '<div class="card' + (size === 'big' ? ' big' : '') + '" data-rarity="' + r.key + '">' +
      '<div class="art"><span class="glyph">' + card.glyph + '</span></div>' +
      '<div class="meta">' +
        '<p class="cname">' + card.name + '</p>' +
        '<p class="cplace">' + card.country + (card.city ? ' · ' + card.city : '') + '</p>' +
      '</div>' +
      '<span class="rbadge">' + r.label + '</span>' +
    '</div>';
  }

  /* ---------- 顶栏 / 抽卡 ---------- */
  function renderTickets() {
    var now = Date.now();
    var eco = cfg.ECONOMY;
    el.ticketCount.textContent = state.tickets;
    var next = LC.Store.msToNext(state, now);
    var dailyFull = state.dailyGranted >= eco.dailyCap;
    if (state.tickets >= eco.maxBanked) el.ticketNext.textContent = '已满';
    else if (dailyFull) el.ticketNext.textContent = '今日已满';
    else el.ticketNext.textContent = '下一抽 ' + fmtMs(next);

    el.drawBtn.disabled = state.tickets < 1;
    if (state.tickets > 0) {
      el.drawHint.textContent = '每 ' + eco.minutesPerTicket + ' 分钟 +1 抽 · 未领取最多 ' + eco.maxBanked;
    } else if (dailyFull) {
      el.drawHint.textContent = '今日次数已发完 · 明天 0 点重置';
    } else {
      el.drawHint.textContent = '次数用完了 · 下一抽 ' + fmtMs(next);
    }
    // 玩家视角：今天已经抽了多少 / 今天最多能抽多少
    el.dailyLine.textContent = '今日已抽 ' + state.dailyDrawn + ' / ' + eco.dailyCap;
  }

  function tick() {
    var prevDay = state.dayKey;
    var prevDrawn = state.dailyDrawn;
    var changed = LC.Store.accrue(state, Date.now());
    if (state.dayKey !== prevDay) {
      LCDailyRollover(prevDay, prevDrawn);
      changed = true;
    }
    if (changed) save();
    renderTickets();
  }

  // 跨天：把上一天的实际抽卡数汇总成一条 daily_drawn
  function LCDailyRollover(prevDay, prevDrawn) {
    track('daily_drawn', { date: prevDay, count: prevDrawn });
  }

  function onDraw(source) {
    if (state.tickets < 1) return;
    state.tickets -= 1;
    var res = LC.Draw.draw(state);
    var now = Date.now();

    // 埋点：抽卡 + 重复后下一次抽卡
    track('draw', {
      card_id: res.card.id, tier: res.rarity, is_dup: !res.isNew,
      source: source || 'free', daily_drawn: state.dailyDrawn
    });
    if (lastDupAt) {
      track('next_draw_after_dup', { gap_ms: now - lastDupAt });
      lastDupAt = 0;
    }
    if (!res.isNew) lastDupAt = now;

    // 地区成套（名单补齐到 9 张后才可能成立）
    checkRegionComplete(res.card.region);

    save();
    renderTickets();
    renderDex();
    showReveal(res);
  }

  function checkRegionComplete(regionId) {
    var region = null;
    LC.Regions.forEach(function (r) { if (r.id === regionId) region = r; });
    if (!region || region.cards.length < 9) return;
    var owned = region.cards.filter(function (c) { return state.owned[c.id]; }).length;
    if (owned !== region.cards.length) return;
    state.completedRegions = state.completedRegions || {};
    if (state.completedRegions[regionId]) return;
    state.completedRegions[regionId] = true;
    track('region_complete', { region_id: regionId });
    save();
  }

  function showReveal(res) {
    var r = rarityOf(res.rarity);
    el.revealKicker.textContent = res.isNew
      ? '新卡入册'
      : '重复卡 · 已有 ' + state.owned[res.card.id] + ' 张';
    el.revealCardWrap.innerHTML = cardHtml(res.card, 'big');
    el.revealRarity.textContent = r.label + (res.pityLegend ? ' · 保底' : res.pityRare ? ' · 保底' : '');
    el.revealRarity.setAttribute('data-rarity', r.key);
    el.revealAgain.disabled = state.tickets < 1;
    el.revealAgain.textContent = state.tickets > 0 ? '再抽一张' : '次数用完了';
    el.revealOverlay.hidden = false;
    var box = el.reveal;
    box.classList.remove('in');
    void box.offsetWidth;
    box.classList.add('in');
  }

  function closeReveal() { el.revealOverlay.hidden = true; }

  /* ---------- 图鉴 ---------- */
  function renderFilters() {
    var total = LC.POOL_TARGET;            // 分母硬锁 36，不随池内卡数变（进度不倒退）
    var ownedTotal = 0;
    LC.Cards.forEach(function (c) { if (state.owned[c.id]) ownedTotal++; });
    el.dexCount.textContent = '已收集 ' + ownedTotal + ' / ' + total;

    var counts = {};
    LC.Cards.forEach(function (c) { if (state.owned[c.id]) counts[c.rarity] = (counts[c.rarity] || 0) + 1; });

    var html = '<button class="chip' + (filter === 'all' ? ' is-on' : '') + '" data-filter="all" type="button">全部 ' + total + '</button>';
    cfg.RARITY.forEach(function (r) {
      if (r.weight <= 0) return; // 棱彩不进池，不参与筛选
      var n = LC.TIER_TARGET[r.key];       // 各档锁定分母（6/2/1 × 地区数）
      html += '<button class="chip' + (filter === r.key ? ' is-on' : '') + '" data-filter="' + r.key +
        '" type="button">' + r.label + ' ' + (counts[r.key] || 0) + '/' + n + '</button>';
    });
    el.filters.innerHTML = html;
  }

  function cellHtml(card) {
    if (state.owned[card.id]) {
      return '<button class="dex-cell" data-id="' + card.id + '" type="button" aria-label="' + card.name + '">' +
        cardHtml(card) + '</button>';
    }
    return '<div class="dex-cell locked" aria-label="未获得">' +
      '<div class="card locked-card" data-rarity="' + card.rarity + '">' +
        '<div class="art"><span class="glyph">?</span></div>' +
        '<div class="meta"><p class="cname">未获得</p><p class="cplace">' + rarityOf(card.rarity).label + '</p></div>' +
      '</div></div>';
  }

  function regionsHtml() {
    var html = '';
    var shown = 0;
    LC.Regions.forEach(function (region) {
      var cards = region.cards.filter(function (c) { return filter === 'all' || c.rarity === filter; });
      if (!cards.length) return;
      shown += cards.length;
      var owned = region.cards.filter(function (c) { return state.owned[c.id]; }).length;
      html += '<section class="region">' +
        '<div class="region-head"><h3>' + region.name + '</h3>' +
        '<span class="region-count">' + owned + ' / ' + LC.REGION_TARGET + '</span>' +
        '</div><div class="grid">' + cards.map(cellHtml).join('') + '</div></section>';
    });
    return { html: html, shown: shown };
  }

  function prismHtml() {
    var html = '<section class="region prism-region">' +
      '<div class="region-head"><h3>成就限定</h3><span class="region-count">棱彩 · 不进抽卡池</span></div>' +
      '<div class="grid">';
    LC.PrismCards.forEach(function (c) {
      html += '<div class="dex-cell locked prism" aria-label="' + c.unlock + '">' +
        '<div class="card locked-card" data-rarity="prism">' +
          '<div class="art"><span class="glyph">🌈</span></div>' +
          '<div class="meta"><p class="cname">' + c.unlock + '</p><p class="cplace">棱彩 · 成就解锁</p></div>' +
        '</div></div>';
    });
    return html + '</div></section>';
  }

  function renderDex() {
    if (el.dexView.hidden) { renderFilters(); return; }
    renderFilters();
    var res = regionsHtml();
    el.regions.innerHTML = res.html + (filter === 'all' ? prismHtml() : '');
    el.dexEmpty.hidden = res.shown !== 0;
  }

  function openDetail(card) {
    var r = rarityOf(card.rarity);
    var src = card.source && card.source.pageUrl
      ? '<a class="src" href="' + card.source.pageUrl + '" target="_blank" rel="noopener">' +
        '原页面 · ' + (card.source.author || '未署名') + ' · ' + card.source.license + '</a>'
      : '<span class="src">出处未接入：上线前每张卡都要有 pageUrl / author / license / imageUrl。</span>';
    el.detailBody.innerHTML =
      cardHtml(card, 'big') +
      '<p class="blurb">' + card.blurb + '</p>' +
      '<p class="detail-row">收藏 <b>' + (state.owned[card.id] || 0) + '</b> 张 · ' + r.label + '</p>' +
      src;
    el.detailOverlay.hidden = false;
    track('card_open', { card_id: card.id, owned: state.owned[card.id] || 0 });
  }

  function closeDetail() { el.detailOverlay.hidden = true; }

  /* ---------- 概率与保底 ---------- */
  function renderRateSheet() {
    var rates = LC.Draw.rates();
    var counts = LC.Draw.poolCounts();

    var lines = rates.filter(function (r) { return r.drawable; }).map(function (r) {
      var n = counts.byTier[r.key] || 0;
      var each = n ? (r.pct / n) : 0;
      return '<li><span class="dot" data-rarity="' + r.key + '"></span>' + r.label +
        ' <b>' + r.pct.toFixed(1) + '%</b>' +
        ' <span class="muted">（卡池 ' + n + ' 张，单张 ' + each.toFixed(3) + '%）</span></li>';
    }).join('');

    // 含保底综合出率：与基础出率并列公示（Chief 定的两行口径）
    var pityLines = rates.filter(function (r) { return r.drawable; }).map(function (r) {
      return '<li><span class="dot" data-rarity="' + r.key + '"></span>' + r.label +
        ' <b>约 ' + cfg.PITY_RATES[r.key].toFixed(1) + '%</b></li>';
    }).join('');

    var legendTotal = LC.Cards.filter(function (c) { return c.rarity === 'legend'; }).length;
    el.rateBody.innerHTML =
      '<p class="rate-line"><b>基础出率：</b></p><ul class="rate-list">' + lines + '</ul>' +
      '<p class="rate-line"><b>含保底综合出率</b>（10 万抽实测，验收按这一行）：</p>' +
      '<ul class="rate-list compact">' + pityLines + '</ul>' +
      '<p class="rate-line muted">按 10 万次模拟，随已抽次数与保底计数变化。</p>' +
      '<p class="rate-line">当前卡池 <b>' + counts.total + '</b> 张；' +
      '图鉴共 ' + (LC.POOL_TARGET + LC.PrismCards.length) + ' 张（含 ' + LC.PrismCards.length +
      ' 张棱彩，成就专属、不通过抽取获得）。</p>' +
      '<p class="rate-line">棱彩卡不通过抽取获得：集齐任意 3 个地区 / 集齐本季全部 ' + legendTotal +
      ' 张传说 / 图鉴 100%，各解锁一张。</p>' +
      '<p class="rate-line"><b>保底：</b>连续 ' + cfg.PITY.rareAfter + ' 次未获得稀有及以上，第 ' + (cfg.PITY.rareAfter + 1) +
      ' 次必得稀有；连续 ' + cfg.PITY.legendAfter + ' 次未获得传说，第 ' + (cfg.PITY.legendAfter + 1) +
      ' 次必得传说。计数不跨天清零。</p>' +
      '<p class="rate-line muted">出率由抽卡权重决定，与各档卡池张数无关。</p>';
  }

  /* ---------- 复制日志 ---------- */
  function copyLog() {
    var text = JSON.stringify(LC.Track.exportJson(state), null, 1);
    function done() { toast('测试日志已复制（' + LC.Track.count() + ' 条）'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请长按选择'); }
    document.body.removeChild(ta);
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- 视图切换 ---------- */
  function setView(view) {
    if (currentView === 'dex' && view !== 'dex' && dexOpenedAt) {
      track('gallery_dwell', { region_id: 'all', ms: Date.now() - dexOpenedAt });
      dexOpenedAt = 0;
    }
    currentView = view;
    el.drawView.hidden = view !== 'draw';
    el.dexView.hidden = view !== 'dex';
    el.tabDraw.classList.toggle('is-active', view === 'draw');
    el.tabDex.classList.toggle('is-active', view === 'dex');
    if (view === 'dex') {
      dexOpenedAt = Date.now();
      var missing = LC.Cards.filter(function (c) { return !state.owned[c.id]; }).length;
      track('gallery_open', { region_id: 'all', missing_count: missing });
      renderDex();
    }
  }

  /* ---------- 启动 ---------- */
  function init() {
    ['brandName', 'ticketCount', 'ticketNext', 'drawBtn', 'drawHint', 'dailyLine', 'rarityLegend',
      'rateBtn', 'rateOverlay', 'rateSheet', 'rateBody', 'rateClose',
      'drawView', 'dexView', 'regions', 'dexCount', 'filters', 'dexEmpty', 'exportBtn',
      'tabDraw', 'tabDex',
      'revealOverlay', 'reveal', 'revealKicker', 'revealCardWrap', 'revealRarity',
      'revealAgain', 'revealDex',
      'detailOverlay', 'detail', 'detailBody', 'detailClose'].forEach(function (id) {
      el[id] = $(id);
    });

    state = LC.Store.load();
    var prevDay = state.dayKey;
    var prevDrawn = state.dailyDrawn;
    LC.Store.accrue(state, Date.now());
    if (state.dayKey !== prevDay) LCDailyRollover(prevDay, prevDrawn);
    LC.Store.save(state);
    track('session_start', {});

    // 概率只列可抽的三档；棱彩单独一行说明
    var rates = LC.Draw.rates();
    var legend = rates.filter(function (r) { return r.drawable; }).map(function (r) {
      return '<li><span class="dot" data-rarity="' + r.key + '"></span>' +
        r.label + ' <b>' + (Math.round(r.pct * 10) / 10) + '%</b></li>';
    }).join('');
    var legendTotal = LC.Cards.filter(function (c) { return c.rarity === 'legend'; }).length;
    el.rarityLegend.innerHTML = legend +
      '<li class="prism-note">棱彩卡不通过抽取获得：集齐任意 3 个地区 / 全部 ' + legendTotal +
      ' 张传说 / 图鉴 100%，各解锁一张。</li>';

    el.drawBtn.addEventListener('click', function () { onDraw('free'); });
    el.revealAgain.addEventListener('click', function () { closeReveal(); onDraw('free'); });
    el.revealDex.addEventListener('click', function () { closeReveal(); setView('dex'); });
    el.revealOverlay.addEventListener('click', function (e) { if (e.target === el.revealOverlay) closeReveal(); });
    el.tabDraw.addEventListener('click', function () { setView('draw'); });
    el.tabDex.addEventListener('click', function () { setView('dex'); });
    el.filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      filter = b.dataset.filter;
      renderDex();
    });
    el.regions.addEventListener('click', function (e) {
      var cell = e.target.closest('.dex-cell[data-id]');
      if (!cell) return;
      var card = LC.Cards.filter(function (c) { return c.id === cell.dataset.id; })[0];
      if (card) openDetail(card);
    });
    el.detailClose.addEventListener('click', closeDetail);
    el.detailOverlay.addEventListener('click', function (e) { if (e.target === el.detailOverlay) closeDetail(); });
    el.rateBtn.addEventListener('click', function () { renderRateSheet(); el.rateOverlay.hidden = false; });
    el.rateClose.addEventListener('click', function () { el.rateOverlay.hidden = true; });
    el.rateOverlay.addEventListener('click', function (e) { if (e.target === el.rateOverlay) el.rateOverlay.hidden = true; });
    el.exportBtn.addEventListener('click', copyLog);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeReveal(); closeDetail(); el.rateOverlay.hidden = true; }
    });
    global.addEventListener('pagehide', save);

    renderTickets();
    renderFilters();
    timer = setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
