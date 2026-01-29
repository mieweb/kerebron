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
import { LspWebSocketTransport } from '@kerebron/extension-lsp/LspWebSocketTransport';
import { LspTransportGetter, Transport } from '@kerebron/extension-lsp';
import { Dropdown, MenuElement, MenuItem } from '@kerebron/extension-menu';

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
    async roomId() {
      await this.editor.loadDocumentText('yjs', this.roomId);
    }
  },
  methods: {
    async init() {

      const myMenu = {
        modifyMenu: (menus: MenuElement[][]) => {
          const fileMenu = [
            new MenuItem({
              label: 'Simulate loadDoc',
              enable: () => true,
              run: () => this.loadDoc(),
            }),
            new MenuItem({
              label: 'Simulate loadLspToy',
              enable: () => true,
              run: () => this.loadLspToy(),
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

      const getLspTransport: LspTransportGetter = (lang: string): Transport | undefined => {
        const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
        const uri = protocol + '//' + globalThis.location.host + '/lsp';

        switch (lang) {
          case 'markdown':
            return new LspWebSocketTransport(uri + '/mine');
          case 'json':
            return new LspWebSocketTransport(uri + '/deno');
          case 'typescript':
          case 'javascript':
            return new LspWebSocketTransport(uri + '/typescript');
          case 'yaml':
            return new LspWebSocketTransport(uri + '/yaml');
        }
        return undefined;
      }

      if (this.editor) {
        this.editor.destroy();
      }

      let userName = '';
      if (!userName) {
        userName = 'TODO ' + Math.floor(Math.random() * 100);
      }

      this.editor = CoreEditor.create({
        cdnUrl: 'http://localhost:8000/wasm/',
        uri: 'file:///test.md',
        element: this.$refs.editor,
        editorKits: [
          new DevAdvancedEditorKit(myMenu),
          YjsEditorKit.createFrom(userName),
          // LspEditorKit.createFrom({ getLspTransport }),
        ]
      });

      if (this.roomId) {
        await this.editor.loadDocumentText('yjs', this.roomId);
      }

      if (false)
      this.editor.addEventListener('selection', (event: CustomEvent) => {
        const selection = event.detail.selection;
        const extensionMarkdown: ExtensionMarkdown | undefined = this.editor.getExtension('markdown');
        if (extensionMarkdown) {
          const result = extensionMarkdown.toMarkdown(this.editor.state.doc);
          this.md = result.content;

          const mapper = new PositionMapper(this.editor, result.rawTextMap);
          this.from = mapper.toRawTextPos(selection.from);
          this.to = mapper.toRawTextPos(selection.to);
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
      const example = await import('./example.md?raw');
      const buffer = new TextEncoder().encode(example.default);
      await this.editor.loadDocument('text/x-markdown', buffer);
      return true;
    },

    loadDoc2() {
      const input: HTMLInputElement = document.createElement('input');
      input.type = 'file';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        console.log('Selected file:', file);
        await this.editor.loadDocument(
            file.type,
            new Uint8Array(await file.arrayBuffer()),
        );
      });
      input.click();
      return true;
    },

    async loadLspToy() {
      const example = await import('./example.lsptoy?raw');
      await this.editor.loadDocument('text/x-markdown', new TextEncoder().encode(example.default));
      return true;
    }
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/editor-kits/assets/DevAdvancedEditorKit.css';

.md-selected {
  background: #FF000066;
  outline: #FF000066 1px solid;
}

:host {
  position: relative;
}

</style>
