import { TaskType } from './eburon-types';

type AliasLogEvent = {
  alias: string;
  task_type: TaskType;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  error_class?: string;
};

export function logAliasEvent(event: AliasLogEvent) {
  if (typeof window === 'undefined') {
    return;
  }

  fetch('/api/eburon/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    }),
    keepalive: true,
  }).catch(() => null);
}
