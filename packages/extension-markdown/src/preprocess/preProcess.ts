import { Command } from 'prosemirror-state';

import { removeEmptyTags } from './removeEmptyTags.ts';
import { removeMarkedContent } from './removeMarkedContent.ts';
import { fixIdLinks } from './fixIdLinkts.ts';
import { addEmptyLines } from './addEmptyLines.ts';

export interface PreProcessConfig {
}

export function getDefaultsPreProcessFilters(
  {}: PreProcessConfig,
): Array<Command> {
  return [
    // removeMarkedContent,
    removeEmptyTags,
    fixIdLinks,
    addEmptyLines,
  ];
}
