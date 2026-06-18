import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // In dev, points to test fixtures by default. Override via TOPICS_DIR env var for real data.
  const topicsDir = process.env.TOPICS_DIR || resolve(__dirname, '../test/fixtures/topics');

  let apiProcess: ChildProcess | null = null;

  function cleanup() {
    if (apiProcess && apiProcess.exitCode === null) {
      apiProcess.kill('SIGTERM');
      apiProcess = null;
    }
  }

  function removeProcessListeners(fn: () => void) {
    process.removeListener('SIGINT', fn);
    process.removeListener('SIGTERM', fn);
  }

  let boundCleanup: (() => void) | null = null;

  return {
    plugins: [
      vue(),
      tailwindcss(),
      {
        name: 'serve-api',
        apply: 'serve',
        configureServer(server) {
          function startApiProcess() {
            if (apiProcess && apiProcess.exitCode === null) {
              apiProcess.kill('SIGTERM');
              apiProcess = null;
            }
            apiProcess = spawn('node', ['serve.mjs'], {
              cwd: __dirname,
              stdio: 'inherit',
              env: {
                ...process.env,
                PORT: '24277',
                TOPICS_DIR: topicsDir,
              },
            });

            apiProcess.on('error', (err) => {
              console.error(`[serve-api] Failed to start API server: ${err.message}`);
            });

            apiProcess.on('exit', (code) => {
              if (code !== 0 && code !== null) {
                console.error(`[serve-api] API server exited with code ${code}`);
              }
              apiProcess = null;
            });
          }

          if (boundCleanup) {
            removeProcessListeners(boundCleanup);
          }

          startApiProcess();

          boundCleanup = cleanup;
          server.httpServer?.on('close', cleanup);
          process.on('SIGINT', cleanup);
          process.on('SIGTERM', cleanup);
        },
      },
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    server: {
      host: true,
      port: 24278,
      proxy: {
        '/api': {
          target: 'http://localhost:24277',
          changeOrigin: true,
        },
      },
    },
  };
});
