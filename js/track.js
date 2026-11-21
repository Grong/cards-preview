/* track.js — 本地埋点 + 日志导出（首版没有服务端，字段照 design/acceptance.md）。
 *
 * 事件落 localStorage，上限 3000 条（超过丢最早一半）。导出 JSON：
 *   { uid, version, exported_at, tz, day_index, events: [...] }
 * 微信里"复制文本"比下载文件稳，界面用复制到剪贴板。
 *
 * 埋点只记行为，不记任何个人信息。
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});
  var KEY = 'huanyou.events.v1';
  var MAX = 3000;

  function storage() { return LC.Store.storage(); }

  function load() {
    try {
      var raw = storage().getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function save(events) {
    try {
      storage().setItem(KEY, JSON.stringify(events.slice(-MAX)));
      return true;
    } catch (e) { return false; }
  }

  // 记一条事件：{ e, uid, ts, day_index, ...字段 }
  function log(state, event, fields) {
    var events = load();
    var now = Date.now();
    var item = {
      e: event,
      uid: state.uid,
      ts: now,
      day_index: dayIndex(state, now)
    };
    if (fields) {
      Object.keys(fields).forEach(function (k) { item[k] = fields[k]; });
    }
    events.push(item);
    if (events.length > MAX) events = events.slice(-Math.floor(MAX / 2));
    save(events);
    return item;
  }

  // 第几天（从建档那天算，D1 起）
  function dayIndex(state, now) {
    var start = state.createdAt || now;
    var d0 = new Date(start); d0.setHours(0, 0, 0, 0);
    var d1 = new Date(now); d1.setHours(0, 0, 0, 0);
    return Math.floor((d1 - d0) / 86400000) + 1;
  }

  function exportJson(state, now) {
    now = now || Date.now();
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return {
      uid: state.uid,
      version: LC.Config.APP_VERSION,
      exported_at: new Date(now).toISOString(),
      tz: tz,
      day_index: dayIndex(state, now),
      events: load()
    };
  }

  function count() { return load().length; }
  function clear() { try { storage().removeItem(KEY); } catch (e) {} }

  LC.Track = {
    KEY: KEY,
    load: load,
    save: save,
    log: log,
    dayIndex: dayIndex,
    exportJson: exportJson,
    count: count,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : globalThis);
