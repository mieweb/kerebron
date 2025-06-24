import {
  DOMParser,
  DOMSerializer,
  Fragment,
  Node,
  type ParseOptions,
  Schema,
} from 'prosemirror-model';

import { type Converter, type CoreEditor, Extension } from '@kerebron/editor';

export type CreateNodeFromContentOptions = {
  parseOptions?: ParseOptions;
  errorOnInvalidContent?: boolean;
};

export function getHTMLFromFragment(
  fragment: Fragment,
  schema: Schema,
): string {
  const documentFragment = DOMSerializer.fromSchema(schema).serializeFragment(
    fragment,
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
  const wrappedValue = `<body>${value}</body>`;

  const html =
    new globalThis.DOMParser().parseFromString(wrappedValue, 'text/html').body;

  return removeWhitespaces(html);
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

export function createNodeFromHTML(
  content: string,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): Node {
  options = {
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

  const parser = DOMParser.fromSchema(schema);
  return parser.parse(elementFromString(content), options.parseOptions);
}

export function createFragmentFromHTML(
  content: string,
  schema: Schema,
  options?: CreateNodeFromContentOptions,
): Fragment {
  options = {
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
  return parser.parseSlice(elementFromString(content), options.parseOptions)
    .content;
}

export class ExtensionHtml extends Extension {
  name = 'html';

  override getConverters(
    editor: CoreEditor,
    schema: Schema,
  ): Record<string, Converter> {
    const config = this.config;
    return {
      'text/html': {
        fromDoc(document: Node): string {
          return getHTMLFromFragment(document.content, editor.schema);
        },
        toDoc(html: string): Node {
          return createNodeFromHTML(html, editor.schema);
        },
      },
    };
  }
}
