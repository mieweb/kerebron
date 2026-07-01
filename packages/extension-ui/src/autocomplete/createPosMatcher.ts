import { ResolvedPos } from 'prosemirror-model';
import { AutocompleteMatcher, SuggestionMatch } from './types.ts';

export function createPosMatcher(): AutocompleteMatcher {
  return ($position: ResolvedPos): SuggestionMatch | undefined => {
    const textFrom = $position.pos;

    const query = '';

    const from = textFrom;
    const to = from + query.length;

    return {
      range: {
        from,
        to,
      },
      query,
    };
  };
}
