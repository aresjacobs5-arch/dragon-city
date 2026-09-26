import * as THREE from 'three';
import { globalUniforms } from '../materials.js';
import { getNoiseTexture } from '../textures.js';

// Gradient sky dome with a soft sun glow.
export function createSky({ top = '#4fb0ee', horizon = '#c9ecff', sun = '#fff3cf', sunDir = new THREE.Vector3(-0.5, 0.6, -0.6), radius = 900 } = {}) {
  const uniforms = {
    uTop: { value: new THREE.Color(top) },
    uHorizon: { value: new THREE.Color(horizon) },
    uSun: { value: new THREE.Color(sun) },
    uSunDir: { value: sunDir.clone().normalize() },
    uBottom: { value: new THREE.Color(horizon).lerp(new THREE.Color('#ffffff'), 0.2) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSun, uBottom, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        col = mix(col, uBottom, smoothstep(0.0, -0.4, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSun * (pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// Endless sea of clouds far beneath the islands.
export function createCloudSea({ y = -46, size = 1400, color = '#ffffff', shade = '#b9cdea', fog = '#bfe5fb' } = {}) {
  const tex = getNoiseTexture();
  const uniforms = {
    uTex: { value: tex },
    uTime: globalUniforms.uTime,
    uColor: { value: new THREE.Color(color) },
    uShade: { value: new THREE.Color(shade) },
    uFog: { value: new THREE.Color(fog) },
    uCenter: { value: new THREE.Vector3() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uTime;
      uniform vec3 uColor, uShade, uFog, uCenter;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz * 0.004;
        float n1 = texture2D(uTex, p + vec2(uTime * 0.004, uTime * 0.002)).r;
        float n2 = texture2D(uTex, p * 2.3 - vec2(uTime * 0.006, -uTime * 0.003)).g;
        float n = n1 * 0.65 + n2 * 0.35;
        float puff = smoothstep(0.25, 0.75, n);
        vec3 col = mix(uShade, uColor, puff);
        float d = length(vW.xz - uCenter.xz);
        float f = smoothstep(120.0, 620.0, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.userData.uniforms = uniforms;
  mesh.renderOrder = -5;
  return mesh;
}
