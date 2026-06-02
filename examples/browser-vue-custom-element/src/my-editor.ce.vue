<template>
  <div class="d-flex flex-row" style="height: 85vh">
    <div>
      <div ref="editor" class="kb-component"></div>
    </div>
    <div>
      <div>
        <h5>Markdown</h5>
        <pre>{{ md }}</pre>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';

import {
  Dropdown,
  type MenuElement,
  MenuItem,
} from '@kerebron/extension-menu-legacy';

import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

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
    async init() {
      this.$refs.editor.innerHTML = '';

      this.editor = CoreEditor.create({
        element: this.$refs.editor,
        editorKits: [
          new DevAdvancedEditorKit({
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
              menus[0].unshift(new Dropdown(fileMenu, {label: 'File'}));
              return menus;
            },
          }),
          YjsEditorKit.createFrom(),
        ]
      });

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
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

:host {
  position: relative;
}

</style>
