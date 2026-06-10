export function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}
