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
import { AdvancedEditorKit } from './AdvancedEditorKit.ts';
import { LspEditorKit } from './LspEditorKit.ts';
import { YjsEditorKit } from './YjsEditorKit.ts';

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

      this.editor = new CoreEditor({
        shadowRoot: this.$.shadowRoot,
        element: this.$refs.editor,
        extensions: [
          new AdvancedEditorKit(),
          YjsEditorKit.createFrom(ydoc, this.roomId),
          await LspEditorKit.createFrom()
        ]
      });

    },
    mdToHtml(md: string) {
      const from = 5;
      const to = 10;
      const parts = [
        md.substring(0, from),
        md.substring(from, to),
        md.substring(to),
      ]
      return '<span>' + parts[0] + '</span>' +
      '<strong>' + parts[1] + '</strong>' +
      '<span>' + parts[2] + '</span>';
    }
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu-legacy/assets/menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';
@import '@kerebron/extension-autocomplete/assets/autocomplete.css';

:host {
  position: relative;
}

</style>
