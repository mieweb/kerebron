import * as fc from 'npm:fast-check@^3.17.1';
import { next as automerge } from '@automerge/automerge';

import { assert, assertEquals, assertFalse, AssertionError } from '@std/assert';

import { patchSpans } from '../src/maintainSpans.ts';
import { describe, splitBlock } from './testUtils.ts';
import { deepEqual } from 'node:assert';
import process from 'node:process';

describe('the patchSpans function', () => {
  Deno.test('should update the spans after a delete', () => {
    const spans: automerge.Span[] = [
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line one' },
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line two' },
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line three' },
    ];
    patchSpans(['text'], spans, {
      action: 'del',
      path: ['text', 5],
      length: 4,
    });
    assertEquals(spans, [
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line' },
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line two' },
      { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      { type: 'text', value: 'line three' },
    ]);
  });

  describe('when handling a block insertion', () => {
    Deno.test('should insert a new block after top level text', () => {
      const spans: automerge.Span[] = [{ type: 'text', value: 'hello world' }];
      for (
        const patch of splitBlock(6, {
          type: 'paragraph',
          parents: [],
          attrs: {},
        })(['text'])
      ) {
        patchSpans(['text'], spans, patch);
      }
      assertEquals(spans, [
        { type: 'text', value: 'hello ' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'world' },
      ]);
    });

    Deno.test('should break text into two nodes', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'item 1' },
      ];
      for (
        const patch of splitBlock(4, {
          type: 'paragraph',
          parents: [],
          attrs: {},
        })(['text'])
      ) {
        patchSpans(['text'], spans, patch);
      }
      assertEquals(spans, [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'ite' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: {},
          },
        },
        { type: 'text', value: 'm 1' },
      ]);
    });

    Deno.test('should set the attributes from the patch', () => {
      const spans: automerge.Span[] = [{ type: 'text', value: 'hello world' }];
      for (
        const patch of splitBlock(6, {
          type: 'paragraph',
          parents: [],
          attrs: { type: new automerge.RawString('todo') },
        })(['text'])
      ) {
        patchSpans(['text'], spans, patch);
      }
      assertEquals(spans, [
        { type: 'text', value: 'hello ' },
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: { type: new automerge.RawString('todo') },
          },
        },
        { type: 'text', value: 'world' },
      ]);
    });

    Deno.test('should set the attributes from the patch when not splitting text', () => {
      const spans: automerge.Span[] = [{ type: 'text', value: 'hello world' }];
      for (
        const patch of splitBlock(0, {
          type: 'paragraph',
          parents: [],
          attrs: { type: new automerge.RawString('todo') },
        })(['text'])
      ) {
        patchSpans(['text'], spans, patch);
      }
      assertEquals(spans, [
        {
          type: 'block',
          value: {
            type: new automerge.RawString('paragraph'),
            parents: [],
            attrs: { type: new automerge.RawString('todo') },
          },
        },
        { type: 'text', value: 'hello world' },
      ]);
    });
  });

  describe('when deleting a block', () => {
    Deno.test('should join two sibling blocks', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello ' },
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'world' },
      ];
      patchSpans(['text'], spans, {
        action: 'del',
        path: ['text', 7],
      });
      assertEquals(spans, [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello world' },
      ]);
    });

    Deno.test('should remove the last block', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello world' },
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
      ];
      patchSpans(['text'], spans, {
        action: 'del',
        path: ['text', 12],
      });
      assertEquals(spans, [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello world' },
      ]);
    });

    Deno.test('should remove an intermediate empty block', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'hello world' },
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'next line' },
      ];
      patchSpans(['text'], spans, {
        action: 'del',
        path: ['text', 13],
      });
      assertEquals(spans, [
        { type: 'block', value: { parents: [], type: 'paragraph', attrs: {} } },
        { type: 'text', value: 'hello world' },
        { type: 'block', value: { parents: [], type: 'paragraph', attrs: {} } },
        { type: 'text', value: 'next line' },
      ]);
    });

    Deno.test('should remove the first block in a document', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'heading', parents: [], attrs: {} } },
        { type: 'text', value: 'heading one' },
      ];
      patchSpans(['text'], spans, {
        action: 'del',
        path: ['text', 0],
      });
      assertEquals(spans, [{ type: 'text', value: 'heading one' }]);
    });
  });

  describe('when handling updateBlock', () => {
    Deno.test('should update block marker attributes', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'item one' },
      ];
      patchSpans(['text'], spans, {
        action: 'insert',
        path: ['text', 0, 'parents', 0],
        values: ['ordered_list', 'list_item'],
      });
      assertEquals(spans, [
        {
          type: 'block',
          value: {
            type: 'paragraph',
            parents: ['ordered_list', 'list_item'],
            attrs: {},
          },
        },
        { type: 'text', value: 'item one' },
      ]);
    });

    Deno.test('should update the type', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'item one' },
      ];
      patchSpans(['text'], spans, {
        action: 'put',
        path: ['text', 0, 'type'],
        value: 'list_item',
      });
      patchSpans(['text'], spans, {
        action: 'put',
        path: ['text', 0, 'parents'],
        value: ['ordered_list'],
      });
      assertEquals(spans, [
        {
          type: 'block',
          value: { type: 'list_item', parents: ['ordered_list'], attrs: {} },
        },
        { type: 'text', value: 'item one' },
      ]);
    });

    Deno.test('should update the span attributes', () => {
      const spans: automerge.Span[] = [
        { type: 'block', value: { type: 'paragraph', parents: [], attrs: {} } },
        { type: 'text', value: 'item one' },
      ];
      patchSpans(['text'], spans, {
        action: 'put',
        path: ['text', 0, 'attrs', 'type'],
        value: 'todo',
      });
      assertEquals(spans, [
        {
          type: 'block',
          value: { type: 'paragraph', parents: [], attrs: { type: 'todo' } },
        },
        { type: 'text', value: 'item one' },
      ]);
    });
  });

  Deno.test('should handle deleting the whole document', () => {
    const spans: automerge.Span[] = [
      {
        type: 'block',
        value: { type: 'list_item', parents: ['ordered_list'], attrs: {} },
      },
      { type: 'text', value: 'item one' },
      {
        type: 'block',
        value: {
          type: 'list_item',
          parents: ['ordered_list', 'list_item', 'ordered_list'],
          attrs: {},
        },
      },
      { type: 'text', value: 'item two' },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'del',
        path: ['text', 0],
      },
      {
        action: 'del',
        path: ['text', 0],
        length: 8,
      },
      {
        action: 'del',
        path: ['text', 0],
      },
      {
        action: 'del',
        path: ['text', 0],
        length: 8,
      },
    ];
    for (const patch of patches) {
      patchSpans(['text'], spans, patch);
    }
    assertEquals(spans, []);
  });

  describe('when handling splice patches', () => {
    Deno.test('should not remove text blocks', () => {
      const spans: automerge.Span[] = [
        {
          type: 'block',
          value: {
            attrs: {
              level: 1,
            },
            parents: [],
            type: 'heading',
          },
        },
        {
          type: 'text',
          value: 'Heading',
        },
        {
          type: 'block',
          value: {
            type: 'paragraph',
            attrs: {},
            parents: [],
          },
        },
        {
          type: 'text',
          value: 'some text',
        },
        {
          type: 'block',
          value: {
            attrs: {},
            type: 'paragraph',
            parents: [],
          },
        },
        {
          type: 'text',
          value: 'b',
        },
        {
          type: 'block',
          value: {},
        },
      ];
      const patches: automerge.Patch[] = [
        { action: 'splice', path: ['text', 21], value: 'a' },
      ];
      for (const patch of patches) {
        patchSpans(['text'], spans, patch);
      }
      assertEquals(spans, [
        {
          type: 'block',
          value: {
            attrs: {
              level: 1,
            },
            parents: [],
            type: 'heading',
          },
        },
        {
          type: 'text',
          value: 'Heading',
        },
        {
          type: 'block',
          value: {
            type: 'paragraph',
            attrs: {},
            parents: [],
          },
        },
        {
          type: 'text',
          value: 'some text',
        },
        {
          type: 'block',
          value: {
            attrs: {},
            type: 'paragraph',
            parents: [],
          },
        },
        {
          type: 'text',
          value: 'b',
        },
        {
          type: 'block',
          value: {},
        },
        {
          type: 'text',
          value: 'a',
        },
      ]);
    });
  });

  Deno.test('should delete a block after splicing before the block', () => {
    const spansBefore: automerge.Span[] = [
      { type: 'block', value: { type: '0', parents: [], attrs: {} } },
      { type: 'text', value: ' 0' },
    ];
    const spansAfter: automerge.Span[] = [{ type: 'text', value: '  0' }];
    const patches: automerge.Patch[] = [
      { action: 'splice', path: ['text', 0], value: ' ' },
      { action: 'del', path: ['text', 1] },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle deletions which cross block boundaries', () => {
    const spansBefore: automerge.Span[] = [
      { type: 'text', value: '0Y d1' },
      { type: 'block', value: { type: 'ef', parents: [], attrs: {} } },
      { type: 'text', value: 'Y d1' },
      { type: 'block', value: { type: 'BtCbs', parents: [], attrs: {} } },
      { type: 'block', value: { type: 'ref', parents: [], attrs: {} } },
      { type: 'block', value: { type: 'n', parents: [], attrs: {} } },
      { type: 'block', value: { type: 'y', parents: [], attrs: {} } },
    ];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: '  Rd1' },
      { type: 'block', value: { parents: [], attrs: {}, type: 'BtCbs' } },
      { type: 'block', value: { type: 'ref', attrs: {}, parents: [] } },
      { type: 'block', value: { type: 'n', parents: [], attrs: {} } },
      { type: 'block', value: { type: 'y', parents: [], attrs: {} } },
    ];

    const patches: automerge.Patch[] = [
      { action: 'del', path: ['text', 0], length: 7 },
      { action: 'splice', path: ['text', 1], value: ' R' },
    ];

    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle more deletions which cross block boundaries', () => {
    const spansBefore: automerge.Span[] = [
      { type: 'block', value: { type: '0', parents: [], attrs: {} } },
      { type: 'text', value: '0A' },
    ];

    const spansAfter: automerge.Span[] = [{ type: 'text', value: ' XA' }];

    const patches: automerge.Patch[] = [
      { action: 'splice', path: ['text', 0], value: ' X' },
      { action: 'del', path: ['text', 2], length: 2 },
    ];

    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle simple mark splices', () => {
    const spansBefore: automerge.Span[] = [];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: 'a', marks: { a: ' ' } },
    ];
    const patches: automerge.Patch[] = [
      { action: 'splice', path: ['text', 0], value: 'a', marks: { a: ' ' } },
    ];

    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle splices with different marks', () => {
    const spansBefore: automerge.Span[] = [];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: 'a', marks: { ' ': ' ' } },
      { type: 'text', value: 'aaaaaacalwIyler' },
    ];
    const patches: automerge.Patch[] = [
      { action: 'splice', path: ['text', 0], value: 'a', marks: { ' ': ' ' } },
      { action: 'splice', path: ['text', 1], value: 'aaaaaacalwIyler' },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle splice patches which add a mark in an unmarked span', () => {
    const spansBefore: automerge.Span[] = [{ type: 'text', value: ' ' }];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: '0' },
      { type: 'text', value: '0', marks: { ' ': 'A' } },
      { type: 'text', value: 'K1 To 8000000 ' },
    ];
    const patches: automerge.Patch[] = [
      { action: 'splice', path: ['text', 0], value: '0' },
      { action: 'splice', path: ['text', 1], value: '0', marks: { ' ': 'A' } },
      { action: 'splice', path: ['text', 2], value: 'K1 To 8000000' },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle mark patches', () => {
    const spansBefore: automerge.Span[] = [{ type: 'text', value: ' ' }];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: ' ', marks: { '0': 'a' } },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'mark',
        path: ['text'],
        marks: [{ name: '0', value: 'a', start: 0, end: 1 }],
      },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should consolidate spans when marking', () => {
    const spansBefore: automerge.Span[] = [{ type: 'text', value: '0' }];
    const spansAfter: automerge.Span[] = [
      {
        type: 'text',
        value: 'aaaconstructoraaa',
        marks: { '17 ': 'prototype' },
      },
      { type: 'text', value: 'aaaaaaaaaaa0', marks: { a: ' ' } },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'splice',
        path: ['text', 0],
        value: 'aaaconstructoraaa',
        marks: { '17 ': 'prototype' },
      },
      {
        action: 'splice',
        path: ['text', 17],
        value: 'aaaaaaaaaaa',
        marks: { a: ' ' },
      },
      {
        action: 'mark',
        path: ['text'],
        marks: [{ name: 'a', value: ' ', start: 28, end: 29 }],
      },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle delete after a mark', () => {
    const spansBefore: automerge.Span[] = [{ type: 'text', value: 'aa' }];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: 'a', marks: { ' ': 'A' } },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'mark',
        path: ['text'],
        marks: [{ name: ' ', value: 'A', start: 0, end: 1 }],
      },
      { action: 'del', path: ['text', 1] },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should merge when a splice extends a marked range at the end', () => {
    const spansBefore: automerge.Span[] = [{ type: 'text', value: 'o world' }];
    const spansAfter: automerge.Span[] = [
      { type: 'text', value: 'hello top', marks: { bold: true } },
      { type: 'text', value: ' world' },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'splice',
        path: ['text', 0],
        value: 'hello t',
        marks: { bold: true },
      },
      {
        action: 'mark',
        path: ['text'],
        marks: [{ name: 'bold', value: true, start: 7, end: 8 }],
      },
      {
        action: 'splice',
        path: ['text', 8],
        value: 'p',
        marks: { bold: true },
      },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should do nothing when a mark is added to a block', () => {
    const spansBefore: automerge.Span[] = [
      { type: 'block', value: { type: '0', parents: [], attrs: {} } },
      { type: 'text', value: 'hello' },
    ];
    const patches: automerge.Patch[] = [
      {
        action: 'mark',
        path: ['text'],
        marks: [{ name: 'bold', value: true, start: 0, end: 1 }],
      },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansBefore);
  });

  Deno.test('should delete a block when the delete span ends in a block boundary', () => {
    const spansBefore: automerge.Span[] = [
      {
        type: 'text',
        value: 'hello',
      },
      { type: 'block', value: { type: '0', parents: [], attrs: {} } },
      { type: 'text', value: 'A' },
    ];
    const spansAfter: automerge.Span[] = [{ type: 'text', value: 'hA' }];
    const patches: automerge.Patch[] = [
      { action: 'del', path: ['text', 1], length: 5 },
    ];
    const patched = structuredClone(spansBefore);
    for (const patch of patches) {
      patchSpans(['text'], patched, patch);
    }
    assertEquals(patched, spansAfter);
  });

  Deno.test('should handle any kind of patch', function () {
    // this.timeout(0);
    fc.assert(
      fc.property(scenario(), ({ spansBefore, spansAfter, patches }) => {
        const updatedSpans = structuredClone(spansBefore);
        for (const patch of patches) {
          patchSpans(['text'], updatedSpans, patch);
        }
        deepEqual(updatedSpans, spansAfter);
      }),
      {
        numRuns: process.env.CI ? 10 : 100,
        reporter: (out) => {
          if (out.failed) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            console.log(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              `action: ${JSON.stringify(out.counterexample![0].actions)}`,
            );
            console.log('reproducing test case: \n');
            console.log('const spansBefore: am.Span[] = [');
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const span of out.counterexample![0].spansBefore) {
              console.log(JSON.stringify(span), ',');
            }
            console.log(']');
            console.log('const spansAfter: am.Span[] = [');
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const span of out.counterexample![0].spansAfter) {
              console.log(JSON.stringify(span), ',');
            }
            console.log(']');
            console.log('const patches: am.Patch[] = [');
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            for (const patch of out.counterexample![0].patches) {
              console.log(JSON.stringify(patch), ',');
            }
            console.log(']');
            throw new Error('failed');
          }
        },
      },
    );
  });
});

type Scenario = {
  spansBefore: automerge.Span[];
  spansAfter: automerge.Span[];
  patches: automerge.Patch[];
  actions: Action[];
};

function arbSpans(): fc.Arbitrary<automerge.Span[]> {
  return fc
    .array(
      fc.oneof(
        fc.record<automerge.Span>({
          type: fc.constant('block'),
          value: fc.record({
            type: symbolString(),
            parents: fc
              .array(symbolString(), { maxLength: 5 })
              .map((s) => s.map((s) => new automerge.RawString(s))),
            attrs: fc.object({
              maxDepth: 0,
              key: symbolString(),
              values: [sensibleString()],
            }),
          }),
        }),
        fc.record<automerge.Span>({
          type: fc.constant('text'),
          value: sensibleString({ size: 'small' }),
        }),
      ),
    )
    .map((spans) => {
      //consolidate consecutive text spans
      const result = [];
      let lastSpan: automerge.Span | null = null;
      for (const span of spans) {
        if (
          lastSpan !== null &&
          lastSpan.type === 'text' &&
          span.type === 'text'
        ) {
          lastSpan.value += span.value;
        } else {
          result.push(span);
          lastSpan = span;
        }
      }
      return result;
    });
}

function symbolString(): fc.Arbitrary<string> {
  return fc
    .string({ minLength: 0, maxLength: 20 })
    .filter((s) => /^[a-zA-Z0-9_]+$/.test(s) && s !== '__proto__');
}

function scenario(): fc.Arbitrary<Scenario> {
  return arbSpans().chain((spansBefore) => {
    let doc = automerge.from({ text: '' });
    doc = automerge.change(
      doc,
      (d) => automerge.updateSpans(d, ['text'], spansBefore),
    );
    const headsBefore = automerge.getHeads(doc);

    const doMoreModifications = (
      spansBefore: automerge.Span[],
      startHeads: automerge.Heads,
      doc: automerge.Doc<{ text: string }>,
      changesSoFar: number,
      actionsSoFar: Action[],
    ): fc.Arbitrary<{
      spansBefore: automerge.Span[];
      startHeads: automerge.Heads;
      doc: automerge.Doc<{ text: string }>;
      actions: Action[];
    }> => {
      if (changesSoFar >= 5) {
        return fc.constant({
          startHeads,
          doc,
          spansBefore: spansBefore,
          actions: actionsSoFar,
        });
      }
      return fc.tuple(arbAction(doc), fc.context()).chain(([action, ctx]) => {
        ctx.log(`action: ${JSON.stringify(action)}`);
        const updated = applyAction(automerge.clone(doc), action);
        const newActions = actionsSoFar.slice();
        newActions.push(action);
        return doMoreModifications(
          spansBefore,
          startHeads,
          updated,
          changesSoFar + 1,
          newActions,
        );
      });
    };

    return doMoreModifications(
      structuredClone(spansBefore),
      headsBefore,
      doc,
      0,
      [],
    ).map(({ spansBefore, startHeads, doc, actions }) => {
      const patches = automerge.diff(doc, startHeads, automerge.getHeads(doc));
      const spansAfter = automerge.spans(doc, ['text']);
      return {
        spansBefore: structuredClone(spansBefore),
        spansAfter,
        patches,
        actions,
      };
    });
  });
}

type Action =
  | { type: 'insert'; index: number; chars: string }
  | { type: 'delete'; index: number; length: number }
  | {
    type: 'addMark';
    range: automerge.MarkRange;
    name: string;
    value: string | boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'splitBlock'; index: number; value: { [key: string]: any } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'updateBlock'; index: number; value: { [key: string]: any } };

function arbAction(doc: automerge.Doc<{ text: string }>): fc.Arbitrary<Action> {
  if (doc.text.length === 0) {
    return fc.record<Action>({
      type: fc.constant('insert'),
      index: fc.constant(0),
      chars: sensibleString({ size: 'small' }),
    });
  }
  const actions = [insert(doc), del(doc), addMark(doc), arbSplitBlock(doc)];
  const spans = automerge.spans(doc, ['text']);
  const blockCount = spans.reduce((acc, span) => {
    if (span.type === 'block') {
      acc++;
    }
    return acc;
  }, 0);
  if (blockCount > 0) {
    actions.push(arbUpdateBlock(spans));
  }
  return fc.oneof(...actions);
}

function insert(doc: automerge.Doc<{ text: string }>): fc.Arbitrary<Action> {
  return fc.record<Action>({
    type: fc.constant('insert'),
    index: fc.integer({ min: 0, max: doc.text.length }),
    chars: sensibleString({ size: 'small' }),
  });
}

function del(doc: automerge.Doc<{ text: string }>): fc.Arbitrary<Action> {
  return fc
    .integer({ min: 0, max: doc.text.length })
    .chain((index) => {
      return fc.tuple(
        fc.constant(index),
        fc.integer({ min: 0, max: doc.text.length - index }),
      );
    })
    .map(([index, length]) => {
      return { type: 'delete', index, length };
    });
}

function addMark(doc: automerge.Doc<{ text: string }>): fc.Arbitrary<Action> {
  type MarkExpand = 'before' | 'after' | 'both' | 'none';
  function arbExpand(): fc.Arbitrary<MarkExpand> {
    return fc.oneof(
      fc.constant<MarkExpand>('before'),
      fc.constant<MarkExpand>('after'),
      fc.constant<MarkExpand>('both'),
      fc.constant<MarkExpand>('none'),
    );
  }
  return fc.integer({ min: 0, max: doc.text.length - 1 }).chain((start) => {
    const end = fc.integer({ min: start + 1, max: doc.text.length });
    return fc.tuple(end, arbExpand()).chain(([end, expand]) => {
      return fc.record<Action>({
        type: fc.constant('addMark'),
        range: fc.constant({ start, end, expand }),
        name: fc.oneof(fc.constant('bold'), fc.constant('italic')),
        value: fc.oneof(fc.boolean(), fc.constant('stringval')),
      });
    });
  });
}

function arbSplitBlock(
  doc: automerge.Doc<{ text: string }>,
): fc.Arbitrary<Action> {
  return fc.record<Action>({
    type: fc.constant('splitBlock'),
    index: fc.integer({ min: 0, max: doc.text.length - 1 }),
    value: arbBlock(),
  });
}

function arbUpdateBlock(spans: automerge.Span[]): fc.Arbitrary<Action> {
  const blockIndices: number[] = spans.reduce((acc, span, index) => {
    if (span.type === 'block') {
      acc.push(index);
    }
    return acc;
  }, [] as number[]);
  return fc
    .tuple(fc.constantFrom(...blockIndices), arbBlock())
    .map(([index, block]) => {
      return { type: 'updateBlock', index, value: block };
    });
}

function arbBlock() {
  return fc.record({
    type: symbolString(),
    parents: fc
      .array(symbolString(), { maxLength: 5 })
      .map((s) => s.map((s) => new automerge.RawString(s))),
    attrs: fc.object({
      maxDepth: 2,
      key: symbolString(),
      values: [sensibleString().map((s) => new automerge.RawString(s))],
    }),
  });
}

function applyAction(
  doc: automerge.Doc<{ text: string }>,
  action: Action,
): automerge.Doc<{ text: string }> {
  return automerge.change(doc, (d) => {
    if (action.type === 'insert') {
      automerge.splice(d, ['text'], action.index, 0, action.chars);
    } else if (action.type === 'delete') {
      automerge.splice(d, ['text'], action.index, action.length, '');
    } else if (action.type === 'splitBlock') {
      automerge.splitBlock(d, ['text'], action.index, action.value);
    } else if (action.type === 'updateBlock') {
      automerge.updateBlock(d, ['text'], action.index, action.value);
    } else {
      automerge.mark(d, ['text'], action.range, action.name, action.value);
    }
  });
}

function sensibleString(
  constraints?: fc.StringMatchingConstraints,
): fc.Arbitrary<string> {
  if (constraints === undefined) {
    constraints = { size: 'small' };
  }
  return fc.stringMatching(/^[a-zA-Z0-9 ]+$/, constraints);
}
