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

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
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
}).listen(PORT, async () => {
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
