import { EditorState } from 'prosemirror-state';
import { TextRange } from '@kerebron/editor';

export interface SpellcheckResult {
  range: TextRange;
  word: string;
  error: string;
}

export function spellcheckDocument(
  state: EditorState,
  checkWord: (word: string) => string | undefined,
): SpellcheckResult[] {
  const results: SpellcheckResult[] = [];

  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    // Adjust the regex to match the words you consider valid.
    // const wordRegex = /\p{L}+/gu; // Unicode letters, so it works with English, Polish, German, etc.
    const wordRegex = /\b[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*\b/gu; // words like don't and well-known to remain a single word:

    for (const match of node.text.matchAll(wordRegex)) {
      const word = match[0];
      const offset = match.index ?? 0;

      const error = checkWord(word);

      if (error) {
        results.push({
          range: {
            from: pos + offset,
            to: pos + offset + word.length,
          },
          word,
          error,
        });
      }
    }
  });

  return results;
}
