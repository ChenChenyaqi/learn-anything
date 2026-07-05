import { readSync } from 'node:fs';
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from '@earendil-works/pi-coding-agent';
import { z } from 'zod';
import { runRequestLoop } from './request-loop.ts';

const BootConfigSchema = z.object({
  apiKey: z.string().min(1),
  provider: z.string().min(1),
  baseUrl: z.string().min(1).nullable().optional(),
  model: z.string().min(1),
  cwd: z.string().min(1),
  sessionId: z.string().nullable().optional(),
});
type BootConfig = z.infer<typeof BootConfigSchema>;

const BUILT_IN_TOOLS = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'];

function readFirstFrameSync(): { line: string; rest: Buffer } {
  const chunks: Buffer[] = [];
  const buf = Buffer.alloc(8192);
  while (true) {
    let bytes: number;
    try {
      bytes = readSync(0, buf, 0, buf.length, null);
    } catch (err) {
      throw new Error(`sidecar: failed to read boot frame from stdin: ${String(err)}`, {
        cause: err,
      });
    }
    if (bytes <= 0) {
      throw new Error('sidecar: stdin closed before boot frame arrived');
    }
    const slice = buf.subarray(0, bytes);
    const newline = slice.indexOf(0x0a);
    if (newline >= 0) {
      chunks.push(slice.subarray(0, newline));
      const rest = Buffer.from(slice.subarray(newline + 1));
      let line = Buffer.concat(chunks).toString('utf8');
      if (line.endsWith('\r')) line = line.slice(0, -1);
      return { line, rest };
    }
    chunks.push(Buffer.from(slice));
  }
}

async function boot(config: BootConfig): Promise<AgentSession> {
  const authStorage = AuthStorage.create();
  authStorage.setRuntimeApiKey(config.provider, config.apiKey);

  const modelRegistry = ModelRegistry.create(authStorage);
  if (config.baseUrl) {
    modelRegistry.registerProvider(config.provider, { baseUrl: config.baseUrl });
  }

  const model = modelRegistry.find(config.provider, config.model);
  if (!model) {
    throw new Error(`sidecar: model not found for provider "${config.provider}": ${config.model}`);
  }

  const sessionManager = SessionManager.create(
    config.cwd,
    undefined,
    config.sessionId ? { id: config.sessionId } : undefined,
  );

  const { session } = await createAgentSession({
    cwd: config.cwd,
    model,
    authStorage,
    modelRegistry,
    sessionManager,
    tools: BUILT_IN_TOOLS,
  });

  return session;
}

async function main(): Promise<void> {
  const { line, rest } = readFirstFrameSync();
  const config = BootConfigSchema.parse(JSON.parse(line));
  const session = await boot(config);
  runRequestLoop({ session, cwd: config.cwd }, rest);
}

main().catch((err) => {
  process.stderr.write(`sidecar: fatal: ${String(err)}\n`);
  process.exit(1);
});
