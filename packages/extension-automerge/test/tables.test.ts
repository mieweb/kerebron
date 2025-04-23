import { Node as ProseMirrorNode } from 'prosemirror-model';

import { next as automerge } from '@automerge/automerge';

import { schema } from './basicSchema.ts';
import { SchemaAdapter } from '../src/SchemaAdapter.ts';
import { createNodeFromObject } from '@kerebron/editor/utilities';
import { createEmptyDocFromExisting, pmDocToAmHandle } from '../src/loader.ts';
import { amToPm } from '../src/amToPm.ts';
import { MemoryStorageAdapter } from '../../../examples/example-server-hono/src/automerge/MemoryStorageAdapter.ts';
import { Repo } from '@automerge/automerge-repo';
import { DocHandleChangePayload } from '../src/types.ts';
import { EditorState } from 'prosemirror-state';
import { amSpansToDoc } from '../src/amTraversal.ts';
import { assertEquals } from '@std/assert';

const basicSchemaAdapter = new SchemaAdapter(schema);

const pmDoc = {
  'type': 'doc',
  'content': [
    {
      'type': 'table',
      'attrs': {
        'class': 'table',
      },
      'content': [
        {
          'type': 'table_row',
          'content': [
            {
              'type': 'table_header',
              'attrs': {},
              'content': [
                {
                  'type': 'paragraph',
                  'content': [
                    {
                      'type': 'text',
                      'text': '1',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          'type': 'table_row',
          'content': [
            {
              'type': 'table_cell',
              'attrs': {},
              'content': [
                {
                  'type': 'paragraph',
                  'content': [
                    {
                      'type': 'text',
                      'text': '2',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    // {
    //   "type": "paragraph",
    //   "content": [
    //     {
    //       "type": "text",
    //       "text": "After TABLE"
    //     }
    //   ]
    // }
  ],
};

Deno.test('should load pm to am', () => {
  return;
  const doc2 = createNodeFromObject(pmDoc, schema, {
    slice: false,
    parseOptions: {},
    errorOnInvalidContent: false,
  }) as ProseMirrorNode;

  // const amDoc = automerge.from({ text: '' });

  // amDoc.

  const storage = new MemoryStorageAdapter();

  const repo = new Repo({
    network: [],
    storage,
    sharePolicy: () => Promise.resolve(false),
    // peerId: `storage-example-server-hono-hostname`,
  });

  const emptyDoc = createEmptyDocFromExisting(doc2)!;

  const state = EditorState.create({ schema, doc: emptyDoc });

  const handle = repo.create({ text: '' });

  const onAutoMergeChange: (
    args: DocHandleChangePayload<unknown>,
  ) => void = ({
    doc,
    patches,
    patchInfo,
  }) => {
    // console.log('onAutoMergeChange', doc, patches, patchInfo);

    const headsBefore = automerge.getHeads(patchInfo.before);
    const spans = automerge.spans(automerge.view(doc, headsBefore), ['text']);

    // console.log('_____');
    // console.log('spans from am', spans);
    // console.log('_____');
    // console.log('patches', patches)

    const tr = amToPm(basicSchemaAdapter, spans, patches, ['text'], state.tr);

    console.log('_____');
    // console.log('spans2 from am', spans);

    console.log('_____');

    for (const step of tr.steps) {
      console.log('tr.step', JSON.stringify(step, null, 2));
    }

    let newState = state.apply(tr);

    console.log(
      'newState.doc',
      JSON.stringify(newState.doc.content.toJSON(), null, 2),
    ); // Logs the document as a JSON object

    // console.log('Modified PM doc', JSON.stringify(newState.doc.content.toJSON(), null, 2)); // Logs the document as a JSON object

    // const spanstest = automerge.spans(doc, ['text']);
    // console.log('spanstest', spanstest);

    // const docAfter = amSpansToDoc(basicSchemaAdapter, spanstest);
    // console.log('docAfter', JSON.stringify(docAfter.content.toJSON(), null, 2)); // Logs the document as a JSON object

    // tr.setMeta('addToHistory', false); // remote changes should not be added to local stack

    // this.ignoreTr = true;
    // this.view.dispatch(tr);
    // this.ignoreTr = false;
  };

  handle.on('change', onAutoMergeChange);

  pmDocToAmHandle(basicSchemaAdapter, handle, doc2);

  // const updatedDoc = handle.docSync()!;

  // const spans = automerge.spans(updatedDoc, ['text']);
  // const marks = automerge.marks(updatedDoc, ['text']);

  // replace from 9 to 9,
  //     type: text

  //  replaceStep(adapter, spans, step as ReplaceStep, doc, path, pmDoc);
  //   console.log('spans', spans);

  /*

  const spans2 = [
    {
      type: "block",
      value: {
        type: { val: "table_header" },
        isEmbed: false,
        parents: [ { val: "table" }, { val: "table_row" } ],
        attrs: {}
      }
    },
    { type: "text", value: "1" },
    {
      type: "block",
      value: {
        attrs: {},
        type: { val: "table_cell" },
        parents: [ { val: "table" }, { val: "table_row" } ],
        isEmbed: false
      }
    },
    {
      type: "block",
      value: {
        attrs: {},
        parents: [],
        type: { val: "paragraph" },
        isEmbed: false
      }
    },
    { type: "text", value: "After TABLE" }
  ]
;

  */

  // const doc3 = amSpansToDoc(basicSchemaAdapter, spans2);
  // console.log('doc3', doc3.content);

  // pmDocToAmHandle

  // const syncPlugin = new SyncPlugin(schemaAdapter, pathToTextField, handle);

  // amToPm();
});

Deno.test('conversion of non RawString values', () => {
  return;
  const spans: automerge.Span[] = [
    {
      type: 'block',
      value: {
        type: { val: 'table_header' },
        isEmbed: false,
        attrs: {},
        parents: [{ val: 'table' }, { val: 'table_row' }],
      },
    },
    { type: 'text', value: '1' },
  ];

  const docAfter = amSpansToDoc(basicSchemaAdapter, spans);
  const content = docAfter.content.toJSON();
  assertEquals(content[0].type, 'table');
  assertEquals(content[0].content[0].type, 'table_row');
  assertEquals(content[0].content[0].content[0].type, 'table_header');

  // console.log("spans", spans)
});

Deno.test('conversion of RawString values', () => {
  return;
  const spans = [
    {
      type: 'block',
      value: {
        type: new automerge.RawString('table_header'),
        isEmbed: false,
        attrs: {},
        parents: [
          new automerge.RawString('table'),
          new automerge.RawString('table_row'),
        ],
      },
    },
    { type: 'text', value: '1' },
  ];

  const docAfter = amSpansToDoc(basicSchemaAdapter, spans);
  const content = docAfter.content.toJSON();
  assertEquals(content[0].type, 'table');
  assertEquals(content[0].content[0].type, 'table_row');
  assertEquals(content[0].content[0].content[0].type, 'table_header');
});

Deno.test('mmm of RawString values', () => {
  return;
  const spans = [
    {
      'type': 'block',
      'value': {
        'isEmbed': false,
        'parents': [
          {
            'val': 'table',
          },
          {
            'val': 'table_row',
          },
        ],
        'type': {
          'val': 'table_header',
        },
        'attrs': {},
      },
    },
    {
      'type': 'text',
      'value': '1',
    },
    {
      'type': 'block',
      'value': {
        'attrs': {},
        'isEmbed': false,
        'parents': [
          {
            'val': 'table',
          },
          {
            'val': 'table_row',
          },
        ],
        'type': {
          'val': 'table_header',
        },
      },
    },
    {
      'type': 'text',
      'value': '2',
    },
    {
      'type': 'block',
      'value': {
        'parents': [
          {
            'val': 'table',
          },
          {
            'val': 'table_row',
          },
        ],
        'type': {
          'val': 'table_cell',
        },
        'attrs': {},
        'isEmbed': false,
      },
    },
    {
      'type': 'text',
      'value': '3',
    },
    {
      'type': 'block',
      'value': {
        'type': {
          'val': 'table_cell',
        },
        'attrs': {},
        'isEmbed': false,
        'parents': [
          {
            'val': 'table',
          },
          {
            'val': 'table_row',
          },
        ],
      },
    },
    {
      'type': 'text',
      'value': '4',
    },
  ];

  const docAfter = amSpansToDoc(basicSchemaAdapter, spans);
  const content = docAfter.content.toJSON();
  console.log(
    'doc after block change',
    JSON.stringify(docAfter.content.toJSON(), null, 2),
  );
});

Deno.test('mmm2', () => {
  // return;
  const spans = [
    {
      type: 'block',
      value: {
        type: { val: 'table_header' },
        isEmbed: false,
        attrs: {},
        parents: [{ val: 'table' }, { val: 'table_row' }],
      },
    },
    { type: 'text', value: '1' },
    {
      type: 'block',
      value: {
        isEmbed: false,
        parents: [{ val: 'table' }, { val: 'table_row' }],
        type: { val: 'table_cell' },
        attrs: {},
      },
    },
    { type: 'text', value: '2' },
  ];

  const docAfter = amSpansToDoc(basicSchemaAdapter, spans);
  const content = docAfter.content.toJSON();
  console.log(
    'doc after block change',
    JSON.stringify(docAfter.content.toJSON(), null, 2),
  );
});
