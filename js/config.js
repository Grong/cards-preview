/* config.js — 全局配置（唯一数值入口：概率、保底、经济、存档键都在这里）。
 *
 * ⚠ 数值是 demo 占位，等策划2 的数值表定稿后只改这一个文件：
 *   - 四档权重、保底规则
 *   - 每分钟给几张、上限、初始抽数
 *   - 任务/广告奖励（P1 再开）
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});

  /* 首版范围：只上 4 个地区 × 9 张 = 36（图源按过审数量落档再扩到 48 / 72）。
   * 代码结构不写死：LC.POOL_TARGET = 地区数 × 9，扩地区只改这份名单。 */
  LC.Config = {
    VERSION: 1,
    APP_VERSION: '0.1.0-preview',
    /* 正式名待用户拍板（微信小游戏备案按游戏名备、提交后不可改）；
     * 拍板前界面只显示"预览版"，不对外露出自起的名字。 */
    APP_NAME: '预览版',
    STORAGE_KEY: 'huanyou.state.v1',
    ACTIVE_REGIONS: ['europe', 'eastasia', 'southasia', 'mideast'],

    /* 上线池分母：本季只认 SEASON_1_SIZE，图鉴进度分母不随池内卡数变。
     * 上线必须是完整池：36（4 地区 × 9）齐了上，凑不齐上完整的 27（3 地区 × 9）；
     * 绝不上「先 24 再补 12」的半成品池——分母从 24 涨到 36 就是进度倒退。
     * 扩池（48/72）不改这个数：新卡进「扩展」分区，本季分母不动。 */
    SEASON_1_SIZE: 36,
    /* 每地区的档位结构（锁定分母用）：6 普通 + 2 稀有 + 1 传说 = 9。 */
    REGION_MIX: { common: 6, rare: 2, legend: 1 },

    /* 概率公示两套数（Chief 2026-11-21 定）：
     *   基础出率（权重算出）与含保底综合出率（10 万抽实测）。
     *   验收按综合口径 ±1 个点；改权重/保底时两套都要重算。 */
    PITY_RATES: { common: 81.0, rare: 15.2, legend: 3.9 },

    /* 稀有度四档，weight 是相对权重（内部按总和归一，改权重不用凑 1000）。
     * 棱彩 weight=0 且 drawable=false：不通过抽取获得。 */

    /* 计时模式：
     *   'local'  —— 纯单机，承认客户端时间可改（等于无限抽）。无付费，风险可接受。
     *   'server' —— 由服务端发抽卡次数；前端只展示，需要后端与登录，成本另算。
     * 默认 local，等策划2 拍板再定这一版走哪条。
     */
    MODE: 'local',

    RARITY: [
      { key: 'common', label: '普通', weight: 840, color: '#9FB0AA' },
      { key: 'rare',   label: '稀有', weight: 130, color: '#57A9F5' },
      { key: 'legend', label: '传说', weight: 30,  color: '#E8B04B' },
      { key: 'prism',  label: '棱彩', weight: 0,   color: '#C77DFF', drawable: false }
    ],

    /* 保底（策划2 v0.2）：
     *   连续 10 抽没出稀有及以上 → 第 11 抽必稀有及以上
     *   连续 60 抽没出传说     → 第 61 抽必传说
     * 两个计数器互相独立，跨天不清零，存进存档。
     */
    PITY: { rareAfter: 10, legendAfter: 60 },

    /* 经济（策划2 v0.2 / 首版无广告）：
     *   每 5 分钟 +1；未领取存量上限 30；
     *   每日三个数分开记（Chief 2026-11-21 定）：
     *     naturalGranted 自然恢复，日上限 77
     *     taskGranted    任务奖励，日上限 13
     *     dailyGranted = 两者之和，总上限 90
     *   B 版广告再加 adGranted 上限 30，合计 120（首版不显示 120）。
     *   startTickets 是初始赠送，计入当天自然恢复。
     */
    ECONOMY: {
      minutesPerTicket: 5,
      maxBanked: 30,
      dailyCap: 90,
      naturalDailyCap: 77,
      taskDailyCap: 13,
      adDailyBonus: 30,
      dayResetHour: 0,
      startTickets: 10
    },

    /* 抽卡序列的基准种子；存档里会按抽数推进，保证同一存档可复现。 */
    DRAW_SEED: 20261121
  };
})(typeof window !== 'undefined' ? window : globalThis);
