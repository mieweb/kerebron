<template>
  <a href="/">Main</a>

  <div class="d-flex flex-column" style="height: 90vh">
    <div class="h-50">
      <div v-if="editor">
        <button :disabled="!editor.can().toggleStrong().run()" @click="editor.chain().toggleStrong().run()">toggleStrong</button>
        <button :disabled="!editor.can().setHorizontalRule().run()" @click="editor.chain().setHorizontalRule().run()">setHorizontalRule</button>
        <button :disabled="!editor.can().setHardBreak().run()" @click="editor.chain().setHardBreak().run()">setHardBreak</button>
        <button :disabled="!editor.can().setCodeBlock().run()" @click="editor.chain().setCodeBlock().run()">setCodeBlock</button>
        <button :disabled="!editor.can().insertTable().run()" @click="editor.chain().insertTable().run()">insertTable</button>
        <button @click="loadDoc">Simulate loadDoc</button>
      </div>
      <div class="d-flex">
        <div ref="editor" class="w-50"></div>
        <div class="w-50">
          <h5>Markdown</h5>
          <pre>{{md}}</pre>
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
          <h5>Automerge JSON</h5>
          Spans
          <pre>{{ JSON.stringify(spans, null, 2) }}</pre>
          Marks
          <pre>{{ JSON.stringify(marks, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMenu} from "@kerebron/extension-menu";
import {ExtensionAutomerge} from "@kerebron/extension-automerge";

import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';

export default {
  name: "EditorAutomerge",
  props: ['modelValue'],
  data() {
    return {
      peerId: '',
      lastValue: null,
      doc: {},
      spans: [],
      marks: [],
      md: '',
      editor: null
    }
  },
  async mounted() {
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

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const networkAdapter = new BrowserWebSocketClientAdapter(
      protocol + '//' + globalThis.location.host + '/automerge',
    );

    const extensionAutomerge = new ExtensionAutomerge({
      networkAdapter
    });

    this.editor = new CoreEditor({
      element: this.$refs.editor,
      extensions: [
        new ExtensionBasicEditor(),
        new ExtensionMenu(),
        extensionAutomerge
      ],
      // content: pmDoc
    });

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.lastValue = ev.detail.transaction.doc;
      // this.md = this.editor.getDocument('text/x-markdown');
      // this.$emit('input', this.lastValue);
    });

    this.editor.addEventListener('automerge:change', (ev: CustomEvent) => {
      this.spans = ev.detail.getSpans();
      this.marks = ev.detail.getMarks();
    });

    this.editor.addEventListener('automerge:url', (ev: CustomEvent) => {
      globalThis.location.hash = ev.detail.url;
    });

    const docUrl = globalThis.location.hash.slice(1);
    if (docUrl.startsWith('automerge:')) {
      extensionAutomerge.loadFromAutoMerge(docUrl);
    } else {
      this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb', 'text/x-markdown');
      this.editor.setDocument(pmDoc);
      this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb\n\n<table><tr><td>CELL</td></tr></table>', 'text/x-markdown');
      this.editor.setDocument(null);
    }

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