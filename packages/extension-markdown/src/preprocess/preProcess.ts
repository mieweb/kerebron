import { AsyncCommand, Command } from '@kerebron/editor/commands';

import { UrlRewriter } from '@kerebron/editor';
import { addEmptyLines } from './addEmptyLines.ts';
import { fixIdLinks } from './fixIdLinkts.ts';
import { fixShortCodes } from './fixShortCodes.ts';
import { removeEmptyTags } from './removeEmptyTags.ts';
import { removeMarkedContent } from './removeMarkedContent.ts';
import { removeSuggest } from './removeSuggest.ts';
import { rewriteUrls } from './rewriteUrls.ts';
import { rtrimLines } from './rtrimLines.ts';
import { insertToc } from './insertToc.ts';
import { addEnterAfterImage } from './addEnterAfterImage.ts';

export interface PreProcessConfig {
  urlRewriter?: UrlRewriter;
}

export function getDefaultsPreProcessFilters(
  { urlRewriter }: PreProcessConfig,
): Array<Command | AsyncCommand> {
  return [
    insertToc,
    // removeMarkedContent,
    fixShortCodes,
    removeSuggest,
    removeEmptyTags,
    fixIdLinks,
    addEnterAfterImage,
    addEmptyLines,
    rtrimLines,
    rewriteUrls(urlRewriter),
  ];
}
