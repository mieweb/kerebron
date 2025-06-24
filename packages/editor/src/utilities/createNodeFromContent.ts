import {
  Fragment,
  Node as ProseMirrorNode,
  Schema,
} from 'prosemirror-model';

import type { Content } from '../types.ts';

export type CreateNodeFromContentOptions = {
  errorOnInvalidContent?: boolean;
};

export function createNodeFromObject(
  content: Content | ProseMirrorNode | Fragment,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): ProseMirrorNode | Fragment {
  try {
    // if the JSON Content is an array of nodes, create a fragment for each node
    if (Array.isArray(content) && content.length > 0) {
      return Fragment.fromArray(
        content.map((item) => schema.nodeFromJSON(item)),
      );
    }

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

export function createNodeFromContent(
  content: Content | ProseMirrorNode | Fragment,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): ProseMirrorNode | Fragment {
  if (content instanceof ProseMirrorNode || content instanceof Fragment) {
    return content;
  }

  const isJSONContent = typeof content === 'object' && content !== null;

  if (isJSONContent) {
    createNodeFromObject(content, schema, options);
  }

  return schema.topNodeType.createAndFill(null, [])!;
}
