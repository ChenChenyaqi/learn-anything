import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  createAgentSessionServices,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  type AgentSession,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
} from '@earendil-works/pi-coding-agent';
import { mapPiEvent } from './agent-event-adapter.ts';
import { emitAgentEvent } from './stdout-writer.ts';

const BUILT_IN_TOOLS = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'];

export interface BootConfig {
  apiKey: string;
  provider: string;
  baseUrl?: string | null;
  model: string;
  cwd: string;
  sessionId?: string | null;
}

export interface SessionLifecycle {
  runtime: AgentSessionRuntime;
}

export async function createSessionLifecycle(config: BootConfig): Promise<SessionLifecycle> {
  const authStorage = AuthStorage.create();
  authStorage.setRuntimeApiKey(config.provider, config.apiKey);

  const modelRegistry = ModelRegistry.create(authStorage);
  if (config.baseUrl) {
    modelRegistry.registerProvider(config.provider, { baseUrl: config.baseUrl });
  }

  const services = await createAgentSessionServices({
    cwd: config.cwd,
    authStorage,
    modelRegistry,
  });

  let model = services.modelRegistry.find(config.provider, config.model);
  if (!model) {
    const api = config.provider === 'anthropic' ? 'anthropic-messages' : 'openai-completions';
    const baseUrl =
      config.baseUrl ??
      (config.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1');
    modelRegistry.registerProvider(config.provider, {
      baseUrl,
      apiKey: config.apiKey,
      api,
      models: [
        {
          id: config.model,
          name: config.model,
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 16384,
        },
      ],
    });
    model = services.modelRegistry.find(config.provider, config.model);
    if (!model) {
      throw new Error(
        `sidecar: model not found for provider "${config.provider}": ${config.model}`,
      );
    }
  }
  services.settingsManager.setDefaultModelAndProvider(config.provider, config.model);

  const sessionManager = SessionManager.create(
    config.cwd,
    undefined,
    config.sessionId ? { id: config.sessionId } : undefined,
  );

  const factory: CreateAgentSessionRuntimeFactory = async (opts) => {
    const result = await createAgentSessionFromServices({
      services,
      sessionManager: opts.sessionManager,
      tools: BUILT_IN_TOOLS,
      sessionStartEvent: opts.sessionStartEvent,
    });
    return {
      ...result,
      services,
      diagnostics: services.diagnostics,
    };
  };

  const runtime = await createAgentSessionRuntime(factory, {
    cwd: config.cwd,
    agentDir: services.agentDir,
    sessionManager,
  });

  return { runtime };
}

export function subscribeSession(session: AgentSession): () => void {
  return session.subscribe((event) => {
    const jsonl = mapPiEvent(session.sessionId, event);
    if (jsonl) emitAgentEvent(jsonl.session_id, jsonl.event);
  });
}
