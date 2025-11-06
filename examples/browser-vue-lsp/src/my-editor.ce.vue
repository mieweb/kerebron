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
console.info('starting');

      this.editor = new CoreEditor({
        uri: 'test.md',
        shadowRoot: this.$.shadowRoot,
        element: this.$refs.editor,
        extensions: [
          new AdvancedEditorKit(),
          YjsEditorKit.createFrom(ydoc, this.roomId),
          await LspEditorKit.createFrom()
        ]
      });

      this.editor.addEventListener('selection', (event: CustomEvent) => {
        const selection = event.detail.selection;
        console.log('sel', selection.anchor, selection.head)
        const extensionMarkdown: ExtensionMarkdown | undefined = this.editor.getExtension('markdown');
        if (extensionMarkdown) {
          const result = extensionMarkdown.toMarkdown(this.editor.state.doc);
          this.md = result.content;
          console.log(result);

          console.log('selection', selection);

          const mapper = new PositionMapper(this.editor, result.markdownMap);
          const range = mapper.getSelectionCharRange(selection);
          console.log('getSelectionCharRange', range);
          this.from = mapper.toMarkDownPos(selection.from);
          this.to = mapper.toMarkDownPos(selection.to);
          console.log('ftftftftftt1', this.from, selection.from)
          console.log('ftftftftftt2', this.to, selection.to)
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

.md-selected {
  background: #FF000066;
  outline: #FF000066 1px solid;
}

:host {
  position: relative;
}

</style>
