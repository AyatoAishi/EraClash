// Zero-dependency static server for Era Clash.  Run:  node server.js   (then open http://localhost:8080)
//
// Auto-update: if this folder is a git clone of the repo, the server pulls new commits from GitHub
// every minute while it runs (fast-forward only — it never merges over your own unpushed work).
// The game polls /__build and shows "Update downloaded" so you can refresh.
// Disable with:  set NO_AUTOPULL=1
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.md': 'text/plain' };

// ---------- auto pull ----------
const IS_GIT = fs.existsSync(path.join(ROOT, '.git'));
let build = { hash: 'local', subject: '', pulledAt: null, status: IS_GIT ? 'starting' : 'not a git clone (run setup-git.bat once)' };
const git = (args) => new Promise((res) => execFile('git', args, { cwd: ROOT, windowsHide: true }, (err, out, errOut) => res({ ok: !err, out: (out || '').trim(), err: (errOut || '').trim() })));

async function readHead() {
  const h = await git(['log', '-1', '--format=%h|%s']);
  if (h.ok) { const [hash, ...s] = h.out.split('|'); build.hash = hash; build.subject = s.join('|'); }
}
async function autoPull() {
  if (!IS_GIT || process.env.NO_AUTOPULL) return;
  const f = await git(['fetch', 'origin', 'main']);
  if (!f.ok) { build.status = 'offline / fetch failed'; return; }
  const behind = await git(['rev-list', '--count', 'HEAD..origin/main']);
  if (!behind.ok || behind.out === '0') { build.status = 'up to date'; return; }
  const p = await git(['merge', '--ff-only', 'origin/main']);
  if (p.ok) {
    await readHead();
    build.pulledAt = Date.now(); build.status = 'updated';
    console.log(`  [auto-update] pulled ${behind.out} new commit(s) -> ${build.hash} ${build.subject}`);
  } else {
    build.status = 'local changes block the update — push or stash them (see push.bat)';
    console.log('  [auto-update] could not fast-forward: you have local commits/changes. Run push.bat (it pulls + pushes).');
  }
}

// ---------- PvP relay (Online 1v1) ----------
// A tiny zero-dependency WebSocket server on /ws. The HOST's browser runs the match; this only pairs two players
// by a room code and passes their messages through. Messages are JSON: { t: 'create' | 'join' | 'relay' | 'leave', ... }.
const crypto = require('crypto');
const rooms = new Map();   // code -> { host, guest, hostFaction }
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(c)); return c; };
function wsSend(sock, obj) {
  if (sock.destroyed) return;
  const data = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
  const n = data.length, head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
  sock.write(Buffer.concat([head, data]));
}
function wsClose(sock) { try { if (!sock.destroyed) sock.end(Buffer.from([0x88, 0])); } catch {} }
function leaveRoom(sock) {
  const code = sock.room; if (!code) return;
  sock.room = null;
  const R = rooms.get(code); if (!R) return;
  const other = R.host === sock ? R.guest : R.host;
  rooms.delete(code);
  if (other) { other.room = null; wsSend(other, { t: 'peerLeft' }); }
}
function onWsMessage(sock, text) {
  let m; try { m = JSON.parse(text); } catch { return; }
  if (m.t === 'relay') {   // the hot path: forward as-is to the other player
    const R = sock.room && rooms.get(sock.room); if (!R) return;
    const other = R.host === sock ? R.guest : R.host;
    if (other) wsSend(other, text);
  } else if (m.t === 'create') {
    leaveRoom(sock);
    const code = newCode();
    rooms.set(code, { host: sock, guest: null, hostFaction: m.faction === 'modern' ? 'modern' : 'medieval', name: String(m.name || '').slice(0, 20) });
    sock.room = code;
    wsSend(sock, { t: 'room', code });
  } else if (m.t === 'join') {
    const code = String(m.code || '').toUpperCase().trim(), R = rooms.get(code);
    if (!R) return wsSend(sock, { t: 'error', msg: 'No room with that code' });
    if (R.guest) return wsSend(sock, { t: 'error', msg: 'That room is full' });
    if (R.host === sock) return wsSend(sock, { t: 'error', msg: "That's your own room" });
    leaveRoom(sock);
    R.guest = sock; sock.room = code;
    wsSend(sock, { t: 'joined', code, hostFaction: R.hostFaction, hostName: R.name });
    wsSend(R.host, { t: 'peer', name: String(m.name || '').slice(0, 20) });
  } else if (m.t === 'leave') leaveRoom(sock);
}
function acceptWs(req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  let buf = Buffer.alloc(0), frag = [];
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 8 * 1024 * 1024) return sock.destroy();   // nothing legit is this big
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      const mask = masked ? buf.subarray(off, off + 4) : null; off += masked ? 4 : 0;
      const data = Buffer.from(buf.subarray(off, off + len));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(need);
      if (op === 8) { wsClose(sock); sock.destroy(); return; }
      if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }   // ping -> pong
      if (op === 10) continue;
      if (op === 0 || op === 1) { frag.push(data); if (fin) { const t = Buffer.concat(frag).toString('utf8'); frag = []; onWsMessage(sock, t); } }
    }
  });
  const ping = setInterval(() => { if (!sock.destroyed) sock.write(Buffer.from([0x89, 0])); }, 25000);   // keeps hosting proxies from closing idle sockets
  const bye = () => { clearInterval(ping); leaveRoom(sock); };
  sock.on('close', bye); sock.on('error', bye);
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/__health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + rooms.size + ' rooms'); }
  if (p === '/__build') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(build));
  }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.git`)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
server.on('upgrade', (req, sock) => { if (req.url.split('?')[0] === '/ws') acceptWs(req, sock); else sock.destroy(); });
server.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  ERA CLASH running at ${url}\n  Ctrl+C to stop.\n`);
  if (IS_GIT) { await readHead(); console.log(`  Build ${build.hash}: ${build.subject}\n  Auto-update: checking GitHub every 60s\n`); }
  else console.log('  Auto-update is off: this folder is not a git clone (run setup-git.bat once).\n');
  autoPull(); setInterval(autoPull, 60 * 1000);
  if (!process.env.NO_OPEN) {
    const cmd = process.platform === 'win32' ? `start "" ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(cmd, () => {});
  }
});
