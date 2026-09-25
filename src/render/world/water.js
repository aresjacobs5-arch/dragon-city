import * as THREE from 'three';
import { globalUniforms } from '../materials.js';
import { getNoiseTexture, getFoamTexture } from '../textures.js';
import { RNG } from '../../core/rng.js';
import * as G from '../geom.js';

// Stylized water: bright body, soft fresnel, foam rim and sparkles.
export function waterMaterial({ deep = '#2aa7dd', shallow = '#7fe0f7', foam = '#ffffff', flow = new THREE.Vector2(0, 0), lava = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: globalUniforms.uTime,
      uTex: { value: getNoiseTexture() },
      uDeep: { value: new THREE.Color(deep) },
      uShallow: { value: new THREE.Color(shallow) },
      uFoam: { value: new THREE.Color(foam) },
      uFlow: { value: flow },
      uLava: { value: lava ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float edge;
      varying float vEdge;
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vEdge = edge;
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLava;
      uniform sampler2D uTex;
      uniform vec3 uDeep, uShallow, uFoam;
      uniform vec2 uFlow;
      varying float vEdge;
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vec2 p = vW.xz * 0.18 + uFlow * uTime;
        float n1 = texture2D(uTex, p + vec2(uTime * 0.02, uTime * 0.013)).r;
        float n2 = texture2D(uTex, p * 1.7 - vec2(uTime * 0.017, -uTime * 0.021)).g;
        float n = n1 * 0.5 + n2 * 0.5;
        vec3 col = mix(uDeep, uShallow, smoothstep(0.2, 0.95, vEdge) * 0.8 + n * 0.25);
        float foam = smoothstep(0.78, 0.98, vEdge + (n - 0.5) * 0.25);
        col = mix(col, uFoam, foam * 0.85);
        float sp = smoothstep(0.72, 0.8, n1 * n2 * 1.9);
        col += sp * 0.45;
        if (uLava > 0.5) {
          float glow = smoothstep(0.45, 0.8, n);
          col = mix(uDeep, uShallow, glow);
          col += vec3(1.0, 0.8, 0.3) * smoothstep(0.75, 0.9, n) * 0.6;
        }
        gl_FragColor = vec4(col, mix(0.9, 1.0, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Irregular pond shape with an "edge" attribute (0 center -> 1 shore).
export function pondGeometry(radius = 2.2, seed = 3, segs = 40) {
  const rng = new RNG(seed);
  const harm = [2, 3, 5].map((k) => ({ k, a: rng.range(0.04, 0.12), p: rng.range(0, 6.28) }));
  const rf = (th) => radius * (1 + harm.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.p), 0));
  const pos = [0, 0, 0];
  const edge = [0];
  const uv = [0.5, 0.5];
  const idx = [];
  const rings = 4;
  for (let r = 1; r <= rings; r++) {
    const f = r / rings;
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const rr = rf(th) * f;
      pos.push(Math.cos(th) * rr, 0, Math.sin(th) * rr);
      edge.push(f);
      uv.push(0.5 + Math.cos(th) * f * 0.5, 0.5 + Math.sin(th) * f * 0.5);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let r = 0; r < rings - 1; r++) {
    const s0 = 1 + r * segs, s1 = 1 + (r + 1) * segs;
    for (let j = 0; j < segs; j++) {
      const a = s0 + j, b = s0 + ((j + 1) % segs), c = s1 + j, d = s1 + ((j + 1) % segs);
      idx.push(a, d, c, a, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.rf = rf;
  return g;
}

// Ribbon along ground points; edge attribute = distance from center line.
export function ribbonGeometry(points, width = 0.8) {
  const pos = [], edge = [], uv = [], idx = [];
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1] || 0, p[2] !== undefined ? p[2] : p[1])));
  const n = Math.max(8, points.length * 8);
  const P = new THREE.Vector3(), Tn = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, Tn);
    S.set(-Tn.z, 0, Tn.x).normalize();
    for (let k = 0; k < 3; k++) {
      const o = (k - 1) * width * 0.5;
      pos.push(P.x + S.x * o, P.y, P.z + S.z * o);
      edge.push(k === 1 ? 0.45 : 1);
      uv.push(k / 2, t);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 1, c = a + 3, d = a + 4;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Waterfall: a curved sheet pouring off the island lip, fading into mist.
export function createWaterfall({ x, z, angle, width = 1.0, drop = 16, color = '#5fd0f5', lava = false }) {
  const segs = 24;
  const cols = 4;
  const pos = [], uv = [], idx = [];
  const dirX = Math.cos(angle), dirZ = Math.sin(angle);
  const sideX = -dirZ, sideZ = dirX;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -t * drop;
    const out = 0.35 + Math.sqrt(t) * 1.2 + t * 0.6;
    for (let k = 0; k <= cols; k++) {
      const s = (k / cols - 0.5) * width * (1 + t * 0.9);
      pos.push(x + dirX * out + sideX * s, y + 0.02, z + dirZ * out + sideZ * s);
      uv.push(k / cols, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < cols; k++) {
      const a = i * (cols + 1) + k, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: globalUniforms.uTime,
      uTex: { value: getFoamTexture() },
      uColor: { value: new THREE.Color(color) },
      uLava: { value: lava ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLava;
      uniform sampler2D uTex;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float s = texture2D(uTex, vec2(vUv.x * 0.8, vUv.y * 1.2 - uTime * 0.9)).r;
        float s2 = texture2D(uTex, vec2(vUv.x * 1.3 + 0.3, vUv.y * 2.0 - uTime * 1.4)).r;
        float foam = smoothstep(0.45, 0.85, s * 0.6 + s2 * 0.5);
        vec3 col = mix(uColor, vec3(1.0), foam * 0.8 + 0.1);
        if (uLava > 0.5) col = mix(uColor, vec3(1.0, 0.85, 0.35), foam);
        float side = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float fade = 1.0 - smoothstep(0.45, 1.0, vUv.y);
        float a = side * fade * (0.75 + foam * 0.25);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

// Pond with stone rim and lily pads.
export function createPond({ x, z, radius = 2.2, seed = 3, theme }) {
  const group = new THREE.Group();
  const geo = pondGeometry(radius, seed);
  const lava = !!theme.lava;
  const waterC = new THREE.Color(theme.water);
  const mat = waterMaterial({
    deep: lava ? '#d8431a' : waterC.clone().offsetHSL(0, 0.05, -0.08).getStyle(),
    shallow: lava ? '#ffb13a' : waterC.clone().offsetHSL(0, 0, 0.18).getStyle(),
    lava,
  });
  const water = new THREE.Mesh(geo, mat);
  water.position.set(x, 0.05, z);
  water.renderOrder = 1;
  group.add(water);
  // stones
  const rng = new RNG(seed + 10);
  const stones = [];
  const rockC = new THREE.Color(theme.rock);
  const rf = geo.userData.rf;
  const n = Math.round(radius * 9);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const rr = rf(th) + rng.range(-0.05, 0.12);
    const s = rng.range(0.16, 0.34);
    const g = G.flat(G.jitter(G.ico(1, 0), 0.2, i + seed));
    G.xf(g, { p: [x + Math.cos(th) * rr, 0.04, z + Math.sin(th) * rr], r: [rng.range(0, 3), rng.range(0, 3), 0], s: [s * 1.3, s * 0.7, s] });
    const c = rockC.clone().multiplyScalar(rng.range(0.85, 1.08));
    G.paint(g, (px, py, pz, nx, ny) => (ny > 0.55 && !lava ? new THREE.Color(theme.moss).lerp(c, 0.4) : c));
    stones.push(g);
  }
  if (!lava && !theme.ice) {
    for (let i = 0; i < 4; i++) {
      const th = rng.range(0, 6.28);
      const rr = rng.range(0.2, 0.65) * radius;
      const pad = G.cylinder(0.32, 0.32, 0.03, 12);
      G.xf(pad, { p: [x + Math.cos(th) * rr, 0.08, z + Math.sin(th) * rr] });
      G.paint(pad, '#58b847');
      stones.push(pad);
      if (i % 2 === 0) {
        const fl = G.cone(0.1, 0.12, 6);
        G.xf(fl, { p: [x + Math.cos(th) * rr + 0.08, 0.15, z + Math.sin(th) * rr] });
        G.paint(fl, '#ff9cc4');
        stones.push(fl);
      }
    }
  }
  const sm = new THREE.Mesh(G.merge(stones), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  sm.castShadow = true;
  sm.receiveShadow = true;
  group.add(sm);
  group.userData.rf = (th) => rf(th);
  return group;
}
