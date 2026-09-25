import * as THREE from 'three';
import { getCloudShadowTexture } from './textures.js';

// Shared uniforms: soft cloud shadows drifting across every island surface.
export const globalUniforms = {
  uTime: { value: 0 },
  uCloudTex: { value: null },
  uCloudOffset: { value: new THREE.Vector2(0, 0) },
  uCloudScale: { value: 1 / 26 },
  uCloudStrength: { value: 0.28 },
};

export function updateGlobalUniforms(dt) {
  globalUniforms.uTime.value += dt;
  globalUniforms.uCloudOffset.value.x += dt * 0.012;
  globalUniforms.uCloudOffset.value.y += dt * 0.006;
}

function injectCloudShadows(shader) {
  if (!globalUniforms.uCloudTex.value) globalUniforms.uCloudTex.value = getCloudShadowTexture();
  shader.uniforms.uCloudTex = globalUniforms.uCloudTex;
  shader.uniforms.uCloudOffset = globalUniforms.uCloudOffset;
  shader.uniforms.uCloudScale = globalUniforms.uCloudScale;
  shader.uniforms.uCloudStrength = globalUniforms.uCloudStrength;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vCloudXZ;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 cwp = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        cwp = instanceMatrix * cwp;
      #endif
      cwp = modelMatrix * cwp;
      vCloudXZ = cwp.xz;`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec2 vCloudXZ;
      uniform sampler2D uCloudTex;
      uniform vec2 uCloudOffset;
      uniform float uCloudScale;
      uniform float uCloudStrength;`
    )
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      float cloudS = texture2D( uCloudTex, vCloudXZ * uCloudScale + uCloudOffset ).r;
      reflectedLight.directDiffuse *= mix( 1.0 - uCloudStrength, 1.0, cloudS );`
    );
}

// Environment material: lambert + vertex colors + drifting cloud shadows.
export function envMaterial(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  m.onBeforeCompile = injectCloudShadows;
  m.customProgramCacheKey = () => 'env-cloud' + (opts.flatShading ? '-flat' : '');
  return m;
}

let _envSmooth = null, _envFlat = null;
export function sharedEnvMaterial(flat = false) {
  if (flat) {
    if (!_envFlat) _envFlat = envMaterial({ flatShading: true });
    return _envFlat;
  }
  if (!_envSmooth) _envSmooth = envMaterial();
  return _envSmooth;
}

// Monster material: soft vinyl-toy look with rim light for readable silhouettes.
export function creatureMaterial({ rim = 0.55, rimColor = 0xfff4e0, emissive = 0x000000, roughness = 0.55, cloud = true } = {}) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0.0,
    emissive,
  });
  const rimU = { value: rim };
  const rimC = { value: new THREE.Color(rimColor) };
  const flash = { value: 0 };
  const flashColor = { value: new THREE.Color(0xffffff) };
  m.userData.rim = rimU;
  m.userData.flash = flash;
  m.userData.flashColor = flashColor;
  const silhouette = { value: 0 };
  const silColor = { value: new THREE.Color('#1c1430') };
  m.userData.silhouette = silhouette;
  // Per-pixel skin pattern: 0 none, 1 cracks (glowing), 2 spots, 3 plates, 4 stripes, 5 runes (glowing), 6 scales
  const pat = {
    uPatType: { value: 0 },
    uPatScale: { value: 7 },
    uPatWidth: { value: 0.06 },
    uPatColor: { value: new THREE.Color('#ff8a2a') },
    uPatSeed: { value: 0 },
    uPatAmount: { value: 0.5 },
  };
  m.userData.pattern = pat;
  m.onBeforeCompile = (shader) => {
    if (cloud) injectCloudShadows(shader);
    shader.uniforms.uRim = rimU;
    shader.uniforms.uRimColor = rimC;
    shader.uniforms.uFlash = flash;
    shader.uniforms.uFlashColor = flashColor;
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.uniforms.uSil = silhouette;
    shader.uniforms.uSilColor = silColor;
    Object.assign(shader.uniforms, pat);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nattribute float pat;\nvarying float vGlow;\nvarying float vPat;\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;\nvPat = pat;\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRim;
        uniform vec3 uRimColor;
        uniform float uFlash;
        uniform vec3 uFlashColor;
        uniform float uTime;
        uniform float uSil;
        uniform vec3 uSilColor;
        uniform float uPatType, uPatScale, uPatWidth, uPatSeed, uPatAmount;
        uniform vec3 uPatColor;
        varying float vGlow;
        varying float vPat;
        varying vec3 vRest;
        vec3 patHash(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973) + uPatSeed * 0.137);
          p += dot(p, p.yxz + 33.33);
          return fract((p.xxy + p.yxx) * p.zyx);
        }
        // returns F1, F2, cell id
        vec3 patWorley(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          float f1 = 8.0, f2 = 8.0, id = 0.0;
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
            vec3 g = vec3(float(x), float(y), float(z));
            vec3 o = patHash(i + g);
            vec3 r = g + o - f;
            float d = dot(r, r);
            if (d < f1) { f2 = f1; f1 = d; id = o.x; } else if (d < f2) { f2 = d; }
          }
          return vec3(sqrt(f1), sqrt(f2), id);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float patGlow = 0.0;
        if (vPat > 0.5 && uPatType > 0.5) {
          vec3 pp = vRest * uPatScale;
          if (uPatType < 1.5 || (uPatType > 4.5 && uPatType < 5.5)) {
            vec3 w = patWorley(pp);
            float e = w.y - w.x;
            float aa = fwidth(e) * 1.2;
            float c = 1.0 - smoothstep(uPatWidth - aa, uPatWidth + aa, e);
            if (uPatType > 4.5) c *= step(0.45, w.z);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, c);
            patGlow = c;
          } else if (uPatType < 2.5) {
            vec3 w = patWorley(pp);
            float r = 0.18 + (w.z - 0.5) * 0.25;
            float aa = fwidth(w.x) * 1.2;
            float c = (1.0 - smoothstep(r - aa, r + aa, w.x)) * step(uPatAmount, w.z + 0.2);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, c);
          } else if (uPatType < 3.5 || uPatType > 5.5) {
            vec3 w = patWorley(pp);
            float e = w.y - w.x;
            float aa = fwidth(e) * 1.2;
            float c = 1.0 - smoothstep(uPatWidth - aa, uPatWidth + aa, e);
            diffuseColor.rgb *= 1.0 - (w.x - 0.3) * 0.12;
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, c * 0.9);
          } else {
            float s = sin(pp.y * 3.14159 + sin(pp.x * 1.3) * 0.6);
            float aa = fwidth(s) * 1.2;
            float c = smoothstep(uPatAmount - aa, uPatAmount + aa, s);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, c);
          }
        }`
      )
      .replace(
        '#include <opaque_fragment>',
        `float rimF = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
        rimF = pow( rimF, 2.6 );
        outgoingLight += uRimColor * rimF * uRim * ( 0.35 + 0.65 * saturate( normal.y * 0.5 + 0.6 ) );
        float pulse = 0.88 + 0.12 * sin( uTime * 3.0 + vViewPosition.y * 4.0 );
        float gl = max( saturate( vGlow ), patGlow * pulse );
        outgoingLight = mix( outgoingLight, diffuseColor.rgb * 1.35 + 0.08, gl * pulse );
        outgoingLight = mix( outgoingLight, uFlashColor, uFlash );
        outgoingLight = mix( outgoingLight, uSilColor + uSilColor * rimF * 1.2, uSil );
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'creature' + (cloud ? '-c' : '');
  return m;
}

export const PATTERN_TYPES = { none: 0, cracks: 1, veins: 1, spots: 2, plates: 3, stripes: 4, runes: 5, scales: 6 };

export function applyPattern(material, pattern) {
  const u = material.userData.pattern;
  if (!u) return;
  if (!pattern) {
    u.uPatType.value = 0;
    return;
  }
  u.uPatType.value = PATTERN_TYPES[pattern.type] ?? 0;
  const defaults = { cracks: [7, 0.05], veins: [7, 0.05], spots: [7, 0.5], plates: [5, 0.07], stripes: [6, 0.35], runes: [5, 0.05], scales: [14, 0.06] };
  const d = defaults[pattern.type] || [7, 0.06];
  u.uPatScale.value = pattern.scale ?? d[0];
  u.uPatWidth.value = pattern.width ?? d[1];
  u.uPatAmount.value = pattern.amount ?? (pattern.type === 'stripes' ? 0.35 : 0.5);
  u.uPatSeed.value = pattern.seed ?? 0;
  if (pattern.color) u.uPatColor.value.set(pattern.color);
}

// Unlit glow material for emissive creature parts (lava cracks, flames, runes).
export function glowMaterial(opts = {}) {
  return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, ...opts });
}
