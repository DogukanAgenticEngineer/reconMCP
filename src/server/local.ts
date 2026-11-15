import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { handleMcpRequest } from './mcp-handler.js';
import { handleReconcileRequest } from './reconcile-handler.js';

const app = express();
app.disable('x-powered-by');
app.all('/api/mcp', (req, res) => { void handleMcpRequest(req, res); });
app.all('/api/reconcile', (req, res) => { void handleReconcileRequest(req, res); });

const server = createServer(app);
const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { server } },
  appType: 'spa',
});
app.use(vite.middlewares);
app.use((_req, res) => { res.status(404).end('Not Found'); });

const port = Number(process.env.PORT ?? 3000);
server.listen(port, '0.0.0.0');
