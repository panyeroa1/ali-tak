import EventEmitter from 'eventemitter3';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';
import {
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  TaskType,
} from './eburon-types';

export interface StreamingLog {
  count?: number;
  data?: unknown;
  date: Date;
  message: string | object;
  type: string;
}

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  turncomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
}

type AliasTelemetryEvent = {
  alias: string;
  task_type: TaskType;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  error_class?: string;
};

type NormalizedWireMessage =
  | LiveServerMessage
  | {
      type: 'error';
      message?: string;
    };

const DEFAULT_EBURON_LIVE_PATH = '/api/eburon/live';

export class GenAILiveClient {
  private readonly emitter = new EventEmitter<LiveClientEventTypes>();

  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  private socket?: WebSocket;
  private activeAliasId = 'echo-v1.0';
  private lastTurnStartedAt: number | null = null;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  constructor(private readonly liveBaseUrl: string) {}

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this.activeAliasId = config.alias_id || this.activeAliasId;
    this._status = 'connecting';

    const wsUrl = this.buildSocketUrl(config);

    return new Promise(resolve => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      try {
        this.socket = new WebSocket(wsUrl);
      } catch {
        this.onError(
          new ErrorEvent('error', {
            message: this.toAliasErrorMessage('connect_failed'),
          })
        );
        settle(false);
        return;
      }

      const openTimeout = window.setTimeout(() => {
        if (this._status === 'connecting') {
          this.onError(
            new ErrorEvent('error', {
              message: this.toAliasErrorMessage('timeout'),
            })
          );
          this.socket?.close();
          settle(false);
        }
      }, 12000);

      this.socket.onopen = () => {
        window.clearTimeout(openTimeout);
        this._status = 'connected';
        this.emitter.emit('open');
        this.log('session.open', 'Connected');
        this.sendWire({
          type: 'session.start',
          payload: {
            config,
          },
        });
        settle(true);
      };

      this.socket.onmessage = event => {
        const normalized = this.normalizeWireMessage(event.data);
        if (!normalized) {
          return;
        }

        if ((normalized as { type?: string }).type === 'error') {
          this.onError(
            new ErrorEvent('error', {
              message: this.toAliasErrorMessage(
                (normalized as { message?: string }).message
              ),
            })
          );
          return;
        }

        this.onMessage(normalized as LiveServerMessage);
      };

      this.socket.onerror = () => {
        this.onError(
          new ErrorEvent('error', {
            message: this.toAliasErrorMessage('transport_error'),
          })
        );
        settle(false);
      };

      this.socket.onclose = event => {
        window.clearTimeout(openTimeout);
        this.onClose(event);
      };
    });
  }

  public disconnect() {
    this.sendWire({ type: 'session.stop' });
    this.socket?.close();
    this.socket = undefined;
    this._status = 'disconnected';
    this.log('session.close', 'Disconnected');
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (!this.socket || this._status !== 'connected') {
      this.onError(
        new ErrorEvent('error', {
          message: this.toAliasErrorMessage('not_connected'),
        })
      );
      return;
    }

    this.markTurnStart();
    this.sendWire({
      type: 'session.client_content',
      payload: {
        turns: Array.isArray(parts) ? parts : [parts],
        turnComplete,
      },
    });
    this.log('session.client_content', 'content_sent');
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (!this.socket || this._status !== 'connected') {
      this.onError(
        new ErrorEvent('error', {
          message: this.toAliasErrorMessage('not_connected'),
        })
      );
      return;
    }

    this.markTurnStart();
    this.sendWire({
      type: 'session.realtime_input',
      payload: {
        chunks,
      },
    });

    let taskType: TaskType = 'audio';
    const hasImage = chunks.some(chunk => chunk.mimeType.includes('image'));
    if (hasImage) {
      taskType = 'vision';
    }
    this.logAliasTelemetry({ alias: this.activeAliasId, task_type: taskType });
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (!this.socket || this._status !== 'connected') {
      this.onError(
        new ErrorEvent('error', {
          message: this.toAliasErrorMessage('not_connected'),
        })
      );
      return;
    }

    this.sendWire({
      type: 'session.tool_response',
      payload: {
        functionResponses: toolResponse.functionResponses || [],
      },
    });
    this.log('session.tool_response', 'tool_response_sent');
  }

  protected onMessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }

    if (message.toolCall) {
      this.log('session.tool_call', 'tool_call');
      this.emitter.emit('toolcall', message.toolCall);
      return;
    }

    if (message.toolCallCancellation) {
      this.log('session.tool_call_cancellation', 'tool_call_cancellation');
      this.emitter.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (!message.serverContent) {
      return;
    }

    const { serverContent } = message;
    if (serverContent.interrupted) {
      this.log('session.interrupted', 'interrupted');
      this.emitter.emit('interrupted');
      return;
    }

    if (serverContent.inputTranscription) {
      this.emitter.emit(
        'inputTranscription',
        serverContent.inputTranscription.text,
        serverContent.inputTranscription.isFinal ?? false
      );
    }

    if (serverContent.outputTranscription) {
      this.emitter.emit(
        'outputTranscription',
        serverContent.outputTranscription.text,
        serverContent.outputTranscription.isFinal ?? false
      );
    }

    if (serverContent.modelTurn) {
      const parts: Part[] = serverContent.modelTurn.parts || [];
      const audioParts = parts.filter(p =>
        p.inlineData?.mimeType?.startsWith('audio/pcm')
      );
      const base64s = audioParts.map(p => p.inlineData?.data);
      const otherParts = difference(parts, audioParts);

      base64s.forEach(b64 => {
        if (!b64) return;
        const data = base64ToArrayBuffer(b64);
        this.emitter.emit('audio', data);
        this.log('session.audio', `buffer (${data.byteLength})`);
      });

      if (otherParts.length > 0) {
        const content: LiveServerContent = { modelTurn: { parts: otherParts } };
        this.emitter.emit('content', content);
        this.log('session.content', 'content');
      }
    }

    if (serverContent.turnComplete) {
      this.log('session.turn_complete', 'turn_complete');
      this.emitter.emit('turncomplete');
      this.logAliasTelemetry({
        alias: this.activeAliasId,
        task_type: 'audio',
        latency_ms:
          this.lastTurnStartedAt !== null
            ? Math.round(performance.now() - this.lastTurnStartedAt)
            : undefined,
      });
      this.lastTurnStartedAt = null;
    }
  }

  protected onError(e: ErrorEvent) {
    this._status = 'disconnected';
    this.logAliasTelemetry({
      alias: this.activeAliasId,
      task_type: 'audio',
      error_class: this.classifyError(e.message),
    });
    this.log('session.error', e.message);
    this.emitter.emit('error', e);
  }

  protected onClose(e: CloseEvent) {
    this._status = 'disconnected';
    this.log('session.close', 'disconnected');
    this.emitter.emit('close', e);
  }

  protected log(type: string, message: string | object) {
    this.emitter.emit('log', {
      type,
      message,
      date: new Date(),
    });
  }

  private markTurnStart() {
    if (this.lastTurnStartedAt === null) {
      this.lastTurnStartedAt = performance.now();
    }
  }

  private sendWire(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  private normalizeWireMessage(raw: unknown): NormalizedWireMessage | null {
    let parsed: any = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (
      parsed.setupComplete !== undefined ||
      parsed.toolCall !== undefined ||
      parsed.toolCallCancellation !== undefined ||
      parsed.serverContent !== undefined
    ) {
      return parsed as LiveServerMessage;
    }

    const type = parsed.type as string | undefined;
    const payload = parsed.payload ?? parsed.data ?? {};

    if (type === 'session.error') {
      return {
        type: 'error',
        message: payload?.message || parsed.message,
      };
    }

    if (type === 'session.setup_complete') {
      return { setupComplete: true };
    }

    if (type === 'session.tool_call') {
      return { toolCall: payload };
    }

    if (type === 'session.tool_call_cancellation') {
      return { toolCallCancellation: payload };
    }

    if (type === 'session.interrupted') {
      return { serverContent: { interrupted: true } };
    }

    if (type === 'session.turn_complete') {
      return { serverContent: { turnComplete: true } };
    }

    if (type === 'session.input_transcription') {
      return {
        serverContent: {
          inputTranscription: {
            text: payload?.text || '',
            isFinal: payload?.isFinal ?? false,
          },
        },
      };
    }

    if (type === 'session.output_transcription') {
      return {
        serverContent: {
          outputTranscription: {
            text: payload?.text || '',
            isFinal: payload?.isFinal ?? false,
          },
        },
      };
    }

    if (type === 'session.audio') {
      return {
        serverContent: {
          modelTurn: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/pcm',
                  data: payload?.data || payload?.base64 || '',
                },
              },
            ],
          },
        },
      };
    }

    if (type === 'session.content') {
      return { serverContent: payload };
    }

    return null;
  }

  private buildSocketUrl(config: LiveConnectConfig) {
    const rawBase = (this.liveBaseUrl || DEFAULT_EBURON_LIVE_PATH).trim();
    const baseWithPath =
      rawBase.endsWith('/live') || rawBase.endsWith('/live/')
        ? rawBase
        : `${rawBase.replace(/\/$/, '')}/live`;

    let resolved = baseWithPath;
    if (baseWithPath.startsWith('http://')) {
      resolved = `ws://${baseWithPath.slice('http://'.length)}`;
    } else if (baseWithPath.startsWith('https://')) {
      resolved = `wss://${baseWithPath.slice('https://'.length)}`;
    } else if (baseWithPath.startsWith('/')) {
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      resolved = `${scheme}//${window.location.host}${baseWithPath}`;
    }

    const url = new URL(resolved);
    if (config.alias_id) url.searchParams.set('alias_id', config.alias_id);
    if (config.alias_name) url.searchParams.set('alias_name', config.alias_name);
    if (config.alias_version) {
      url.searchParams.set('alias_version', config.alias_version);
    }
    return url.toString();
  }

  private classifyError(message: string) {
    const text = (message || '').toLowerCase();
    if (text.includes('timeout')) return 'timeout';
    if (text.includes('429') || text.includes('rate') || text.includes('quota')) {
      return 'rate_limited';
    }
    if (text.includes('401') || text.includes('403') || text.includes('auth')) {
      return 'auth';
    }
    if (text.includes('tool')) return 'tool_failure';
    return 'service_unavailable';
  }

  private toAliasErrorMessage(reason?: string) {
    const normalized = (reason || '').toLowerCase();
    const aliasName = this.activeAliasId.split('-')[0] || 'orbit';

    if (normalized.includes('timeout')) {
      return `${aliasName} is taking longer than expected. Please try again.`;
    }
    if (
      normalized.includes('429') ||
      normalized.includes('rate') ||
      normalized.includes('quota')
    ) {
      return `${aliasName} is temporarily unavailable. Switching to a fallback route.`;
    }
    if (
      normalized.includes('401') ||
      normalized.includes('403') ||
      normalized.includes('auth')
    ) {
      return `${aliasName} is temporarily unavailable. Please try again shortly.`;
    }
    return `${aliasName} is temporarily unavailable. Switching to a fallback route.`;
  }

  private logAliasTelemetry(event: AliasTelemetryEvent) {
    const payload = {
      ...event,
      latency_ms: event.latency_ms,
      input_tokens: event.input_tokens,
      output_tokens: event.output_tokens,
      cost_usd: event.cost_usd,
      error_class: event.error_class,
      timestamp: new Date().toISOString(),
    };

    if (typeof window === 'undefined') {
      return;
    }

    fetch('/api/eburon/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => null);
  }
}
