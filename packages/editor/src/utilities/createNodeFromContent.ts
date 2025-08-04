import { Fragment, Node as ProseMirrorNode, Schema } from 'prosemirror-model';

import type { Content, JSONContent } from '../types.ts';

export type CreateNodeFromContentOptions = {
  errorOnInvalidContent?: boolean;
};

export function createNodeFromObject(
  content: JSONContent | ProseMirrorNode | Fragment,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): ProseMirrorNode {
  try {
    const node = schema.nodeFromJSON(content);

    if (options?.errorOnInvalidContent) {
      node.check();
    }

    return node;
  } catch (error) {
    if (options?.errorOnInvalidContent) {
      throw new Error('Invalid JSON content', {
        cause: error as Error,
      });
    }

    console.warn(
      'Invalid content.',
      'Passed value:',
      content,
      'Error:',
      error,
    );

    return schema.topNodeType.createAndFill(null, [])!;
  }
}

export function createNodeFromArray(
  content: JSONContent[],
  schema: Schema,
): Fragment {
  return Fragment.fromArray(
    content.map((item) => schema.nodeFromJSON(item)),
  );
}

export function createNodeFromContent(
  content: JSONContent | ProseMirrorNode | Fragment,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): ProseMirrorNode | Fragment {
  if (content instanceof ProseMirrorNode || content instanceof Fragment) {
    return content;
  }

  const isJSONContent = typeof content === 'object' && content !== null;

  if (isJSONContent) {
    return createNodeFromObject(content, schema, options);
  }

  return schema.topNodeType.createAndFill(null, [])!;
}
