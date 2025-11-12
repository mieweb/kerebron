import type { ResolvedPos } from 'prosemirror-model';
import { AutocompleteMatcher, SuggestionMatch } from './types.ts';

export function ensureAnchor(expr: RegExp, start: boolean) {
  let { source } = expr;
  let addStart = start && source[0] != '^',
    addEnd = source[source.length - 1] != '$';
  if (!addStart && !addEnd) return expr;
  return new RegExp(
    `${addStart ? '^' : ''}(?:${source})${addEnd ? '$' : ''}`,
    expr.flags ?? (expr.ignoreCase ? 'i' : ''),
  );
}

function matchBefore($position: ResolvedPos, expr: RegExp) {
  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;

  if (!text) {
    return null;
  }

  const textFrom = $position.pos - text.length;

  const start = Math.max(textFrom, $position.pos - 250);
  const str = text.slice();

  const found = str.search(ensureAnchor(expr, false));

  return found < 0
    ? null
    : { from: start + found, to: $position.pos, text: str.slice(found) };
}

export function createRegexMatcher(
  regexes: RegExp[],
): AutocompleteMatcher {
  return ($position: ResolvedPos): SuggestionMatch => {
    const text = $position.nodeBefore?.isText && $position.nodeBefore.text;

    if (!text) {
      return null;
    }
    const textFrom = $position.pos - text.length;

    const matches = regexes.map((regex) => matchBefore($position, regex))
      .filter((m) => !!m);

    if (matches.length === 0) {
      return null;
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
      query: matchedText,
      text: matchedText,
    };
  };
}
