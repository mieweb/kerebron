import type { Node } from 'prosemirror-model';
import { Command } from 'prosemirror-state';

import { convertCodeParagraphsToCodeBlocks } from './convertCodeParagraphsToCodeBlocks.ts';
import { removeUnusedBookmarks } from './removeUnusedBookmarks.ts';
import { fixContinuedLists } from './fixContinuedLists.ts';
import { convertMathMl } from './convertMathMl.ts';
import { mergeCodeBlocks } from './mergeCodeBlocks.ts';

export interface PostProcessConfig {
  doc: Node;
  filesMap: Record<string, Uint8Array>;
}

export function getDefaultsPostProcessFilters(
  { doc, filesMap }: PostProcessConfig,
): Array<Command> {
  return [
    convertCodeParagraphsToCodeBlocks,
    removeUnusedBookmarks,
    fixContinuedLists,
    convertMathMl,
    mergeCodeBlocks,
  ];
}
