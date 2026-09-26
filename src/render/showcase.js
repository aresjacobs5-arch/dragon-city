import * as THREE from 'three';
import { MonsterView } from './monsters/builder.js';
import { eggMesh } from './monsters/eggs.js';
import { Particles } from './fx/particles.js';
import { updateGlobalUniforms } from './materials.js';
import { RARITIES } from '../data/rarities.js';
import { ease, clamp } from '../core/math.js';
import * as Geo from './geom.js';

// Full-screen stage for hatch reveals and other big moments.
export class Showcase {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
    this.bgU = {
      uTop: { value: new THREE.Color('#2a1a4a') },
      uBot: { value: new THREE.Color('#8a5ad8') },
      uTime: { value: 0 },
    };
    const bg = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.bgU,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop, uBot; uniform float uTime; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); float k = smoothstep(-0.3, 0.7, d.y);
          vec3 c = mix(uBot, uTop, k);
          float a = atan(d.x, d.z); float rays = pow(max(0.0, sin(a * 9.0 + uTime * 0.3)), 8.0) * smoothstep(0.6, -0.1, abs(d.y - 0.1));
          c += rays * 0.18 * uBot;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.scene.add(bg);
    this.scene.add(new THREE.HemisphereLight('#f0e8ff', '#5a4a6a', 1.2));
    this.key = new THREE.SpotLight('#fff4e0', 60, 20, 0.5, 0.6, 1.2);
    this.key.position.set(0, 7, 3);
    this.key.target.position.set(0, 0.5, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight('#c8b8ff', 1.2);
    fill.position.set(-3, 2, 4);
    this.scene.add(fill);
    // pedestal
    const ped = new THREE.Mesh(Geo.paint(Geo.lathe([[0.001, 0.35], [1.25, 0.35], [1.35, 0.22], [1.2, 0.0], [0.001, 0]], 48), '#f4e8ff'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    ped.receiveShadow = true;
    ped.position.y = -0.35;
    this.scene.add(ped);
    this.glowRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.45, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.y = 0.01;
    this.scene.add(this.glowRing);
    // light beams
    this.beams = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 9), beamMat);
      b.position.y = 4.2;
      b.rotation.set(0, (i / 10) * Math.PI, (Math.random() - 0.5) * 0.9);
      this.beams.add(b);
    }
    this.beams.position.y = 0.6;
    this.scene.add(this.beams);
    this.beamMat = beamMat;
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.flash.position.y = 0.7;
    this.scene.add(this.flash);
    this.particles = new Particles(this.scene, 1200);
    this.time = 0;
    this.shake = 0;
    this.egg = null;
    this.mon = null;
    this.seq = null;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 44 : 32;
    this.camera.updateProjectionMatrix();
  }

  setRarity(r) {
    const R = RARITIES[r];
    const c = new THREE.Color(R.color);
    this.bgU.uBot.value.copy(c).lerp(new THREE.Color('#ffffff'), 0.1);
    this.bgU.uTop.value.copy(c).multiplyScalar(0.18).lerp(new THREE.Color('#1a1030'), 0.5);
    this.glowRing.material.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.4);
    this.beamMat.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.5);
    this.rarity = R;
  }

  clear() {
    if (this.old) {
      this.scene.remove(this.old.group);
      this.old.dispose();
      this.old = null;
    }
    if (this.egg) this.scene.remove(this.egg);
    if (this.mon) {
      this.scene.remove(this.mon.group);
      this.mon.dispose();
    }
    this.egg = null;
    this.mon = null;
    this.seq = null;
  }

  // Runs the hatch sequence. Callbacks: onBurst(), onReveal()
  playHatch(species, stage, { onBurst, onReveal, sfx } = {}) {
    this.clear();
    this.setRarity(species.rarity);
    const R = RARITIES[species.rarity];
    this.egg = eggMesh(species);
    this.egg.scale.setScalar(2.1);
    this.egg.position.y = 6;
    this.scene.add(this.egg);
    this.mon = new MonsterView(species, stage, { castShadow: true, cloud: false, rim: 0.7 });
    this.mon.group.visible = false;
    this.mon.group.scale.setScalar(0.001);
    this.scene.add(this.mon.group);
    const drama = R.idx; // 0..6
    const wobbleTime = 1.0 + drama * 0.45;
    this.seq = { t: 0, phase: 'drop', drama, wobbleTime, onBurst, onReveal, sfx, landed: false, cracks: 0 };
    this.cracks = [];
    // frame by final monster size: keep it in the lower-middle, clear of the title text
    const hFinal = this.mon.worldHeight * 1.6;
    const vfov = (this.camera.fov * Math.PI) / 180;
    this.revealDist = Math.min(12, Math.max(5.2, hFinal / (0.5 * 2 * Math.tan(vfov / 2)) + 1.2));
    this.lookY = Math.max(1.05, hFinal * 0.66);
    this.camY = 2.4 + (this.lookY - 1.05);
    this._ly = 1.05;
    this.camera.position.set(0, this.camY, 7.2);
    this.camera.lookAt(0, 1.1, 0);
  }

  // Evolution: the old form charges up with light, spins, bursts and the new
  // form appears. Callbacks: onFlash(), onReveal()
  playEvolve(species, fromStage, toStage, { onFlash, onReveal, sfx } = {}) {
    this.clear();
    this.setRarity(species.rarity);
    // evolutions always get a warm golden stage
    this.bgU.uBot.value.set('#ffc14d');
    this.bgU.uTop.value.set('#7a3a1a');
    this.glowRing.material.color.set('#fff0b0');
    this.beamMat.color.set('#fff3c4');
    const R = RARITIES[species.rarity];
    this.old = new MonsterView(species, fromStage, { castShadow: true, cloud: false, rim: 0.7 });
    this.old.group.scale.setScalar(1.6);
    this.scene.add(this.old.group);
    this.mon = new MonsterView(species, toStage, { castShadow: true, cloud: false, rim: 0.7 });
    this.mon.group.visible = false;
    this.mon.group.scale.setScalar(0.001);
    this.scene.add(this.mon.group);
    const hFinal = this.mon.worldHeight * 1.6;
    const vfov = (this.camera.fov * Math.PI) / 180;
    this.revealDist = Math.min(12, Math.max(5.2, hFinal / (0.5 * 2 * Math.tan(vfov / 2)) + 1.2));
    this.lookY = Math.max(1.05, hFinal * 0.66);
    this.camY = 2.4 + (this.lookY - 1.05);
    this._ly = this.lookY;
    this.camera.position.set(0, this.camY, this.revealDist + 1);
    this.old.animator.play('happy');
    this.seq = { kind: 'evolve', t: 0, phase: 'charge', drama: Math.max(2, R.idx), onFlash, onReveal, sfx, pulses: 0 };
  }

  skip() {
    if (!this.seq) return;
    if (this.seq.kind === 'evolve') {
      if (this.seq.phase === 'charge') this.seq.t = Math.max(this.seq.t, 2.2);
      return;
    }
    if (this.seq.phase === 'drop' || this.seq.phase === 'wobble') {
      this.seq.t = 0;
      this.seq.phase = 'burst';
      this._burst();
    }
  }

  _addCrack() {
    const pts = [];
    let x = (Math.random() - 0.5) * 0.3, y = 0.5 + Math.random() * 0.4;
    const ang = Math.random() * Math.PI * 2;
    for (let i = 0; i < 5; i++) {
      pts.push(new THREE.Vector3(Math.cos(ang) * 0.37, y, Math.sin(ang) * 0.37));
      y += (Math.random() - 0.5) * 0.18;
    }
    const g = Geo.taperTube(pts.map((p, i) => p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 2) * 0.15)), 0.012, 4, 8);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: this.rarity ? this.rarity.color : '#fff', toneMapped: false }));
    m.material.color.lerp(new THREE.Color('#ffffff'), 0.5);
    this.egg.add(m);
  }

  _burst() {
    const s = this.seq;
    if (this.egg) this.egg.visible = false;
    const c = new THREE.Vector3(0, 0.8, 0);
    const R = this.rarity;
    this.particles.emit('flash', c, { count: 1, size: 3 + s.drama });
    this.particles.emit('shock', new THREE.Vector3(0, 0.3, 0), { count: 1, size: 2 + s.drama * 0.5, color: R.color });
    this.particles.emit('star', c, { count: 30 + s.drama * 12, spread: 0.3, speed: 1 + s.drama * 0.25, color: null });
    this.particles.emit('sparkle', c, { count: 30, spread: 0.6, color: R.color });
    this.particles.emit('puff', new THREE.Vector3(0, 0.3, 0), { count: 14, spread: 0.4 });
    if (s.drama >= 2) this.particles.emit('confetti', new THREE.Vector3(0, 1.5, 0), { count: 40 + s.drama * 15, spread: 1 });
    this.shake = 0.5 + s.drama * 0.15;
    this.flashK = 1;
    this.mon.group.visible = true;
    if (s.onBurst) s.onBurst();
  }

  update(dt) {
    this.time += dt;
    this.bgU.uTime.value = this.time;
    updateGlobalUniforms(dt);
    const s = this.seq;
    if (s && s.kind === 'evolve') {
      s.t += dt;
      if (s.phase === 'charge') {
        const k = clamp(s.t / 2.4, 0, 1);
        // rising glow pulses and an accelerating spin
        const pulse = Math.floor(k * 6);
        while (s.pulses < pulse) {
          s.pulses++;
          this.old.flash('#ffffff', 0.35 + s.pulses * 0.1);
          if (s.sfx) s.sfx('sparkle');
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = new THREE.Vector3(Math.cos(a) * 2.2, 0.4 + Math.random() * 2, Math.sin(a) * 2.2);
            this.particles.emit('sparkle', p, { count: 2, dir: new THREE.Vector3(0, 1, 0).sub(p).normalize(), speed: 2.2, color: this.rarity.color });
          }
        }
        this.old.group.rotation.y += dt * (1 + k * k * 22);
        this.old.flashT = Math.max(this.old.flashT, k * 0.9);
        this.old.group.position.y = Math.sin(k * Math.PI * 0.5) * 0.35;
        this.beamMat.opacity = k * 0.22;
        this.shake = Math.max(this.shake, k * 0.12);
        if (k >= 1) {
          s.phase = 'burst';
          s.t = 0;
          this.old.group.visible = false;
          this.flashK = 1;
          this.shake = 0.7;
          const c = new THREE.Vector3(0, 1, 0);
          this.particles.emit('shock', new THREE.Vector3(0, 0.3, 0), { count: 1, size: 3, color: this.rarity.color });
          this.particles.emit('star', c, { count: 60, spread: 0.4, speed: 1.6 });
          this.particles.emit('confetti', new THREE.Vector3(0, 1.6, 0), { count: 80, spread: 1 });
          this.mon.group.visible = true;
          if (s.onFlash) s.onFlash();
        }
      } else if (s.phase === 'burst') {
        const k = clamp(s.t / 0.55, 0, 1);
        this.mon.group.scale.setScalar(Math.max(0.001, ease.outElastic(k) * 1.6));
        this.mon.group.position.y = Math.sin(k * Math.PI) * 0.5;
        if (k >= 1) {
          s.phase = 'reveal';
          s.t = 0;
          this.mon.animator.play('roar');
          if (s.onReveal) s.onReveal();
        }
      } else if (s.phase === 'reveal') {
        this.beamMat.opacity = Math.min(0.22, this.beamMat.opacity + dt * 0.3);
        if (Math.random() < dt * 4) this.particles.emit('sparkle', new THREE.Vector3((Math.random() - 0.5) * 2, 0.3 + Math.random() * 2, (Math.random() - 0.5) * 1.5), { count: 1, color: this.rarity.color });
        this.mon.group.rotation.y = Math.sin(this.time * 0.5) * 0.35;
      }
      if (this.old) this.old.update(dt);
    } else if (s) {
      s.t += dt;
      if (s.phase === 'drop') {
        const k = clamp(s.t / 0.55, 0, 1);
        this.egg.position.y = 6 * (1 - ease.inQuad(k));
        if (k >= 1) {
          s.phase = 'wobble';
          s.t = 0;
          this.shake = 0.25;
          this.particles.emit('dust', new THREE.Vector3(0, 0.1, 0), { count: 18, spread: 0.8 });
          if (s.sfx) s.sfx('land');
        }
      } else if (s.phase === 'wobble') {
        const k = s.t / s.wobbleTime;
        const amp = 0.05 + k * (0.18 + s.drama * 0.02);
        const freq = 9 + k * 14;
        this.egg.rotation.z = Math.sin(s.t * freq) * amp;
        this.egg.position.y = Math.abs(Math.sin(s.t * freq * 0.5)) * k * 0.12;
        const wantCracks = Math.floor(k * (2 + Math.min(4, s.drama)));
        while (s.cracks < wantCracks) {
          s.cracks++;
          this._addCrack();
          this.particles.emit('sparkle', new THREE.Vector3(0, 1.2, 0.6), { count: 6, spread: 0.4, color: this.rarity.color });
          if (s.sfx) s.sfx('crack');
        }
        this.beamMat.opacity = k * 0.1 * Math.min(1, s.drama / 2);
        const ts = 1 + Math.sin(s.t * 40) * 0.02 * k;
        this.egg.scale.set(2.1 * ts, 2.1 / ts, 2.1 * ts);
        if (s.t >= s.wobbleTime) {
          s.phase = 'burst';
          s.t = 0;
          this._burst();
          if (s.sfx) s.sfx('burst');
        }
      } else if (s.phase === 'burst') {
        const k = clamp(s.t / 0.5, 0, 1);
        const sc = ease.outElastic(k);
        this.mon.group.scale.setScalar(Math.max(0.001, sc * 1.6));
        this.mon.group.position.y = Math.sin(k * Math.PI) * 0.8;
        if (k >= 1) {
          s.phase = 'reveal';
          s.t = 0;
          this.mon.animator.play(s.drama >= 2 ? 'roar' : 'happy');
          if (s.onReveal) s.onReveal();
        }
      } else if (s.phase === 'reveal') {
        this.beamMat.opacity = Math.min(0.22, this.beamMat.opacity + dt * 0.3) * (s.drama >= 1 ? 1 : 0.4);
        if (Math.random() < dt * (2 + s.drama)) this.particles.emit('sparkle', new THREE.Vector3((Math.random() - 0.5) * 2, 0.3 + Math.random() * 2, (Math.random() - 0.5) * 1.5), { count: 1, color: this.rarity.color });
        this.mon.group.rotation.y = Math.sin(this.time * 0.5) * 0.35;
      }
    }
    this.beams.rotation.y += dt * 0.25;
    if (this.flashK > 0) {
      this.flashK = Math.max(0, this.flashK - dt * 2.2);
      this.flash.material.opacity = this.flashK * 0.9;
      this.flash.scale.setScalar(1 + (1 - this.flashK) * 5);
    }
    this.glowRing.material.opacity = 0.35 + Math.sin(this.time * 3) * 0.2;
    if (this.mon) {
      this.mon.update(dt);
      if (this.seq && this.seq.phase === 'reveal') this.mon.ambient(this.particles, dt);
    }
    // camera: slow push in with shake
    const reveal = this.mon && this.seq && (this.seq.phase === 'reveal' || this.seq.kind === 'evolve');
    const target = reveal ? this.revealDist || 6 : 7.2;
    const k = 1 - Math.exp(-2 * dt);
    this.camera.position.z += (target - this.camera.position.z) * k;
    this._ly = (this._ly ?? 1.05) + ((reveal ? this.lookY || 1.05 : 1.05) - (this._ly ?? 1.05)) * k;
    this.camera.position.y = (this.camY || 2.4) + (this._ly - (this.lookY || 1.05)) * 0.5;
    this.camera.position.x = Math.sin(this.time * 0.3) * 0.25;
    this.camera.lookAt(0, this._ly, 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      const s2 = this.shake * this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s2;
      this.camera.position.y += (Math.random() - 0.5) * s2;
    }
    this.particles.setScale(this.engine.height * this.engine.renderer.getPixelRatio(), this.camera.fov);
    this.particles.update(dt);
  }
}
