import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = Number(process.env.PORT || 8787);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function tryServeStatic(pathname, res) {
  try {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(DIST_DIR, path.normalize(safePath));
    if (!fullPath.startsWith(DIST_DIR)) return false;

    let target = fullPath;
    try {
      const stat = await fs.stat(target);
      if (stat.isDirectory()) target = path.join(target, 'index.html');
    } catch {
      target = path.join(DIST_DIR, 'index.html');
    }

    const content = await fs.readFile(target);
    const ext = path.extname(target);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (handled) return;

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const served = await tryServeStatic(url.pathname, res);
  if (served) return;

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kavcy Zero-Knowledge Sync Server running on http://0.0.0.0:${PORT}`);
});
