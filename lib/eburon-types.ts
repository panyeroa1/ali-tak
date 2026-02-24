export const Modality = {
  AUDIO: 'audio',
  TEXT: 'text',
  IMAGE: 'image',
} as const;

export type Modality = (typeof Modality)[keyof typeof Modality];

export const FunctionResponseScheduling = {
  INTERRUPT: 'interrupt',
  WHEN_IDLE: 'when_idle',
  SILENT: 'silent',
} as const;

export type FunctionResponseScheduling =
  (typeof FunctionResponseScheduling)[keyof typeof FunctionResponseScheduling];

export type TaskType = 'chat' | 'code' | 'vision' | 'audio';

export type AliasName = 'orbit' | 'codemax' | 'echo' | 'vision';

export type JsonObject = Record<string, unknown>;

export interface FunctionResponse {
  id?: string;
  name?: string;
  response?: unknown;
}

export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}

export interface LiveServerToolCall {
  functionCalls: Array<{
    id?: string;
    name: string;
    args?: JsonObject;
  }>;
}

export interface LiveServerToolCallCancellation {
  ids?: string[];
}

export interface Part {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  [key: string]: unknown;
}

export interface LiveServerContent {
  interrupted?: boolean;
  inputTranscription?: {
    text: string;
    isFinal?: boolean;
  };
  outputTranscription?: {
    text: string;
    isFinal?: boolean;
  };
  modelTurn?: {
    parts?: Part[];
  };
  turnComplete?: boolean;
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
  };
}

export interface LiveServerMessage {
  setupComplete?: boolean;
  toolCall?: LiveServerToolCall;
  toolCallCancellation?: LiveServerToolCallCancellation;
  serverContent?: LiveServerContent;
}

export interface LiveConnectConfig extends JsonObject {
  responseModalities?: Modality[];
  speechConfig?: {
    voiceConfig?: {
      prebuiltVoiceConfig?: {
        voiceName?: string;
      };
    };
  };
  inputAudioTranscription?: JsonObject;
  outputAudioTranscription?: JsonObject;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  alias_id?: string;
  alias_name?: AliasName;
  alias_version?: string;
}

export interface PublicAlias {
  alias_id: string;
  alias_name: AliasName;
  alias_version: string;
  capabilities: string[];
  limits: {
    max_context: number;
    tokens_per_second: number;
    max_output: number;
  };
  status: 'healthy' | 'degraded';
  default_temperature: number;
}
