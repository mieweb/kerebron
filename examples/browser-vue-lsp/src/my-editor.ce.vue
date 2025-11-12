<template>
  <div class="d-flex flex-row" style="height: 85vh">
    <div>
      <div ref="editor" class="kb-component"></div>
    </div>
    <div>
      <div>
        <h5>Markdown</h5>
        <pre v-html=mdToHtml(md)></pre>
      </div>
      <div>
        <h5>ydoc</h5>
        <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import * as Y from 'yjs';
import { CoreEditor } from '@kerebron/editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { PositionMapper } from '@kerebron/extension-markdown/PositionMapper';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { Dropdown, MenuElement, MenuItem } from '@kerebron/extension-menu';

export default {
  name: 'my-editor',
  props: ['modelValue', 'roomId'],
  expose: ['loadDoc', 'loadDoc2'],
  data() {
    return {
      peerId: '',
      lastValue: null,
      doc: {},
      ydoc: {},
      spans: [],
      marks: [],
      md: '',
      editor: null,
      from: -1,
      to: -1
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
    roomId() {
      this.init();
    }
  },
  methods: {
    async init() {
      if (!this.roomId) {
        return;
      }
      const ydoc = new Y.Doc();
      this.ydoc = ydoc;

      const myMenu = {
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
          menus[0].unshift(new Dropdown(fileMenu, { label: 'File' }));
          return menus;
        },
      }

      this.editor = new CoreEditor({
        uri: 'test.md',
        element: this.$refs.editor,
        extensions: [
          new DevAdvancedEditorKit(myMenu),
          YjsEditorKit.createFrom(ydoc, this.roomId),
          await LspEditorKit.createFrom()
        ]
      });

      this.editor.addEventListener('selection', (event: CustomEvent) => {
        const selection = event.detail.selection;
        const extensionMarkdown: ExtensionMarkdown | undefined = this.editor.getExtension('markdown');
        if (extensionMarkdown) {
          const result = extensionMarkdown.toMarkdown(this.editor.state.doc);
          this.md = result.content;

          const mapper = new PositionMapper(this.editor, result.markdownMap);
          this.from = mapper.toMarkDownPos(selection.from);
          this.to = mapper.toMarkDownPos(selection.to);
        }
      });

    },
    mdToHtml(md: string) {
      if (this.from > -1 && this.to > -1) {
        const parts = [
          md.substring(0, this.from),
          md.substring(this.from, this.to),
          md.substring(this.to),
        ]
        return '<span>' + parts[0] + '</span>' +
        '<span class="md-selected">' + parts[1] + '</span>' +
        '<span>' + parts[2] + '</span>';
      } else {
        return md;
      }
    },

    async loadDoc() {
      const buffer = new TextEncoder().encode(
        '# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n',
      );
      await this.editor.loadDocument('text/x-markdown', buffer);
      return true;
    },

    loadDoc2() {
      const input: HTMLInputElement = document.createElement('input');
      input.type = 'file';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        console.log('Selected file:', file);
        await this.editor.loadDocument(file.type, await file.bytes());
      });
      input.click();
      return true;
    }
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
/*@import '@kerebron/extension-menu/assets/custom-menu.css';*/
@import '@kerebron/extension-menu-legacy/assets/menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';
@import '@kerebron/extension-autocomplete/assets/autocomplete.css';

.md-selected {
  background: #FF000066;
  outline: #FF000066 1px solid;
}

:host {
  position: relative;
}

</style>
