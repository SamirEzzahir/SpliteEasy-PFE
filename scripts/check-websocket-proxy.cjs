/* Exercises Next's real external rewrite with a local WebSocket backend. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const WS = require('../frontend/node_modules/next/dist/compiled/ws');
const next = require('../frontend/node_modules/next');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

(async () => {
  const backend = http.createServer();
  const sockets = new WS.Server({ server: backend });
  let requestPath;
  sockets.on('connection', (socket, request) => {
    requestPath = request.url;
    socket.on('message', data => socket.send(data.toString() === 'ping' ? 'pong' : data.toString()));
  });
  await listen(backend);
  process.env.NEXT_PUBLIC_API_URL = '';
  process.env.SPLITEASY_NEXT_DIST_DIR = 'out/websocket-check';
  process.env.BACKEND_PROXY_TARGET = `http://127.0.0.1:${backend.address().port}`;
  const dir = path.join(__dirname, '../frontend');
  const tsconfig = path.join(dir, 'tsconfig.json');
  const originalTsconfig = fs.readFileSync(tsconfig);
  const { default: config } = await import(pathToFileURL(path.join(dir, 'next.config.mjs')).href);
  const app = next({ dev: true, dir, conf: { ...config, distDir: 'out/websocket-check' } });
  let frontend, client;
  try {
    await app.prepare();
    frontend = http.createServer(app.getRequestHandler());
    await listen(frontend);
    // The custom server installs Next's rewrite-aware upgrade handler on its
    // first HTTP request (the inherited getUpgradeHandler only handles HMR).
    await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${frontend.address().port}/branding/app-icon.png`, response => {
        response.resume(); response.on('end', resolve);
      }).on('error', reject);
    });
    client = new WS(`ws://127.0.0.1:${frontend.address().port}/api/Notifications/ws/test-user?token=test-only`);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('WebSocket proxy timed out')), 15000);
      client.on('open', () => client.send('ping'));
      client.on('error', reject);
      client.on('message', data => {
        try {
          assert.equal(data.toString(), 'pong');
          assert.equal(requestPath, '/Notifications/ws/test-user?token=test-only');
          clearTimeout(timeout); resolve();
        } catch (error) { reject(error); }
      });
    });
    console.log('PASS: Next /api rewrite upgrades WebSockets, preserves authentication query and returns pong.');
  } finally {
    client?.terminate();
    for (const socket of sockets.clients) socket.terminate();
    sockets.close(); backend.close(); frontend?.close(); await app.close();
    fs.writeFileSync(tsconfig, originalTsconfig);
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
