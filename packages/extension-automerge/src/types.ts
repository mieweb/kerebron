import { next as automerge } from '@automerge/automerge/slim';

export type ChangeFn<T> = (doc: T, field: string) => void;

// export interface DocHandle<T> {
//   docSync: () => automerge.Doc<T> | undefined;
//   change: (fn: automerge.ChangeFn<T>) => void;
// }

// This type is copied from automerge-repo so we don't have to depend on the whole automerge-repo
// package and so non automerge-repo users can implement it themselves
export type DocHandle<T> = {
  docSync(): T | undefined;
  change: (fn: (doc: T) => void) => void;
  on(event: 'change', callback: (p: DocHandleChangePayload<T>) => void): void;
  off(event: 'change', callback: (p: DocHandleChangePayload<T>) => void): void;
};

export interface DocHandleChangePayload<T> {
  /** The handle that changed */
  handle: DocHandle<T>;
  /** The value of the document after the change */
  doc: automerge.Doc<T>;
  /** The patches representing the change that occurred */
  patches: automerge.Patch[];
  /** Information about the change */
  patchInfo: automerge.PatchInfo<T>;
}

export type BlockType = string;

export function isBlockMarker(obj: unknown): obj is BlockMarker {
  if (obj == null) {
    return false;
  }
  if (typeof obj !== 'object') {
    return false;
  }
  if (!('type' in obj)) {
    return false;
  }
  if (!('parents' in obj) || !Array.isArray(obj.parents)) {
    return false;
  }
  if (!validBlockType(obj.type)) {
    return false;
  }
  for (const parent of obj.parents) {
    if (!validBlockType(parent)) {
      return false;
    }
  }
  return true;
}

export function validBlockType(type: unknown): type is BlockType {
  if (!(type instanceof automerge.RawString)) {
    return false;
  }
  return [
    'list_item',
    'ordered_list',
    'bullet_list',
    'paragraph',
    'heading',
    'aside',
    'image',
    'blockquote',
  ].includes(type.val);
}

export type BlockMarker = {
  type: automerge.RawString;
  parents: automerge.RawString[];
  attrs: { [key: string]: automerge.MaterializeValue };
  isEmbed?: boolean;
};

export function blockSpanToBlockMarker(span: {
  [key: string]: automerge.MaterializeValue;
}): BlockMarker {
  const {
    type: spanType,
    parents: spanParents,
    attrs: spanAttrs,
    isEmbed: spanIsEmbed,
  } = span;
  let type;
  if (!(spanType instanceof automerge.RawString)) {
    if ('string' === typeof (spanType?.val)) {
      type = new automerge.RawString(spanType.val);
    } else {
      type = new automerge.RawString('paragraph');
    }
  } else {
    type = spanType;
  }
  const attrs: { [key: string]: automerge.MaterializeValue } = {};
  if (spanAttrs && typeof spanAttrs == 'object') {
    for (const [key, value] of Object.entries(spanAttrs)) {
      attrs[key] = value;
    }
  }
  let parents: automerge.RawString[];
  if (!isArrayOfRawString(spanParents)) {
    if (Array.isArray(spanParents)) {
      parents = spanParents.filter((spanType) =>
        'string' === typeof (spanType?.val)
      )
        .map((spanType) => new automerge.RawString(spanType.val));
    } else {
      parents = [];
    }
  } else {
    parents = spanParents;
  }
  const isEmbed = !!spanIsEmbed;
  return { type, parents, attrs, isEmbed };
}

function isArrayOfRawString(obj: unknown): obj is automerge.RawString[] {
  if (!Array.isArray(obj)) {
    return false;
  }
  for (const item of obj) {
    if (!(item instanceof automerge.RawString)) {
      return false;
    }
  }
  return true;
}

export type Span =
  | { type: 'text'; value: string; marks?: automerge.MarkSet }
  | { type: 'block'; value: BlockMarker };

export function amSpanToSpan(span: automerge.Span): Span {
  if (span.type === 'text') {
    return { type: 'text', value: span.value, marks: span.marks };
  } else {
    return { type: 'block', value: blockSpanToBlockMarker(span.value) };
  }
}
