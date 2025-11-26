import { RawTextMapEntry, RawTextResult } from '../types.ts';

export function toRawTextResult(content: string, nodeIdx = 0): RawTextResult {
  const lines = content.split('\n');

  const rawTextMap: Array<RawTextMapEntry> = [];

  let targetPos = 0;
  let targetRow = 0;
  for (const line of lines) {
    rawTextMap.push({
      nodeIdx,
      targetRow,
      targetCol: 0,
      targetPos,
    });

    targetRow++;
    targetPos += line.length + 1;
    nodeIdx += line.length + 1;
  }

  return {
    content,
    rawTextMap,
  };
}
