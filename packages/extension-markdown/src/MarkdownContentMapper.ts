import { ContentMapper } from '@kerebron/workspace';
import { EditorState } from 'prosemirror-state';
import { extPmToMdConverter } from './pmToMdConverter.ts';
import type { MarkdownResult, MdConfig } from './ExtensionMarkdown.ts';

interface RawTextPosItem {
  nodeIdx: number;
  maxNodeIdx: number;
  targetPos: number;
  targetRow: number;
  targetCol: number;
}

export class MarkdownContentMapper implements ContentMapper {
  private readonly rawTextArr: RawTextPosItem[];

  constructor(
    docNodeSize: number,
    private result: MarkdownResult,
  ) {
    this.rawTextArr = [];
    for (const item of result.rawTextMap) {
      if (item.nodeIdx >= 0) {
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
        this.rawTextArr[i].maxNodeIdx = docNodeSize;
      }
    }
  }

  getTextContent(): string {
    return this.result.content;
  }

  toRawTextPos(pos: number): number {
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const item = this.rawTextArr[i];
      if (pos >= item.nodeIdx && pos <= item.maxNodeIdx) {
        return item.targetPos + pos - item.nodeIdx;
      }
    }
    return -1;
  }

  toRawTextLineCol(pos: number): [number, number] {
    for (let i = 0; i < this.rawTextArr.length; i++) {
      const item = this.rawTextArr[i];
      if (pos >= item.nodeIdx && pos <= item.maxNodeIdx) {
        return [item.targetRow, item.targetCol + pos - item.nodeIdx];
      }
    }
    return [0, 0];
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

  static async create(
    state: EditorState,
    config: MdConfig,
  ): Promise<MarkdownContentMapper> {
    const result = await extPmToMdConverter(
      state.doc,
      config,
      state.schema,
      new EventTarget(),
    );
    return new MarkdownContentMapper(state.doc.nodeSize, result);
  }
}
