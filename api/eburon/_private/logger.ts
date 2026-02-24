import { redactValue } from './redaction';

type AliasTelemetryEvent = {
  alias: string;
  task_type: 'chat' | 'code' | 'vision' | 'audio';
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  error_class?: string;
  [key: string]: unknown;
};

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function writeAliasLog(input: AliasTelemetryEvent) {
  const safePayload = redactValue({
    alias: input.alias || 'orbit-v3.2',
    task_type: input.task_type || 'chat',
    latency_ms: toNumber(input.latency_ms),
    input_tokens: toNumber(input.input_tokens),
    output_tokens: toNumber(input.output_tokens),
    cost_usd: toNumber(input.cost_usd),
    error_class: input.error_class || undefined,
    timestamp: new Date().toISOString(),
  });

  console.info(JSON.stringify(safePayload));
}
