// import { EditorView } from 'prosemirror-view'

import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicCodeEditor } from '@kerebron/extension-basic-editor/ExtensionBasicCodeEditor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { assert, assertEquals } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey } from '../src/keys.ts';
import { YSyncPluginState } from '../src/ySyncPlugin.ts';
import { AnyExtensionOrReq } from '../../editor/src/types.ts';

function createNewCodeProsemirrorView() {
  const editor = CoreEditor.create({
    topNode: 'doc_code',
    editorKits: [
      {
        getExtensions: function (): AnyExtensionOrReq[] {
          return [
            new ExtensionBasicCodeEditor({ lang: 'json' }),
          ];
        },
      },
      YjsEditorKit.createFrom('test-user', 'ws://localhost:12345'),
    ],
  });

  const pluginState: YSyncPluginState = ySyncPluginKey.getState(
    editor.state,
  )!;

  const ydoc = pluginState.ydoc;
  const schema = editor.schema;
  const view = editor.view;
  return { ydoc, schema, view };
}

Deno.test('testEmptyNotSync', () => {
  const { ydoc, schema, view } = createNewCodeProsemirrorView();
  const type = ydoc.getXmlFragment('prosemirror');
  console.log('type.toString()', type.toString());
  assert(type.toString() === '', 'should only sync after first change');

  // view.dispatch(
  //   view.state.tr.setNodeMarkup(0, undefined, {
  //     checked: true,
  //   }),
  // );
  // assertEquals(
  //   type.toString(),
  //   '<custom checked="true"></custom>',
  // );
});
