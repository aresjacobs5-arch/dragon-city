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
  const { geometry, bones } = rb.build();
  const bb = geometry.boundingBox;
  t = {
    key,
    geometry,
    bones,
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
