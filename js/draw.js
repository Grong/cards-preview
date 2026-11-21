/* draw.js — 抽卡逻辑（概率、双保底、卡池分档的唯一实现处）。
 * 规则来源：config.js（策划2 v0.2：84/13/3，棱彩不进池，10/60 双保底）。
 *
 * 可复现：同存档、同抽数 → 同一张卡。序列由 state.seed + state.draws 推出，
 * 测试可固定种子跑大样本验证分布。界面层不许自己算概率。
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});

  var poolByRarity = null;

  function pools() {
    if (poolByRarity) return poolByRarity;
    poolByRarity = {};
    LC.Config.RARITY.forEach(function (r) { poolByRarity[r.key] = []; });
    LC.Cards.forEach(function (c) {
      if (!poolByRarity[c.rarity]) throw new Error('卡池里有未知稀有度：' + c.id + ' / ' + c.rarity);
      poolByRarity[c.rarity].push(c);
    });
    drawable().forEach(function (r) {
      if (!poolByRarity[r.key] || !poolByRarity[r.key].length) {
        throw new Error('可抽档位没有卡：' + r.key);
      }
    });
    return poolByRarity;
  }

  // 可抽档位：weight > 0 且 drawable !== false（棱彩不参与）
  function drawable() {
    return LC.Config.RARITY.filter(function (r) {
      return r.weight > 0 && r.drawable !== false;
    });
  }

  function seedFor(state) {
    return (state.seed ^ Math.imul((state.draws || 0) + 1, 0x9E3779B9)) >>> 0;
  }

  /* 抽哪一档（双保底）：
   *   连续 legendAfter 抽无传说 → 必传说
   *   否则连续 rareAfter 抽无稀有及以上 → 在稀有/传说里按权重抽（传说也算达标）
   * 计数器跨天不清零，由 store 持久化。
   */
  function pickRarity(rng, pity) {
    var cfg = LC.Config;
    var p = pity || { rare: 0, legend: 0 };
    if (p.legend >= cfg.PITY.legendAfter) return 'legend';
    if (p.rare >= cfg.PITY.rareAfter) {
      var top = drawable().filter(function (r) { return r.key !== 'common'; });
      return LC.Rng.pickWeighted(rng, top).key;
    }
    return LC.Rng.pickWeighted(rng, drawable()).key;
  }

  function draw(state) {
    var rng = LC.Rng.mulberry32(seedFor(state));
    var rarity = pickRarity(rng, { rare: state.rarePity || 0, legend: state.legendPity || 0 });
    var pool = pools()[rarity];
    var card = pool[Math.floor(rng() * pool.length)] || pool[0];
    var isNew = !state.owned[card.id];
    var pityRare = rarity !== 'common' && (state.rarePity || 0) >= LC.Config.PITY.rareAfter;
    var pityLegend = rarity === 'legend' && (state.legendPity || 0) >= LC.Config.PITY.legendAfter;

    state.owned[card.id] = (state.owned[card.id] || 0) + 1;
    state.draws = (state.draws || 0) + 1;
    state.dailyDrawn = (state.dailyDrawn || 0) + 1;

    // 计数：传说清两个，稀有只清稀有，普通两个都涨
    if (rarity === 'legend') {
      state.rarePity = 0;
      state.legendPity = 0;
    } else if (rarity === 'rare') {
      state.rarePity = 0;
      state.legendPity = (state.legendPity || 0) + 1;
    } else {
      state.rarePity = (state.rarePity || 0) + 1;
      state.legendPity = (state.legendPity || 0) + 1;
    }

    return {
      card: card, rarity: rarity, isNew: isNew,
      pityRare: pityRare, pityLegend: pityLegend
    };
  }

  // 公示用：可抽三档的权重与实际百分比（棱彩单独给，pct 0）
  function rates() {
    var total = 0;
    drawable().forEach(function (r) { total += r.weight; });
    return LC.Config.RARITY.map(function (r) {
      var canDraw = r.weight > 0 && r.drawable !== false;
      return {
        key: r.key, label: r.label, weight: r.weight, drawable: canDraw,
        pct: canDraw ? r.weight / total * 100 : 0
      };
    });
  }

  // 卡池张数（各档 + 总数），概率页展示"出率"和"张数"两套数
  function poolCounts() {
    var counts = {};
    var total = 0;
    LC.Cards.forEach(function (c) {
      counts[c.rarity] = (counts[c.rarity] || 0) + 1;
      total += 1;
    });
    return { byTier: counts, total: total };
  }

  LC.Draw = {
    pools: pools,
    drawable: drawable,
    seedFor: seedFor,
    pickRarity: pickRarity,
    rates: rates,
    poolCounts: poolCounts,
    draw: draw
  };
})(typeof window !== 'undefined' ? window : globalThis);
