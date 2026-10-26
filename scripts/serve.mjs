// The local copy of the site: serves SITE_DIR (default `site`) as the host would,
// for what the criteria touch and nothing more.
// - `/` is `index.html`; any other path is the file at that path.
// - A path with no file answers `404.html` with status 404 (a bare 404 if there is none).
// - `_headers` is applied for its `/*` rule and never served. The server refuses to start
//   if `_headers` has a rule for any other path, so the local copy cannot silently differ.
// Usage: node scripts/serve.mjs [--port 8788] [--dir site]   (or PORT and SITE_DIR)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { port: { type: 'string' }, dir: { type: 'string' } },
});
const port = Number(values.port ?? process.env.PORT ?? 8788);
const root = resolve(values.dir ?? (process.env.SITE_DIR || 'site'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

// Reads `_headers`: rules start at column 0, header lines are indented `Name: value`.
function parseHeaders(text) {
  const rules = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = raw.trim();
      rules.set(current, rules.get(current) ?? []);
      continue;
    }
    if (current === null) throw new Error(`_headers: a header line before any path: "${raw.trim()}"`);
    const colon = raw.indexOf(':');
    if (colon === -1) throw new Error(`_headers: not a "Name: value" line: "${raw.trim()}"`);
    rules.get(current).push([raw.slice(0, colon).trim(), raw.slice(colon + 1).trim()]);
  }
  return rules;
}

function loadHeaders() {
  const file = join(root, '_headers');
  if (!existsSync(file)) return [];
  const rules = parseHeaders(readFileSync(file, 'utf8'));
  for (const path of rules.keys()) {
    if (path !== '/*') {
      throw new Error(
        `_headers has a rule for "${path}"; the local server applies only "/*", ` +
          'so it would differ from the host. Use "/*" or extend scripts/serve.mjs.',
      );
    }
  }
  return rules.get('/*') ?? [];
}

async function fileFor(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative === '_headers' || relative.includes('\0')) return null;
  const full = resolve(root, relative);
  if (full !== root && !full.startsWith(root + sep)) return null;
  try {
    return (await stat(full)).isFile() ? full : null;
  } catch {
    return null;
  }
}

const headers = loadHeaders();

const server = createServer(async (req, res) => {
  for (const [name, value] of headers) res.setHeader(name, value);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const { pathname } = new URL(req.url, 'http://localhost');
  let status = 200;
  let file = await fileFor(pathname);
  if (file === null) {
    status = 404;
    file = await fileFor('/404.html');
  }
  if (file === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found\n');
    return;
  }
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}/`);
});
