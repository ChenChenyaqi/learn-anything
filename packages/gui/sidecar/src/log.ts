// Stderr logging utilities shared across the sidecar. Pure leaf module —
// depends on nothing else in src/, so any module can import it safely.

function hhmmss(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function log(msg: string): void {
  process.stderr.write(`${hhmmss()} [node] ${msg}\n`);
}

export function maskKey(key: string): string {
  const chars = [...key];
  if (chars.length <= 4) return '***';
  return '***' + chars.slice(-4).join('');
}
