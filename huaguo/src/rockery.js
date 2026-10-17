import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE, groundAt, SEA } from './data.js';
import { lit, mesh, box, quadGrid, blobGeometry, inscribed, rand, rr } from './kit.js';
import * as T from './textures.js';

/**
 * 西壁的一段：水帘洞的崖、人字形裂隙、崖刻群、娲遗石与一线天，加上海蚀的
 * 崖脚。水帘是一张可以从中间拉开的幕，拉开才看得见洞门与刻石。
 * 坡面往东是往上去的，所以洞腔朝 +X 走，帘挂在洞口以西、落进潭里。
 */

const FACE = lit('#8b9093', {
  map: T.rockFace({ meters: 16 }), rough: 0.95, side: THREE.DoubleSide,
  emissive: '#0c1218', ei: 0.3,
});
const BOULDER = lit('#94978f', {
  map: T.granite({ meters: 7 }), rough: 0.93, side: THREE.DoubleSide,
  emissive: '#0b1014', ei: 0.24,
});

const SPAN = 150;          // 这一段崖的横向宽度
const HIGH = 96;           // 崖顶在台地以上多高
const MOUTH_W = 7.2;       // 人字洞口的半宽
const MOUTH_H = 9.4;

export function buildHill(scene) {
  const grp = new THREE.Group();
  grp.name = 'cliff';
  const anchors = [];
  const carvings = [];

  const cave = SITE.cave;
  const mx = cave.x;                          // 洞口所在的面
  const floorY = groundAt(mx, cave.z) - 0.2;  // 洞槛
  const wallX = mx + 5;                       // 壁面在洞口再往东一点

  /* ------------------------------------------------------------ 崖壁 */
  const facePiece = (zFrom, zTo, yFn, nu = 26) => quadGrid((u, v) => {
    const z = zFrom + u * (zTo - zFrom);
    const y = yFn(u, v);
    const bulge = 9 * Math.sin(u * 5.1 + 0.6) + 4.2 * Math.sin(u * 12.3 - 1.1);
    return [wallX + bulge - 3.4 * v, y, z];
  }, nu, 20, { spanU: (zTo - zFrom) / 16, spanV: HIGH / 16 });

  const base = floorY - 18;
  const pieces = [
    facePiece(cave.z - SPAN / 2, cave.z - MOUTH_W, (u, v) => base + v * HIGH),
    facePiece(cave.z + MOUTH_W, cave.z + SPAN / 2, (u, v) => base + v * HIGH),
    // 门楣：下沿跟着人字走
    quadGrid((u, v) => {
      const t = u * 2 - 1;
      const z = cave.z + t * MOUTH_W;
      const notch = MOUTH_H * (1 - Math.abs(t));
      const y = floorY + notch + v * (HIGH - MOUTH_H - 10);
      return [wallX + 5 * Math.sin(u * 7.3) - 2.4 * (1 - v), y, z];
    }, 20, 16, { spanU: 1.2, spanV: 5 }),
    // 洞口两壁：从槛往内收，把人字的两条腿做实
    facePiece(cave.z - MOUTH_W - 1.2, cave.z - MOUTH_W + 0.4, (u, v) => floorY + v * (MOUTH_H * 0.5), 4),
    facePiece(cave.z + MOUTH_W - 0.4, cave.z + MOUTH_W + 1.2, (u, v) => floorY + v * (MOUTH_H * 0.5), 4),
  ];
  const face = mesh(pieces, FACE);
  face.name = 'cliff-face';
  grp.add(face);

  /* ------------------------------------------------------------ 洞腔 */
  const deep = 17, halfW = 5.2, ceil = 6.8;
  const back = mx + deep;
  const chamber = [
    quad([mx, floorY, cave.z - halfW], [mx, floorY, cave.z + halfW], [back, floorY, cave.z + halfW], [back, floorY, cave.z - halfW]),
    quad([mx, floorY + ceil, cave.z - halfW * 0.42], [mx, floorY + ceil, cave.z + halfW * 0.42],
      [back, floorY + ceil * 0.66, cave.z + halfW], [back, floorY + ceil * 0.66, cave.z - halfW]),
    quad([mx, floorY, cave.z - halfW], [mx, floorY + ceil, cave.z - halfW * 0.42],
      [back, floorY + ceil * 0.66, cave.z - halfW], [back, floorY, cave.z - halfW]),
    quad([mx, floorY, cave.z + halfW], [mx, floorY + ceil, cave.z + halfW * 0.42],
      [back, floorY + ceil * 0.66, cave.z + halfW], [back, floorY, cave.z + halfW]),
    quad([back, floorY, cave.z - halfW], [back, floorY, cave.z + halfW],
      [back, floorY + ceil * 0.66, cave.z + halfW], [back, floorY + ceil * 0.66, cave.z - halfW]),
  ];
  const inner = mesh(chamber, lit('#616663', {
    map: T.rockFace({ meters: 11 }), rough: 0.98, side: THREE.DoubleSide,
    emissive: '#080d11', ei: 0.46,
  }));
  inner.name = 'cave-chamber';
  grp.add(inner);
  anchors.push([mx + 5, floorY + 1.0, cave.z, 'caveLamp'], [mx + 11, floorY + 0.7, cave.z + 2.2, 'caveLamp']);

  /* ------------------------------------------------------------ 水帘 */
  const veil = buildVeil(grp, cave, floorY);

  /* ---------------------------------------------------------- 崖刻群 */
  const carves = [
    { text: '高山流水', w: 2.5, h: 9.4, y: floorY + 13, z: cave.z - 23, size: 0.9 },
    { text: '己酉年重阳日中泉子王同书', w: 0.9, h: 7.8, y: floorY + 13.4, z: cave.z - 32.5, size: 0.7, cols: 2 },
    { text: '灵泉', w: 1.7, h: 5.2, y: floorY + 10, z: cave.z + 21, size: 0.86 },
    { text: '神泉普润', w: 1.9, h: 7.4, y: floorY + 15, z: cave.z + 38, size: 0.82 },
    { text: '印心石屋', w: 1.9, h: 7.0, y: floorY + 9, z: cave.z - 45, size: 0.82 },
  ];
  for (const c of carves) {
    const sheet = inscribed(c.text, c.w, c.h, {
      vertical: true, cols: c.cols || 1, ink: '#dfe6e2', size: c.size, glow: '#93a6b2', ei: 0.4,
    });
    const px = wallX - 1.4;
    sheet.position.set(px, c.y + c.h / 2, c.z);
    sheet.rotation.y = -Math.PI / 2 + 0.12;
    sheet.name = 'carving';
    grp.add(sheet);
    carvings.push({ mesh: sheet, base: 0.42 });
    anchors.push([px - 2.4, c.y + c.h * 0.3, c.z + 1.4, 'carveLamp']);
  }

  /* ------------------------------------------------------ 娲遗石与一线天 */
  const bo = SITE.boulders;
  const parts = [];
  const big = [
    [0, 0, 13, 11, 9], [-9, 5, 10, 9, 8], [8, -7, 11, 10, 7.4], [2, 12, 8, 7, 6], [-4, -12, 9, 8, 7],
  ];
  big.forEach(([dx, dz, r, hh, w], i) => {
    const px = bo.x + dx, pz = bo.z + dz;
    const g = blobGeometry(r, { detail: 2, amp: 0.2, squash: hh / r, seed: i + 3 });
    g.scale(1, 1, w / r);
    g.translate(px, groundAt(px, pz) + hh * 0.4, pz);
    parts.push(g);
  });
  {
    const px = bo.x + 3.4, pz = bo.z + 1.6, py = groundAt(px, pz);
    const g = blobGeometry(6.2, { detail: 2, amp: 0.14, squash: 0.78, seed: 9 });
    g.translate(px, py + 5.4, pz);
    parts.push(g);
    const egg = blobGeometry(3.4, { detail: 2, amp: 0.1, squash: 0.62, seed: 14 });
    egg.scale(1.1, 0.72, 1);
    egg.translate(px - 0.5, py + 11.4, pz + 0.4);
    parts.push(egg);
    anchors.push([px - 6, py + 1.1, pz - 3.2, 'stoneLamp']);
  }
  const boulders = mesh(parts, BOULDER);
  boulders.name = 'boulders';
  grp.add(boulders);
  {
    const fx = bo.x - 3.8, fz = bo.z - 1.4, fy = groundAt(fx, fz);
    anchors.push([fx, fy + 0.7, fz, 'crack']);
    grp.add(mesh([
      box(1.7, 0.5, 9.4, fx - 2.7, fy + 7.2, fz),
      box(1.7, 0.5, 9.4, fx + 2.7, fy + 7.2, fz),
    ], BOULDER));
  }

  /* ------------------------------------------------ 海蚀崖脚与坡上乱石 */
  const foot = [], footBlobs = [];
  for (let z = -1160; z <= 1160; z += 26) {
    const x = SEA.oldShore(z) + rr(-4, 8);
    const y = groundAt(x, z);
    if (y > 22 || y < 1) continue;
    foot.push(box(rr(3.4, 9), rr(0.5, 1.7), rr(1.2, 3.2), x, y - 0.2, z).rotateY(rr(-0.3, 0.3)));
    footBlobs.push(blobGeometry(rr(1.2, 2.6), { detail: 1, amp: 0.3, squash: 0.6, seed: rand() * 40 })
      .translate(x + rr(-6, 6), y + 0.2, z + rr(-8, 8)));
  }
  const benchMat = lit('#70746f', {
    map: T.rockFace({ meters: 9 }), rough: 0.97, side: THREE.DoubleSide,
    emissive: '#0a1015', ei: 0.32,
  });
  for (const g of [mergeGeometries(foot), mergeGeometries(footBlobs)]) {
    const m = new THREE.Mesh(g, benchMat);
    m.name = 'wave-bench';
    grp.add(m);
  }

  const scatter = [];
  for (let i = 0; i < 180; i++) {
    const x = rr(-660, 320), z = rr(-900, 900);
    const y = groundAt(x, z);
    if (y < 14) continue;
    const r = rr(1.4, 5.2) * (0.6 + Math.min(1.6, y / 420));
    const g = blobGeometry(r, { detail: 1, amp: 0.32, squash: rr(0.5, 0.85), seed: i });
    g.translate(x, y + r * 0.18, z);
    scatter.push(g);
  }
  const talus = mesh(scatter, BOULDER);
  talus.name = 'talus';
  grp.add(talus);

  scene.add(grp);
  return {
    group: grp, anchors, carvings, veil,
    mouth: { x: mx, z: cave.z, y: floorY, w: MOUTH_W, h: MOUTH_H },
    cliffTop: base + HIGH,
    poolY: groundAt(SITE.cave.x - 32, 164),
  };
}

/** 四边形（四个角点，逆时针） */
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]], 3));
  const uv = [];
  for (let i = 0; i < 4; i++) uv.push(i % 2, i > 1 ? 1 : 0);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/**
 * 水帘：挂在洞门以西的一张幕，从中间拉开；后面还有两段更高的跌水，
 * 三层叠起来才是"半壁飞泉"。
 */
function buildVeil(grp, cave, floorY) {
  const uni = { uTime: { value: 0 }, uOpen: { value: 0 }, uFlow: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: uni,
    vertexShader: `
      uniform float uTime; uniform float uOpen;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.x *= 1.0 - uOpen * 0.58;
        p.z += sin(p.y * 0.5 + uTime * 3.1) * 0.5 + sin(uTime * 1.7) * 0.2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uOpen; uniform float uFlow;
      varying vec2 vUv;
      void main(){
        float u = vUv.x, v = vUv.y;
        float gap = uOpen * 0.46;
        float parted = smoothstep(0.5 - gap - 0.08, 0.5 - gap, u)
                     * (1.0 - smoothstep(0.5 + gap, 0.5 + gap + 0.08, u));
        float curtain = 1.0 - parted;
        float strands = 0.0;
        for (int i = 0; i < 3; i++) {
          float f = float(i);
          strands += pow(abs(sin((u * (24.0 + f * 12.0) + v * 2.2 - uTime * (5.4 + f * 1.3)) * 3.1416)), 6.0) / (1.0 + f);
        }
        float streak = clamp(strands * 0.62, 0.0, 1.0);
        float fall = pow(1.0 - v, 0.30);
        float a = curtain * uFlow * (0.14 + 0.62 * streak) * (0.42 + 0.58 * fall);
        if (a < 0.012) discard;
        vec3 col = mix(vec3(0.20,0.28,0.36), vec3(0.90,0.94,1.0), streak * 0.7 + 0.12);
        col += vec3(0.34,0.40,0.50) * pow(streak, 3.0) * 0.9;
        gl_FragColor = vec4(col, a * 0.92);
      }`,
  });

  const sheet = (zFrom, zTo, yBottom, yTop, xTop, xBottom, nu = 34, nv = 20) =>
    quadGrid((u, v) => {
      const z = zFrom + u * (zTo - zFrom);
      const y = yBottom + v * (yTop - yBottom);
      const x = lerpN(xBottom, xTop, v) + 2.4 * Math.sin(u * Math.PI);
      return [x, y, z];
    }, nu, nv, { spanU: (zTo - zFrom) / 8, spanV: (yTop - yBottom) / 8 });

  const mouthZ = cave.z;
  const pieces = [
    // 洞门前这一挂：上沿在楣外，下扎进潭里
    sheet(mouthZ - 17, mouthZ + 17, floorY - 8, floorY + MOUTH_H + 3.6, cave.x - 3.4, cave.x - 15.5),
    // 两段跌水：贴着壁面往上
    sheet(mouthZ - 26, mouthZ - 9, floorY + MOUTH_H + 3, floorY + 44, cave.x + 2, cave.x - 5.5, 18, 14),
    sheet(mouthZ + 9, mouthZ + 26, floorY + MOUTH_H + 3, floorY + 38, cave.x + 2, cave.x - 5.5, 18, 14),
  ];
  const m = new THREE.Mesh(mergeGeometries(pieces), mat);
  m.name = 'water-veil';
  m.renderOrder = 7;
  grp.add(m);

  const N = 240, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos.set([cave.x - rr(6, 20), floorY - rr(0, 7), mouthZ + rr(-19, 19)], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sm = new THREE.Points(pg, new THREE.PointsMaterial({
    size: 2.6, map: T.softGlow('236,246,255', 0.02), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.46, fog: false,
  }));
  sm.name = 'spray';
  sm.frustumCulled = false;
  grp.add(sm);

  return {
    mesh: m, points: sm, uni,
    setOpen(v) { uni.uOpen.value = Math.max(0, Math.min(1, v)); },
    setFlow(v) { uni.uFlow.value = Math.max(0, v); m.visible = v > 0.02; sm.visible = v > 0.06; },
    update(t, flow) {
      uni.uTime.value = t;
      uni.uFlow.value = flow;
      m.visible = flow > 0.02;
      sm.visible = flow > 0.06;
    },
  };
}

const lerpN = (a, b, t) => a + (b - a) * t;
