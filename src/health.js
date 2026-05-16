import { createServer } from 'http';
import { client } from './client.js';

export function startHealthServer() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const connected = client.ws.status === 0; // 0 = READY
      const status = connected ? 'ok' : 'degraded';
      res.writeHead(connected ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status,
        uptime: Math.floor(process.uptime()),
        discord: connected ? 'connected' : 'disconnected',
        ping: client.ws.ping,
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`✅ Health server running on port ${port}`);
    startSelfPing(port);
  });
}

// ─── Self-ping ทุก 14 นาที กัน Render spin down ──────────────────────────────
function startSelfPing(port) {
  // ใช้ RENDER_EXTERNAL_URL ถ้าอยู่บน Render, fallback localhost
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  const url  = `${base}/health`;

  setInterval(async () => {
    try {
      const res = await fetch(url);
      console.log(`[self-ping] ${url} → ${res.status}`);
    } catch (err) {
      console.warn(`[self-ping] failed:`, err.message);
    }
  }, 14 * 60 * 1000); // 14 นาที

  console.log(`✅ Self-ping active (every 14 min → ${url})`);
}
