type AliasName = 'orbit' | 'codemax' | 'echo' | 'vision';

export interface PublicAliasRecord {
  alias_id: string;
  alias_name: AliasName;
  alias_version: string;
  capabilities: string[];
  limits: {
    max_context: number;
    tokens_per_second: number;
    max_output: number;
  };
  default_temperature: number;
  status: 'healthy' | 'degraded';
}

export interface PrivateAliasResolution {
  alias_name: AliasName;
  alias_version: string;
  provider_id: string;
  provider_model_id: string;
  endpoint_ref: string;
  key_ref: string;
  routing_policy: {
    primary: string;
    fallbacks: string[];
    weights?: Record<string, number>;
  };
}

const PUBLIC_ALIAS_CATALOG: PublicAliasRecord[] = [
  {
    alias_id: 'orbit-v3.2',
    alias_name: 'orbit',
    alias_version: 'v3.2',
    capabilities: [
      'Reasoning: long-context',
      'Reasoning: tool use',
      'Reasoning: structured output',
    ],
    limits: { max_context: 128000, tokens_per_second: 70, max_output: 8192 },
    default_temperature: 0.2,
    status: 'healthy',
  },
  {
    alias_id: 'codemax-v2.4',
    alias_name: 'codemax',
    alias_version: 'v2.4',
    capabilities: [
      'Code: repo-aware edits',
      'Code: patch generation',
      'Code: refactor support',
    ],
    limits: { max_context: 256000, tokens_per_second: 50, max_output: 8192 },
    default_temperature: 0.1,
    status: 'healthy',
  },
  {
    alias_id: 'vision-v1.1',
    alias_name: 'vision',
    alias_version: 'v1.1',
    capabilities: [
      'Vision: image understanding',
      'Vision: OCR-like extraction',
      'Vision: chart reading',
    ],
    limits: { max_context: 64000, tokens_per_second: 40, max_output: 4096 },
    default_temperature: 0.2,
    status: 'healthy',
  },
  {
    alias_id: 'echo-v1.0',
    alias_name: 'echo',
    alias_version: 'v1.0',
    capabilities: [
      'Audio: speech-to-text',
      'Audio: text-to-speech',
      'Audio: conversational turn-taking',
    ],
    limits: { max_context: 64000, tokens_per_second: 35, max_output: 4096 },
    default_temperature: 0.3,
    status: 'healthy',
  },
];

const PRIVATE_RESOLUTION_TABLE: Record<string, PrivateAliasResolution> = {
  'orbit-v3.2': {
    alias_name: 'orbit',
    alias_version: 'v3.2',
    provider_id: process.env.EBURON_ORBIT_PROVIDER_ID || 'provider-orbit-primary',
    provider_model_id:
      process.env.EBURON_ORBIT_PROVIDER_MODEL_ID || 'model-orbit-reasoning',
    endpoint_ref:
      process.env.EBURON_ORBIT_ENDPOINT_REF || 'endpoint://orbit-primary',
    key_ref: process.env.EBURON_ORBIT_KEY_REF || 'secret://orbit-key',
    routing_policy: {
      primary: 'orbit-primary-route',
      fallbacks: ['orbit-fallback-route-a', 'orbit-fallback-route-b'],
      weights: {
        'orbit-primary-route': 90,
        'orbit-fallback-route-a': 7,
        'orbit-fallback-route-b': 3,
      },
    },
  },
  'codemax-v2.4': {
    alias_name: 'codemax',
    alias_version: 'v2.4',
    provider_id: process.env.EBURON_CODEMAX_PROVIDER_ID || 'provider-codemax-primary',
    provider_model_id:
      process.env.EBURON_CODEMAX_PROVIDER_MODEL_ID || 'model-codemax-code',
    endpoint_ref:
      process.env.EBURON_CODEMAX_ENDPOINT_REF || 'endpoint://codemax-primary',
    key_ref: process.env.EBURON_CODEMAX_KEY_REF || 'secret://codemax-key',
    routing_policy: {
      primary: 'codemax-primary-route',
      fallbacks: ['codemax-fallback-route-a'],
      weights: {
        'codemax-primary-route': 95,
        'codemax-fallback-route-a': 5,
      },
    },
  },
  'vision-v1.1': {
    alias_name: 'vision',
    alias_version: 'v1.1',
    provider_id: process.env.EBURON_VISION_PROVIDER_ID || 'provider-vision-primary',
    provider_model_id:
      process.env.EBURON_VISION_PROVIDER_MODEL_ID || 'model-vision-image',
    endpoint_ref:
      process.env.EBURON_VISION_ENDPOINT_REF || 'endpoint://vision-primary',
    key_ref: process.env.EBURON_VISION_KEY_REF || 'secret://vision-key',
    routing_policy: {
      primary: 'vision-primary-route',
      fallbacks: ['vision-fallback-route-a'],
      weights: {
        'vision-primary-route': 92,
        'vision-fallback-route-a': 8,
      },
    },
  },
  'echo-v1.0': {
    alias_name: 'echo',
    alias_version: 'v1.0',
    provider_id: process.env.EBURON_ECHO_PROVIDER_ID || 'provider-echo-primary',
    provider_model_id:
      process.env.EBURON_ECHO_PROVIDER_MODEL_ID || 'model-echo-audio',
    endpoint_ref: process.env.EBURON_ECHO_ENDPOINT_REF || 'endpoint://echo-primary',
    key_ref: process.env.EBURON_ECHO_KEY_REF || 'secret://echo-key',
    routing_policy: {
      primary: 'echo-primary-route',
      fallbacks: ['echo-fallback-route-a'],
      weights: {
        'echo-primary-route': 90,
        'echo-fallback-route-a': 10,
      },
    },
  },
};

export function listPublicAliases() {
  return PUBLIC_ALIAS_CATALOG;
}

export function getPublicAlias(aliasId: string) {
  return PUBLIC_ALIAS_CATALOG.find(alias => alias.alias_id === aliasId) || null;
}

export function resolvePrivateAlias(aliasId: string) {
  return PRIVATE_RESOLUTION_TABLE[aliasId] || null;
}
