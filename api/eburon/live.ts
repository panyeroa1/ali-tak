import { toUserFacingAliasError } from './_private/redaction';

export default function handler(req: any, res: any) {
  if (req.method === 'GET') {
    res.status(200).json({
      status: 'ok',
      message: 'Eburon live route is available.',
    });
    return;
  }

  res.status(426).json({
    error: toUserFacingAliasError('echo', 'upgrade_required'),
  });
}
