import { writeAliasLog } from './_private/logger';
import { redactValue } from './_private/redaction';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  writeAliasLog(redactValue(payload) as any);
  res.status(204).end();
}
