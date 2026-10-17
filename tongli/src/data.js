/**
 * 同里古镇 · 川字河灯 —— 全景尺寸与底图。
 * 坐标单位为米：-Z 为北，+X 为东，y=0 是镇河与湖的水面。
 *
 * 这一景的底图是"水在中间、地在缝外"的：镇内十几条河把陆地切成七块，
 * 块与块之间靠桥连，镇子外面又是一圈湖。所以这里不画"一块地上挖几条沟"，
 * 而是反过来——先给河的中心线与宽度，再由它们之间的余量长出地块（blockPoly）。
 * 于是河道天然贯通、地块天然不重叠，桥位只要指着某条河就能落。
 *
 * 考据口径：镇"为川字河所分、成七块"这类说法进解说时要按核查结果写；
 * 这里的平面布局是按水乡通例摆的写意底图，不是测绘的镇地图。
 */

import { rand } from './kit.js';

/* ------------------------------------------------------------------ 基准高度 */

/** 岸顶（居民路面）：河面之上 2.2 米，贴水一级台阶就能到船 */
export const BANK = 2.2;
/** 驳岸压在水下的深度 */
export const QUAY_DRAFT = 2.6;
/** 圩岸/堤顶：湖边只比水面高一点，退潮的样子 */
export const DEP = 1.15;
/** 镇外地坪（田与市外的地） */
export const PLAIN_Y = 1.0;

/* ------------------------------------------------------------------ 河道 */

/** 东西向三河 = "川"字的三横 */
const RIVERS_EW = [
  { id: 'north', zh: '北河', z: -250, x0: -560, x1: 560, width: 24 },
  { id: 'mid', zh: '市河', z: 20, x0: -580, x1: 580, width: 28 },
  { id: 'south', zh: '南河', z: 275, x0: -540, x1: 540, width: 20 },
];
/** 南北向 = 穿过三横的那一竖 */
const RIVERS_NS = [
  { id: 'west', zh: '西界河', x: -450, z0: -330, z1: 355, width: 22 },
  { id: 'east', zh: '东长港', x: 470, z0: -355, z1: 350, width: 26 },
];
/** 弄河：窄的那几条只通小船，上面盖的是梁桥 */
const Lanes = [
  { id: 'lane1', x: 60, z0: -330, z1: 20, width: 11 },
  { id: 'lane2', x: 200, z0: 20, z1: 350, width: 10 },
  { id: 'lane3', x: -450, z: -70, x0: -450, x1: -180, width: 9, ew: true },
  { id: 'lane4', x: 300, z: 150, x0: 120, x1: 470, width: 9, ew: true },
  { id: 'lane5', z: -150, x0: -437, x1: 52, width: 10, ew: true },
];

/** 统一成 { id, zh, path, width } —— 水面、桥、沿街建筑都从这里取 */
export const CANALS = [];
for (const r of RIVERS_EW) {
  CANALS.push({ id: r.id, zh: r.zh, main: true, width: r.width, path: [[r.x0, r.z], [r.x1, r.z]] });
}
for (const r of RIVERS_NS) {
  CANALS.push({ id: r.id, zh: r.zh, main: true, width: r.width, path: [[r.x, r.z0], [r.x, r.z1]] });
}
for (const l of Lanes) {
  const path = l.ew
    ? [[l.x0, l.z], [l.x1, l.z]]
    : [[l.x, l.z0], [l.x, l.z1]];
  CANALS.push({ id: l.id, zh: l.zh || `${l.id}巷弄河`, width: l.width, path, lane: true });
}

export const CANAL = {};
for (const c of CANALS) CANAL[c.id] = c;

/** 镇心与镇河总表：水面 shader 的暖光方向、船队与灯都从这里取 */
export const TOWN = { center: { x: 10, z: 20 }, bankY: BANK, canals: CANALS };

/** 某条河在 x（或 z）方向上的两岸内缘 */
export function canalEdges(c) {
  const h = c.width / 2 + 2.0;            // 2.0 = 驳岸 + 沿河街的最小退让
  if (c.path[0][1] === c.path[1][1]) return { axis: 'ew', z0: c.path[0][1] - h, z1: c.path[0][1] + h };
  return { axis: 'ns', x0: c.path[0][0] - h, x1: c.path[0][0] + h };
}

/* ------------------------------------------------------------------ 地块 */

/** 北界/南界/西界/东界的陆地外缘（河从这里入湖） */
const LAND = { x0: -437, x1: 455, z0: -352, z1: 372 };

/**
 * 一块地：四个界桩之间的多边形。角上收圆、边上按确定性随机抖一点，
 * 于是镇子不是棋盘，但每一轮刷新都是同一个镇子。
 */
function blockPoly(x0, x1, z0, z1, { corner = 14, jitter = 2.2, seg = 3 } = {}) {
  const pts = [];
  const edge = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L;
    for (let i = 1; i <= seg; i++) {
      const t = i / (seg + 1);
      const o = (rand() - 0.5) * 2 * jitter;
      pts.push([ax + dx * t + nx * o, az + dz * t + nz * o]);
    }
  };
  const r = Math.min(corner, (x1 - x0) / 2, (z1 - z0) / 2);
  const cs = [[x0 + r, z0 + r, -Math.PI, -Math.PI / 2], [x1 - r, z0 + r, -Math.PI / 2, 0],
    [x1 - r, z1 - r, 0, Math.PI / 2], [x0 + r, z1 - r, Math.PI / 2, Math.PI]];
  for (let k = 0; k < 4; k++) {
    const [cx, cz, a0, a1] = cs[k];
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (a1 - a0) * (i / 4);
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
    const [nx0, nz0, nx1, nz1] = [
      [[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]],
    ][k];
    edge(nx0[0], nx0[1], nx1[0], nx1[1]);
  }
  // 去掉相邻重复点，不然 Shape 会打出退化三角形
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < 0.05 && Math.abs(q[1] - p[1]) < 0.05) continue;
    out.push(p);
  }
  return out;
}

/**
 * 七块地：由河的中心线撑出来。
 * 名字用编号，解说里怎么写以核查结果为准（见 STATIONS）。
 */
export const ISLANDS = [
  // 镇北两条：被 lane5（东西弄河）切开
  { id: 'n1', name: '镇北 · 西', poly: blockPoly(LAND.x0, 52, LAND.z0, -160, { corner: 16 }) },
  { id: 'n2', name: '镇北 · 东', poly: blockPoly(68, LAND.x1, LAND.z0, -160, { corner: 16 }) },
  // 北河与市河之间：被 lane1（南北弄河）切开，是全镇最热闹的两块
  { id: 'm1', name: '镇中 · 西', poly: blockPoly(LAND.x0 - 8, 48, -140, -2, { corner: 18 }) },
  { id: 'm2', name: '镇中 · 东', poly: blockPoly(72, LAND.x1 + 8, -236, -2, { corner: 18 }) },
  // 市河以南
  { id: 's1', name: '镇南 · 西', poly: blockPoly(LAND.x0, 191, 34, LAND.z1, { corner: 18 }) },
  { id: 's2', name: '镇南 · 中', poly: blockPoly(211, LAND.x1, 34, 138, { corner: 18 }) },
  { id: 's3', name: '镇南 · 东', poly: blockPoly(211, LAND.x1, 162, LAND.z1, { corner: 18 }) },
];

/** 地块包围盒，供落位与机位粗筛 */
export const ISLAND_BOX = {};
for (const isl of ISLANDS) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of isl.poly) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  ISLAND_BOX[isl.id] = { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export const ISLAND = {};
for (const isl of ISLANDS) ISLAND[isl.id] = isl;

/** 点落在哪块地上（-1 表示在水里） */
export function islandAt(x, z) {
  for (const isl of ISLANDS) {
    const b = ISLAND_BOX[isl.id];
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (pointIn(isl.poly, x, z)) return isl.id;
  }
  return null;
}

export function pointIn(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 多边形在 (x,z) 处朝外的法向与到边界的距离：沿河街与民宅要贴着边摆 */
export function edgeNear(poly, x, z, reach = 26) {
  let best = null;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    if (L2 < 1e-6) continue;
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) best = { d, px, pz, tx: dx / L, tz: dz / L, i };
  }
  if (!best || best.d > reach) return null;
  // 外法向：切向 (tx,tz) 顺时针 90° 得 (tz,-tx)；用"点在多边形外"校验方向
  let nx = best.tz, nz = -best.tx;
  if (pointIn(poly, best.px + nx, best.pz + nz)) { nx = -nx; nz = -nz; }
  return { ...best, nx, nz };
}

/* ------------------------------------------------------------------ 湖与圩 */

/**
 * 一片连起来的水：外圈是湖界，镇子泡在它中间，块与块的缝自然就是河。
 * 五湖的名字与方位写进 sectors，轮廓本身是写意的。
 */
export const LAKES = {
  /** 水面外界（顺时针一圈，含镇子） */
  extent: [
    [-1180, -1420], [-620, -1520], [120, -1470], [720, -1330], [1180, -980],
    [1340, -430], [1290, 220], [1040, 820], [520, 1180], [-160, 1280],
    [-820, 1160], [-1240, 760], [-1420, 200], [-1380, -560],
  ],
  /** 水底 */
  bed: { x: 0, z: -60, w: 3400, d: 3300 },
  /** 湖的分片：名字与方位见考证，只用来落洲、堤与对岸的灯 */
  sectors: {
    outer: { x: -420, z: -1020, r: 520 },
    e: { x: 980, z: -240, r: 460 },
    se: { x: 640, z: 760, r: 420 },
    s: { x: -260, z: 860, r: 400 },
    w: { x: -1060, z: 120, r: 420 },
  },
};

/** 环湖的圩岸与长堤：把一大片水切成几片，也给出"湖在镇外"的那条岸线 */
export const BANKS = [
  { id: 'bankN', path: [[-820, -560], [-360, -610], [60, -586], [480, -622], [860, -560]], width: 26, y: DEP, name: '北圩' },
  { id: 'bankS', path: [[-760, 620], [-300, 660], [180, 626], [620, 662], [900, 600]], width: 24, y: DEP, name: '南圩' },
  { id: 'bankW', path: [[-860, -420], [-906, 20], [-856, 420]], width: 20, y: DEP, name: '西圩' },
  { id: 'bankE', path: [[880, -360], [920, 40], [860, 400]], width: 20, y: DEP, name: '东圩' },
];

/* ------------------------------------------------------------------ 桥 */

/**
 * 桥位表。`over` 指它跨的是哪条河，`at` 是桥中心，`dir` 是桥的走向（弧度，
 * 0 = 桥顺着 +X）。三桥的名字与形制按核查结果填，其余是无名或通例桥。
 * 类型：arch = 单孔石拱（净空够摇橹船过），beam = 石梁平桥（窄弄河上）。
 */
export const BRIDGES = [
  // 三桥：镇中最热闹的一处，两跨一拐
  { id: 'taiping', name: '太平桥', over: 'north', at: [104, -250], dir: 0, type: 'arch', span: 17, width: 4.4, rise: 3.0 },
  { id: 'jili', name: '吉利桥', over: 'lane1', at: [60, -186], dir: Math.PI / 2, type: 'arch', span: 12, width: 3.6, rise: 2.1 },
  { id: 'changqing', name: '长庆桥', over: 'mid', at: [-58, 20], dir: 0, type: 'arch', span: 19, width: 4.6, rise: 3.1 },
  // 其余：东西南北各几座，跨主河的都是拱桥，弄河上是梁桥
  { id: 'b1', over: 'mid', at: [250, 20], dir: 0, type: 'arch', span: 20, width: 4.2, rise: 2.8 },
  { id: 'b2', over: 'mid', at: [470, 20], dir: Math.PI / 2, type: 'arch', span: 18, width: 4.0, rise: 2.6 },
  { id: 'b3', over: 'mid', at: [-330, 20], dir: 0, type: 'arch', span: 20, width: 4.2, rise: 2.8 },
  { id: 'b4', over: 'north', at: [-250, -250], dir: 0, type: 'arch', span: 17, width: 4.0, rise: 2.6 },
  { id: 'b5', over: 'north', at: [330, -250], dir: 0, type: 'beam', span: 15, width: 3.4, rise: 1.1 },
  { id: 'b6', over: 'south', at: [-120, 275], dir: 0, type: 'arch', span: 15, width: 3.6, rise: 2.2 },
  { id: 'b7', over: 'south', at: [300, 275], dir: 0, type: 'arch', span: 15, width: 3.4, rise: 2.1 },
  { id: 'b8', over: 'west', at: [-450, -120], dir: Math.PI / 2, type: 'beam', span: 14, width: 3.2, rise: 1.0 },
  { id: 'b9', over: 'west', at: [-450, 160], dir: Math.PI / 2, type: 'arch', span: 14, width: 3.2, rise: 2.0 },
  { id: 'b10', over: 'east', at: [470, -140], dir: Math.PI / 2, type: 'arch', span: 16, width: 3.6, rise: 2.3 },
  { id: 'b11', over: 'east', at: [470, 200], dir: Math.PI / 2, type: 'beam', span: 16, width: 3.4, rise: 1.0 },
  { id: 'b12', over: 'lane2', at: [200, 150], dir: Math.PI / 2, type: 'beam', span: 11, width: 2.8, rise: 0.9 },
  { id: 'b13', over: 'lane3', at: [-300, -70], dir: 0, type: 'beam', span: 10, width: 2.6, rise: 0.8 },
  { id: 'b14', over: 'lane4', at: [280, 150], dir: 0, type: 'beam', span: 10, width: 2.6, rise: 0.8 },
  { id: 'b15', over: 'lane5', at: [-200, -150], dir: 0, type: 'beam', span: 10, width: 2.6, rise: 0.8 },
  // 圩岸上的桥：镇门通往湖边的路从这里出
  { id: 'g1', over: 'bankN', at: [-360, -610], dir: Math.PI / 2, type: 'arch', span: 13, width: 3.4, rise: 1.9 },
  { id: 'g2', over: 'bankS', at: [180, 626], dir: Math.PI / 2, type: 'arch', span: 13, width: 3.4, rise: 1.9 },
];

/* ------------------------------------------------------------------ 园林与洲 */

/**
 * 退思园的园址：镇北一块的东段，园墙围出来的一方。
 * 形制与建筑名录以核查为准，这里先给边界（东西 x、南北 z）。
 */
export const GARDEN = {
  island: 'n2',
  x0: 150, x1: 300, z0: -330, z1: -182,
  wallH: 4.2,
};

/** 罗星洲：在一片湖心里，洲上塔与阁的名目见考证 */
export const ISLET = {
  x: 700, z: -560, r: 78, y: 1.5,
  name: '罗星洲',
};

/** 镇外的田与村：只给地坪与几点灯火 */
export const OUTER = {
  groundY: PLAIN_Y,
  fields: [
    { x0: -1180, x1: -620, z0: -1080, z1: -640 },
    { x0: 560, x1: 1180, z0: -1160, z1: -700 },
    { x0: -1180, x1: -560, z0: 640, z1: 1060 },
    { x0: 300, x1: 980, z0: 700, z1: 1080 },
  ],
};

/* ------------------------------------------------------------------ 招牌动作 */

/** 灯船巡河的航线：从下游入镇，过三桥，绕市河一圈，再出湖 */
export const VOYAGE = {
  boats: 3,
  speed: 9.5,
  /** 过一座桥亮一座桥，次第就是这三桥 */
  chain: ['taiping', 'jili', 'changqing'],
  route: [
    [-40, 820], [-30, 560], [-6, 300], [30, 120], [58, 20], [70, -110], [88, -200],
    [104, -250], [160, -262], [280, -256], [400, -244], [470, -200],
    [470, -60], [470, 90], [430, 200], [300, 240], [160, 268], [0, 276],
    [-160, 268], [-300, 240], [-420, 160], [-450, 40], [-452, -120],
    [-430, -260], [-360, -330], [-200, -420], [-40, -520], [140, -620],
    [380, -700], [560, -780], [700, -560],
  ],
};

/** 河灯：沿镇河放的一圈，走三桥习俗里的"放"在这一景里是次要动作 */
export const FLOATS = { count: 46, radius: 3.0 };

/* ------------------------------------------------------------------ 参数默认 */

export const DEFAULTS = {
  lantern: 100,
  window: 70,
  float: 40,
  ripple: 100,
  bloom: 30,
  voyage: false,
  reflect: true,
  labels: true,
  tour: false,
  autoQuality: true,
};
