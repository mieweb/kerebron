import {
  DOMParser,
  DOMSerializer,
  Fragment,
  Node as PMNode,
  type ParseOptions,
  Schema,
} from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';

import { HtmlPasteRule } from './ExtensionPaste.ts';

export type CreateNodeFromContentOptions = {
  parseOptions?: ParseOptions;
  errorOnInvalidContent?: boolean;
  pasteRules: HtmlPasteRule[];
};

export function getHTMLFromFragment(
  fragment: Fragment,
  schema: Schema,
): string {
  const document = globalThis.document;
  const documentFragment = DOMSerializer.fromSchema(schema).serializeFragment(
    fragment,
    { document },
  );

  const temporaryDocument = document.implementation.createHTMLDocument();
  const container = temporaryDocument.createElement('div');

  container.appendChild(documentFragment);

  return container.innerHTML;
}

const removeWhitespaces = (node: HTMLElement) => {
  const children = node.childNodes;

  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i];

    if (
      child.nodeType === 3 && child.nodeValue &&
      /^(\n\s\s|\n)$/.test(child.nodeValue)
    ) {
      node.removeChild(child);
    } else if (child.nodeType === 1) {
      removeWhitespaces(child as HTMLElement);
    }
  }

  return node;
};

export function elementFromString(value: string): HTMLElement {
  // add a wrapper to preserve leading and trailing whitespace
  const wrappedValue = `<html lang="en"><body>${value}</body></html>`;

  // TODO: consider using `const clean = DOMPurify.sanitize(html);` to prevent loading external resources
  // Or check all src/href attrs, etc. for js

  const body =
    new globalThis.DOMParser().parseFromString(wrappedValue, 'text/html').body;

  return removeWhitespaces(body);
}

function prepareContentCheckSchema(schema: Schema): Schema {
  const contentCheckSchema = new Schema({
    topNode: schema.spec.topNode,
    marks: schema.spec.marks,
    // Prosemirror's schemas are executed such that: the last to execute, matches last
    // This means that we can add a catch-all node at the end of the schema to catch any content that we don't know how to handle
    nodes: schema.spec.nodes.append({
      __unknown__catch__all__node: {
        content: 'inline*',
        group: 'block',
        parseDOM: [
          {
            tag: '*',
            getAttrs: (e) => {
              // Try to stringify the element for a more helpful error message
              const invalidContent = typeof e === 'string' ? e : e.outerHTML;
              throw new Error('Invalid HTML content', {
                cause: new Error(`Invalid element found: ${invalidContent}`),
              });
            },
          },
        ],
      },
    }),
  });

  return contentCheckSchema;
}

export async function createNodeFromHTML(
  content: string,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): Promise<PMNode> {
  options = {
    pasteRules: [],
    parseOptions: {},
    ...options,
  };

  if (options.errorOnInvalidContent) {
    const contentCheckSchema = prepareContentCheckSchema(schema);
    DOMParser.fromSchema(contentCheckSchema).parse(
      elementFromString(content),
      options.parseOptions,
    );
  }

  const body = elementFromString(content);
  // const processed = await processHtml(body, {});

  const parser = DOMParser.fromSchema(schema);
  return parser.parse(body, options.parseOptions);
}

export function createFragmentFromHTML(
  content: string,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): Fragment {
  options = {
    pasteRules: [],
    parseOptions: {},
    ...options,
  };

  if (options.errorOnInvalidContent) {
    const contentCheckSchema = prepareContentCheckSchema(schema);
    DOMParser.fromSchema(contentCheckSchema).parseSlice(
      elementFromString(content),
      options.parseOptions,
    );
  }

  const parser = DOMParser.fromSchema(schema);
  const htmlElement = elementFromString(content);

  return parser.parseSlice(htmlElement, options.parseOptions)
    .content;
}

export class ExtensionHtml extends Extension {
  name = 'html';

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    return {
      'text/html': {
        fromDoc: async (document: PMNode): Promise<Uint8Array> => {
          const html = getHTMLFromFragment(document.content, editor.schema);
          return new TextEncoder().encode(html);
        },
        toDoc: async (buffer: Uint8Array): Promise<PMNode> => {
          const html = new TextDecoder().decode(buffer);

          const body = elementFromString(html);
          const parser = DOMParser.fromSchema(schema);
          return parser.parse(body);
        },
      },
    };
  }
}
