/* cards.js — 首发卡池结构：8 地区 × 9 张（每地区 6 普通 + 2 稀有 + 1 传说）。
 *
 * 现状：48 张名单已定（每地区 1 传说 + 1 稀有 + 4 普通），还差 24 张
 * （每地区 +1 稀有 +2 普通，等美术2 出候选、策划2 筛）。补卡只往 REGIONS 里加，
 * 图鉴分母、地区进度、概率页里的张数都从数据现算，不写死 24/48/72。
 *
 * 棱彩 3 张是成就解锁，不进抽卡池（PRISM），不参与概率。
 *
 * source 四字段是上线硬条件（策划2 v0.3，图源改 Pixabay）：
 *   pageUrl（原页面）/ author（作者）/ license（许可）/ imageUrl（图片直链）。
 * 四字段缺一不能发；tools/release-check.js 会逐张检查。演示阶段填空，接图后补。
 */
(function (global) {
  'use strict';
  var LC = (global.LC = global.LC || {});

  function card(id, name, country, city, rarity, glyph, blurb) {
    return {
      id: id, name: name, country: country, city: city || '',
      rarity: rarity, glyph: glyph, blurb: blurb,
      source: { pageUrl: '', author: '', license: '', imageUrl: '' }
    };
  }

  // 每地区结构：1 传说 + 1 稀有 + 4 普通（已知），后续 +1 稀有 +2 普通
  var REGIONS = [
    {
      id: 'europe', name: '欧洲', cards: [
        card('eiffel', '埃菲尔铁塔', '法国', '巴黎', 'legend', '🗼', '为万国博览会而建，曾差点被拆掉。'),
        card('sagrada', '圣家堂', '西班牙', '巴塞罗那', 'rare', '⛪', '高迪改了四十多年，至今还在建。'),
        card('colosseum', '罗马斗兽场', '意大利', '罗马', 'common', '🏟', '可容纳数万人的古竞技场。'),
        card('pisa', '比萨斜塔', '意大利', '比萨', 'common', '🏛', '从修建时就歪，歪了六百多年。'),
        card('bigben', '大本钟', '英国', '伦敦', 'common', '🕰', '威斯敏斯特宫旁的钟楼，整点报时。'),
        card('stbasil', '圣瓦西里主教座堂', '俄罗斯', '莫斯科', 'common', '⛪', '红场旁九座彩色洋葱顶。')
      ]
    },
    {
      id: 'eastasia', name: '东亚', cards: [
        card('wall', '长城', '中国', '', 'legend', '🧱', '横跨北方的城墙，明长城最完整。'),
        card('fuji', '富士山', '日本', '', 'rare', '🗻', '日本最高峰，山顶终年积雪。'),
        card('kiyomizu', '清水寺', '日本', '京都', 'common', '⛩', '悬空的木舞台，京都的老地标。'),
        card('himeji', '姬路城', '日本', '姬路', 'common', '🏯', '白色城墙与天守阁，保存完整。'),
        card('potala', '布达拉宫', '中国', '拉萨', 'common', '🏔', '红山上的宫堡，海拔三千七百米。'),
        card('gyeongbok', '景福宫', '韩国', '首尔', 'common', '🏯', '朝鲜王朝的正宫。')
      ]
    },
    {
      id: 'southasia', name: '南亚与东南亚', cards: [
        card('taj', '泰姬陵', '印度', '阿格拉', 'legend', '🕌', '白色大理石陵墓，为纪念亡妻而建。'),
        card('angkor', '吴哥窟', '柬埔寨', '暹粒', 'rare', '🛕', '高棉帝国留下的石头庙宇群。'),
        card('borobudur', '婆罗浮屠', '印度尼西亚', '爪哇', 'common', '🛕', '世界最大的佛教塔群。'),
        card('shwedagon', '仰光大金塔', '缅甸', '仰光', 'common', '🛕', '通体贴金的佛塔。'),
        card('petronas', '双子塔', '马来西亚', '吉隆坡', 'common', '🏙', '两座塔在中段用天桥相连。'),
        card('lotus', '莲花寺', '印度', '新德里', 'common', '🪷', '像一朵盛开的莲花。')
      ]
    },
    {
      id: 'mideast', name: '中东', cards: [
        card('petra', '佩特拉', '约旦', '', 'legend', '🪨', '直接在岩壁上凿出来的城。'),
        card('bluemosque', '蓝色清真寺', '土耳其', '伊斯坦布尔', 'rare', '🕌', '内壁贴满蓝色瓷砖。'),
        card('burj', '哈利法塔', '阿联酋', '迪拜', 'common', '🏙', '世界第一高楼，八百多米。'),
        card('cappadocia', '卡帕多奇亚', '土耳其', '格雷梅', 'common', '🎈', '奇石地貌与热气球。'),
        card('abudhabi', '阿布扎比大清真寺', '阿联酋', '阿布扎比', 'common', '🕌', '白色大理石与金色穹顶。'),
        card('imam', '伊玛目广场', '伊朗', '伊斯法罕', 'common', '🏛', '曾经的世界最大广场之一。')
      ]
    },
    {
      id: 'africa', name: '非洲', cards: [
        card('giza', '吉萨金字塔', '埃及', '吉萨', 'legend', '🔺', '四千多年前的法老陵墓。'),
        card('lalibela', '拉利贝拉岩石教堂', '埃塞俄比亚', '拉利贝拉', 'rare', '⛪', '整座教堂从岩石里凿出。'),
        card('djenno', '杰内大清真寺', '马里', '杰内', 'common', '🕌', '用泥砖砌成的清真寺。'),
        card('victoria', '维多利亚瀑布', '赞比亚', '', 'common', '💦', '水雾能升到几百米高。'),
        card('tablemt', '桌山', '南非', '开普敦', 'common', '⛰', '山顶平得像桌面。'),
        card('hassan', '哈桑二世清真寺', '摩洛哥', '卡萨布兰卡', 'common', '🕌', '一半建在海上的清真寺。')
      ]
    },
    {
      id: 'northamerica', name: '北美', cards: [
        card('liberty', '自由女神像', '美国', '纽约', 'legend', '🗽', '法国送出的礼物，举着火炬站在港口。'),
        card('goldengate', '金门大桥', '美国', '旧金山', 'rare', '🌉', '橘红色的悬索桥，常年在雾里。'),
        card('niagara', '尼亚加拉瀑布', '加拿大', '', 'common', '💦', '横跨两国的马蹄形瀑布。'),
        card('cntower', '多伦多 CN 塔', '加拿大', '多伦多', 'common', '🗼', '曾是世界最高的自立建筑。'),
        card('grandcanyon', '大峡谷', '美国', '亚利桑那', 'common', '🏜', '科罗拉多河切出的深谷。'),
        card('washington', '华盛顿纪念碑', '美国', '华盛顿', 'common', '🗿', '白色方尖碑，高约 169 米。')
      ]
    },
    {
      id: 'latinamerica', name: '拉美', cards: [
        card('machu', '马丘比丘', '秘鲁', '', 'legend', '⛰', '云端的印加古城，藏在山脊上。'),
        card('chichen', '奇琴伊察', '墨西哥', '尤卡坦', 'rare', '🐍', '羽蛇神金字塔，春分时会有蛇影。'),
        card('christ', '里约基督像', '巴西', '里约热内卢', 'common', '🗽', '山顶上的张开双臂的基督像。'),
        card('moai', '复活节岛石像', '智利', '', 'common', '🗿', '面朝大海的摩艾石像。'),
        card('havana', '哈瓦那老城', '古巴', '哈瓦那', 'common', '🏛', '彩色骑楼与老广场。'),
        card('uyuni', '乌尤尼盐沼', '玻利维亚', '', 'common', '🪞', '雨季时像一面天空之镜。')
      ]
    },
    {
      id: 'oceania', name: '大洋洲', cards: [
        card('sydney', '悉尼歌剧院', '澳大利亚', '悉尼', 'legend', '🎭', '像一组白色贝壳，也像鼓满的帆。'),
        card('uluru', '乌鲁鲁', '澳大利亚', '北领地', 'rare', '🪨', '沙漠正中的巨大红色岩石。'),
        card('milford', '米尔福德峡湾', '新西兰', '', 'common', '⛰', '峭壁直插水面的峡湾。'),
        card('flinders', '弗林德斯街车站', '澳大利亚', '墨尔本', 'common', '🏛', '黄色外墙的老火车站。'),
        card('moeraki', '摩拉基大圆石', '新西兰', '', 'common', '🪨', '沙滩上的圆形巨石。'),
        card('skytower', '天空塔', '新西兰', '奥克兰', 'common', '🗼', '南半球最高的建筑之一。')
      ]
    }
  ];

  // 棱彩：成就限定，不进抽卡池（三条条件按启用地区/传说数现算）
  var PRISM = [
    { id: 'prism-wall', name: '长城 · 虹彩', country: '中国', city: '', rarity: 'prism',
      glyph: '🌈', blurb: '', unlock: '集齐任意 3 个地区',
      source: { pageUrl: '', author: '', license: '', imageUrl: '' } },
    { id: 'prism-eiffel', name: '埃菲尔铁塔 · 虹彩', country: '法国', city: '巴黎', rarity: 'prism',
      glyph: '🌈', blurb: '', unlock: '',
      source: { pageUrl: '', author: '', license: '', imageUrl: '' } },
    { id: 'prism-machu', name: '马丘比丘 · 虹彩', country: '秘鲁', city: '', rarity: 'prism',
      glyph: '🌈', blurb: '', unlock: '',
      source: { pageUrl: '', author: '', license: '', imageUrl: '' } }
  ];

  var all = [];
  /* 首版只启用 ACTIVE_REGIONS 里的地区（默认 4 个 × 9 = 36，上线分母锁在 config.POOL_SIZE）；
   * 其余地区的数据留在 ALL_REGIONS 里，扩地区时改 config 一处即可。 */
  var activeIds = (LC.Config.ACTIVE_REGIONS && LC.Config.ACTIVE_REGIONS.length)
    ? LC.Config.ACTIVE_REGIONS : null;
  var activeRegions = activeIds
    ? REGIONS.filter(function (r) { return activeIds.indexOf(r.id) >= 0; })
    : REGIONS;
  activeRegions.forEach(function (r) { r.cards.forEach(function (c) { c.region = r.id; all.push(c); }); });

  // 每地区满编 9 张；上线分母硬锁 config.POOL_SIZE（36），不随当前池内卡数变。
  var REGION_TARGET = 9;
  var POOL_TARGET = LC.Config.POOL_SIZE;
  var MIX = LC.Config.REGION_MIX;
  // 锁定的档位分母：普通 / 稀有 / 传说各多少张（4 地区 → 24 / 8 / 4）
  var TIER_TARGET = {
    common: activeRegions.length * MIX.common,
    rare: activeRegions.length * MIX.rare,
    legend: activeRegions.length * MIX.legend
  };
  if (activeRegions.length * REGION_TARGET !== POOL_TARGET && typeof console !== 'undefined') {
    console.warn('[cards] 启用地区 ' + activeRegions.length + ' 个 × ' + REGION_TARGET +
      ' ≠ 上线分母 ' + POOL_TARGET + '：降级或扩池要连 config 一起改，release-check 会失败。');
  }
  if (MIX.common + MIX.rare + MIX.legend !== REGION_TARGET && typeof console !== 'undefined') {
    console.warn('[cards] REGION_MIX 合计 ' + (MIX.common + MIX.rare + MIX.legend) +
      ' ≠ 每地区 ' + REGION_TARGET + ' 张');
  }
  var legendTotal = all.filter(function (c) { return c.rarity === 'legend'; }).length;
  // 三条棱彩条件：3 个地区 / 全部传说 / 图鉴 100%（按启用地区数现算）
  PRISM[0].unlock = '集齐任意 3 个地区';
  PRISM[0].blurb = PRISM[0].unlock + '（' + activeRegions.length + ' 个里集齐 3 个）解锁。';
  PRISM[1].unlock = '集齐本季全部 ' + legendTotal + ' 张传说';
  PRISM[1].blurb = PRISM[1].unlock + '解锁。';
  PRISM[2].unlock = '图鉴 100%';
  PRISM[2].blurb = '集齐图鉴全部卡片解锁。';

  LC.AllRegions = REGIONS;      // 全部已写数据的地区（含待上线的）
  LC.Regions = activeRegions;   // 首版启用的地区
  LC.Cards = all;               // 可抽池（不含棱彩）
  LC.PrismCards = PRISM;        // 成就限定
  LC.AllCards = all.concat(PRISM);
  LC.REGION_TARGET = REGION_TARGET;  // 每地区满编 9 张
  LC.POOL_TARGET = POOL_TARGET;      // 上线分母（硬锁，config.POOL_SIZE）
  LC.TIER_TARGET = TIER_TARGET;      // 各档锁定分母：普通/稀有/传说
})(typeof window !== 'undefined' ? window : globalThis);
