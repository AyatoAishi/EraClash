// ============================================================
//  Fog-of-war RENDERING: every lit/basic material darkens fragments whose world (x,z)
//  falls in a cell the viewer can't see. Done once, globally, by hooking
//  Material.prototype.onBeforeCompile — so new meshes (troops, props, future buildings)
//  get it automatically. Opt out per material with material.userData.noFow = true.
// ============================================================
import * as THREE from 'three';
import { TERRAIN } from './terrain.js';

export const FOW = {
  on: { value: 0 },              // 0 = off (spectator / menu), 1 = on
  dark: { value: 0.42 },         // brightness multiplier in the fog
  tex: { value: null },
  rect: { value: new THREE.Vector4(TERRAIN.visMinX, TERRAIN.visMinZ, TERRAIN.visMaxX - TERRAIN.visMinX, TERRAIN.visMaxZ - TERRAIN.visMinZ) },
  data: null, alpha: null, W: 0, H: 0,
};

export function installFogShader(W, H) {
  FOW.W = W; FOW.H = H;
  FOW.data = new Uint8Array(W * H * 4).fill(255);
  FOW.alpha = new Float32Array(W * H).fill(1);
  const tex = new THREE.DataTexture(FOW.data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  FOW.tex.value = tex;

  THREE.Material.prototype.onBeforeCompile = function (shader) {
    if (this.userData?.noFow) return;
    if (!shader.vertexShader.includes('#include <project_vertex>') || !shader.fragmentShader.includes('#include <fog_fragment>')) return;
    shader.uniforms.fowTex = FOW.tex; shader.uniforms.fowOn = FOW.on; shader.uniforms.fowDark = FOW.dark; shader.uniforms.fowRect = FOW.rect;
    shader.vertexShader = 'varying vec2 vFowXZ;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 fw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fw = instanceMatrix * fw;
        #endif
        fw = modelMatrix * fw; vFowXZ = fw.xz; }`);
    shader.fragmentShader = 'varying vec2 vFowXZ;\nuniform sampler2D fowTex;\nuniform float fowOn;\nuniform float fowDark;\nuniform vec4 fowRect;\n' +
      shader.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>
      if (fowOn > 0.5) { float fv = texture2D(fowTex, (vFowXZ - fowRect.xy) / fowRect.zw).r; gl_FragColor.rgb *= mix(fowDark, 1.0, fv); }`);
  };
}

/** Ease the displayed fog toward the viewer's visibility grid (smooth edges when troops move). */
export function updateFogTexture(vis, dt) {
  if (!FOW.data) return;
  const a = FOW.alpha, d = FOW.data, k = Math.min(1, dt * 6);
  for (let i = 0; i < a.length; i++) {
    const want = vis ? vis[i] : 1;
    a[i] += (want - a[i]) * k;
    d[i * 4] = Math.round(a[i] * 255);
  }
  FOW.tex.value.needsUpdate = true;
}
