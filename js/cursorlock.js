// ============================================================
//  CURSOR LOCK — keeps the mouse inside the game (dual monitors, browser tab bar, taskbar).
//
//  Browsers can't clamp the real cursor, so while a match is running we take Pointer Lock (the OS
//  cursor is hidden and frozen) and draw our own pixel cursor that is clamped to the window.
//  Every real mouse event is swallowed in the capture phase and re-sent as a synthetic event at
//  the virtual cursor's position, to whatever element is under it. Game code doesn't know the
//  difference: it still reads e.clientX / e.target as usual.
//
//  - Lock is taken on the first click inside a running match (browsers need a click for it).
//  - It's dropped on pause / menus / game over, and re-taken on the next click.
//  - The browser always gives Esc back to the player: it releases the lock. We then do what Esc
//    normally does in-game (cancel aim, close shop, pause...).
//  Settings: gameplay.cursorLock (on/off), gameplay.cursorSens (mouse speed while locked).
// ============================================================
import { settings } from './settings.js';

const MOUSE = ['mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'auxclick', 'wheel',
  'pointermove', 'pointerdown', 'pointerup', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave'];
const DBL_MS = 350;

export class CursorLock {
  constructor(app) {
    this.app = app;
    this.x = innerWidth / 2; this.y = innerHeight / 2;
    this.locked = false;
    this.wantUnlock = false;      // we released it ourselves (pause, menu) -> not an Esc press
    this.hover = null;            // element under the virtual cursor
    this.down = {};               // button -> element pressed on (for click synthesis)
    this.lastClick = { t: 0, el: null };
    this.buttons = 0;
    this.lastEscAt = 0;

    this.el = document.createElement('div');
    this.el.id = 'vcursor';
    this.el.innerHTML = '<svg viewBox="0 0 12 18" shape-rendering="crispEdges"><path d="M0 0h1v1h-1zM0 1h2v1h-2zM0 2h1v1h-1zM2 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM6 6h1v1h-1zM0 7h1v1h-1zM7 7h1v1h-1zM0 8h1v1h-1zM8 8h1v1h-1zM0 9h1v1h-1zM9 9h1v1h-1zM0 10h1v1h-1zM10 10h1v1h-1zM0 11h1v1h-1zM7 11h5v1h-5zM0 12h1v1h-1zM4 12h1v1h-1zM7 12h1v1h-1zM0 13h1v1h-1zM3 13h2v1h-2zM8 13h1v1h-1zM0 14h1v1h-1zM2 14h1v1h-1zM5 14h1v1h-1zM8 14h1v1h-1zM0 15h2v1h-2zM5 15h1v1h-1zM9 15h1v1h-1zM0 16h1v1h-1zM6 16h1v1h-1zM9 16h1v1h-1zM6 17h3v1h-3z" fill="#000"/><path d="M1 2h1v1h-1zM1 3h2v1h-2zM1 4h3v1h-3zM1 5h4v1h-4zM1 6h5v1h-5zM1 7h6v1h-6zM1 8h7v1h-7zM1 9h8v1h-8zM1 10h9v1h-9zM1 11h6v1h-6zM1 12h3v1h-3zM5 12h2v1h-2zM1 13h2v1h-2zM5 13h3v1h-3zM1 14h1v1h-1zM6 14h2v1h-2zM6 15h3v1h-3zM7 16h2v1h-2z" fill="#fff"/></svg>';
    document.body.appendChild(this.el);

    // capture phase on window = runs before every other listener in the page
    for (const type of MOUSE) addEventListener(type, (e) => this.onReal(e), { capture: true, passive: false });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && e.isTrusted) this.lastEscAt = performance.now(); }, true);
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    document.addEventListener('pointerlockerror', () => { this.locked = false; this.render(); });
    addEventListener('resize', () => this.clamp());
    addEventListener('blur', () => this.release());
  }

  get enabled() { return settings.gameplay.cursorLock && this.app.state === 'playing' && 'requestPointerLock' in document.body; }

  acquire(x, y) {
    if (this.locked || !this.enabled) return;
    this.x = x ?? this.x; this.y = y ?? this.y; this.clamp();
    try {
      const p = document.documentElement.requestPointerLock();
      p?.catch?.(() => {});         // Chrome refuses for ~1s right after the player pressed Esc; the next click retries
    } catch { /* not supported */ }
  }
  release() {
    if (!this.locked) return;
    this.wantUnlock = true;
    document.exitPointerLock?.();
  }
  /** Called every frame: drop the lock whenever we're not in a running match. */
  update() { if (this.locked && !this.enabled) this.release(); }

  onLockChange() {
    const now = document.pointerLockElement === document.documentElement;
    const was = this.locked;
    this.locked = now;
    this.buttons = 0; this.down = {};
    if (now) { this.hover = document.elementFromPoint(this.x, this.y); }
    else if (was && !this.wantUnlock && this.app.state === 'playing') {
      // the player pressed Esc (the browser keeps that key for itself). Run the normal Esc action,
      // unless the page also got the Esc keydown (some browsers send it), so it doesn't happen twice.
      setTimeout(() => { if (performance.now() - this.lastEscAt > 250) this.app.handleEscape?.(); }, 60);
    }
    this.wantUnlock = false;
    this.render();
  }

  clamp() {
    this.x = Math.max(0, Math.min(innerWidth - 1, this.x));
    this.y = Math.max(0, Math.min(innerHeight - 1, this.y));
  }
  render() {
    this.el.style.display = this.locked ? 'block' : 'none';
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.el.classList.toggle('aim', document.body.classList.contains('armed') || !!this.app.controls?.targeting);
  }

  // ---------- event routing ----------
  onReal(e) {
    if (!e.isTrusted) return;                                         // our own synthetic events pass through
    if (!this.locked) {
      // first click inside a running match takes the lock (at the real cursor position, so nothing jumps)
      if (e.type === 'mousedown' && this.enabled) this.acquire(e.clientX, e.clientY);
      return;
    }
    e.stopImmediatePropagation();
    if (e.cancelable && e.type !== 'pointerdown' && e.type !== 'pointerup') e.preventDefault();
    const mods = { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey };
    switch (e.type) {
      case 'mousemove': {
        const s = settings.gameplay.cursorSens ?? 1, cap = Math.max(400, innerWidth / 3);
        // browsers sometimes report one huge bogus jump right after the lock starts: ignore those
        if (Math.abs(e.movementX) > cap || Math.abs(e.movementY) > cap) break;
        this.x += e.movementX * s; this.y += e.movementY * s; this.clamp();
        const t = this.target();
        this.moveHover(t, mods);
        this.fire(t, 'mousemove', MouseEvent, { ...mods, button: 0 });
        this.render();
        break;
      }
      case 'mousedown': {
        const t = this.target();
        this.buttons |= 1 << btnBit(e.button);
        this.down[e.button] = t;
        // focus behaves like a real click: inputs get focus, anything else blurs the focused input
        const f = t.closest?.('input, textarea, select, button, [tabindex]');
        if (f && /INPUT|TEXTAREA|SELECT/.test(f.tagName)) f.focus();
        else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
        this.fire(t, 'pointerdown', PointerEvent, { ...mods, button: e.button, pointerType: 'mouse', isPrimary: true });
        this.fire(t, 'mousedown', MouseEvent, { ...mods, button: e.button });
        break;
      }
      case 'mouseup': {
        const t = this.target();
        this.buttons &= ~(1 << btnBit(e.button));
        this.fire(t, 'pointerup', PointerEvent, { ...mods, button: e.button, pointerType: 'mouse', isPrimary: true });
        this.fire(t, 'mouseup', MouseEvent, { ...mods, button: e.button });
        const d = this.down[e.button]; delete this.down[e.button];
        const hit = d && (d === t || d.contains(t) || t.contains(d)) ? (d.contains(t) ? d : t) : null;
        if (e.button === 0 && hit) {
          this.fire(hit, 'click', MouseEvent, { ...mods, button: 0, detail: 1 });
          const now = performance.now();
          if (this.lastClick.el === hit && now - this.lastClick.t < DBL_MS) { this.fire(hit, 'dblclick', MouseEvent, { ...mods, button: 0, detail: 2 }); this.lastClick = { t: 0, el: null }; }
          else this.lastClick = { t: now, el: hit };
        } else if (e.button === 2) this.fire(t, 'contextmenu', MouseEvent, { ...mods, button: 2 });
        else if (e.button === 1 && hit) this.fire(hit, 'auxclick', MouseEvent, { ...mods, button: 1 });
        break;
      }
      case 'wheel': {
        const t = this.target();
        const ok = this.fire(t, 'wheel', WheelEvent, { ...mods, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode });
        if (ok) scrollUnder(t, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1));  // synthetic wheels don't scroll by themselves
        break;
      }
      default: break;                                                  // real click/over/out/pointer* are replaced by ours
    }
  }
  target() {
    return document.elementFromPoint(this.x, this.y) || document.body;   // #vcursor has pointer-events: none
  }
  moveHover(t, mods) {
    if (t === this.hover) return;
    const old = this.hover; this.hover = t;
    if (old?.isConnected) this.fire(old, 'mouseout', MouseEvent, { ...mods, relatedTarget: t });
    this.fire(t, 'mouseover', MouseEvent, { ...mods, relatedTarget: old });
  }
  fire(t, type, Ctor, extra) {
    const ev = new Ctor(type, {
      bubbles: type !== 'mouseenter' && type !== 'mouseleave', cancelable: true, composed: true, view: window,
      clientX: this.x, clientY: this.y, screenX: this.x, screenY: this.y, buttons: this.buttons, ...extra,
    });
    return t.dispatchEvent(ev);
  }
}

const btnBit = (b) => (b === 1 ? 2 : b === 2 ? 1 : b);   // MouseEvent.button -> MouseEvent.buttons bit
function scrollUnder(el, dy) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) { n.scrollTop += dy; return; }
  }
}
