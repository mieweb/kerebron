<template>
  <div class="d-flex flex-row" style="height: 85vh">
    <div>
      <div ref="editor" class="kb-component"></div>
    </div>
    <div>
      <div>
        <h5>Markdown</h5>
        <pre>{{ md }}</pre>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';
import { dracula } from 'thememirror';

import { CoreEditor, type TextRange } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionAutocomplete } from '@kerebron/extension-autocomplete';

import {
  Dropdown,
  type MenuElement,
  MenuItem,
  ExtensionMenuLegacy,
} from '@kerebron/extension-menu-legacy';

import { ExtensionYjs } from '@kerebron/extension-yjs';
import { userColors } from '@kerebron/extension-yjs/userColors';
import { ExtensionCodeMirror } from '@kerebron/extension-codemirror';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

export default {
  name: 'my-editor',
  props: ['modelValue', 'roomId'],
  expose: ['loadDoc', 'loadDoc2'],
  data() {
    return {
      lastValue: null,
      doc: {},
      spans: [],
      marks: [],
      md: '',
      editor: null,
    };
  },
  async mounted() {
    this.$nextTick(() => {
      this.init();
    });
  },
  watch: {
    value(newValue) {
      if (newValue !== this.lastValue) {
        // this.state = createState(newValue, this.handle);
        // this.view.updateState(this.state);
      }
    },
    async roomId() {
      await this.editor.loadDocumentText('yjs', this.roomId);
    }
  },
  methods: {
    async init() {
      this.$refs.editor.innerHTML = '';

      const autocomplete = new ExtensionAutocomplete({
        getItems(query: string) {
          console.log('query', query);
          return [
            '@alice',
            '@bob',
            '@doug',
            '@greg',
            '@monika'
            ].filter(str => str.startsWith(query));
        },
        onSelect: (selected: string, range: TextRange) => {
          this.editor.chain().replaceRangeText(range, selected).run();
        }
      });

      let userName = '';
      if (!userName) {
        userName = 'TODO ' + Math.floor(Math.random() * 100);
      }

      this.editor = CoreEditor.create({
        element: this.$refs.editor,
        editorKits: [
          YjsEditorKit.createFrom(userName),
          {
            getExtensions() {
              return [
                new ExtensionBasicEditor(),
                new ExtensionMenuLegacy({
                  modifyMenu: (menus: MenuElement[][]) => {
                    const fileMenu = [
                      new MenuItem({
                        label: 'Simulate loadDoc',
                        enable: () => true,
                        run: () => this.loadDoc(),
                      }),
                      new MenuItem({
                        label: 'Load',
                        enable: () => true,
                        run: () => this.loadDoc2(),
                      }),
                    ];
                    menus[0].unshift(new Dropdown(fileMenu, {label: 'File'}));
                    return menus;
                  },
                }),
                autocomplete,
                new ExtensionMarkdown(),
                new ExtensionOdt(),
                new ExtensionTables(),
                new ExtensionDevToolkit(),
                new ExtensionCodeMirror({
                  theme: [dracula],
                }),
              ];
            }
          }
        ]
      });

      this.editor.addEventListener('transaction', async (ev: CustomEvent) => {
        this.lastValue = ev.detail.transaction.doc;
        const buffer = await this.editor.saveDocument('text/x-markdown');
        this.md = new TextDecoder().decode(buffer);
        // this.$emit('input', this.lastValue);
      });
    },
    async loadDoc() {
      const buffer = new TextEncoder().encode(
        '# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n',
      );
      await this.editor.loadDocument('text/x-markdown', buffer);
    },
    loadDoc2() {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        console.log('Selected file:', file);
        await this.editor.loadDocument(
            file.type,
            new Uint8Array(await file.arrayBuffer()),
        );
      };
      input.click();
    },
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

:host {
  position: relative;
}

</style>
