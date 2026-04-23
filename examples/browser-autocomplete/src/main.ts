import { CoreEditor, type TextRange } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';
import { type AutocompleteSource } from '@kerebron/extension-autocomplete';

const editor = CoreEditor.create({
  uri: 'test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor')!,
  editorKits: [
    new AdvancedEditorKit(),
  ],
});

await editor.loadDocumentText('text/markdown', '# Hello world!');
await editor.loadDocumentText('text/markdown', '```markdown\naaa\n```\n');

const source: AutocompleteSource = {
  triggerKeys: ['@'],
  getItems(query: string) {
    return [
      '@alice',
      '@bob',
      '@doug',
      '@greg',
      '@monika',
    ].filter((str) => str.startsWith(query));
  },
  onSelect: (selected: string, range: TextRange) => {
    editor.chain().replaceRangeText(range, selected).run();
  },
};

editor.chain().addAutocompleteSource(source).run();
