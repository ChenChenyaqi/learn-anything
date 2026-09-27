import path from 'path';
import { exec, spawn } from 'child_process';
import chalk from 'chalk';
import * as fs from 'fs';
import { createRequire } from 'module';
import { LEARN_DIR } from '../core/config.js';
import { getMessages } from '../i18n/index.js';
import type { SupportedLocale } from '../i18n/types.js';
import { DEFAULT_PORT, findFreePort, isPortFree } from '../utils/port.js';
import { listRegisteredTopics, registerPath } from '../scripts/topic-registry.mjs';

export interface ServeOptions {
  targetPath?: string;
  port?: number;
  strictPort?: boolean;
  open?: boolean;
  locale?: SupportedLocale;
}

export async function executeServe(options: ServeOptions): Promise<void> {
  const locale = options.locale ?? 'en';
  const msg = getMessages(locale);
  const m = msg.serve;
  const cli = msg.cli;

  const resolvedPath = path.resolve(options.targetPath ?? '.');
  const topicsDir = path.join(resolvedPath, LEARN_DIR, 'topics');

  if (options.targetPath && !fs.existsSync(topicsDir)) {
    fs.mkdirSync(topicsDir, { recursive: true });
  }

  try {
    if (!options.targetPath && fs.existsSync(topicsDir)) {
      const result = registerPath(resolvedPath);
      for (const warning of result.skipped) console.warn(chalk.yellow(warning));
    }
    const entries = options.targetPath ? fs.readdirSync(topicsDir) : listRegisteredTopics();
    if (entries.length === 0) {
      console.log(chalk.yellow(m.emptyTopics));
    }
  } catch {
    // Missing or inaccessible local data must not prevent opening the dashboard.
  }

  console.log(chalk.cyan(m.startingServer));

  const require = createRequire(import.meta.url);
  const siteDistDir = path.join(path.dirname(require.resolve('../../package.json')), 'site-dist');
  const requestedPort = options.port ?? DEFAULT_PORT;

  let port: number;
  if (options.strictPort) {
    // Honour the exact port; surface a clear error if it is taken.
    if (!(await isPortFree(requestedPort))) {
      console.error(chalk.red(m.portInUse(requestedPort)));
      process.exit(1);
    }
    port = requestedPort;
  } else {
    try {
      port = await findFreePort(requestedPort);
    } catch {
      const endPort = requestedPort + 50 - 1;
      console.error(chalk.red(m.portRangeExhausted(requestedPort, endPort)));
      process.exit(1);
    }
    if (port !== requestedPort) {
      console.log(chalk.yellow(m.portSwitched(requestedPort, port)));
    }
  }

  if (!fs.existsSync(path.join(siteDistDir, 'serve.mjs'))) {
    console.error(chalk.red(m.siteNotBuilt));
    process.exit(1);
  }

  const server = spawn('node', ['serve.mjs'], {
    cwd: siteDistDir,
    stdio: ['ignore', 'pipe', 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
      TOPICS_DIR: options.targetPath ? topicsDir : '',
    },
  });

  let readySignaled = false;
  let outputBuf = '';

  server.stdout!.on('data', (data: Buffer) => {
    outputBuf += data.toString();
    const lines = outputBuf.split('\n');
    outputBuf = lines.pop() || '';

    for (const line of lines) {
      process.stdout.write(line + '\n');
      if (!readySignaled && line.startsWith('SITE_READY|')) {
        readySignaled = true;
        const url = line.substring('SITE_READY|'.length).trim();
        const openBrowser = options.open ?? true;
        if (openBrowser) {
          const openCmd =
            process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? `start ""`
                : 'xdg-open';
          exec(`${openCmd} ${url}`);
        }
        console.log(chalk.green(m.siteReady(url)));
      }
    }
  });

  server.stdout!.on('end', () => {
    if (outputBuf) process.stdout.write(outputBuf);
  });

  const cleanup = () => {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
    }
    console.log(chalk.dim(`\n${m.serverStopped}`));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  server.on('close', (code) => {
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
    if (code !== 0 && code !== null) {
      console.error(chalk.red(`Server exited with code ${code}`));
      process.exit(code);
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(m.portInUse(port)));
    } else {
      console.error(chalk.red(cli.errorPrefix(err.message)));
    }
    process.exit(1);
  });
}
