import { next as automerge } from '@automerge/automerge/slim';
import {
  ContentMatch,
  Fragment,
  Node,
  NodeType,
  Schema,
} from 'prosemirror-model';

import { SchemaAdapter } from './SchemaAdapter.ts';
import {
  eventsWithIndexChanges,
  traverseNode,
  traverseSpans,
} from './amTraversal.ts';

export function pmNodeToSpans(
  adapter: SchemaAdapter,
  node: Node,
): (
  | {
    type: 'block';
    value: {
      type: automerge.RawString;
      parents: automerge.RawString[];
      attrs: { [key: string]: automerge.MaterializeValue };
      isEmbed: boolean;
    };
  }
  | { type: 'text'; value: string; marks?: automerge.MarkSet }
)[] {
  const events = traverseNode(adapter, node);
  const result: (
    | {
      type: 'block';
      value: {
        type: automerge.RawString;
        parents: automerge.RawString[];
        attrs: { [key: string]: automerge.MaterializeValue };
        isEmbed: boolean;
      };
    }
    | { type: 'text'; value: string; marks: automerge.MarkSet }
  )[] = [];
  for (const event of events) {
    if (event.type == 'block') {
      const attrs = { ...event.block.attrs };
      delete attrs.isAmgBlock;
      result.push({
        type: 'block',
        value: {
          type: new automerge.RawString(event.block.type),
          parents: event.block.parents.map((p) => new automerge.RawString(p)),
          attrs,
          isEmbed: event.block.isEmbed,
        },
      });
    } else if (event.type == 'text') {
      result.push({ type: 'text', value: event.text, marks: event.marks });
    }
  }
  return result;
}

export function pmRangeToAmRange(
  adapter: SchemaAdapter,
  spans: automerge.Span[],
  { from, to }: { from: number; to: number },
): { start: number; end: number } | null {
  const events = eventsWithIndexChanges(traverseSpans(adapter, spans));
  let amStart = null;
  let amEnd = null;
  let maxPmIdxSeen = null;
  let maxAmIdxSeen = null;

  if (from === 0) {
    amStart = 0;
  }

  while (
    maxPmIdxSeen == null ||
    maxPmIdxSeen <= to ||
    amStart == null ||
    amEnd == null
  ) {
    const next = events.next();
    if (next.done) {
      break;
    }
    const state = next.value;
    maxPmIdxSeen = state.after.pmIdx;
    maxAmIdxSeen = state.after.amIdx;

    if (amStart == null) {
      if (state.after.pmIdx < from) {
        continue;
      }
      if (state.event.type === 'text') {
        if (state.before.pmIdx > from) {
          // We already passed the start but this is the first automerge event
          // we've seen
          amStart = Math.max(state.before.amIdx, 0) + 1;
        } else if (state.before.pmIdx + state.event.text.length > from) {
          // The target `from` is in the middle of this text
          const diff = from - state.before.pmIdx;
          //amStart = Math.max(state.before.amIdx, 0) + diff + 1
          amStart = state.before.amIdx + diff + 1;
        } else {
          amStart = Math.max(state.after.amIdx, 0) + 1;
        }
      } else if (state.after.pmIdx >= from) {
        // we are only interested in blocks which start _after_ the from index
        amStart = state.after.amIdx + 1;
      }
    }
    if (amEnd == null) {
      if (state.after.pmIdx < to) {
        continue;
      }
      if (state.event.type === 'text') {
        if (state.before.pmIdx >= to) {
          amEnd = state.before.amIdx + 1;
        } else if (state.before.pmIdx + state.event.text.length > to) {
          const diff = to - state.before.pmIdx;
          //amEnd = Math.max(state.before.amIdx, 0) + diff + 1
          amEnd = state.before.amIdx + diff + 1;
        }
      } else {
        if (state.before.pmIdx >= to) {
          amEnd = state.before.amIdx + 1;
        }
      }
    }
  }

  if (amStart != null) {
    if (amEnd == null) {
      amEnd = maxAmIdxSeen ? maxAmIdxSeen + 1 : amStart;
    }
    return { start: amStart, end: amEnd };
  } else {
    const endOfDoc = maxAmIdxSeen ? maxAmIdxSeen + 1 : 0;
    return { start: endOfDoc, end: endOfDoc };
  }
}
