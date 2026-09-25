import * as THREE from 'three';
import { RigBuilder, createSkeleton } from './rig.js';
import { ARCHETYPES } from './archetypes.js';
import { Animator } from './animator.js';
import { creatureMaterial, applyPattern } from '../materials.js';

// Monster templates (merged skinned geometry + bone definitions) are cached per
// species+stage; each on-screen monster gets its own skeleton and animator.

export const STAGE_SCALE = [0.78, 0.95, 1.12];
export const RARITY_SIZE = { common: 1, uncommon: 1.04, rare: 1.08, epic: 1.16, legendary: 1.26, mythic: 1.32, ancient: 1.38 };
const cache = new Map();

// Final-form monsters carry a gentle aura of their element.
const AURA = {
  fire: { type: 'ember', color: null },
  nature: { type: 'leaf', color: null },
  water: { type: 'bubble', color: null },
  earth: { type: 'dust', color: '#e6c29a', size: 0.5 },
  electric: { type: 'bolt', color: null, size: 0.5 },
  ice: { type: 'snow', color: null },
  light: { type: 'sparkle', color: '#fff3b0' },
  dark: { type: 'sparkle', color: '#b48cff' },
  metal: { type: 'sparkle', color: '#e1e8f2' },
  magic: { type: 'magic', color: null },
  ancient: { type: 'magic', color: '#7ff0d8' },
  void: { type: 'sparkle', color: '#9a86e0' },
  celestial: { type: 'star', color: '#dfe8ff', size: 0.6 },
};
const _av = new THREE.Vector3();

export function stageForLevel(level) {
  return level >= 20 ? 2 : level >= 10 ? 1 : 0;
}

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

export function getTemplate(species, stage = 0) {
  const key = `${species.id}:${stage}`;
  let t = cache.get(key);
  if (t) return t;
  const rb = new RigBuilder();
  const model = cloneModel(species.model);
  const st = { s: stage, g: stage / 2 };
  const fn = ARCHETYPES[model.arch] || ARCHETYPES.quad;
  const info = fn(rb, model, st);
  const { geometry, bones, emitters } = rb.build();
  const bb = geometry.boundingBox;
  t = {
    key,
    geometry,
    bones,
    emitters: emitters || [],
    info,
    arch: model.arch,
    scale: (model.size || 1) * STAGE_SCALE[stage] * (RARITY_SIZE[species.rarity] || 1) * (species.boss ? 2.2 : 1),
    height: bb.max.y,
    radius: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5,
    bbox: bb.clone(),
  };
  cache.set(key, t);
  return t;
}

export function clearTemplateCache() {
  for (const t of cache.values()) t.geometry.dispose();
  cache.clear();
}

// A live monster in a scene.
export class MonsterView {
  constructor(species, stage = 0, { castShadow = true, receiveShadow = false, rim = 0.55, cloud = true } = {}) {
    this.species = species;
    this.stage = stage;
    this.template = getTemplate(species, stage);
    const tpl = this.template;
    this.group = new THREE.Group(); // positioned/rotated by gameplay
    this.inner = new THREE.Group(); // scaled
    this.inner.scale.setScalar(tpl.scale);
    this.group.add(this.inner);
    this.material = creatureMaterial({ rim, cloud });
    const pat = species.model.pattern;
    if (pat) {
      const colors = species.model.colors || {};
      applyPattern(this.material, { ...pat, color: colors[pat.color] || pat.color || colors.glow || colors.accent });
    }
    const sk = createSkeleton(tpl.bones);
    this.bones = sk.byName;
    const mesh = new THREE.SkinnedMesh(tpl.geometry, this.material);
    mesh.add(sk.root);
    mesh.bind(new THREE.Skeleton(sk.bones));
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, tpl.height * 0.5, 0), Math.max(tpl.height, tpl.radius * 2) * 0.9 + 0.3);
    mesh.userData.monsterView = this;
    this.mesh = mesh;
    this.inner.add(mesh);
    this.animator = new Animator(this);
    this.flashT = 0;
    this.worldHeight = tpl.height * tpl.scale;
  }

  get height() {
    return this.worldHeight;
  }

  // Ambient particles: bone emitters (flame tips...) and the final-form aura.
  ambient(particles, dt) {
    if (!particles || !this.group.visible) return;
    const em = this.template.emitters;
    if (em && em.length) {
      this._emT = (this._emT ?? Math.random() * 0.4) - dt;
      if (this._emT <= 0) {
        this._emT = 0.35 + Math.random() * 0.4;
        const e = em[(Math.random() * em.length) | 0];
        const bone = this.bones[e.bone];
        if (bone) {
          bone.getWorldPosition(_av);
          particles.emit(e.type, _av, { count: 1, spread: 0.05, size: 0.8 * this.group.scale.x });
        }
      }
    }
    if (this.stage >= 2 && this.species.elements) {
      this._auT = (this._auT ?? Math.random()) - dt;
      if (this._auT <= 0) {
        this._auT = 0.28 + Math.random() * 0.3;
        const el = this.species.elements[(Math.random() * this.species.elements.length) | 0];
        const a = AURA[el];
        if (a) {
          const tpl = this.template;
          const s = tpl.scale * this.group.scale.x;
          const ang = Math.random() * Math.PI * 2;
          const r = (0.3 + Math.random() * 0.5) * tpl.radius * s;
          _av.set(Math.cos(ang) * r, (0.15 + Math.random() * 0.85) * tpl.height * s, Math.sin(ang) * r);
          _av.applyQuaternion(this.group.quaternion).add(this.group.getWorldPosition(new THREE.Vector3()));
          particles.emit(a.type, _av, { count: 1, spread: 0.05, color: a.color, size: (a.size || 0.7) * Math.max(0.8, s), speed: 0.4 });
        }
      }
    }
  }

  flash(color = 0xffffff, strength = 0.85) {
    this.material.userData.flashColor.value.set(color);
    this.flashT = strength;
  }

  setSilhouette(v) {
    this.material.userData.silhouette.value = v;
  }

  update(dt) {
    this.animator.update(dt);
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 4);
      this.material.userData.flash.value = this.flashT;
    } else if (this.material.userData.flash.value !== 0) this.material.userData.flash.value = 0;
  }

  // World-space point above the head (for labels, status icons)
  topPoint(out = new THREE.Vector3()) {
    out.set(0, this.worldHeight + 0.15, 0);
    return this.group.localToWorld(out);
  }

  dispose() {
    this.material.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
