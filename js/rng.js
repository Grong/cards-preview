/* rng.js — 可复现的伪随机与加权抽取（抽卡公平的唯一实现处之一）。
 * mulberry32：32 位状态，快、够用；同种子序列完全一致，方便测试大样本。
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 字符串 → uint32（给"用名字当种子"的场景留的）
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // 按 item.weight 加权抽一个；权重不要求加起来是 1000
  function pickWeighted(rng, items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].weight;
    var r = rng() * total;
    var acc = 0;
    for (var j = 0; j < items.length; j++) {
      acc += items[j].weight;
      if (r < acc) return items[j];
    }
    return items[items.length - 1];
  }

  LC.Rng = { mulberry32: mulberry32, hashSeed: hashSeed, pickWeighted: pickWeighted };
})(typeof window !== 'undefined' ? window : globalThis);
