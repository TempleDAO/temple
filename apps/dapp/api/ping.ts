import { VercelRequest, VercelResponse } from '@vercel/node';
const handler = async (_req: VercelRequest, res: VercelResponse) => res.send('pong');
export default handler;
