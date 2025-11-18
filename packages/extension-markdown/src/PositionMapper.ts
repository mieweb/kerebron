import type { Node } from 'prosemirror-model';
import type { CoreEditor, RawTextMapEntry } from '@kerebron/editor';

interface RawTextPosItem {
  nodeIdx: number;
  maxNodeIdx: number;
  targetPos: number;
  targetRow: number;
  targetCol: number;
}

function findFirstLetterPosition(
  node: Node,
  startPos: number,
): [number, number] | null {
  let firstLetterPos: number = -1;
  let textLen = 0;

  node.descendants((child, posInParent) => {
    if (child.isText && child.text && child.text.length > 0) {
      firstLetterPos = startPos + posInParent + 1; // First char of first text node
      textLen = child.text.length;
      return false; // Stop
    }
    return true;
  });

  if (firstLetterPos === -1) {
    return null;
  }

  return [firstLetterPos, textLen];
}

export class PositionMapper {
  private readonly rawTextArr: RawTextPosItem[];
  public readonly doc: Node;

  constructor(
    editor: CoreEditor,
    public readonly rawTextMap: Array<RawTextMapEntry>,
  ) {
    this.doc = editor.state.doc;
    this.rawTextArr = [];
    for (const item of rawTextMap) {
      if (item.nodeIdx > 0) {
        this.rawTextArr.push({
          nodeIdx: item.nodeIdx,
          maxNodeIdx: item.nodeIdx,
          targetPos: item.targetPos,
          targetRow: item.targetRow,
          targetCol: item.targetCol,
        });
      }
    }
    this.rawTextArr.sort((b, a) => b.nodeIdx - a.nodeIdx);
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const next = i + 1;
      if (next < this.rawTextArr.length) {
        this.rawTextArr[i].maxNodeIdx = this.rawTextArr[next].nodeIdx - 1;
      } else {
        this.rawTextArr[i].maxNodeIdx = this.doc.nodeSize;
      }
    }
  }

  toRawTextPos(pos: number) {
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const item = this.rawTextArr[i];
      if (pos >= item.nodeIdx && pos <= item.maxNodeIdx) {
        return item.targetPos + pos - item.nodeIdx;
      }
    }
    return -1;
  }

  toRawTextLspPos(pos: number) {
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const item = this.rawTextArr[i];
      if (pos >= item.nodeIdx && pos <= item.maxNodeIdx) {
        return {
          line: item.targetRow,
          character: item.targetCol + pos - item.nodeIdx,
        };
      }
    }
    return { line: 0, character: 0 };
  }

  fromLineChar(line: number, character: number) {
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const item = this.rawTextArr[i];
      const len = item.maxNodeIdx - item.nodeIdx + 1;

      if (item.targetRow === line) {
        if (character >= item.targetCol && character < item.targetCol + len) {
          const offset = character - item.targetCol;
          return item.nodeIdx + offset;
        }

        const nextItem = this.rawTextArr[i + 1];
        const isLastInRow = !nextItem || nextItem.targetRow > item.targetRow;
        if (isLastInRow && character >= item.targetCol + len) {
          return item.maxNodeIdx;
        }
      }
    }
    return -1;
  }
}
