const BLOCKLIST: RegExp[] = [
  /\bopenai\b/gi,
  /\banthropic\b/gi,
  /\bgoogle\b/gi,
  /\bmeta\b/gi,
  /\bmistral\b/gi,
  /\bxai\b/gi,
  /\bgemini\b/gi,
  /\bclaude\b/gi,
  /\bllama\b/gi,
  /\bmixtral\b/gi,
  /\bwhisper\b/gi,
  /\bgpt(?:-[a-z0-9.-]+)?\b/gi,
  /\bo\d(?:-[a-z0-9.-]+)?\b/gi,
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /https?:\/\/[^\s"']+/gi,
  /\b(?:api[_-]?key|authorization|bearer)\b[:=]?\s*[a-z0-9._-]+/gi,
  /\b(?:github_pat_[a-z0-9_]+)\b/gi,
  /\b(?:sk-[a-z0-9]{12,})\b/gi,
];

const MAX_RECURSION_DEPTH = 5;

export function redactString(input: string) {
  let value = input;
  for (const pattern of BLOCKLIST) {
    value = value.replace(pattern, '[redacted]');
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    value = value.replace(pattern, '[redacted]');
  }
  return value;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_RECURSION_DEPTH) {
    return '[redacted]';
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = /(provider|model|endpoint|key|secret|token|region|deployment)/i.test(
        key
      );
      output[key] = isSensitiveKey ? '[redacted]' : redactValue(inner, depth + 1);
    }
    return output;
  }
  return value;
}

export function classifyError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('timeout')) return 'timeout';
  if (text.includes('rate') || text.includes('quota') || text.includes('429')) {
    return 'rate_limited';
  }
  if (text.includes('401') || text.includes('403') || text.includes('auth')) {
    return 'auth';
  }
  if (text.includes('tool')) return 'tool_failure';
  return 'service_unavailable';
}

export function toUserFacingAliasError(aliasName: string, errorMessage: string) {
  const kind = classifyError(errorMessage);
  if (kind === 'timeout') {
    return `${aliasName} is taking longer than expected. Please try again.`;
  }
  if (kind === 'rate_limited') {
    return `${aliasName} is temporarily unavailable. Switching to a fallback route.`;
  }
  if (kind === 'auth') {
    return `${aliasName} is temporarily unavailable. Please try again shortly.`;
  }
  return `${aliasName} is temporarily unavailable. Please try again shortly.`;
}
