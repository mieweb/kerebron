import { ContentMapper } from '@kerebron/workspace';

export interface CodePosMap {
  targetRow: number;
  targetPos: number;
  len: number;
}

export interface CodeTextResult {
  content: string;
  rawTextLines: Array<CodePosMap>;
}

export function toCodeTextResult(content: string): CodeTextResult {
  const lines = content.split('\n');

  const rawTextMap: Array<CodePosMap> = [];

  let targetPos = 0;
  let targetRow = 0;
  for (const line of lines) {
    const len = line.length + 1;
    rawTextMap.push({
      targetRow,
      targetPos,
      len,
    });

    targetRow++;
    targetPos += len;
  }

  return {
    content,
    rawTextLines: rawTextMap,
  };
}

export class CodeContentMapper implements ContentMapper {
  constructor(private codeTextResult: CodeTextResult) {}

  getTextContent(): string {
    return this.codeTextResult.content;
  }

  toRawTextPos(pos: number): number {
    return pos;
  }

  toRawTextLineCol(pos: number): [number, number] {
    for (let i = 0; i < this.codeTextResult.rawTextLines.length; i++) {
      const item = this.codeTextResult.rawTextLines[i];
      if (pos >= item.targetPos && pos < item.targetPos + item.len) {
        return [item.targetRow, pos - item.targetPos];
      }
    }
    return [0, 0];
  }

  fromLineChar(line: number, column: number): number {
    for (let i = 0; i < this.codeTextResult.rawTextLines.length; i++) {
      const item = this.codeTextResult.rawTextLines[i];

      if (item.targetRow === line) {
        if (column >= 0 && column < item.len) {
          const offset = item.targetPos + column;
          return offset;
        }

        const nextItem = this.codeTextResult.rawTextLines[i + 1];
        const isLastInRow = !nextItem || nextItem.targetRow > item.targetRow;
        if (isLastInRow && column >= item.len) {
          return this.codeTextResult.content.length;
        }
      }
    }

    return -1;
  }

  static async create(text: string): Promise<CodeContentMapper> {
    const codeTextResult: CodeTextResult = toCodeTextResult(text);
    return new CodeContentMapper(codeTextResult);
  }
}
