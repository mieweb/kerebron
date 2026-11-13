import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { BasicEditorKit } from '@kerebron/extension-basic-editor/BasicEditorKit';

import { Fragment, Node as PmNode, Schema } from 'prosemirror-model';
import { Parser } from 'expr-eval';

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

const editor1 = CoreEditor.create({
  element: document.getElementById('editor1')!,
  editorKits: [
    new AdvancedEditorKit(),
  ],
});

const editor2 = editor1.clone({
  element: document.getElementById('editor2')!,
  editorKits: [
    new BasicEditorKit(),
  ],
  readOnly: true,
});

editor2.link(editor1)
  .renderShortCode(replaceFunc)
  .run();
