<template>
  <div>
    <div ref="editor1" class="kb-component"></div>
    <div ref="editor2" class="kb-component"></div>
  </div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { DevAdvancedEditorKit } from '@kerebron/editor-kits/DevAdvancedEditorKit';
import { BasicEditorKit } from '@kerebron/extension-basic-editor/BasicEditorKit';

import { Fragment, Node as PmNode, Schema } from 'prosemirror-model';
import { Parser } from 'https://esm.sh/expr-eval';

const parser = new Parser();

const replaceFunc = (node: PmNode, schema: Schema) => {
  const content: string = node.attrs.content.trim();
  const expr = parser.parse(content);
  try {
    return Fragment.from([
      schema.text('Rendered: ' + expr.evaluate({ test: 123 })),
    ].filter((a) => !!a));
  } catch (err) {
    return Fragment.from([
      schema.text('Rendered: ' + err.message),
    ].filter((a) => !!a));
  }
};

export default {
  name: 'linked-editors',
  data() {
    return {
      editor1: null,
      editor2: null,
    };
  },
  async mounted() {
    this.$nextTick(() => {
      this.init();
    });
  },
  methods: {
    async init() {
      this.editor1 = CoreEditor.create({
        element: this.$refs.editor1,
        editorKits: [
          new DevAdvancedEditorKit()
        ]
      });

      this.editor2 = this.editor1.clone({
        element: this.$refs.editor2,
        editorKits: [
          new BasicEditorKit()
        ],
        readOnly: true
      });

      this.editor2.link(this.editor1)
        .renderShortCode(replaceFunc)
        .run();
    },
  },
};
</script>
<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/editor-kits/assets/DevAdvancedEditorKit.css';
</style>
