import { AsyncCommand, Command } from '@kerebron/editor/commands';

import { UrlRewriter } from '@kerebron/editor';
import { addEmptyLines } from './addEmptyLines.ts';
import { fixIdLinks } from './fixIdLinkts.ts';
import { fixShortCodes } from './fixShortCodes.ts';
import { removeEmptyTags } from './removeEmptyTags.ts';
import { removeMarkedContent } from './removeMarkedContent.ts';
import { rewriteUrls } from './rewriteUrls.ts';
import { removeSuggest } from './removeSuggest.ts';

export interface PreProcessConfig {
  urlRewriter?: UrlRewriter;
}

export function getDefaultsPreProcessFilters(
  { urlRewriter }: PreProcessConfig,
): Array<Command | AsyncCommand> {
  return [
    // removeMarkedContent,
    fixShortCodes,
    removeSuggest,
    removeEmptyTags,
    fixIdLinks,
    addEmptyLines,
    rewriteUrls(urlRewriter),
  ];
}
