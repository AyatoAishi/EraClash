// Adds a patch-notes entry (js/patchnotes.js) for every pushed commit that didn't write one by hand.
// Run by .github/workflows/patch-notes.yml on every push to main. Node 20, no dependencies.
//
// Commit message format (see CONTRIBUTING.md):
//   v0.12.0: Short title          <- optional explicit version, otherwise it auto-bumps
//   - First change                <- each "- " line becomes one patch-note item
//   - Second change
// Subject starting with "feat:" / "[minor]" bumps the MINOR version, anything else bumps PATCH.
// Skipped: commits that already edit js/patchnotes.js, commits containing [skip notes] / [skip ci], bot commits.
import fs from 'node:fs';

const FILE = 'js/patchnotes.js';
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
let src = fs.readFileSync(FILE, 'utf8');

const latest = () => (src.match(/version: '(\d+)\.(\d+)\.(\d+)'/) || [0, 0, 0, 0]).slice(1).map(Number);
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").trim();
const pht = (iso) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600e3);
  return d.toISOString().slice(0, 19) + '+08:00';
};

let added = 0;
for (const c of event.commits || []) {
  const msg = c.message || '';
  const files = [...(c.added || []), ...(c.modified || [])];
  if (files.includes(FILE)) continue;                                   // notes written by hand
  if (/\[skip (notes|ci)\]/i.test(msg)) continue;
  if (/\[bot\]$/.test(c.author?.username || '') || c.author?.name === 'github-actions[bot]') continue;
  if (!files.some((f) => /^(js|css|index\.html|vendor)/.test(f))) continue;   // docs-only / tooling commits don't need notes

  const lines = msg.split('\n').map((l) => l.trim()).filter((l) => !/^(co-authored-by|signed-off-by|claude-session):/i.test(l));
  let subject = lines[0] || 'Update';
  let version;
  const m = subject.match(/^v?(\d+\.\d+\.\d+)\s*[:\-–]\s*(.*)$/);
  if (m) { version = m[1]; subject = m[2] || 'Update'; }
  else {
    const [a, b, p] = latest();
    const minor = /^(feat(\(.+\))?:|\[minor\])/i.test(subject);
    version = minor ? `${a}.${b + 1}.0` : `${a}.${b}.${p + 1}`;
    subject = subject.replace(/^(feat|fix|balance|chore|ui)(\(.+\))?:\s*|^\[(minor|patch)\]\s*/i, '');
  }
  if (src.includes(`version: '${version}'`)) continue;                 // already noted
  const items = lines.slice(1).filter((l) => /^[-*] /.test(l)).map((l) => l.slice(2));
  if (!items.length) items.push(subject);
  const author = c.author?.username || c.author?.name || 'unknown';
  const entry = `  {
    version: '${version}', date: '${pht(c.timestamp)}', title: '${esc(subject)}', author: '${esc(author)}',
    sections: [
      { title: 'Changes', items: [
${items.map((i) => `        '${esc(i)}',`).join('\n')}
      ] },
    ],
  },
`;
  src = src.replace('export const PATCH_NOTES = [\n', 'export const PATCH_NOTES = [\n' + entry);
  added++;
  console.log(`+ v${version} ${subject} (${author})`);
}
if (added) fs.writeFileSync(FILE, src);
console.log(added ? `Added ${added} patch-note entr${added > 1 ? 'ies' : 'y'}.` : 'Nothing to add.');
