<template>
  <div class="d-flex" style="height: 85vh">
    <div class="flex-fill w-50">
      <div ref="editor"></div>
    </div>
    <div class="flex-fill w-50">
      <h5>Markdown</h5>
      <pre>{{ md }}</pre>
    </div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';

import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { YjsEditorKit } from '@kerebron/yjs/YjsEditorKit';

export default {
  name: 'my-editor',
  props: ['modelValue', 'roomId', 'user'],
  expose: ['loadDoc', 'loadDoc2'],
  data() {
    return {
      lastValue: null,
      doc: {},
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
      this.editor.chain().changeRoom(this.roomId).run();
    },
    user() {
      if (this.editor && this.user) {
        this.editor.chain().changeUser({ ...this.user }).run();
      }
    }
  },
  methods: {
    attachMenu(editor: CoreEditor) {
      const ui: Ui = editor.ci.resolve('ui');

      const menuFile: MenuDropdown = {
        type: 'dropdown',
        id: 'file',
        title: 'File',
        items: [
          {
            type: 'item',
            id: 'myitem',
            title: 'Simulate loadDoc',
            action: async (_editor) => this.loadDoc(),
          },
          {
            type: 'item',
            id: 'load-file',
            title: 'Load file',
            action: (_editor) => this.loadDoc2(),
          },
        ],
      };

      this.editor.run.addMenuItem(menuFile, 0);
    },
    async init() {
      this.$refs.editor.replaceChildren();

      this.editor = CoreEditor.create({
        element: this.$refs.editor,
        editorKits: [
          new AdvancedEditorKit(),
          YjsEditorKit.createFrom({ addMenu: true }),
        ]
      });

      this.attachMenu(this.editor);

      this.editor.chain().changeRoom(this.roomId).run();
      if (this.user) {
        this.editor.chain().changeUser({ ...this.user }).run();
      }

      this.editor.addEventListener('transaction', async (ev: CustomEvent) => {
        this.lastValue = ev.detail.transaction.doc;
        const buffer = await this.editor.saveDocument('text/x-markdown');
        this.md = new TextDecoder().decode(buffer);
        // this.$emit('input', this.lastValue);
      });
    },
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
        await this.editor.loadDocument(
            file.type,
            new Uint8Array(await file.arrayBuffer()),
        );
      };
      input.click();
    },
  },
};
</script>
<style>
  /* This CSS is isolated from website CSS */
  @import '@kerebron/editor/assets/index.css';
  @import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

  .d-flex {
    display: flex;
  }
  .flex-fill {
    flex: fill;
  }
  .w-50 {
    width: 50%;
  }
</style>
