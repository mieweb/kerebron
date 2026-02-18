import { AsyncCommand, Command } from '@kerebron/editor/commands';

import { removeEmptyTags } from './removeEmptyTags.ts';
import { removeMarkedContent } from './removeMarkedContent.ts';
import { fixIdLinks } from './fixIdLinkts.ts';
import { addEmptyLines } from './addEmptyLines.ts';
import { fixShortCodes } from './fixShortCodes.ts';
import { rewriteUrls } from './rewriteUrls.ts';
import { UrlRewriter } from '@kerebron/editor';

export interface PreProcessConfig {
  urlRewriter?: UrlRewriter;
}

export function getDefaultsPreProcessFilters(
  { urlRewriter }: PreProcessConfig,
): Array<Command | AsyncCommand> {
  return [
    // removeMarkedContent,
    fixShortCodes,
    removeEmptyTags,
    fixIdLinks,
    addEmptyLines,
    rewriteUrls(urlRewriter),
  ];
}
