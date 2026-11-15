import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleMcpRequest } from '../src/server/mcp-handler.js';

export const config = { api: { bodyParser: false }, maxDuration: 15 };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleMcpRequest(req, res);
}
