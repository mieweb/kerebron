import type { CoreEditor } from '@kerebron/editor';
import type { Diagnostic } from '@kerebron/ui/diagnostics';
import { spellcheckDocument } from '@kerebron/ui/spellcheckDocument';

export function attachSpellcheck(editor: CoreEditor) {
  const listenerChange = async () => {
    console.log('listenerChange', listenerChange);

    const errors = spellcheckDocument(editor.state, (word: string) => {
      return word.length > 32 ? 'Word longer than 32 letters' : undefined;
    });

    const diagnostics: Diagnostic[] = errors.map((error) => ({
      id: crypto.randomUUID(),
      message: error.error,
      range: error.range,
      attrs: {
        'id': 'anchorforcustompopup',
      },
    }));

    editor.run.publishDiagnostics(
      editor.config.uri,
      editor.version,
      diagnostics,
    );
  };

  editor.addEventListener('doc:loaded', listenerChange);
  editor.addEventListener('changed', listenerChange);
}
