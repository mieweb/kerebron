<template>
  <div>
    <div>
      <div ref="editor" class="kb-component"></div>
    </div>
    <div>
      <h5>Markdown</h5>
      <pre>{{ md }}</pre>
    </div>
    <div>
      <h5>ydoc</h5>
      <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
    </div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';

import {
  Dropdown,
  ExtensionMenu,
  type MenuElement,
  MenuItem,
} from '@kerebron/extension-menu';

import { ExtensionYjs } from '@kerebron/extension-yjs';
import { userColors } from '@kerebron/extension-yjs/userColors';
import { NodeCodeMirror } from '@kerebron/extension-codemirror';

import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';
import { dracula } from 'thememirror';

export default {
  name: 'my-editor',
  props: ['modelValue'],
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
    };
  },
  async mounted() {
    this.$nextTick(() => {
      const docUrl = globalThis.location.hash.slice(1);
      let roomId;
      if (docUrl.startsWith('room:')) {
        roomId = docUrl.substring('room:'.length);
      } else {
        roomId = String(Math.random());
        globalThis.location.hash = 'room:' + roomId;
      }

      const userColor = userColors[random.uint32() % userColors.length];

      const ydoc = new Y.Doc();
      this.ydoc = ydoc;

      const protocol = globalThis.location.protocol === 'http:'
        ? 'ws:'
        : 'wss:';
      const wsProvider = new WebsocketProvider(
        protocol + '//' + globalThis.location.host + '/yjs',
        roomId,
        ydoc,
      );

      wsProvider.on('status', (event) => {
        console.log('wsProvider status', event.status); // logs "connected" or "disconnected"
      });

      wsProvider.awareness.setLocalStateField('user', {
        name: 'Anonymous ' + Math.floor(Math.random() * 100),
        color: userColor.color,
        colorLight: userColor.light,
      });

      this.editor = new CoreEditor({
        element: this.$refs.editor,
        extensions: [
          new ExtensionBasicEditor(),
          new ExtensionMenu({
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
          }),
          new ExtensionMarkdown(),
          new ExtensionOdt(),
          new ExtensionTables(),
          new ExtensionYjs({ ydoc, provider: wsProvider }),
          new ExtensionDevToolkit(),
          new NodeCodeMirror({
            theme: [dracula],
            ydoc,
            provider: wsProvider,
            shadowRoot: this.$.shadowRoot,
          }),
          // new NodeCodeMirror({ theme: [dracula] }),
        ],
        // content: pmDoc
      });

      this.editor.addEventListener('transaction', async (ev: CustomEvent) => {
        this.lastValue = ev.detail.transaction.doc;
        const buffer = await this.editor.saveDocument('text/x-markdown');
        this.md = new TextDecoder().decode(buffer);
        // this.$emit('input', this.lastValue);
      });
    });
  },
  watch: {
    value(newValue) {
      if (newValue !== this.lastValue) {
        // this.state = createState(newValue, this.handle);
        // this.view.updateState(this.state);
      }
    },
  },
  methods: {
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
        await this.editor.loadDocument(file.type, await file.bytes());
      };
      input.click();
    },
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu/assets/menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';
</style>
