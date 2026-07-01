export class DomOffset {
  character: number;
  line: number;
  charCount: number;
  textLines: string[] = [];

  constructor(container: Node, node: Node, offset: number) {
    let charCount = 0;

    let wholeText = '';

    function walk(current: Node) {
      let textContent = current.nodeType === Node.TEXT_NODE
        ? (current.textContent || '')
        : '';
      textContent = textContent.replace(/\u200B/g, '');

      wholeText += textContent;
      charCount += textContent.length;
      if (current === node) {
        textContent = textContent.substring(0, offset);
      }

      if (current === node) {
        throw new Error('found');
      }

      if (current.nodeType !== Node.TEXT_NODE) {
        for (let child of current.childNodes) {
          walk(child);
        }
      }
    }

    try {
      walk(container);
      // deno-lint-ignore no-empty
    } catch (e) {
    }

    this.textLines = wholeText.split('\n');
    const lines: string[] = [...this.textLines];

    let line = lines.length - 1;
    let character = (lines.pop() || '').length;

    this.charCount = charCount;
    this.line = line;
    this.character = character;
  }

  calculateOffsetFromLsp(
    { line, character }: { line: number; character: number },
  ) {
    const lines: string[] = this.textLines.slice(0, line + 1);

    const lastLineIdx = lines.length - 1;
    lines[lastLineIdx] = lines[lastLineIdx].substring(0, character);

    const text = lines.join('\n');

    return text.length;
  }
}
