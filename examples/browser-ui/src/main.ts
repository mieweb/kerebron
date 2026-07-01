import { CoreEditor, type TextRange } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import {
  type AutocompleteSource,
  createPosMatcher,
  createRegexMatcher,
} from '@kerebron/extension-ui/autocomplete';
import type {
  HoverMatch,
  HoverSource,
  HoverTrigger,
} from '@kerebron/extension-ui/hover';

const editor = CoreEditor.create({
  uri: 'test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor')!,
  editorKits: [
    new AdvancedEditorKit(),
  ],
});

await editor.loadDocumentText('text/markdown', '# Hello world!');
await editor.loadDocumentText(
  'text/markdown',
  '# Test\n\n```javascript\nconsole.log(3)\n```\n',
);

const source: AutocompleteSource = {
  triggerKeys: ['ctrl+ '],
  matchers: [
    createPosMatcher(),
  ],
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

const source2: AutocompleteSource = {
  matchers: [
    createRegexMatcher([/@/]),
  ],
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
editor.chain().addAutocompleteSource(source2).run();

const source3: HoverSource = {
  match: function (trigger: HoverTrigger): HoverMatch | undefined {
    let pos = trigger.pos;
    if (trigger.uri) {
      pos += +trigger.inside;
    }

    return {
      source: source3,
      uri: trigger.uri,
      range: {
        from: pos,
        to: pos,
      },
      text: '...',
    };
  },
  getItem: function (range: TextRange) {
    console.log('HoverSource.getItem', range);
    // throw new Error('Function not implemented.');
    return { text: 'source3.getItem ' + range.from };
  },
};

editor.chain().addHoverSource(source3).run();
