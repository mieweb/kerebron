import { next as automerge } from '@automerge/automerge/slim';
import {
  ContentMatch,
  Fragment,
  Node,
  NodeType,
  Schema,
} from 'prosemirror-model';

import { amSpanToSpan, BlockMarker, isBlockMarker } from './types.ts';
import {
  amMarksFromPmMarks,
  NodeMapping,
  pmMarksFromAmMarks,
  SchemaAdapter,
} from './SchemaAdapter.ts';

type RenderRole = 'explicit' | 'render-only';

interface ParentNode {
  idx: number;
  node: Node;
}

export type TraversalEvent =
  | {
    type: 'openTag';
    tag: string;
    role: RenderRole;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attrs?: { [key: string]: any };
  }
  | { type: 'closeTag'; tag: string; role: RenderRole }
  | { type: 'leafNode'; tag: string; role: RenderRole }
  | { type: 'text'; text: string; marks: automerge.MarkSet }
  | {
    type: 'block';
    isUnknown?: boolean;
    block: {
      type: string;
      parents: string[];
      attrs: { [key: string]: automerge.MaterializeValue };
      isEmbed: boolean;
    };
  };

/**
 * Convert an array of AutoMerge spans into a ProseMirror doc.
 * @param adapter
 * @param spans
 * @returns
 */
export function amSpansToDoc(
  adapter: SchemaAdapter,
  spans: automerge.Span[],
): Node {
  const events = traverseSpans(adapter, spans);
  type StackItem = {
    tag: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attrs: { [key: string]: any };
    children: Node[];
  };
  const stack: StackItem[] = [
    {
      tag: 'doc',
      attrs: {},
      children: [],
    },
  ];
  let nextBlockAmgAttrs: { [key: string]: automerge.MaterializeValue } | null =
    null;

  for (const event of events) {
    if (event.type === 'openTag') {
      const attrs = Object.assign({}, nextBlockAmgAttrs, event.attrs);
      stack.push({
        tag: event.tag,
        attrs,
        children: [],
      });
    } else if (event.type === 'closeTag') {
      //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { children, attrs, tag } = stack.pop()!;
      const node = constructNode(adapter.schema, tag, attrs, children);
      stack[stack.length - 1].children.push(node);
    } else if (event.type === 'leafNode') {
      stack[stack.length - 1].children.push(
        constructNode(adapter.schema, event.tag, nextBlockAmgAttrs || {}, []),
      );
    } else if (event.type === 'text') {
      const pmMarks = pmMarksFromAmMarks(adapter, event.marks);
      stack[stack.length - 1].children.push(
        adapter.schema.text(event.text, pmMarks),
      );
    }

    if (event.type === 'block') {
      nextBlockAmgAttrs = { isAmgBlock: true, ...event.block.attrs };
      if (event.isUnknown) {
        nextBlockAmgAttrs.unknownBlock = event.block;
      }
    } else {
      nextBlockAmgAttrs = null;
    }
  }
  if (stack.length !== 1) {
    throw new Error('Invalid stack length');
  } else {
    const { children, attrs, tag } = stack[0];
    return constructNode(adapter.schema, tag, attrs, children);
  }
}

function constructNode(
  schema: Schema,
  nodeName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attrs: { [key: string]: any },
  children: Node[],
): Node {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownAttrs: { [key: string]: any } = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unknownAttrs: { [key: string]: any } = {};
  let hasUnknownAttr = false;
  for (const name of Object.keys(attrs)) {
    if (
      name === 'isAmgBlock' ||
      name === 'unknownBlock' ||
      name === 'unknownAttrs'
    ) {
      knownAttrs[name] = attrs[name];
      continue;
    }
    const attrSpec = schema.nodes[nodeName]?.spec?.attrs?.[name];
    if (attrSpec != null) {
      knownAttrs[name] = attrs[name];
    } else {
      hasUnknownAttr = true;
      unknownAttrs[name] = attrs[name];
    }
  }
  if (hasUnknownAttr) {
    knownAttrs.unknownAttrs = unknownAttrs;
  }
  return schema.node(nodeName, knownAttrs, children);
}

export function amSpliceIdxToPmIdx(
  adapter: SchemaAdapter,
  spans: automerge.Span[],
  target: number,
): number | null {
  const events = eventsWithIndexChanges(traverseSpans(adapter, spans));
  let maxInsertableIndex = null;

  for (const state of events) {
    if (state.before.amIdx >= target && maxInsertableIndex != null) {
      return maxInsertableIndex;
    }
    if (state.event.type === 'openTag') {
      if (adapter.schema.nodes[state.event.tag].isTextblock) {
        maxInsertableIndex = state.after.pmIdx;
      }
    } else if (state.event.type === 'leafNode') {
      maxInsertableIndex = state.after.pmIdx;
    } else if (state.event.type === 'text') {
      maxInsertableIndex = state.after.pmIdx;
      if (state.after.amIdx >= target) {
        if (state.before.amIdx + state.event.text.length >= target) {
          const diff = target - state.before.amIdx;
          return state.before.pmIdx + diff - 1;
        }
      }
    }
  }
  return maxInsertableIndex;
}

export function amIdxToPmBlockIdx(
  adapter: SchemaAdapter,
  spans: automerge.Span[],
  target: number,
): number | null {
  const events = eventsWithIndexChanges(traverseSpans(adapter, spans));
  let lastBlockStart = null;
  let isFirstTag = true;

  for (const state of events) {
    if (state.event.type === 'openTag') {
      if (state.event.role === 'explicit') {
        lastBlockStart = state.after.pmIdx;
      } else if (
        adapter.schema.nodes[state.event.tag].isTextblock &&
        isFirstTag
      ) {
        // If there's a render-only opening paragraph then everything before
        // the first block marker should be inside it
        lastBlockStart = state.after.pmIdx;
      }
      isFirstTag = false;
    } else if (state.event.type === 'block') {
      if (state.after.amIdx === target) {
        return state.after.pmIdx + 1;
      }
    }
    if (state.after.amIdx >= target) {
      return lastBlockStart;
    }
  }
  return lastBlockStart;
}

type Indexes = {
  amIdx: number;
  pmIdx: number;
};

export function* eventsWithIndexChanges(
  events: IterableIterator<TraversalEvent>,
): IterableIterator<{
  event: TraversalEvent;
  before: Indexes;
  after: Indexes;
}> {
  let pmOffset = 0;
  let amOffset = -1;

  while (true) {
    const next = events.next();
    if (next.done) {
      return;
    }
    const event = next.value;
    const before = { amIdx: amOffset, pmIdx: pmOffset };

    if (event.type === 'openTag' && event.tag !== 'doc') {
      pmOffset += 1;
    } else if (event.type === 'closeTag' && event.tag !== 'doc') {
      pmOffset += 1;
    } else if (event.type === 'leafNode') {
      pmOffset += 1;
    } else if (event.type === 'text') {
      amOffset += event.text.length;
      pmOffset += event.text.length;
    } else if (event.type === 'block') {
      amOffset += 1;
    }
    const after = { amIdx: amOffset, pmIdx: pmOffset };
    yield { event, before, after };
  }
}

export function* traverseNode(
  adapter: SchemaAdapter,
  node: Node,
): IterableIterator<TraversalEvent> {
  const toProcess: (
    | TraversalEvent
    | {
      type: 'node';
      node: Node;
      parent: Node | null;
      indexInParent: number;
      numChildrenInParent: number;
    }
  )[] = [
    {
      node,
      parent: null,
      indexInParent: 0,
      numChildrenInParent: node.childCount,
      type: 'node',
    },
  ];
  const nodePath: Node[] = [];

  while (toProcess.length > 0) {
    const next = toProcess.pop();
    if (next == null) {
      return;
    }
    if (next.type === 'node') {
      const cur = next.node;
      if (cur.isText) {
        const marks = amMarksFromPmMarks(adapter, cur.marks);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        yield { type: 'text', text: cur.text!, marks };
      } else {
        const maybeBlock = blockForNode(
          adapter,
          cur,
          nodePath,
          next.indexInParent,
          next.numChildrenInParent,
        );
        const role = maybeBlock != null ? 'explicit' : 'render-only';

        if (maybeBlock != null) {
          const { block, isUnknown } = maybeBlock;
          yield {
            type: 'block',
            isUnknown,
            block,
          };
        }
        if (cur.isLeaf) {
          yield { type: 'leafNode', tag: cur.type.name, role };
        } else {
          yield { type: 'openTag', tag: cur.type.name, role };
          // nodePath.push({ node: cur, idx: 0 });
          nodePath.push(cur);

          toProcess.push({ type: 'closeTag', tag: cur.type.name, role });
          for (let i = cur.childCount - 1; i >= 0; i--) {
            toProcess.push({
              parent: cur,
              indexInParent: i,
              numChildrenInParent: cur.childCount,
              type: 'node',
              node: cur.child(i),
            });
          }
        }
      }
    } else {
      if (next.type === 'closeTag') {
        nodePath.pop();
      }
      yield next;
    }
  }
}

function blockForNode(
  adapter: SchemaAdapter,
  node: Node,
  nodePath: Node[],
  indexInParent: number,
  numChildrenInParent: number,
): {
  isUnknown: boolean;
  block: {
    type: string;
    parents: string[];
    attrs: { [key: string]: automerge.MaterializeValue };
    isEmbed: boolean;
  };
} | null {
  // Round trip unknown blocks through the editor
  if (node.attrs.unknownBlock != null) {
    return {
      isUnknown: true,
      block: node.attrs.unknownBlock,
    };
  }

  const blockMapping = blockMappingForNode(adapter, node);

  if (blockMapping == null) {
    if (node.attrs.isAmgBlock) {
      throw new Error('no mapping found for node which is marked as a block');
    }
    return null;
  }

  const attrs = blockMapping.attrParsers?.fromProsemirror(node) || {};
  // make sure to round trip unknown attributes
  if (node.attrs.unknownAttrs != null) {
    for (const key of Object.keys(node.attrs.unknownAttrs)) {
      attrs[key] = node.attrs.unknownAttrs[key];
    }
  }

  // We have a few things to do
  // 1. If this node has `isAmgBlock: true` then we just need to get the block
  //    mapping and emit the correct block
  // 2. If this node has `isAmgBlock: false` then we have to decide, based on
  //    it's descendants, whether we should emit a block at this point

  if (node.attrs.isAmgBlock) {
    return {
      isUnknown: false,
      block: {
        type: blockMapping.blockName,
        parents: findParents(adapter, nodePath),
        attrs,
        isEmbed: blockMapping.isEmbed || false,
      },
    };
  } else if (blockMapping && blockMapping.isEmbed) {
    return {
      isUnknown: false,
      block: {
        type: blockMapping.blockName,
        parents: findParents(adapter, nodePath),
        attrs,
        isEmbed: true,
      },
    };
  } else {
    // Two possibilities:
    //
    // 1. The block is a container for an `isAmgBlock: true` block
    // 2. The block is a newly inserted block

    const explicitChildren = findExplicitChildren(node);
    if (explicitChildren != null) {
      // This block has explicit children. So we only need to emit a block
      // marker if the content before the first explicit child is different to
      // that which would be emitted by the default schema
      const defaultContent = blockMapping.content.contentMatch.fillBefore(
        Fragment.from([explicitChildren.first]),
        true,
      );
      if (defaultContent == null) {
        throw new Error('schema could not find wrapping');
      }
      if (defaultContent.eq(explicitChildren.contentBeforeFirst)) {
        return null;
      }
    }

    let emitBlock = false;
    if (node.isTextblock) {
      const lastParent = nodePath[nodePath.length - 1];
      const lastParentNode = lastParent;
      // const lastParentNode = lastParent.node;
      if (
        lastParentNode == null ||
        (lastParentNode.type === adapter.schema.nodes.doc &&
          numChildrenInParent > 1)
      ) {
        // we're at the top level and there are multiple children, so we need to emit a block marker
        emitBlock = true;
      } else {
        // If we're the first node in our parent, and we're the default textblock
        // for that parent then we don't emit a block marker
        const isTextWrapper =
          lastParentNode.type.contentMatch.defaultType === node.type &&
          indexInParent === 0 &&
          !node.attrs.isAmgBlock;
        if (!isTextWrapper) {
          emitBlock = true;
        }
      }
    } else if (hasImmediateTextChild(node)) {
      emitBlock = true;
    }
    if (emitBlock) {
      return {
        isUnknown: blockMapping.content === adapter.unknownBlock,
        block: {
          type: blockMapping.blockName,
          parents: findParents(adapter, nodePath),
          attrs,
          isEmbed: blockMapping.isEmbed || false,
        },
      };
    } else {
      return null;
    }
  }
}

function hasImmediateTextChild(node: Node): boolean {
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i).isTextblock) {
      return true;
    }
  }
  return false;
}

type ExplicitChildren = {
  /**
   * The content before the first child which has `isAmgBlock: true` or has a
   * descendant with `isAmgBlock: true`
   */
  contentBeforeFirst: Fragment;
  /**
   * The child which has `isAmgBlock: true` or has a descendant with
   * `isAmgBlock: true`
   */
  first: Node;
};

/**
 * Find the first child of this node which either has `isAmgBlock: true` or
 * has a descendant with `isAmgBlock: true`
 */
function findExplicitChildren(node: Node): ExplicitChildren | null {
  let numExplicitChildren = 0;
  let firstExplicitChild = null;
  const contentBeforeFirst = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    let hasExplicitDescendant = false;
    if (child.attrs.isAmgBlock) {
      hasExplicitDescendant = true;
    } else {
      child.descendants((desc) => {
        if (desc.attrs.isAmgBlock) {
          hasExplicitDescendant = true;
          return false;
        }
        return true;
      });
    }
    if (hasExplicitDescendant) {
      numExplicitChildren++;
      if (firstExplicitChild == null) {
        firstExplicitChild = child;
      }
    }
    if (firstExplicitChild == null) {
      contentBeforeFirst.push(child);
    }
    if (numExplicitChildren > 1) {
      break;
    }
  }
  if (numExplicitChildren > 0) {
    return {
      contentBeforeFirst: Fragment.from(contentBeforeFirst),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      first: firstExplicitChild!,
    };
  } else {
    return null;
  }
}

function blockMappingForNode(
  adapter: SchemaAdapter,
  node: Node,
): NodeMapping | null {
  if (node.type === adapter.unknownBlock && node.attrs.unknownParentBlock) {
    return {
      blockName: node.attrs.unknownParentBlock,
      content: node.type,
      isEmbed: false,
    };
  }

  const possibleMappings = adapter.nodeMappings.filter(
    (m) => m.content === node.type,
  );
  if (possibleMappings.length === 0) {
    return null;
  }

  return possibleMappings[0];
}

function findParents(adapter: SchemaAdapter, parentNodes: Node[]): string[] {
  const parents: string[] = [];
  for (const [index, parent] of parentNodes.entries()) {
    const node = parent; // .node;
    if (
      index === parentNodes.length - 1 &&
      node.isTextblock &&
      !node.attrs.isAmgBlock
    ) {
      // If the last node is a render-only text block then we don't need to emit it, the
      // schema will take care of inserting it around the content for us
      continue;
    }
    const mapping = blockMappingForNode(
      adapter,
      node,
    );
    if (mapping == null) {
      continue;
    }
    parents.push(mapping.blockName);
  }
  return parents;
}

export function* traverseSpans(
  adapter: SchemaAdapter,
  amSpans: automerge.Span[],
): IterableIterator<TraversalEvent> {
  const blockSpans = amSpans.map(amSpanToSpan);
  if (blockSpans.length === 0) {
    return yield* [
      { type: 'openTag', tag: 'paragraph', role: 'render-only' },
      { type: 'closeTag', tag: 'paragraph', role: 'render-only' },
    ];
  }
  const state = new TraverseState(adapter);

  for (const span of blockSpans) {
    if (span.type === 'block') {
      yield* state.newBlock(span.value);
    } else {
      yield* state.newText(span.value, span.marks || {});
    }
  }
  yield* state.finish();
}

class TraverseState {
  adapter: SchemaAdapter;
  lastBlock: BlockMarker | null = null;
  stack: { node: NodeType; role: RenderRole; lastMatch: ContentMatch }[] = [];
  topMatch: ContentMatch;

  constructor(adapter: SchemaAdapter) {
    this.adapter = adapter;
    this.stack = [];
    this.topMatch = this.adapter.schema.nodes.doc.contentMatch;
  }

  set currentMatch(match: ContentMatch) {
    if (match === null) {
      throw new Error('Match cannot be null');
    }
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].lastMatch = match;
    } else {
      this.topMatch = match;
    }
  }

  get currentMatch(): ContentMatch {
    if (this.stack.length > 0) {
      return this.stack[this.stack.length - 1].lastMatch;
    } else {
      return this.topMatch;
    }
  }

  *newBlock(block: BlockMarker): IterableIterator<TraversalEvent> {
    if (block.isEmbed) {
      const { content } = nodesForBlock(
        this.adapter,
        block.type.val,
        block.isEmbed,
      );
      const wrapping = this.currentMatch.findWrapping(content);
      if (wrapping) {
        for (let i = 0; i < wrapping.length; i++) {
          yield this.pushNode(wrapping[i], null, 'render-only');
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.currentMatch = this.currentMatch.matchType(content)!;
      yield blockEvent(this.adapter, block);
      yield { type: 'leafNode', tag: content.name, role: 'explicit' };
      return;
    }
    const newOuter = outerNodeTypes(this.adapter, block);
    let i = 0;
    while (i < newOuter.length && i < this.stack.length) {
      if (this.stack[i].node !== newOuter[i].type) {
        break;
      }
      i++;
    }
    const toClose = this.stack.splice(i);
    for (const { node, role, lastMatch } of toClose.toReversed()) {
      yield* this.finishStackFrame({ node, role, lastMatch });
      yield { type: 'closeTag', tag: node.name, role };
    }
    for (let j = i; j < newOuter.length; j++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { type: next, attrs } = newOuter[j]!;
      yield* this.fillBefore(next);
      yield this.pushNode(next, attrs, 'render-only');
    }
    yield blockEvent(this.adapter, block);
    const { content } = nodesForBlock(
      this.adapter,
      block.type.val,
      block.isEmbed || false,
    );
    yield this.pushNode(content, null, 'explicit');
  }

  pushNode(
    node: NodeType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attrs: { [key: string]: any } | null,
    role: RenderRole,
  ): TraversalEvent {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.currentMatch = this.currentMatch.matchType(node)!;
    this.stack.push({ node, role, lastMatch: node.contentMatch });
    return { type: 'openTag', tag: node.name, role, ...(attrs && { attrs }) };
  }

  *newText(
    text: string,
    marks: automerge.MarkSet,
  ): IterableIterator<TraversalEvent> {
    const wrapping = this.currentMatch.findWrapping(
      this.adapter.schema.nodes.text,
    );

    if (wrapping) {
      for (let i = 0; i < wrapping.length; i++) {
        yield this.pushNode(wrapping[i], null, 'render-only');
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.currentMatch = this.currentMatch.matchType(
      this.adapter.schema.nodes.text,
    )!;
    yield { type: 'text', text, marks };
  }

  *finish(): IterableIterator<TraversalEvent> {
    for (const { node, role, lastMatch } of this.stack.toReversed()) {
      yield* this.finishStackFrame({ node, role, lastMatch });
      yield { type: 'closeTag', tag: node.name, role };
    }
  }

  *fillBefore(node: NodeType): IterableIterator<TraversalEvent> {
    const fill = this.currentMatch.fillBefore(Fragment.from(node.create()));
    if (fill != null) {
      yield* this.emitFragment(fill);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.currentMatch = this.currentMatch.matchFragment(fill)!;
    }
  }

  *emitFragment(fragment: Fragment): IterableIterator<TraversalEvent> {
    type Event =
      | { type: 'open'; node: Node }
      | { type: 'close'; node: NodeType };
    const toProcess: Event[] = [];
    for (let i = fragment.childCount - 1; i >= 0; i--) {
      toProcess.push({ type: 'open', node: fragment.child(i) });
    }
    while (toProcess.length > 0) {
      const next = toProcess.pop();
      if (next == null) {
        return;
      }
      if (next.type === 'open') {
        yield {
          type: 'openTag',
          tag: next.node.type.name,
          role: 'render-only',
        };
        if (next.node.isText) {
          // TODO: Calculate marks
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          yield { type: 'text', text: next.node.text!, marks: {} };
          yield {
            type: 'closeTag',
            tag: next.node.type.name,
            role: 'render-only',
          };
        } else {
          toProcess.push({ type: 'close', node: next.node.type });
          for (let i = next.node.childCount - 1; i >= 0; i--) {
            toProcess.push({ type: 'open', node: next.node.child(i) });
          }
        }
      } else {
        yield { type: 'closeTag', tag: next.node.name, role: 'render-only' };
      }
    }
  }

  *finishStackFrame(frame: {
    node: NodeType;
    role: RenderRole;
    lastMatch: ContentMatch;
  }): IterableIterator<TraversalEvent> {
    const fill = frame.lastMatch.fillBefore(Fragment.empty, true);
    if (fill) {
      yield* this.emitFragment(fill);
    }
  }
}

type OuterNode = {
  type: NodeType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attrs: { [key: string]: any } | null;
};

function outerNodeTypes(
  adapter: SchemaAdapter,
  block: BlockMarker,
): OuterNode[] {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const result: OuterNode[] = [];
  for (const parent of block.parents) {
    const { content, attrs } = nodesForBlock(adapter, parent.val, false);
    result.push({ type: content, attrs: attrs || null });
  }
  return result;
}

function blockEvent(
  adapter: SchemaAdapter,
  block: BlockMarker,
): TraversalEvent {
  const mapping = adapter.nodeMappings.find((m) =>
    m.blockName === block.type.val
  );

  const attrs = { ...block.attrs };
  for (const [key, value] of Object.entries(attrs)) {
    if (value instanceof automerge.RawString) {
      attrs[key] = value.val;
    } else if ('string' === typeof value?.val) {
      attrs[key] = value?.val;
    }
  }
  return {
    type: 'block',
    isUnknown: mapping == null,
    block: {
      attrs,
      parents: block.parents.map((p) => p.val),
      type: block.type.val,
      isEmbed: block.isEmbed || false,
    },
  };
}

export function blockAtIdx(
  spans: automerge.Span[],
  target: number,
): { index: number; block: BlockMarker } | null {
  let idx = 0;
  let block: { index: number; block: BlockMarker } | null = null;
  for (const span of spans) {
    if (idx > target) {
      return block;
    }
    if (span.type === 'text') {
      if (idx + span.value.length > target) {
        return block;
      }
      idx += span.value.length;
    } else {
      if (isBlockMarker(span.value)) {
        block = { index: idx, block: span.value };
      }
      idx += 1;
    }
  }
  return block;
}

function nodesForBlock(
  adapter: SchemaAdapter,
  blockType: string,
  isEmbed: boolean,
): {
  content: NodeType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attrs?: { [key: string]: any };
} {
  const mapping = adapter.nodeMappings.find((m) => m.blockName === blockType);
  if (mapping == null) {
    if (isEmbed) {
      return {
        content: adapter.unknownLeaf,
      };
    } else {
      return {
        content: adapter.unknownBlock,
        attrs: { unknownParentBlock: blockType },
      };
    }
  }
  return {
    content: mapping.content,
  };
}
