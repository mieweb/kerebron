<template>
  <div class="d-flex flex-row" style="height: 85vh">
    <div>
      <div ref="editor" class="kb-component"></div>
    </div>
    <div>
      <div>
        <h5>Markdown</h5>
        <pre>{{md}}</pre>
      </div>
      <div>
        <h5>Prosemirror JSON</h5>
        <pre>{{ JSON.stringify(lastValue, null, 2) }}</pre>
      </div>
      <div>
        <h5>ydoc</h5>
        <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {CoreEditor} from '@kerebron/editor';
import {ExtensionBasicEditor} from '@kerebron/extension-basic-editor';
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionOdt} from '@kerebron/extension-odt';
import {ExtensionTables} from '@kerebron/extension-tables';

import {ExtensionMenu, type MenuElement, MenuItem, Dropdown} from "@kerebron/extension-menu";

import {ExtensionYjs} from "@kerebron/extension-yjs";
import {userColors} from "@kerebron/extension-yjs/userColors";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";

import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';
import {dracula} from 'thememirror';

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
      editor: null
    }
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
        // this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb', 'text/x-markdown');
        // this.editor.setDocument(pmDoc);
        // this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb\n\n<table><tr><td>CELL</td></tr></table>', 'text/x-markdown');
        // this.editor.setDocument(null);
      }

      const userColor = userColors[random.uint32() % userColors.length];

      const ydoc = new Y.Doc();
      this.ydoc = ydoc;

      const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
      const wsProvider = new WebsocketProvider(protocol + '//' + globalThis.location.host + '/yjs', roomId, ydoc);

      wsProvider.on('status', event => {
        console.log('wsProvider status', event.status) // logs "connected" or "disconnected"
      });

      wsProvider.awareness.setLocalStateField('user', {
        name: 'Anonymous ' + Math.floor(Math.random() * 100),
        color: userColor.color,
        colorLight: userColor.light
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
                  run: () => this.loadDoc()
                }),
                new MenuItem({
                  label: 'Load',
                  enable: () => true,
                  run: () => this.loadDoc2()
                })
              ];
              menus[0].unshift(new Dropdown(fileMenu, { label: 'File' }));
              return menus;
            }
          }),
          new ExtensionMarkdown(),
          new ExtensionOdt(),
          new ExtensionTables(),
          new ExtensionYjs({ ydoc, provider: wsProvider }),
          new NodeCodeMirror({ theme: [dracula], ydoc, provider: wsProvider, shadowRoot: this.$.shadowRoot }),
          // new NodeCodeMirror({ theme: [dracula] }),
        ],
        // content: pmDoc
      });

      this.editor.addEventListener('transaction', (ev: CustomEvent) => {
        this.lastValue = ev.detail.transaction.doc;
        this.md = this.editor.getDocument('text/x-markdown');
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
    }
  },
  methods: {
    loadDoc() {
      this.editor.setDocument('# TEST \n\n1.  aaa **bold**\n2.  bbb\n\n```js\nconsole.log("TEST")\n```\n', 'text/x-markdown');
    },
    loadDoc2() {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async e => {
        const file = e.target.files[0];
        console.log('Selected file:', file);
        this.editor.setDocument(await file.bytes(), file.type);
      };
      input.click();
    },
  }
};
</script>
<style>
@import "@kerebron/editor/assets/index.css";
@import "@kerebron/extension-tables/assets/tables.css";
@import "@kerebron/extension-menu/assets/menu.css";
@import "@kerebron/extension-codemirror/assets/codemirror.css";
</style>
