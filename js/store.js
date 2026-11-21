/* store.js — 存档 + 分钟计时 + 本地统计。
 *
 * 存：抽卡次数（存量）、已拥有、双保底计数、上次计时点、当天已发/已抽、uid、种子。
 * 关掉再开不丢；每次变动即时 save。
 *
 * 计时口径（mode 'local'）：按「上次计时点 → 现在」补抽，客户端时间可改；
 * 这是纯单机、无付费下的取舍。要防刷必须把发牌放服务端（MODE='server'）。
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});
  var cfg = LC.Config;

  var memory = null;
  function memStorage() {
    if (!memory) {
      var data = {};
      memory = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        _data: data
      };
    }
    return memory;
  }

  function storage() {
    // 微信小游戏：wx storage 是同步 API，字段名与 localStorage 对齐后上层不用改
    try {
      if (global.wx && typeof global.wx.getStorageSync === 'function') {
        return {
          getItem: function (k) {
            try { var v = global.wx.getStorageSync(k); return (v === '' || v == null) ? null : v; }
            catch (e) { return null; }
          },
          setItem: function (k, v) {
            try { global.wx.setStorageSync(k, v); } catch (e) {}
          },
          removeItem: function (k) {
            try { global.wx.removeStorageSync(k); } catch (e) {}
          }
        };
      }
    } catch (e) { /* 没有 wx 就往下走 */ }
    try {
      if (global.localStorage) return global.localStorage;
    } catch (e) { /* 隐私模式可能抛错 */ }
    return memStorage();
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // 本地日期键（补零，方便按字符串比较先后；0 点重置用）
  function dayKey(now) {
    var d = new Date(now);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function newUid() {
    var rnd = Math.floor(Math.random() * 0xFFFFFFFF).toString(36);
    return 'u_' + Date.now().toString(36) + rnd;
  }

  function fresh(now) {
    if (now == null) now = Date.now();
    return {
      v: cfg.VERSION,
      uid: newUid(),
      tickets: cfg.ECONOMY.startTickets,
      lastTickAt: now,
      owned: {},
      rarePity: 0,
      legendPity: 0,
      draws: 0,
      // 每日发放拆三个数：自然 77 + 任务 13 = 合计 90（初始赠送计入自然）
      dailyGranted: cfg.ECONOMY.startTickets,
      naturalGranted: cfg.ECONOMY.startTickets,
      taskGranted: 0,
      dailyDrawn: 0,
      dayKey: dayKey(now),
      seed: cfg.DRAW_SEED >>> 0,
      createdAt: now,
      updatedAt: now
    };
  }

  function intOr(x, d) {
    var n = Math.floor(Number(x));
    return isFinite(n) && n >= 0 ? n : d;
  }

  // 今日发放三个数的校验/迁移；reset=true 表示正常跨天清零
  function normDaily(s, raw, reset) {
    var eco = cfg.ECONOMY;
    if (reset) {
      s.dailyGranted = 0;
      s.naturalGranted = 0;
      s.taskGranted = 0;
      return;
    }
    var total = Math.min(eco.dailyCap, intOr(raw.dailyGranted, 0));
    var nat, task;
    if (raw.naturalGranted != null || raw.taskGranted != null) {
      nat = Math.min(eco.naturalDailyCap, intOr(raw.naturalGranted, total));
      task = Math.min(eco.taskDailyCap, intOr(raw.taskGranted, 0));
    } else {
      // 旧档只有 dailyGranted（任务还没上线）：全算自然恢复
      nat = Math.min(eco.naturalDailyCap, total);
      task = Math.min(eco.taskDailyCap, total - nat);
    }
    s.naturalGranted = nat;
    s.taskGranted = task;
    s.dailyGranted = Math.min(eco.dailyCap, nat + task);
  }

  // 任何来源的存档都先过一遍校验，坏字段回落到默认值
  function normalize(raw, now) {
    if (!raw || typeof raw !== 'object' || raw.v !== cfg.VERSION) return fresh(now);
    var s = fresh(now);
    s.uid = raw.uid || s.uid;
    s.tickets = Math.min(cfg.ECONOMY.maxBanked, intOr(raw.tickets, 0));
    var last = raw.lastTickAt != null ? raw.lastTickAt : raw.lastTick;
    s.lastTickAt = isFinite(Number(last)) ? Number(last) : now;
    s.rarePity = intOr(raw.rarePity, intOr(raw.pity, 0)); // 旧档单计数器迁移到稀有保底
    s.legendPity = intOr(raw.legendPity, 0);
    s.draws = intOr(raw.draws, 0);
    s.seed = (Number(raw.seed) >>> 0) || cfg.DRAW_SEED;
    s.createdAt = isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : now;
    s.updatedAt = isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : now;

    var today = dayKey(now);
    if (typeof raw.dayKey === 'string' && raw.dayKey > today) {
      // 存档日期在未来（用户把时间调回去过）：保留，不重置，防回拨刷次数
      s.dayKey = raw.dayKey;
      normDaily(s, raw, false);
      s.dailyDrawn = intOr(raw.dailyDrawn, 0);
    } else if (raw.dayKey === today) {
      s.dayKey = today;
      normDaily(s, raw, false);
      s.dailyDrawn = intOr(raw.dailyDrawn, 0);
    } else {
      // 正常跨天：今日已发/已抽清零
      s.dayKey = today;
      normDaily(s, raw, true);
      s.dailyDrawn = 0;
    }

    if (raw.owned && typeof raw.owned === 'object') {
      Object.keys(raw.owned).forEach(function (id) {
        var n = intOr(raw.owned[id], 0);
        if (n > 0) s.owned[id] = n;
      });
    }
    return s;
  }

  function load(st) {
    var now = Date.now();
    st = st || storage();
    try {
      var raw = st.getItem(cfg.STORAGE_KEY);
      if (!raw) return fresh(now);
      return normalize(JSON.parse(raw), now);
    } catch (e) {
      return fresh(now);
    }
  }

  function save(state, st) {
    st = st || storage();
    state.updatedAt = Date.now();
    try {
      st.setItem(cfg.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 按时间补抽（用 lastTickAt 时间戳算差值，不靠 setInterval 累加）：
   *   - 每 minutesPerTicket 分钟 +1
   *   - 未领取存量封顶 maxBanked（抽掉会恢复）
   *   - 自然恢复每天封顶 naturalDailyCap（77），不占任务额度；
   *     合计不超过 dailyCap（90）
   *   - 日期回拨不触发重置；时间倒退只把基准挪到现在
   *   - 返回 true 表示状态变了（含跨天重置），调用方该存一次
   */
  function accrue(state, now) {
    var eco = cfg.ECONOMY;
    var per = eco.minutesPerTicket * 60000;
    if (!isFinite(now)) return false;

    var changed = false;
    var today = dayKey(now);
    if (state.dayKey !== today) {
      if (state.dayKey && today > state.dayKey) {
        // 正常跨天：重置今日计数（日期回拨不重置）
        state.dayKey = today;
        state.dailyGranted = 0;
        state.naturalGranted = 0;
        state.taskGranted = 0;
        state.dailyDrawn = 0;
        changed = true;
      } else if (!state.dayKey) {
        state.dayKey = today;
        changed = true;
      }
      // today < state.dayKey：时间被调回过去，什么都不重置
    }

    if (state.lastTickAt == null || !isFinite(state.lastTickAt)) {
      state.lastTickAt = now;
      return true;
    }
    if (now < state.lastTickAt) {
      // 用户把时间调回去了：不补、不崩，基准点拉到现在
      state.lastTickAt = now;
      return true;
    }

    var units = Math.floor((now - state.lastTickAt) / per);
    if (units <= 0) return changed;

    var room = eco.maxBanked - state.tickets;
    var naturalRoom = eco.naturalDailyCap - state.naturalGranted;
    var dailyRoom = eco.dailyCap - state.dailyGranted;
    var gain = Math.max(0, Math.min(units, room, naturalRoom, dailyRoom));
    state.tickets += gain;
    state.naturalGranted += gain;
    state.dailyGranted += gain;
    state.lastTickAt += units * per;
    return true;
  }

  /* 任务奖励发抽：单独计 taskGranted（日上限 taskDailyCap=13），
   * 与自然恢复共用 90 总上限、共用存量 30 上限。
   * 返回实际发出张数（0 表示任务额度/总上限/存量已满）。任务系统接上后从任务页调用。 */
  function grantTask(state, n) {
    var eco = cfg.ECONOMY;
    n = Math.floor(Number(n));
    if (!isFinite(n) || n <= 0) return 0;
    var room = Math.min(eco.maxBanked - state.tickets,
      eco.taskDailyCap - state.taskGranted,
      eco.dailyCap - state.dailyGranted);
    var gain = Math.max(0, Math.min(n, room));
    state.tickets += gain;
    state.taskGranted += gain;
    state.dailyGranted += gain;
    return gain;
  }

  // 距下一抽还有多少毫秒；存满、自然恢复发满或当天总发满时返回 0
  function msToNext(state, now) {
    var eco = cfg.ECONOMY;
    var per = eco.minutesPerTicket * 60000;
    if (state.tickets >= eco.maxBanked) return 0;
    if (state.naturalGranted >= eco.naturalDailyCap) return 0;
    if (state.dailyGranted >= eco.dailyCap) return 0;
    var elapsed = Math.max(0, now - state.lastTickAt);
    return Math.max(0, per - (elapsed % per));
  }

  function reset(st) {
    st = st || storage();
    try { st.removeItem(cfg.STORAGE_KEY); } catch (e) {}
    return fresh(Date.now());
  }

  LC.Store = {
    memStorage: memStorage,
    storage: storage,
    dayKey: dayKey,
    newUid: newUid,
    fresh: fresh,
    normalize: normalize,
    load: load,
    save: save,
    accrue: accrue,
    grantTask: grantTask,
    msToNext: msToNext,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
