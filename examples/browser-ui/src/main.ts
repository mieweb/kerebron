import { CoreEditor } from '@kerebron/editor';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import type { Ui } from '@kerebron/ui';
import type { KerebronPopup } from '@kerebron/ui/popup';
import {
  type AutocompleteSource,
  createPosMatcher,
  createRegexMatcher,
  matchRegexAtPos,
} from '@kerebron/ui/autocomplete';
import type { HoverMatch, HoverSource, HoverTrigger } from '@kerebron/ui/hover';
import { ListRenderer } from '@kerebron/ui/popup/ListRenderer';
import { bindSelect } from '@kerebron/ui/events';

import { attachSpellcheck } from './attachSpellcheck.ts';
import { attachMenu } from './attachMenu.ts';
import { attachTestButtons } from './attachTestButtons.ts';

const editor = CoreEditor.create({
  uri: 'test.md',
  assetLoad: createAssetLoad('/wasm'),
  element: document.getElementById('editor')!,
  editorKits: [
    new DevAdvancedEditorKit(),
  ],
});

attachSpellcheck(editor);
attachMenu(editor);
attachTestButtons(editor);

editor
  .chain()
  .setFromMarkdownUrlRewriter(async (href: string, ctx) => {
    if (ctx.type === 'IMG') {
      return 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/250px-Markdown-mark.svg.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=thumbnail';
    }
    return href;
  })
  .run();

const uiMarkdown = (await import('./ui.md?raw')).default;
await editor.loadDocumentText('text/markdown', uiMarkdown);

const ui: Ui = editor.ci.resolve('ui');

const listRenderer = new ListRenderer();

const keyboardAutocomplete: AutocompleteSource = {
  triggerKeys: ['ctrl- '],
  match: createPosMatcher(),
  processRequest: async function (trigger, match, createPopup) {
    console.trace('source.processRequest', trigger);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const items = [
      '@ctrlspace_trigger',
      '@alice',
      '@bob',
      '@doug',
      '@greg',
      '@monika',
    ];
    if (items.length === 0) {
      return;
    }

    const popup = createPopup();
    ui.setPopupContent(
      popup,
      listRenderer.renderList(items.map((i) => ({ value: i, label: i }))),
    );
    bindSelect(
      popup,
      (value) => editor.chain().replaceRangeText(match.range, value).run(),
    );

    return {
      ...match,
      meta: items,
    };
  },
};
editor.chain().addAutocompleteSource(keyboardAutocomplete).run();

const regexAutocomplete: AutocompleteSource = {
  match: createRegexMatcher(editor, [/[@\/]/]),
  processRequest: async function (trigger, match, createPopup) {
    console.log('source2.processRequest', trigger);
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (match.text.startsWith('@')) {
      const items = [
        '@regex_trigger',
        '@alice',
        '@bob',
        '@doug',
        '@greg',
        '@monika',
      ].filter((str) => str.startsWith(match.text));
      if (items.length === 0) {
        return;
      }

      const popup = createPopup();
      ui.setPopupContent(
        popup,
        listRenderer.renderList(items.map((i) => ({ label: i, value: i }))),
      );
      bindSelect(
        popup,
        (value) => editor.chain().replaceRangeText(match.range, value).run(),
      );

      return { ...match, meta: items };
    }

    if (match.text.startsWith('/')) {
      const items = [
        '/command1',
        '/command2',
        '/command3',
      ];

      const popup = createPopup();
      ui.setPopupContent(
        popup,
        listRenderer.renderList(items.map((i) => ({ label: i, value: i }))),
      );
      bindSelect(popup, (value) => {
        editor.chain().replaceRangeText(
          match.range,
          'You called command: ' + value,
        ).run();
      });

      return { ...match, meta: items };
    }
  },
};
editor.chain().addAutocompleteSource(regexAutocomplete).run();

editor.run.addDiagnosticHover();

const hoverSource: HoverSource = {
  match: function (trigger: HoverTrigger): HoverMatch | undefined {
    if (trigger.mode !== 'mouse') {
      return;
    }

    const pos = trigger.pos;

    return {
      range: {
        from: pos,
        to: pos,
      },
      text: '',
    };
  },
  processRequest: async function (
    trigger,
    match,
    createPopup: () => KerebronPopup,
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = 'HoverSource.processRequest ' + match.range.from + ', mode: ' +
      trigger.mode;

    const popup = createPopup();
    ui.setPopupContent(popup, ['markdown', text]);

    return { ...match, meta: text };
  },
};
editor.chain().addHoverSource(hoverSource).run();

const hoverMentionSource: HoverSource = {
  match: function (trigger: HoverTrigger): HoverMatch | undefined {
    return matchRegexAtPos(/@[a-zA-Z0-9]+/i, trigger.pos, editor);
  },
  processRequest: async function (
    _trigger,
    match,
    createPopup: () => KerebronPopup,
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const text =
      `# User ${match.text}\n\nBasic info about user\n\n## Actions\n* |ctrl + 1| open website\n* |ctrl + 2| rocket user\n`;

    const popup = createPopup();
    ui.setPopupContent(popup, ['markdown', text]);
    popup.keydownHandler = (event) => {
      if (event.ctrlKey) {
        switch (event.key) {
          case '1':
            alert('Pressed ctrl+1');
            return true;
          case '2':
            alert('Pressed ctrl+2');
            return true;
          case '3':
            alert('Pressed ctrl+3');
            return true;
        }
      }
      return false;
    };

    return { ...match, meta: text };
  },
};
editor.chain().addHoverSource(hoverMentionSource).run();
