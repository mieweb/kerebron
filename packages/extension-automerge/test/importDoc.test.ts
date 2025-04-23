import { Node as ProseMirrorNode } from 'prosemirror-model';

import { next as automerge } from '@automerge/automerge';

import { schema } from './basicSchema.ts';
import { SchemaAdapter } from '../src/SchemaAdapter.ts';
import { createNodeFromObject } from '@kerebron/editor/utilities';
import { pmDocToAm } from '../src/loader.ts';
import { assertEquals } from '@std/assert';

const basicSchemaAdapter = new SchemaAdapter(schema);

Deno.test('should load pm to am', () => {
  const doc2 = createNodeFromObject(
    {
      'type': 'doc',
      'content': [
        {
          'type': 'paragraph',
          'content': [
            {
              'type': 'text',
              'text': 'Before',
            },
            {
              'type': 'text',
              'text': 'Mark',
              'marks': [
                {
                  'type': 'strong',
                },
              ],
            },
            {
              'type': 'text',
              'text': 'After',
            },
          ],
        },
      ],
    },
    schema,
    {
      slice: false,
      parseOptions: {},
      errorOnInvalidContent: false,
    },
  ) as ProseMirrorNode;

  const amDoc = automerge.from({ text: '' });

  const updatedDoc = pmDocToAm(basicSchemaAdapter, amDoc, doc2);

  const spans = automerge.spans(updatedDoc, ['text']);
  const marks = automerge.marks(updatedDoc, ['text']);

  assertEquals(spans[0], { type: 'text', value: 'Before' });
  assertEquals(spans[1], {
    type: 'text',
    value: 'Mark',
    marks: { strong: true },
  });
  assertEquals(spans[2], { type: 'text', value: 'After' });

  assertEquals(marks[0], { name: 'strong', value: true, start: 6, end: 10 });
});
