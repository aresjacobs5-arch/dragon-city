import * as THREE from 'three';
import { Tweens } from '../core/math.js';

// Central renderer. Renders the active "world" controller full screen, an
// optional dim layer, then any DOM-anchored 3D viewports (monster previews,
// hatch reveals) into scissored regions of the same canvas. A single WebGL
// context keeps memory low and avoids re-uploading geometry.
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.autoClear = false;
    renderer.setClearColor(0x9fd8f5, 1);
    this.renderer = renderer;

    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = this.maxPixelRatio;
    this.minPixelRatio = Math.max(0.6, this.maxPixelRatio * 0.5);
    this.width = 1;
    this.height = 1;

    this.world = null; // active world controller { scene, camera, update(dt,t), resize(w,h) }
    this.worldVisible = true;
    this.viewports = new Set();
    this.dim = 0;
    this.dimTarget = 0;
    this.tweens = new Tweens();
    this.timeScale = 1;
    this.time = 0;
    this.frameHooks = new Set();
    this.lateHooks = new Set();
    this._frameTimes = [];
    this._resTimer = 0;
    this.paused = false;

    // Dim layer
    this.dimScene = new THREE.Scene();
    this.dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x160f24, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dimMat);
    q.frustumCulled = false;
    this.dimScene.add(q);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize);
    this.resize();

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
    });
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    if (this.world && this.world.resize) this.world.resize(w, h);
  }

  setWorld(controller) {
    if (this.world && this.world.onDeactivate) this.world.onDeactivate();
    this.world = controller;
    if (controller) {
      if (controller.onActivate) controller.onActivate();
      if (controller.resize) controller.resize(this.width, this.height);
    }
  }

  addViewport(vp) {
    this.viewports.add(vp);
    return vp;
  }
  removeViewport(vp) {
    this.viewports.delete(vp);
  }

  onFrame(fn) { this.frameHooks.add(fn); return () => this.frameHooks.delete(fn); }
  onLateFrame(fn) { this.lateHooks.add(fn); return () => this.lateHooks.delete(fn); }

  start() {
    let last = performance.now();
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.frame(dt, now);
    };
    this._raf = requestAnimationFrame(tick);
  }

  frame(dt, now) {
    if (this.contextLost) return;
    this.time += dt;
    const sdt = dt * this.timeScale;
    this.tweens.update(dt, sdt);
    for (const fn of this.frameHooks) fn(dt, sdt);
    if (this.world && this.world.update && this.worldVisible) this.world.update(dt, this.time);
    for (const vp of this.viewports) if (vp.update) vp.update(dt, this.time);

    // dim easing
    this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-10 * dt));
    this.render();
    for (const fn of this.lateHooks) fn(dt, sdt);
    this._adaptResolution(dt);
  }

  render() {
    const r = this.renderer;
    // 1) DOM-anchored previews first: render each into its screen region and
    //    copy it into the element's own 2D canvas. The world pass below then
    //    paints over those pixels, so previews only ever appear in the DOM.
    if (this.viewports.size) {
      for (const vp of this.viewports) {
        if (!vp.el || !vp.scene || !vp.camera || vp.hidden) continue;
        if (!vp.el.isConnected) continue;
        const scr = vp.el.closest('.scr');
        if (scr && scr.style.visibility === 'hidden') continue;
        const rect = vp.el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rect.right < 0 || rect.bottom < 0 || rect.left > this.width || rect.top > this.height) continue;
        const x = rect.left, y = this.height - rect.bottom, w = rect.width, h = rect.height;
        r.setScissorTest(true);
        r.setScissor(x, y, w, h);
        r.setViewport(x, y, w, h);
        const cam = vp.camera;
        const aspect = w / h;
        if (cam.isPerspectiveCamera && Math.abs(cam.aspect - aspect) > 1e-3) {
          cam.aspect = aspect;
          cam.updateProjectionMatrix();
        }
        r.setClearColor(vp.clearColor ?? 0xcfe9ff, 1);
        r.clear(true, true, false);
        r.render(vp.scene, cam);
        this._blit(vp, rect);
      }
      r.setClearColor(0x9fd8f5, 1);
    }
    // 2) the world, full screen
    r.setScissorTest(false);
    r.setViewport(0, 0, this.width, this.height);
    r.clear(true, true, false);
    if (this.world && this.worldVisible) {
      r.render(this.world.scene, this.world.camera);
      this.lastTris = r.info.render.triangles;
    }
    if (this.dim > 0.01) {
      this.dimMat.opacity = this.dim;
      r.clearDepth();
      r.render(this.dimScene, this.dimCam);
    }
  }

  // Copies a freshly rendered viewport region of the WebGL canvas into a 2D
  // canvas living inside the viewport's DOM element. The 3D preview then sits
  // in normal DOM stacking order (above panel backgrounds, below overlays).
  _blit(vp, rect) {
    let c = vp._canvas;
    if (!c || c.parentNode !== vp.el) {
      c = vp._canvas = document.createElement('canvas');
      c.className = 'vp-canvas';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit';
      vp.el.prepend(c);
      vp._ctx = c.getContext('2d', { alpha: false });
    }
    const pr = this.renderer.getPixelRatio();
    const cw = Math.max(1, Math.round(rect.width * pr));
    const ch = Math.max(1, Math.round(rect.height * pr));
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    try {
      vp._ctx.drawImage(this.canvas, rect.left * pr, rect.top * pr, cw, ch, 0, 0, cw, ch);
    } catch (e) {
      /* canvas not ready */
    }
  }

  _adaptResolution(dt) {
    const ft = this._frameTimes;
    ft.push(dt);
    if (ft.length > 90) ft.shift();
    this._resTimer += dt;
    if (this._resTimer < 2 || ft.length < 60) return;
    this._resTimer = 0;
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    let pr = this.pixelRatio;
    if (avg > 1 / 40 && pr > this.minPixelRatio) pr = Math.max(this.minPixelRatio, pr - 0.2);
    else if (avg < 1 / 57 && pr < this.maxPixelRatio) pr = Math.min(this.maxPixelRatio, pr + 0.1);
    if (Math.abs(pr - this.pixelRatio) > 0.01) {
      this.pixelRatio = pr;
      this.resize();
    }
  }

  // Projects a world position to CSS pixel coordinates of the canvas.
  project(v3, camera = this.world && this.world.camera, out = { x: 0, y: 0, visible: false }) {
    if (!camera) return out;
    _v.copy(v3).project(camera);
    out.x = (_v.x * 0.5 + 0.5) * this.width;
    out.y = (-_v.y * 0.5 + 0.5) * this.height;
    out.visible = _v.z < 1 && _v.z > -1;
    return out;
  }
}

const _v = new THREE.Vector3();
