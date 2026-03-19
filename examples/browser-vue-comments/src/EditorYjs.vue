<template>
  <div>
    <div ref="editor" class="kb-component"></div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';
import { AdvancedEditorKit } from '@kerebron/editor-kits//AdvancedEditorKit';
import { createAssetLoad } from '@kerebron/wasm/web';

export default {
  name: 'my-editor',
  props: ['roomId', 'user'],
  expose: ['addComment', 'addSnapshot', 'showSnapshot'],
  data() {
    return {
      editor: null,
    };
  },
  async mounted() {
    this.$nextTick(() => {
      this.editor = CoreEditor.create({
        element: this.$refs.editor,
        assetLoad: createAssetLoad('/wasm'),
        editorKits: [
          new AdvancedEditorKit(),
          YjsEditorKit.createFrom()
        ],
      });

      this.editor.chain().changeRoom(this.roomId).run();
      if (this.user) {
        this.editor.chain().changeUser({ ...this.user }).run();
      }
    });
  },
  watch: {
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
    addComment(id: string) {
      if (this.editor) {
      return this.editor.chain()
        .addComment(id)
        .run();
      }
    },
    async addSnapshot() {
      if (this.editor) {
        const snapshot = await new Promise((resolve, reject) =>
          this.editor.chain().getYSnapshot({ resolve, reject }).run()
        );
        return snapshot;
      }
    },
    showSnapshot(snapshot, prevSnapshot) {
      // console.log('snapshot, prevSnapshot', snapshot.slice(), prevSnapshot.slice())
      this.editor.chain().setYSnapshot({ snapshot, prevSnapshot }).run();
    }
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-tables/assets/tables.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
@import '@kerebron/extension-codemirror/assets/codemirror.css';

[data-comment-id] {
  background: #ff000080;
}
</style>
