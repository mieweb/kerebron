import * as Y from 'yjs';

import { MarkSpec } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';

import {
  AnyExtensionOrReq,
  CoreEditor,
  EditorKit,
  Extension,
  Mark,
} from '@kerebron/editor';
import { assetLoad } from '@kerebron/wasm/deno';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assert, assertEquals, assertObjectMatch } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import {
  prosemirrorJSONToYDoc,
  prosemirrorJSONToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from '../src/binding/convertUtils.ts';
import { createTestServer, shutdownServer } from './utils/createTestServer.ts';

function createNewDocEditor(port: number, user = 'test-user') {
  const editor = CoreEditor.create({
    assetLoad,
    editorKits: [
      new BrowserLessEditorKit(),
      YjsEditorKit.createFrom('ws://localhost:' + port + '/yjs'),
    ],
  });

  return { editor };
}

const STEP_TS = 50;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const checkResult = (
  result: { testObjects: Array<{ state: EditorState }> },
) => {
  for (let i = 1; i < result.testObjects.length; i++) {
    const p1 = result.testObjects[i - 1].state.doc.toJSON();
    const p2 = result.testObjects[i].state.doc.toJSON();
    assertEquals(p1, p2);
  }
};

class CustomExtension extends Extension {
  override name = 'custom-test-extension';

  constructor(private plugins: Plugin[]) {
    super();
  }

  override getProseMirrorPlugins(): Plugin[] {
    return this.plugins;
  }
}

/**
 * Verify that update events in plugins are only fired once.
 *
 * Initially reported in https://github.com/yjs/y-prosemirror/issues/121
 */
if (false) {
  Deno.test('testPluginIntegrity', async () => {
    let viewUpdateEvents = 0;
    let stateUpdateEvents = 0;
    const customPlugin = new Plugin<void>({
      state: {
        init: () => {
          return {};
        },
        apply: () => {
          stateUpdateEvents++;
        },
      },
      view: () => {
        return {
          update() {
            viewUpdateEvents++;
          },
        };
      },
    });

    const editorKits: EditorKit[] = [
      {
        getExtensions: function (): AnyExtensionOrReq[] {
          return [
            new CustomExtension([customPlugin]),
          ];
        },
      },
    ];

    const server = await createTestServer();

    try {
      const { editor } = createNewDocEditor(server.port);
      editor.chain().changeRoom('testDocTransformation').run();
      await sleep(0);

      editor.dispatchTransaction(
        editor.state.tr.insert(
          0,
          editor.schema.node(
            'paragraph',
            undefined,
            editor.schema.text('hello world'),
          ),
        ),
      );

      await sleep(0);

      {
        const ydoc: Y.Doc = await new Promise((resolve, reject) =>
          editor.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

        // test if transforming back and forth from Yjs doc works
        //
        assertEquals({ viewUpdateEvents, stateUpdateEvents }, {
          viewUpdateEvents: 3, // nodeViews init + initialRender + view.dispach
          stateUpdateEvents: 2, // fired twice, because the ySyncPlugin adds additional fields to state after the initial render
        }, 'events are fired only once');
      }

      editor.destroy();
      await sleep(STEP_TS);
    } finally {
      await shutdownServer(server);
    }
  });
}

class MarkComment extends Mark {
  override name = 'mcomment';
  requires = ['doc'];

  override getMarkSpec(): MarkSpec {
    return {
      attrs: {
        id: { default: null },
      },
      parseDOM: [
        {
          tag: 'comment',
        },
      ],
      toDOM(node) {
        return ['comment', { comment_id: node.attrs.id }];
      },
      excludes: '',
    };
  }
}

if (false) { // TODO create overlapping mark for testing
  Deno.test('testOverlappingMarks', async () => {
    const server = await createTestServer();

    try {
      const { editor } = createNewDocEditor(server.port);
      editor.chain().changeRoom('testOverlappingMarks').run();
      await sleep(0);

      editor.dispatchTransaction(
        editor.view.state.tr.insert(
          0,
          editor.schema.node(
            'paragraph',
            undefined,
            editor.schema.text('hello world'),
          ),
        ),
      );

      editor.dispatchTransaction(
        editor.state.tr.addMark(
          1,
          3,
          editor.schema.mark('mcomment', { id: 4 }),
        ),
      );
      editor.dispatchTransaction(
        editor.state.tr.addMark(
          2,
          4,
          editor.schema.mark('mcomment', { id: 5 }),
        ),
      );
      const stateJSON = JSON.parse(JSON.stringify(editor.state.doc.toJSON()));
      // attrs.ychange is only available with a schema
      delete stateJSON.content[0].attrs;

      {
        const ydoc: Y.Doc = await new Promise((resolve, reject) =>
          editor.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
        const back = prosemirrorJSONToYDoc(editor.schema, stateJSON);
        // test if transforming back and forth from Yjs doc works
        // const backandforth = JSON.parse(JSON.stringify(yDocToProsemirrorJSON(back)))
        const xmlFragment = back.getXmlFragment('prosemirror');
        const backandforth = JSON.parse(
          JSON.stringify(
            yXmlFragmentToProseMirrorRootNode(xmlFragment, editor.schema),
          ),
        );

        assertObjectMatch(backandforth, stateJSON);

        // re-assure that we have overlapping comments
        const expected = [
          {
            'type': 'text',
            'marks': [
              {
                'type': 'mcomment',
                'attrs': {
                  'id': 4,
                },
              },
            ],
            'text': 'h',
          },
          {
            'type': 'text',
            'marks': [
              {
                'type': 'mcomment',
                'attrs': {
                  'id': 4,
                },
              },
              {
                'type': 'mcomment',
                'attrs': {
                  'id': 5,
                },
              },
            ],
            'text': 'e',
          },
          {
            'type': 'text',
            'marks': [
              {
                'type': 'mcomment',
                'attrs': {
                  'id': 5,
                },
              },
            ],
            'text': 'l',
          },
          {
            'type': 'text',
            'text': 'lo world',
          },
        ];
        assertEquals(backandforth.content[0].content, expected);
      }

      editor.destroy();
      await sleep(STEP_TS);
    } finally {
      await shutdownServer(server);
    }
  });
}

Deno.test('testDocTransformation', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testDocTransformation').run();
    await sleep(0);

    editor.dispatchTransaction(
      editor.state.tr.insert(
        0,
        editor.schema.node(
          'paragraph',
          undefined,
          editor.schema.text('hello world'),
        ),
      ),
    );

    const stateJSON = editor.state.doc.toJSON();
    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

      // test if transforming back and forth from Yjs doc works
      //
      {
        const ydoc = prosemirrorJSONToYDoc(editor.schema, stateJSON);
        const xmlFragment = ydoc.getXmlFragment('prosemirror');
        const backandforth = yXmlFragmentToProseMirrorRootNode(
          xmlFragment,
          editor.schema,
        )
          .toJSON();
        assertEquals(stateJSON, backandforth);
      }
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('testXmlFragmentTransformation', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testXmlFragmentTransformation').run();
    await sleep(0);

    editor.dispatchTransaction(
      editor.state.tr.insert(
        0,
        editor.schema.node(
          'paragraph',
          undefined,
          editor.schema.text('hello world'),
        ),
      ),
    );

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

      const stateJSON = editor.state.doc.toJSON();
      console.log(JSON.stringify(stateJSON));
      // test if transforming back and forth from yXmlFragment works
      const xml = new Y.XmlFragment();
      prosemirrorJSONToYXmlFragment(
        /** @type {any} */ (editor.schema),
        stateJSON,
        xml,
      );
      const doc = new Y.Doc();
      doc.getMap('root').set('firstDoc', xml);
      const backandforth = yXmlFragmentToProseMirrorRootNode(xml, editor.schema)
        .toJSON();
      console.log(JSON.stringify(backandforth));
      assertEquals(stateJSON, backandforth);
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

Deno.test('testEmptyParagraph', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testEmptyParagraph').run();
    await sleep(0);

    editor.dispatchTransaction(
      editor.state.tr.insert(
        0,
        editor.schema.node(
          'paragraph',
          undefined,
          editor.schema.text('123'),
        ),
      ),
    );

    await sleep(STEP_TS);

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );
      const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        'contains one paragraph containing a ytext',
      );
      editor.dispatchTransaction(editor.state.tr.delete(1, 4)); // delete characters 123
      assert(
        yxml.length === 2 && yxml.get(0).length === 1,
        "doesn't delete the ytext",
      );
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

/**
 * Test duplication issue https://github.com/yjs/y-prosemirror/issues/161
 */
if (false) { // TODO fix restore pos
  Deno.test('testInsertDuplication', async () => {
    const server = await createTestServer();

    try {
      const { editor: editor1 } = createNewDocEditor(server.port);
      editor1.chain().changeRoom('testInsertDuplication').run();

      const { editor: editor2 } = createNewDocEditor(server.port);
      editor2.chain().changeRoom('testInsertDuplication').run();

      await sleep(STEP_TS);

      {
        const ydoc1: Y.Doc = await new Promise((resolve, reject) =>
          editor1.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml1: Y.XmlFragment = ydoc1.get('kerebron:doc', Y.XmlFragment);

        const ydoc2: Y.Doc = await new Promise((resolve, reject) =>
          editor2.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml2: Y.XmlFragment = ydoc2.get('kerebron:doc', Y.XmlFragment);

        yxml1.observeDeep((events) => {
          events.forEach((event) => {
            console.log('yxml1: ', JSON.stringify(event.changes.delta));
          });
        });
        yxml2.observeDeep((events) => {
          events.forEach((event) => {
            console.log('yxml2: ', JSON.stringify(event.changes.delta));
          });
        });

        editor1.dispatchTransaction(
          editor1.state.tr.insert(
            0,
            editor1.schema.node(
              'paragraph',
            ),
          ),
        );
        await sleep(STEP_TS);

        const sync = async () => {
          Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));
          Y.applyUpdate(ydoc1, Y.encodeStateAsUpdate(ydoc2));
          Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));
          Y.applyUpdate(ydoc1, Y.encodeStateAsUpdate(ydoc2));
          await sleep(10);
        };
        await sync();
        editor1.dispatchTransaction(editor1.state.tr.insertText('1', 1, 1));
        await sleep(STEP_TS);
        editor2.dispatchTransaction(editor2.state.tr.insertText('2', 1, 1));
        await sync();
        editor1.dispatchTransaction(editor1.state.tr.insertText('1', 2, 2));
        await sleep(STEP_TS);
        editor2.dispatchTransaction(editor2.state.tr.insertText('2', 3, 3));
        await sync();
        checkResult({ testObjects: [editor1.view, editor2.view] });

        console.log('yxml1.toString()', yxml1.toString());

        assert(
          yxml1.toString() ===
            '<paragraph>1122</paragraph><paragraph></paragraph><paragraph></paragraph>',
        );
      }

      editor1.destroy();
      editor2.destroy();
      await sleep(STEP_TS);
    } finally {
      await shutdownServer(server);
    }
  });
}

Deno.test('testInsertRightMatch', async () => {
  const server = await createTestServer();

  try {
    const { editor } = createNewDocEditor(server.port);
    editor.chain().changeRoom('testInsertRightMatch').run();
    await sleep(0);

    {
      const ydoc: Y.Doc = await new Promise((resolve, reject) =>
        editor.chain().getYDoc({ resolve, reject }).run()
      );
      const yXmlFragment: Y.XmlFragment = ydoc.get(
        'kerebron:doc',
        Y.XmlFragment,
      );

      editor.dispatchTransaction(
        editor.view.state.tr.insert(
          0,
          [
            editor.schema.node(
              'heading',
              { level: 1 },
              editor.schema.text('Heading 1'),
            ),
            editor.schema.node(
              'paragraph',
              undefined,
              editor.schema.text('Paragraph 1'),
            ),
          ],
        ),
      );
      await sleep(STEP_TS);

      prosemirrorJSONToYXmlFragment(
        editor.schema,
        editor.view.state.doc.toJSON(),
        yXmlFragment,
      );
      const lastP = yXmlFragment.get(yXmlFragment.length - 1);
      const tr = editor.state.tr;
      editor.dispatchTransaction(
        tr.insert(
          tr.doc.child(0).nodeSize + tr.doc.child(1).nodeSize,
          editor.schema.node(
            'paragraph',
            undefined,
            editor.schema.text('Paragraph 2'),
          ),
        ),
      );

      await sleep(STEP_TS);

      const newLastP = yXmlFragment.get(yXmlFragment.length - 1);
      const new2ndLastP = yXmlFragment.get(yXmlFragment.length - 2);

      console.log('new2ndLastP.toString() ', new2ndLastP.toString());

      assert(lastP === newLastP, 'last paragraph is the same as before');
      assert(
        new2ndLastP.toString() === '<paragraph>Paragraph 2</paragraph>',
        '2nd last paragraph is the inserted paragraph',
      );
      assert(
        lastP.toString() === '<paragraph></paragraph>',
        'last paragraph remains empty and is placed at the end',
      );
    }

    editor.destroy();
    await sleep(STEP_TS);
  } finally {
    await shutdownServer(server);
  }
});

/**
 * Tests for #126 - initial cursor position should be retained, not jump to the end.
 */
if (false) { // TODO fix restore pos
  Deno.test('testInitialCursorPosition', async () => {
    const server = await createTestServer();

    try {
      const { editor } = createNewDocEditor(server.port);
      editor.chain().changeRoom('testInitialCursorPosition').run();
      await sleep(STEP_TS);

      {
        const ydoc: Y.Doc = await new Promise((resolve, reject) =>
          editor.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

        const p = new Y.XmlElement('paragraph');
        p.insert(0, [new Y.XmlText('hello world!')]);
        yxml.insert(0, [p]);

        editor.view.focus();
        await sleep(STEP_TS);

        assert(editor.view.state.selection.anchor === 1);
        assert(editor.view.state.selection.head === 1);
      }

      editor.destroy();
      await sleep(STEP_TS);
    } finally {
      await shutdownServer(server);
    }
  });
}

if (false) { // TODO fix restore pos
  Deno.test('testInitialCursorPosition2', async () => {
    const server = await createTestServer();

    try {
      const { editor } = createNewDocEditor(server.port);
      editor.chain().changeRoom('testInitialCursorPosition2').run();
      await sleep(0);

      {
        const ydoc: Y.Doc = await new Promise((resolve, reject) =>
          editor.chain().getYDoc({ resolve, reject }).run()
        );
        const yxml: Y.XmlFragment = ydoc.get('kerebron:doc', Y.XmlFragment);

        editor.view.focus();
        await sleep(10);
        console.log(
          'editor.view.state.selection1',
          editor.view.state.selection.anchor,
        );

        const p: Y.XmlElement = yxml.get(0) as Y.XmlElement;
        // const p = new Y.XmlElement('paragraph');
        p.insert(0, [new Y.XmlText('hello world!')]);
        // yxml.insert(0, [p]);

        console.log(
          'editor.view.state.selection2',
          editor.view.state.selection.anchor,
        );
        assert(editor.view.state.selection.anchor === 1);
        assert(editor.view.state.selection.head === 1);
      }

      editor.destroy();
      await sleep(STEP_TS);
    } finally {
      await shutdownServer(server);
    }
  });
}
