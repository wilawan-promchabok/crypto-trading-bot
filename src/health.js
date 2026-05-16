import { createServer } from 'http';

export function startHealthServer() {
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Math.floor(process.uptime()) }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`✅ Health server running on port ${port}`);
  });
}
