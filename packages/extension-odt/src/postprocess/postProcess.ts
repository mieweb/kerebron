import { Command } from 'prosemirror-state';

import {convertCodeParagraphsToCodeBlocks} from './convertCodeParagraphsToCodeBlocks.ts';
import {removeUnusedBookmarks} from './removeUnusedBookmarks.ts';
import {fixContinuedLists} from './fixContinuedLists.ts';

export function getDefaultsPostProcessFilters(): Array<Command> {
  return [
    convertCodeParagraphsToCodeBlocks,
    removeUnusedBookmarks,
    fixContinuedLists
  ];
}
