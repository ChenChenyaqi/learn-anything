import path from 'path';
import { exec, spawn } from 'child_process';
import chalk from 'chalk';
import * as fs from 'fs';
import { createRequire } from 'module';
import { LEARN_DIR } from '../core/config.js';
import { getMessages } from '../i18n/index.js';
import type { SupportedLocale } from '../i18n/types.js';

export interface ServeOptions {
  targetPath?: string;
  port?: number;
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

  if (!fs.existsSync(topicsDir)) {
    fs.mkdirSync(topicsDir, { recursive: true });
  }

  try {
    const entries = fs.readdirSync(topicsDir);
    if (entries.length === 0) {
      console.log(chalk.yellow(m.emptyTopics));
    }
  } catch {
    // topicsDir already ensured
  }

  console.log(chalk.cyan(m.startingServer));

  const require = createRequire(import.meta.url);
  const siteDistDir = path.join(path.dirname(require.resolve('../../package.json')), 'site-dist');
  const port = options.port ?? 24278;

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
      TOPICS_DIR: topicsDir,
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
