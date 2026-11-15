import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleReconcileRequest } from '../src/server/reconcile-handler.js';

export const config = { api: { bodyParser: false }, maxDuration: 15 };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handleReconcileRequest(req, res);
}
