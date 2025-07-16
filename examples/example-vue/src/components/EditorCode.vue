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

import {CoreEditor} from '@kerebron/editor';
import {ExtensionBasicEditor} from '@kerebron/extension-basic-editor';
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionYjs} from '@kerebron/extension-yjs';
import {NodeCodeMirror, NodeDocumentCode} from '@kerebron/extension-codemirror';
import {userColors} from '@kerebron/extension-yjs/userColors';

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
    const ydoc = this.ydoc = new Y.Doc();

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsProvider = new WebsocketProvider(protocol + '//' + globalThis.location.host + '/yjs', roomId, ydoc);
    wsProvider.on('status', event => {
      console.log('wsProvider status', event.status) // logs "connected" or "disconnected"
    });

    const userColor = userColors[random.uint32() % userColors.length];
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
</script>

<style>
@import "@kerebron/editor/assets/index.css";
@import "@kerebron/extension-codemirror/assets/codemirror.css";
</style>
