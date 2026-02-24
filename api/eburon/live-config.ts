import { getPublicAlias, resolvePrivateAlias } from './_private/alias-resolution';
import { classifyError, toUserFacingAliasError } from './_private/redaction';
import { writeAliasLog } from './_private/logger';

const DEFAULT_ALIAS_ID = 'echo-v1.0';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const aliasId = String(req.query?.alias_id || DEFAULT_ALIAS_ID);
  const publicAlias = getPublicAlias(aliasId);
  const privateResolution = resolvePrivateAlias(aliasId);

  if (!publicAlias || !privateResolution) {
    writeAliasLog({
      alias: aliasId,
      task_type: 'audio',
      error_class: classifyError('unknown_alias'),
    });
    res.status(404).json({
      alias_id: aliasId,
      error: toUserFacingAliasError('orbit', 'unknown_alias'),
    });
    return;
  }

  const liveUrl =
    process.env.EBURON_LIVE_WS_URL ||
    (process.env.VERCEL_URL ? `wss://${process.env.VERCEL_URL}/api/eburon/live` : '/api/eburon/live');

  res.status(200).json({
    alias_id: publicAlias.alias_id,
    alias_name: publicAlias.alias_name,
    alias_version: publicAlias.alias_version,
    capabilities: publicAlias.capabilities,
    limits: publicAlias.limits,
    status: publicAlias.status,
    live_url: liveUrl,
  });
}
