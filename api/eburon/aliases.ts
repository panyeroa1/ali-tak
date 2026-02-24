import { listPublicAliases } from './_private/alias-resolution';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    aliases: listPublicAliases(),
  });
}
