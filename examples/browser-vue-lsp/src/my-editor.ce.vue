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
    </div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';
import { LspEditorKit } from '@kerebron/editor-kits/LspEditorKit';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { LSPWebSocketTransport } from '@kerebron/extension-lsp/LSPWebSocketTransport';
import { LSPTransportGetter, Transport } from '@kerebron/extension-lsp';
import { Dropdown, MenuElement, MenuItem } from '@kerebron/extension-menu';
import { createAssetLoad } from '@kerebron/wasm/web';

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
      if (this.editor) {
        this.editor.chain().changeRoom(this.roomId).run();
      }
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

      const getLspTransport: LSPTransportGetter = (lang: string): Transport | undefined => {
        const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
        const uri = protocol + '//' + globalThis.location.host + '/lsp';

        switch (lang) {
          case 'markdown':
            return new LSPWebSocketTransport(uri + '/mine');
          case 'json':
            return new LSPWebSocketTransport(uri + '/deno');
          case 'typescript':
          case 'javascript':
            return new LSPWebSocketTransport(uri + '/deno');
            return new LSPWebSocketTransport(uri + '/typescript');
          case 'yaml':
            return new LSPWebSocketTransport(uri + '/yaml');
        }
        return undefined;
      }

      if (this.editor) {
        this.editor.destroy();
      }

      this.editor = CoreEditor.create({
        assetLoad: createAssetLoad(new URL('http://localhost:8000/wasm/')),
        uri: 'file:///test.md',
        element: this.$refs.editor,
        editorKits: [
          new DevAdvancedEditorKit(myMenu),
          YjsEditorKit.createFrom(),
          LspEditorKit.createFrom({ getLspTransport }),
        ]
      });

      if (this.roomId) {
        this.editor.chain().changeRoom(this.roomId).run();
        const example = await import('./example.md?raw');
        const buffer = new TextEncoder().encode(example.default);
        await this.editor.loadDocument('text/x-markdown', buffer);

      }

      if (false) {

      }

      // let snapshot: { version: number, getContentMapper: () => Promise<ContentMapper> } | undefined;

      // const workspace: Workspace = editor.ci.resolve('workspace')!;
      // workspace.addEventListener('modifyFile', (event: CustomEvent<WorkspaceModifyParams>) => {
      //   if (event.detail.uri !== editor.config.uri) {
      //     return;
      //   }
      //   snapshot = {
      //     version: event.detail.version,
      //     getContentMapper: event.detail.getContentMapper
      //   }
      // });

      // this.editor.addEventListener('selection', (event: CustomEvent) => {
      //   const selection = event.detail.selection;
      //   if (snapshot) {
      //     const contentMapper: ContentMapper = await snapshot.getContentMapper();

      //     this.md = contentMapper.getTextContent();
      //     this.from = contentMapper.toRawTextPos(selection.from);
      //     this.to = contentMapper.toRawTextPos(selection.to);
      //   }
      // });

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
