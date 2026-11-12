// Builds the offline web version for GitHub Pages: copies app/ to _site/ and
// writes a service worker that precaches every file.
// Usage: node tools/build-web.js  (then serve _site/ over http)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const appDir = path.join(root, 'app');
const outDir = path.join(root, '_site');

function listFiles(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.name === '.DS_Store' || e.name === 'Thumbs.db') return [];
    return e.isDirectory() ? listFiles(path.join(dir, e.name), r) : [r];
  });
}

const files = listFiles(appDir).sort();
const hash = crypto.createHash('sha256');
for (const f of files) {
  hash.update(f);
  hash.update(fs.readFileSync(path.join(appDir, f)));
}
const VERSION = hash.digest('hex').slice(0, 12);
const FILES = ['./', ...files];

const sw = `const VERSION = ${JSON.stringify(VERSION)};
const FILES = ${JSON.stringify(FILES, null, 2)};
const CACHE = 'openings-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('openings-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(res => {
    if (!res) return fetch(req);
    const range = req.headers.get('range');
    return range ? partial(res, range) : res;
  }));
});

// Safari plays <audio> only from 206 responses to its Range requests.
async function partial(res, range) {
  const body = await res.blob(), size = body.size;
  const m = /^bytes=(\\d*)-(\\d*)$/.exec(range.trim()) || [];
  const start = m[1] ? +m[1] : m[2] ? Math.max(0, size - +m[2]) : NaN;
  const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (!(start <= end)) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
`;

fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(appDir, outDir, { recursive: true, filter: src => !/(^|[\\/])(\.DS_Store|Thumbs\.db)$/.test(src) });
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
console.log(`_site/ built: ${files.length} files, cache openings-${VERSION}`);
