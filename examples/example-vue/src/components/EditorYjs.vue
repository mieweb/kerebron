<template>
  <a href="/">Main</a>

  <div class="d-flex flex-row" style="height: 90vh">
    <div class="w-50" style="max-height: 100%; overflow: scroll;">
      <div v-if="editor">
        <button :disabled="!editor.can().toggleStrong().run()" @click="editor.chain().toggleStrong().run()">toggleStrong</button>
        <button :disabled="!editor.can().setHorizontalRule().run()" @click="editor.chain().setHorizontalRule().run()">setHorizontalRule</button>
        <button :disabled="!editor.can().setHardBreak().run()" @click="editor.chain().setHardBreak().run()">setHardBreak</button>
        <button :disabled="!editor.can().setCodeBlock().run()" @click="editor.chain().setCodeBlock().run()">setCodeBlock</button>
        <button :disabled="!editor.can().insertTable().run()" @click="editor.chain().insertTable().run()">insertTable</button>
        <button @click="loadDoc">Simulate loadDoc</button>
        <button @click="loadDoc2">loadDoc</button>
      </div>
      <div ref="editor" class="w-50"></div>
    </div>
    <div class="w-50">
      <div class="h-33">
        <div>
          <h5>Markdown</h5>
          <pre>{{md}}</pre>
        </div>
      </div>
      <div class="h-33">
        <h5>Prosemirror JSON</h5>
        <pre>{{ JSON.stringify(lastValue, null, 2) }}</pre>
      </div>
      <div class="h-33">
        <h5>ydoc</h5>
        <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// import "@kerebron/extension-tables/tables.css";

import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';

import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionOdt} from '@kerebron/extension-odt';
import {ExtensionTables} from '@kerebron/extension-tables';

import {ExtensionMenu} from "@kerebron/extension-menu";

import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";

export default {
  name: "EditorYjs",
  props: ['modelValue'],
  data() {
    return {
      lastValue: null,
      doc: {},
      ydoc: {},
      md: '',
      editor: null
    }
  },
  async mounted() {
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

    const pmDoc = {
      "type": "doc",
      "attrs": {
      },
      "content": [
        {
          "type": "paragraph",
          "attrs": {
          },
          "content": [
            {
              "type": "text",
              "text": "HELLO!"
            }
          ]
        }
      ]
    };

    const usercolors = [
      { color: '#30bced', light: '#30bced33' },
      { color: '#6eeb83', light: '#6eeb8333' },
      { color: '#ffbc42', light: '#ffbc4233' },
      { color: '#ecd444', light: '#ecd44433' },
      { color: '#ee6352', light: '#ee635233' },
      { color: '#9ac2c9', light: '#9ac2c933' },
      { color: '#8acb88', light: '#8acb8833' },
      { color: '#1be7ff', light: '#1be7ff33' }
    ]

// select a random color for this user
    const userColor = usercolors[random.uint32() % usercolors.length]


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
        new ExtensionMenu(),
        new ExtensionMarkdown(),
        new ExtensionOdt(),
        new ExtensionTables(),
        new ExtensionYjs({ ydoc, provider: wsProvider }),
        new NodeCodeMirror({ ydoc, provider: wsProvider }),
        // new NodeCodeMirror(),
      ],
      // content: pmDoc
    });

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.lastValue = ev.detail.transaction.doc;
      this.md = this.editor.getDocument('text/x-markdown');
      // this.$emit('input', this.lastValue);
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
    }
  }
};
//@import "@kerebron/extension-tables/tables.css";

</script>

<style>
/* Import shared Kerebron styles */
@import "@kerebron/editor/src/styles/index.css";

/* Local utility classes */
.h-33 {
  max-height: 33%;
  overflow: scroll;
}

/* Example-specific table styling */
table {
  border: 1px solid red;
}

table th, 
table td {
  border: 1px solid red;
}
</style>