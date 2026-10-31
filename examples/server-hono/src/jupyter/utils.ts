export function stripAnsi(text: string): string {
  return text.replaceAll(/\u001b\[[0-9;]*m/g, '');
}
