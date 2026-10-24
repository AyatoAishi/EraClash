// Small orbit camera for the Dev Lab viewer: LMB drag = rotate, RMB / middle drag = pan, wheel = zoom.
import * as THREE from 'three';

export class OrbitCam {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 1, 0);
    this.yaw = Math.PI / 4;
    this.pitch = 0.45;
    this.dist = 8;
    this.minDist = 1; this.maxDist = 150;
    this.enabled = false;
    this.drag = null;
    const on = (t, f, o) => dom.addEventListener(t, f, o);
    on('pointerdown', (e) => {
      if (!this.enabled) return;
      this.drag = { b: e.button, x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
    });
    on('pointermove', (e) => {
      if (!this.enabled || !this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      if (this.drag.b === 0 && !e.shiftKey) {
        this.yaw -= dx * 0.008;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.008));
      } else this.pan(dx, dy);
    });
    on('pointerup', (e) => { this.drag = null; if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId); });
    on('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
  }
  pan(dx, dy) {
    const s = this.dist * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  }
  /** Frame a box: center on it and back off so it fits. */
  frame(box) {
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    this.target.copy(c);
    const r = Math.max(size.x, size.y, size.z, 0.5);
    this.dist = Math.min(this.maxDist, r * 1.9 + 1.5);
  }
  apply() {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    this.camera.lookAt(this.target);
  }
}
