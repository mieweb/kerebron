import type { Node } from 'prosemirror-model';
import type { CoreEditor, TextRange } from '@kerebron/editor';

interface MarkdownPosItem {
  pos: number;
  targetPos: number;
  maxPos: number;
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
  private readonly markdownArr: MarkdownPosItem[];
  public readonly doc: Node;

  constructor(
    editor: CoreEditor,
    public readonly markdownMap: Array<
      {
        nodeIdx: number;
        targetRow: number;
        targetCol: number;
        sourceCol?: number;
        targetPos: number;
      }
    >,
  ) {
    this.doc = editor.state.doc;
    this.markdownArr = [];
    for (const item of markdownMap) {
      if (item.nodeIdx > 0) {
        this.markdownArr.push({
          pos: item.nodeIdx,
          targetPos: item.targetPos,
          maxPos: item.nodeIdx,
        });
      }
    }
    this.markdownArr.sort((b, a) => b.pos - a.pos);
    for (let i = 0; i < this.markdownArr.length; i++) {
      const next = i + 1;
      if (next < this.markdownArr.length) {
        this.markdownArr[i].maxPos = this.markdownArr[next].pos - 1;
      } else {
        this.markdownArr[i].maxPos = this.doc.nodeSize;
      }
    }
  }

  toMarkDownPos(pos: number) {
    for (let i = 0; i < this.markdownArr.length; i++) {
      const row = this.markdownArr[i];
      if (pos >= row.pos && pos <= row.maxPos) {
        return row.targetPos + pos - row.pos;
      }
    }
    return -1;
  }
}
