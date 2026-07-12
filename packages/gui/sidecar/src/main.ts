import { readSync } from 'node:fs';

import { log, maskKey } from './log.ts';
import { runRequestLoop } from './request-loop.ts';
import { createSessionLifecycle } from './session-lifecycle.ts';
import { setupScriptsDir, setupSkillFiles } from './learn-skills/index.ts';
import { BootConfigSchema } from './wire.ts';

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

async function main(): Promise<void> {
  const { line, rest } = readFirstFrameSync();
  const config = BootConfigSchema.parse(JSON.parse(line));
  log(
    `boot ok (provider=${config.provider}, model=${config.model}, cwd=${config.cwd}, apiKey=${maskKey(config.apiKey)})`,
  );
  const scriptsDir = setupScriptsDir(config.appDataDir);
  setupSkillFiles(config.appDataDir, scriptsDir);
  const { runtime } = await createSessionLifecycle(config);
  runRequestLoop({ runtime, cwd: config.cwd }, rest);
}

main().catch((err) => {
  log(`fatal: ${String(err)}`);
  process.exit(1);
});
