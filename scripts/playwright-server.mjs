import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const webDist = resolve(root, 'apps/web/dist');
const host = '127.0.0.1';
const port = Number.parseInt(process.env.PLAYWRIGHT_WEB_PORT ?? '4387', 10);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function buildWeb() {
  const pnpmCli = process.env.npm_execpath;
  const executable =
    pnpmCli && existsSync(pnpmCli)
      ? process.execPath
      : process.platform === 'win32'
        ? 'pnpm.cmd'
        : 'pnpm';
  const args =
    pnpmCli && existsSync(pnpmCli)
      ? [pnpmCli, '--filter', '@yangbok/web', 'build']
      : ['--filter', '@yangbok/web', 'build'];
  const result = spawnSync(executable, args, {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    shell: process.platform === 'win32' && !(pnpmCli && existsSync(pnpmCli)),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Web production build failed with exit code ${String(result.status)}.`);
  }
}

function safeFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, '');
  const candidates = [
    resolve(webDist, relativePath),
    resolve(webDist, relativePath, 'index.html'),
    resolve(webDist, `${relativePath}.html`),
  ];
  const allowedRoot = `${webDist}${sep}`;
  return (
    candidates.find(
      (candidate) =>
        candidate.startsWith(allowedRoot) && existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
}

function serveFile(response, path, statusCode = 200) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes.get(extname(path)) ?? 'application/octet-stream',
  });
  createReadStream(path).pipe(response);
}

buildWeb();

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const url = new URL(request.url ?? '/', `http://${host}:${String(port)}`);
  const file = safeFile(url.pathname);
  if (file) {
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes.get(extname(file)) ?? 'application/octet-stream',
      });
      response.end();
    } else {
      serveFile(response, file);
    }
    return;
  }

  const notFound = resolve(webDist, '404.html');
  if (existsSync(notFound)) serveFile(response, notFound, 404);
  else response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
});

server.listen(port, host, () => {
  console.log(`[playwright-server] http://${host}:${String(port)}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
