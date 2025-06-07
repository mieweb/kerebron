<template>
  <a href="/">Main</a>

  <div class="d-flex flex-column" style="height: 90vh">
    <div class="h-50">
      <div v-if="editor">
        <button @click="loadDoc">Simulate loadDoc</button>
      </div>
      <div class="d-flex">
        <div ref="editor" class="w-50"></div>
        <div class="w-50">
          <h5>Code</h5>
          <pre>{{ code }}</pre>
        </div>
      </div>
    </div>
    <div class="h-50">
      <div class="d-flex">
        <div class="w-50">
          <h5>Prosemirror JSON</h5>
          <pre>{{ JSON.stringify(lastValue, null, 2) }}</pre>
        </div>
        <div class="w-50">
          <h5>ydoc</h5>
          <pre>{{ JSON.stringify(ydoc, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import * as Y from 'yjs';
import * as random from 'lib0/random';
import { WebsocketProvider } from 'y-websocket';

import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror, NodeDocumentCode} from "@kerebron/extension-codemirror";

export default {
  name: "EditorCode",
  props: ['modelValue'],
  data() {
    return {
      lastValue: null,
      doc: {},
      ydoc: {},
      code: '',
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
    }

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
      topNode: 'doc_code',
      element: this.$refs.editor,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMarkdown(),
        new NodeDocumentCode({ lang: 'yaml' }),
        new ExtensionYjs({ ydoc, provider: wsProvider }),
        new NodeCodeMirror({ ydoc, provider: wsProvider, languageWhitelist: ['yaml'], readOnly: false }),
      ],
      // content: pmDoc
    });

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.lastValue = ev.detail.transaction.doc;
      this.code = this.editor.getDocument('text/code-only');
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
      this.editor.setDocument('# Multiline string with literal block syntax -preserved new lines\n' +
        'string1: |\n' +
        '   Line1\n' +
        '   line2\n' +
        '   "line3"\n' +
        '  line4\n', 'text/code-only');
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