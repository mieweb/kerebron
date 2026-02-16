import * as Y from 'yjs';

import { MarkSpec, NodeSpec } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';

import * as promise from 'lib0/promise';

import {
  AnyExtensionOrReq,
  CoreEditor,
  EditorKit,
  Extension,
  Mark,
  Node,
} from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { assert, assertEquals, assertObjectMatch } from '@kerebron/test-utils';
import { YjsEditorKit } from '@kerebron/editor-kits/YjsEditorKit';

import { ySyncPluginKey } from '../src/keys.ts';
import { YSyncPluginState } from '../src/ySyncPlugin.ts';
import {
  prosemirrorJSONToYDoc,
  prosemirrorJSONToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from './convertUtils.ts';

function createNewProsemirrorView(editorKits: EditorKit[] = []) {
  const editor = CoreEditor.create({
    editorKits: [
      ...editorKits,
      new BrowserLessEditorKit(),
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
Deno.test('testPluginIntegrity', () => {
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

  const { ydoc, schema, view } = createNewProsemirrorView(editorKits);
  // const view = new DummyEditorView({
  //   state: EditorState.create({
  //     schema,
  //     plugins: [
  //       ySyncPlugin(ydoc.get('prosemirror', Y.XmlFragment)),
  //       yUndoPlugin(),
  //       customPlugin,
  //     ],
  //   }),
  // });
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('hello world'),
      ),
    ),
  );
  assertEquals({ viewUpdateEvents, stateUpdateEvents }, {
    viewUpdateEvents: 3, // nodeViews init + initialRender + view.dispach
    stateUpdateEvents: 2, // fired twice, because the ySyncPlugin adds additional fields to state after the initial render
  }, 'events are fired only once');
});

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

Deno.test('testOverlappingMarks', () => {
  const editorKit: EditorKit = {
    getExtensions(): AnyExtensionOrReq[] {
      return [new MarkComment()];
    },
  };
  const { ydoc, schema, view } = createNewProsemirrorView([editorKit]);

  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('hello world'),
      ),
    ),
  );

  view.dispatch(
    view.state.tr.addMark(1, 3, schema.mark('mcomment', { id: 4 })),
  );
  view.dispatch(
    view.state.tr.addMark(2, 4, schema.mark('mcomment', { id: 5 })),
  );
  const stateJSON = JSON.parse(JSON.stringify(view.state.doc.toJSON()));
  // attrs.ychange is only available with a schema
  delete stateJSON.content[0].attrs;
  const back = prosemirrorJSONToYDoc(schema, stateJSON);
  // test if transforming back and forth from Yjs doc works
  // const backandforth = JSON.parse(JSON.stringify(yDocToProsemirrorJSON(back)))
  const xmlFragment = back.getXmlFragment('prosemirror');
  const backandforth = JSON.parse(
    JSON.stringify(yXmlFragmentToProseMirrorRootNode(xmlFragment, schema)),
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
});

Deno.test('testDocTransformation', () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('hello world'),
      ),
    ),
  );
  const stateJSON = view.state.doc.toJSON();
  // test if transforming back and forth from Yjs doc works
  //
  {
    const ydoc = prosemirrorJSONToYDoc(schema, stateJSON);
    const xmlFragment = ydoc.getXmlFragment('prosemirror');
    const backandforth = yXmlFragmentToProseMirrorRootNode(xmlFragment, schema)
      .toJSON();
    assertEquals(stateJSON, backandforth);
  }
});

Deno.test('testXmlFragmentTransformation', () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('hello world'),
      ),
    ),
  );
  const stateJSON = view.state.doc.toJSON();
  console.log(JSON.stringify(stateJSON));
  // test if transforming back and forth from yXmlFragment works
  const xml = new Y.XmlFragment();
  prosemirrorJSONToYXmlFragment(/** @type {any} */ (schema), stateJSON, xml);
  const doc = new Y.Doc();
  doc.getMap('root').set('firstDoc', xml);
  const backandforth = yXmlFragmentToProseMirrorRootNode(xml, schema).toJSON();
  console.log(JSON.stringify(backandforth));
  assertEquals(stateJSON, backandforth);
});

Deno.test('testChangeOrigin', () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  const yXmlFragment = ydoc.get('prosemirror', Y.XmlFragment);
  const yundoManager = new Y.UndoManager(yXmlFragment, {
    trackedOrigins: new Set(['trackme']),
  });

  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('world'),
      ),
    ),
  );
  const ysyncState1 = ySyncPluginKey.getState(view.state)!;
  assert(ysyncState1.isChangeOrigin === false);
  assert(ysyncState1.isUndoRedoOperation === false);
  ydoc.transact(() => {
    yXmlFragment.get(0).get(0).insert(0, 'hello');
  }, 'trackme');
  const ysyncState2 = ySyncPluginKey.getState(view.state)!;
  assert(ysyncState2.isChangeOrigin === true);
  assert(ysyncState2.isUndoRedoOperation === false);
  yundoManager.undo();
  const ysyncState3 = ySyncPluginKey.getState(view.state)!;
  assert(ysyncState3.isChangeOrigin === true);
  assert(ysyncState3.isUndoRedoOperation === true);
});

Deno.test('testEmptyParagraph', () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  view.dispatch(
    view.state.tr.insert(
      0,
      schema.node(
        'paragraph',
        undefined,
        schema.text('123'),
      ),
    ),
  );
  const yxml = ydoc.get('prosemirror') as Y.XmlElement;
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    'contains one paragraph containing a ytext',
  );
  view.dispatch(view.state.tr.delete(1, 4)); // delete characters 123
  assert(
    yxml.length === 2 && yxml.get(0).length === 1,
    "doesn't delete the ytext",
  );
});

/**
 * Test duplication issue https://github.com/yjs/y-prosemirror/issues/161
 */
Deno.test('testInsertDuplication', () => {
  const { ydoc: ydoc1, schema: schema1, view: view1 } =
    createNewProsemirrorView();
  const { ydoc: ydoc2, schema: schema2, view: view2 } =
    createNewProsemirrorView();
  // const ydoc1 = new Y.Doc();
  ydoc1.clientID = 1;
  // const ydoc2 = new Y.Doc();
  ydoc2.clientID = 2;
  // const view1 = createNewProsemirrorView(ydoc1);
  // const view2 = createNewProsemirrorView(ydoc2);
  const yxml1 = ydoc1.getXmlFragment('prosemirror');
  const yxml2 = ydoc2.getXmlFragment('prosemirror');
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
  view1.dispatch(
    view1.state.tr.insert(
      0,
      schema1.node(
        'paragraph',
      ),
    ),
  );
  const sync = () => {
    Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));
    Y.applyUpdate(ydoc1, Y.encodeStateAsUpdate(ydoc2));
    Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));
    Y.applyUpdate(ydoc1, Y.encodeStateAsUpdate(ydoc2));
  };
  sync();
  view1.dispatch(view1.state.tr.insertText('1', 1, 1));
  view2.dispatch(view2.state.tr.insertText('2', 1, 1));
  sync();
  view1.dispatch(view1.state.tr.insertText('1', 2, 2));
  view2.dispatch(view2.state.tr.insertText('2', 3, 3));
  sync();
  checkResult({ testObjects: [view1, view2] });
  assert(
    yxml1.toString() === '<paragraph>1122</paragraph><paragraph></paragraph>',
  );
});

Deno.test('testInsertRightMatch', () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  const yXmlFragment = ydoc.get('prosemirror', Y.XmlFragment);
  view.dispatch(
    view.state.tr.insert(
      0,
      [
        schema.node(
          'heading',
          { level: 1 },
          schema.text('Heading 1'),
        ),
        schema.node(
          'paragraph',
          undefined,
          schema.text('Paragraph 1'),
        ),
      ],
    ),
  );
  prosemirrorJSONToYXmlFragment(
    schema,
    view.state.doc.toJSON(),
    yXmlFragment,
  );
  const lastP = yXmlFragment.get(yXmlFragment.length - 1);
  const tr = view.state.tr;
  view.dispatch(
    tr.insert(
      tr.doc.child(0).nodeSize + tr.doc.child(1).nodeSize,
      schema.node(
        'paragraph',
        undefined,
        schema.text('Paragraph 2'),
      ),
    ),
  );
  const newLastP = yXmlFragment.get(yXmlFragment.length - 1);
  const new2ndLastP = yXmlFragment.get(yXmlFragment.length - 2);
  assert(lastP === newLastP, 'last paragraph is the same as before');
  assert(
    new2ndLastP.toString() === '<paragraph>Paragraph 2</paragraph>',
    '2nd last paragraph is the inserted paragraph',
  );
  assert(
    lastP.toString() === '<paragraph></paragraph>',
    'last paragraph remains empty and is placed at the end',
  );
});

/**
 * Tests for #126 - initial cursor position should be retained, not jump to the end.
 */
Deno.test('testInitialCursorPosition', async () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  const p = new Y.XmlElement('paragraph');
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  p.insert(0, [new Y.XmlText('hello world!')]);
  yxml.insert(0, [p]);

  view.focus();
  await promise.wait(10);
  assert(view.state.selection.anchor === 1);
  assert(view.state.selection.head === 1);
});

Deno.test('testInitialCursorPosition2', async () => {
  const { ydoc, schema, view } = createNewProsemirrorView();
  const yxml = ydoc.get('prosemirror', Y.XmlFragment);
  view.focus();

  await promise.wait(10);
  const p = new Y.XmlElement('paragraph');
  p.insert(0, [new Y.XmlText('hello world!')]);
  yxml.insert(0, [p]);
  assert(view.state.selection.anchor === 1);
  assert(view.state.selection.head === 1);
});

class NodeCustom extends Node {
  override name = 'custom';

  override getNodeSpec(): NodeSpec {
    return {
      atom: true,
      group: 'block',
      attrs: { checked: { default: false } },
      parseDOM: [{ tag: 'div' }],
      toDOM() {
        return ['div'];
      },
    };
  }
}

Deno.test('testEmptyNotSync', () => {
  const editorKit: EditorKit = {
    getExtensions(): AnyExtensionOrReq[] {
      return [new NodeCustom()];
    },
  };
  const { ydoc, schema, view } = createNewProsemirrorView([editorKit]);
  const type = ydoc.getXmlFragment('prosemirror');
  assert(type.toString() === '', 'should only sync after first change');

  view.dispatch(
    view.state.tr.setNodeMarkup(0, undefined, {
      checked: true,
    }),
  );
  assertEquals(
    type.toString(),
    '<custom checked="true"></custom>',
  );
});
