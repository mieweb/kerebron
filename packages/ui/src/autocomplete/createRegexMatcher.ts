import type { ResolvedPos } from 'prosemirror-model';

import { CoreEditor } from '@kerebron/editor';

import {
  AutocompleteMatcher,
  AutocompleteSource,
  AutocompleteTrigger,
  AutocompletMatch,
} from './types.ts';

export function ensureAnchor(expr: RegExp, start: boolean): RegExp {
  const { source } = expr;
  const addStart = start && source[0] != '^';
  const addEnd = source[source.length - 1] != '$';
  if (!addStart && !addEnd) return expr;
  return new RegExp(
    `${addStart ? '^' : ''}(?:${source})${addEnd ? '$' : ''}`,
    expr.flags ?? (expr.ignoreCase ? 'i' : ''),
  );
}

function matchBefore($position: ResolvedPos, expr: RegExp) {
  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
  if (!text) {
    return undefined;
  }

  const textFrom = $position.pos - text.length;

  const start = Math.max(textFrom, $position.pos - 250);
  const str = text.slice(start - textFrom);

  const found = str.search(ensureAnchor(expr, false));

  return found < 0
    ? null
    : { from: start + found, to: $position.pos, text: str.slice(found) };
}

export function createRegexMatcher(
  editor: CoreEditor,
  regexes: RegExp[],
): AutocompleteMatcher {
  return function (
    this: AutocompleteSource,
    trigger: AutocompleteTrigger,
  ): AutocompletMatch | undefined {
    const $position: ResolvedPos = editor.state.doc.resolve(trigger.pos);

    const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
    if (!text) {
      return undefined;
    }

    const textFrom = $position.pos - text.length;

    const matches = regexes.map((regex) => matchBefore($position, regex))
      .filter((m) => !!m);

    if (matches.length === 0) {
      return undefined;
    }

    matches.sort((a, b) => b.text.length - a.text.length);

    let from = matches[0].from;
    let matchedText = matches[0].text;
    let to = matches[0].to;
    while (matchedText.match(/^\s/)) {
      matchedText = matchedText.substring(1);
      from++;
    }

    return {
      range: {
        from,
        to,
      },
      text: matchedText,
    };
  };
}

function matchRegex($position: ResolvedPos, expr: RegExp) {
  const textBefore = $position.nodeBefore?.isText && $position.nodeBefore.text;
  if (!textBefore) {
    return undefined;
  }

  const textFrom = $position.pos - textBefore.length;

  const start = Math.max(textFrom, $position.pos - 250);
  const str = textBefore.slice(start - textFrom);

  const found = str.search(ensureAnchor(expr, false));

  if (found < 0) {
    return undefined;
  }

  const textAfter = $position.nodeAfter?.isText && $position.nodeAfter.text ||
    '';
  const text = str.slice(found) + textAfter;

  const match = text.match(ensureAnchor(expr, true));
  if (match) {
    const retVal = match[0];
    return {
      range: { from: start + found, to: start + found + retVal.length },
      text: retVal,
    };
  }
}

export function matchRegexAtPos(
  regex: RegExp,
  pos: number,
  editor: CoreEditor,
) {
  const $position: ResolvedPos = editor.state.doc.resolve(pos);
  return matchRegex($position, regex);
}
