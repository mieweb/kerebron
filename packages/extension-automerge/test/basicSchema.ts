import {
  DOMOutputSpec,
  Mark,
  MarkSpec,
  Node,
  NodeSpec,
  Schema,
} from 'prosemirror-model';
import { BlockMarker } from '../src/types.ts';
import { next as automerge } from '@automerge/automerge/slim';
import {
  addAmgNodeStateAttrs,
  MappedSchemaSpec,
} from '../src/SchemaAdapter.ts';

// basics
const pDOM: DOMOutputSpec = ['p', 0];
const blockquoteDOM: DOMOutputSpec = ['blockquote', 0];
const hrDOM: DOMOutputSpec = ['hr'];
const preDOM: DOMOutputSpec = ['pre', ['code', 0]];

// marks
const emDOM: DOMOutputSpec = ['em', 0];
const strongDOM: DOMOutputSpec = ['strong', 0];
const codeDOM: DOMOutputSpec = ['code', 0];

// lists
const olDOM: DOMOutputSpec = ['ol', 0];
const ulDOM: DOMOutputSpec = ['ul', 0];
const liDOM: DOMOutputSpec = ['li', 0];

const basicSchema: MappedSchemaSpec = {
  nodes: {
    /// NodeSpec The top level document node.
    doc: {
      content: 'block+',
    } as NodeSpec,

    /// A plain paragraph textblock. Represented in the DOM
    /// as a `<p>` element.
    paragraph: {
      automerge: {
        block: 'paragraph',
      },
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return pDOM;
      },
    } as NodeSpec,

    /// A blockquote (`<blockquote>`) wrapping one or more blocks.
    blockquote: {
      automerge: {
        block: 'blockquote',
      },
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return blockquoteDOM;
      },
    } as NodeSpec,

    /// A horizontal rule (`<hr>`).
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return hrDOM;
      },
    } as NodeSpec,

    /// A heading textblock, with a `level` attribute that
    /// should hold the number 1 to 6. Parsed and serialized as `<h1>` to
    /// `<h6>` elements.
    heading: {
      automerge: {
        block: 'heading',
        attrParsers: {
          fromAutomerge: (block) => ({ level: block.attrs.level }),
          fromProsemirror: (node) => ({ level: node.attrs.level }),
        },
      },
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node) {
        return ['h' + node.attrs.level, 0];
      },
    },

    /// A code listing. Disallows marks or non-text inline
    /// nodes by default. Represented as a `<pre>` element with a
    /// `<code>` element inside of it.
    code_block: {
      automerge: {
        block: 'code-block',
      },
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() {
        return preDOM;
      },
    } as NodeSpec,

    /// The text node.
    text: {
      group: 'inline',
    } as NodeSpec,

    /// An inline image (`<img>`) node. Supports `src`,
    /// `alt`, and `href` attributes. The latter two default to the empty
    /// string.
    image: {
      automerge: {
        block: 'image',
        isEmbed: true,
        attrParsers: {
          fromAutomerge: (block: BlockMarker) => ({
            src: block.attrs.src?.toString() || null,
            alt: block.attrs.alt,
            title: block.attrs.title,
          }),
          fromProsemirror: (node: Node) => ({
            src: new automerge.RawString(node.attrs.src),
            alt: node.attrs.alt,
            title: node.attrs.title,
          }),
        },
      },
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      group: 'inline',
      draggable: true,
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute('src'),
              title: dom.getAttribute('title'),
              alt: dom.getAttribute('alt'),
            };
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title } = node.attrs;
        return ['img', { src, alt, title }];
      },
    } as NodeSpec,

    ordered_list: {
      automerge: {
        block: 'ordered_list',
      },
      group: 'block',
      content: 'list_item+',
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs(dom: HTMLElement) {
            return {
              order: dom.hasAttribute('start')
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                ? +dom.getAttribute('start')!
                : 1,
            };
          },
        },
      ],
      toDOM(node) {
        return node.attrs.order == 1
          ? olDOM
          : ['ol', { start: node.attrs.order }, 0];
      },
    } as NodeSpec,

    bullet_list: {
      automerge: {
        block: 'bullet_list',
      },
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ulDOM;
      },
    },

    /// A list item (`<li>`) spec.
    list_item: {
      automerge: {
        block: 'list_item',
      },
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return liDOM;
      },
      defining: true,
    },

    aside: {
      automerge: {
        block: 'aside',
      },
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'aside' }],
      toDOM() {
        return ['aside', 0];
      },
    },

    unknownBlock: {
      automerge: {
        unknownBlock: true,
      },
      group: 'block',
      content: 'block+',
      parseDOM: [{ tag: 'div', attrs: { 'data-unknown-block': 'true' } }],
      toDOM() {
        return ['div', { 'data-unknown-block': 'true' }, 0];
      },
    },

    unknownLeaf: {
      inline: true,
      attrs: { isAmgBlock: { default: true }, unknownBlock: { default: null } },
      group: 'inline',
      toDOM() {
        return document.createTextNode('u{fffc}');
      },
    },

    table: {
      automerge: {
        block: 'table',
        attrParsers: {
          fromAutomerge: (block) => ({ class: block.attrs.class }),
          fromProsemirror: (node) => ({ class: node.attrs.class }),
        },
      },
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      group: 'block',
      attrs: {
        class: { default: null },
      },
      parseDOM: [{
        tag: 'table',
        getAttrs: (element) => ({ class: element.getAttribute('class') }),
      }],
      toDOM: (node) => ['table', { class: node.attrs.class }, ['tbody', 0]],
      // parseDOM: [
      //   {
      //     tag: 'ol',
      //     getAttrs(dom: HTMLElement) {
      //       return {
      //         order: dom.hasAttribute('start')
      //           // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      //           ? +dom.getAttribute('start')!
      //           : 1,
      //       };
      //     },
      //   },
      // ],
      // toDOM(node) {
      //   return node.attrs.order == 1
      //     ? olDOM
      //     : ['ol', { start: node.attrs.order }, 0];
      // },
    },

    table_row: {
      automerge: {
        block: 'table_row',
      },
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0];
      },
    },

    table_header: {
      automerge: {
        block: 'table_header',
      },
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [
        { tag: 'th' },
      ],
      toDOM: (node) => ['th', {}, 0],
    },

    table_cell: {
      automerge: {
        block: 'table_cell',
      },
      content: 'block+',
      attrs: {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        colwidth: { default: null },
      },
      tableRole: 'cell',
      isolating: true,
      parseDOM: [
        { tag: 'td' },
      ],
      toDOM(node) {
        return ['td', {}, 0];
      },
    },
  },
  marks: {
    /// A link. Has `href` and `title` attributes. `title`
    /// defaults to the empty string. Rendered and parsed as an `<a>`
    /// element.
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom: HTMLElement) {
            return {
              href: dom.getAttribute('href'),
              title: dom.getAttribute('title'),
            };
          },
        },
      ],
      toDOM(node) {
        const { href, title } = node.attrs;
        return ['a', { href, title }, 0];
      },
      automerge: {
        markName: 'link',
        parsers: {
          fromAutomerge: (mark: automerge.MarkValue) => {
            if (typeof mark === 'string') {
              try {
                const value = JSON.parse(mark);
                return {
                  href: value.href || '',
                  title: value.title || '',
                };
              } catch (e) {
                console.warn('failed to parse link mark as JSON');
              }
            }
            return {
              href: '',
              title: '',
            };
          },
          fromProsemirror: (mark: Mark) =>
            JSON.stringify({
              href: mark.attrs.href,
              title: mark.attrs.title,
            }),
        },
      },
    },

    /// An emphasis mark. Rendered as an `<em>` element. Has parse rules
    /// that also match `<i>` and `font-assets: italic`.
    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-assets=italic' },
        { style: 'font-assets=normal', clearMark: (m) => m.type.name == 'em' },
      ],
      toDOM() {
        return emDOM;
      },
      automerge: {
        markName: 'em',
      },
    } as MarkSpec,

    /// A strong mark. Rendered as `<strong>`, parse rules also match
    /// `<b>` and `font-weight: bold`.
    strong: {
      parseDOM: [
        { tag: 'strong' },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: 'b',
          getAttrs: (node: HTMLElement) =>
            node.style.fontWeight != 'normal' && null,
        },
        { style: 'font-weight=400', clearMark: (m) => m.type.name == 'strong' },
        {
          style: 'font-weight',
          getAttrs: (value: string) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM() {
        return strongDOM;
      },
      automerge: {
        markName: 'strong',
      },
    } as MarkSpec,

    /// Code font mark. Represented as a `<code>` element.
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return codeDOM;
      },
    } as MarkSpec,

    unknownMark: {
      attrs: { unknownMarks: { default: null } },
      toDOM() {
        return ['span', { 'data-unknown-mark': true }];
      },
    },
  },
};

addAmgNodeStateAttrs(basicSchema.nodes);

const schema = new Schema(basicSchema);

export { basicSchema, schema };
