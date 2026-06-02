<template>
  <div>
    <div>
      <div ref="editor" class="kb-component" style="height: 50vh"></div>
    </div>
    <div>
      <h5>Markdown</h5>
      <pre>{{ md }}</pre>
    </div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

import {
  type MenuElement,
  MenuItem,
} from '@kerebron/extension-menu';
import { icons } from '@kerebron/extension-menu/icons';

export default {
  name: 'my-editor',
  props: ['modelValue', 'roomId', 'user'],
  expose: ['loadDoc', 'loadDoc2'],
  data() {
    return {
      lastValue: null,
      md: '',
      editor: null,
    };
  },
  async mounted() {
    this.$nextTick(() => {
      this.editor = CoreEditor.create({
        element: this.$refs.editor,
        assetLoad: createAssetLoad('/wasm'),
        editorKits: [
          new AdvancedEditorKit({
            modifyMenu: (menus: MenuElement[][]) => {

              // Group 0: File operations (Load Document)
              const fileGroup: MenuElement[] = [];

              // === Load Document ===
              // Opens a file picker to load ODT, Markdown, or other supported document formats
              fileGroup.push(
                new MenuItem({
                  title: 'Load document',
                  icon: icons.folderOpen,
                  run() {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept =
                      '.odt,application/vnd.oasis.opendocument.text,.md,text/markdown,text/x-markdown';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        try {
                          const buffer = await file.arrayBuffer();
                          // Determine MIME type from file extension if browser doesn't provide it
                          let mimeType = file.type;
                          if (!mimeType || mimeType === '') {
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            if (ext === 'odt') {
                              mimeType = 'application/vnd.oasis.opendocument.text';
                            } else if (ext === 'md') {
                              mimeType = 'text/x-markdown';
                            }
                          }
                          if (mimeType) {
                            await editor.loadDocument(mimeType, new Uint8Array(buffer));
                          } else {
                            console.error('Could not determine file type for:', file.name);
                          }
                        } catch (err) {
                          console.error('Failed to load document:', err);
                        }
                      }
                    };
                    input.click();
                    return true;
                  },
                  enable: () => true,
                }),
              );

              menus.unshift(fileGroup);
              return menus;
            },
          }),
          YjsEditorKit.createFrom()
        ],
        // content: pmDoc
      });

      this.editor.addEventListener('transaction', async (ev: CustomEvent) => {
        this.lastValue = ev.detail.transaction.doc;
        const buffer = await this.editor.saveDocument('text/x-markdown');
        this.md = new TextDecoder().decode(buffer);
        // this.$emit('input', this.lastValue);
      });

      this.editor.chain().changeRoom(this.roomId).run();
      if (this.user) {
        this.editor.chain().changeUser({ ...this.user }).run();
      }
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
      if (this.editor) {
        this.editor.chain().changeRoom(this.roomId).run();
      }
    },
    user() {
      if (this.editor && this.user) {
        this.editor.chain().changeUser({ ...this.user }).run();
      }
    }
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
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
</style>
