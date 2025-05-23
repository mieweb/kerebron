import {
  Attrs,
  Mark,
  MarkType,
  Node,
  NodeType,
  Schema,
} from 'prosemirror-model';

interface OdtElement {
}

export interface ParseSpec {
  node?: string;

  children?: (node: OdtElement) => OdtElement[];

  text?: (node: OdtElement) => string;

  block?: string | ((node: OdtElement) => string);

  mark?: string;

  attrs?: Attrs | null;

  getAttrs?: (
    token: OdtElement,
    style: Style,
  ) => Attrs | null;

  ignore?: boolean;
}

function attrs(spec: ParseSpec, token: OdtElement, style: Style) {
  if (spec.getAttrs) return spec.getAttrs(token, style);
  // For backwards compatibility when `attrs` is a Function
  else if (spec.attrs instanceof Function) return spec.attrs(token);
  else return spec.attrs;
}

interface ListStyle {
  '@name': string;
}

interface Style {
  '@name': string;
}

interface StylesTree {
  styles: {
    'list-style': Array<ListStyle>;
    'style': Array<Style>;
  };
}

interface AutomaticStyles {
  'style': Array<Style>;
}

function resolveStyle(
  stylesTree: StylesTree,
  automaticStyles: AutomaticStyles,
  name,
) {
  let style;

  if (!style) {
    style = stylesTree.styles['list-style'].find((item) =>
      item['@name'] === name
    );
  }
  if (!style) {
    style = stylesTree.styles['style'].find((item) => item['@name'] === name);
  }
  if (!style) {
    style = automaticStyles.style.find((item) => item['@name'] === name);
  }

  if (!style) {
    style = {};
  }

  style['styles'] = [name];

  if (style['@parent-style-name']) {
    const parenStyle = resolveStyle(
      stylesTree,
      automaticStyles,
      style['@parent-style-name'],
    );
    if (parenStyle) {
      const styles = [...style['styles'], ...parenStyle['styles']];
      style = {
        ...parenStyle,
        ...style,
        styles,
      };
    }
  }

  return style;
}

class OdtParseState {
  stack: {
    type: NodeType;
    attrs: Attrs | null;
    content: Node[];
    marks: readonly Mark[];
  }[];

  constructor(
    readonly schema: Schema,
    private readonly stylesTree: StylesTree,
    private readonly automaticStyles: AutomaticStyles,
  ) {
    this.stack = [{
      type: schema.topNodeType,
      attrs: null,
      content: [],
      marks: Mark.none,
    }];
  }

  top() {
    return this.stack[this.stack.length - 1];
  }

  push(elt: Node) {
    if (this.stack.length) this.top().content.push(elt);
  }

  // Adds the given text to the current position in the document,
  // using the current marks as styling.
  addText(text: string) {
    if (!text) return;
    let top = this.top(), nodes = top.content, last = nodes[nodes.length - 1];
    let node = this.schema.text(text, top.marks), merged;
    // if (last && (merged = maybeMerge(last, node))) {
    //   nodes[nodes.length - 1] = merged;
    // } else

    // console.log('addtext', node);
    nodes.push(node);
  }

  // Adds the given mark to the set of active marks.
  openMark(mark: Mark) {
    let top = this.top();
    top.marks = mark.addToSet(top.marks);
  }

  // Removes the given mark from the set of active marks.
  closeMark(mark: MarkType) {
    let top = this.top();
    top.marks = mark.removeFromSet(top.marks);
  }

  // Add a node at the current position.
  addNode(type: NodeType, attrs: Attrs | null, content?: readonly Node[]) {
    let top = this.top();
    let node = type.createAndFill(attrs, content, top ? top.marks : []);
    if (!node) return null;
    this.push(node);
    return node;
  }

  // Wrap subsequent content in a node of the given type.
  openNode(type: NodeType, attrs: Attrs | null) {
    this.stack.push({
      type: type,
      attrs: attrs,
      content: [],
      marks: Mark.none,
    });
  }

  // Close and return the node that is currently on top of the stack.
  closeNode() {
    let info = this.stack.pop()!;
    // console.log('closeNode', info.type.name, info.attrs);
    return this.addNode(info.type, info.attrs, info.content);
  }

  handleElement(nodeType: string, element: OdtElement) {
    const spec = tokens[nodeType];
    if (!spec) {
      console.warn(
        'No spec for:',
        nodeType,
        element,
        this.stack.map((item) => item.type.name),
      );
      return;
    }

    // console.log('handleElement', nodeType, this.stack.length);
    const children = spec.children ? spec.children(element) : [];
    // console.log('ccc', nodeType, children);

    let style;
    if ('object' === typeof element && element['@style-name']) {
      style = resolveStyle(
        this.stylesTree,
        this.automaticStyles,
        element['@style-name'],
      );
    }

    if (spec.block) {
      let block = spec.block;
      if ('string' !== typeof block) {
        block = block(element, style);
      }

      let nodeType = this.schema.nodeType(block);

      this.openNode(nodeType, attrs(spec, element, style));

      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }

      // this.addText(withoutTrailingNewline(tok.content));
      this.closeNode();
    } else if (spec.node) {
    } else if (spec.mark) {
      let markType = this.schema.marks[spec.mark];

      this.openMark(markType.create(attrs(spec, element, style)));

      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }

      this.closeMark(markType);
    } else if (spec.text) {
      // console.log('aaaaaaaaaaaaaaaaaaaa', element);
      this.addText(spec.text(element));
    } else {
      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }
    }
  }
}

function iterateChildren(nodes: unknown[], callback) {
  for (const child of nodes) {
    if ('Unknown' === child) {
      continue;
    }

    let key = '';
    let value = null;
    if (typeof child === 'string') {
      key = '$text';
      value = child;
    } else {
      const keys = Object.keys(child);
      key = keys[0];
      value = child[key];
    }

    if (!key) {
      return;
    }

    callback(key, value);
  }
}

function iterateEnum($value: unknown[]) {
  if (!$value) {
    return [];
  }
  return $value.map((item) => {
    if ('string' === typeof item) {
      return {
        [item]: true,
      };
    }
    return item;
  });
}

const tokens: { [name: string]: ParseSpec } = {
  'body': {
    children: (odtElement) => iterateEnum(odtElement.text?.$value),
  },
  'p': {
    block: (odtElement: OdtElement, style) => {
      if (style.styles.find((item) => item.startsWith('Heading_20_'))) {
        return 'heading';
      }
      return 'paragraph';
    },
    getAttrs: (odtElement: OdtElement, style) => {
      const heading = style.styles.find((item) =>
        item.startsWith('Heading_20_')
      );
      if (heading) {
        return {
          level: parseInt(heading.substring('Heading_20_'.length)),
        };
      }
    },
    children: (odtElement) => iterateEnum(odtElement.$value),
  },
  'span': {
    children: (odtElement) => iterateEnum(odtElement.$value),
  },
  'list': {
    block: 'ordered_list',
    children: (odtElement) =>
      odtElement['list-item'].map((item) => ({ 'list-item': item })),
  },
  'list-item': {
    block: 'list_item',
    children: (odtElement) => iterateEnum(odtElement.$value),
  },
  'table': {
    block: 'table',
    children: (odtElement) =>
      odtElement['table-row'].map((item) => ({ 'table-row': item })),
  },
  'table-row': {
    block: 'table_row',
    children: (odtElement) =>
      odtElement['table-cell'].map((item) => ({ 'table-cell': item })),
  },
  'table-cell': {
    block: 'table_cell',
    children: (odtElement) => iterateEnum(odtElement.$value),
  },
  'a': {
    mark: 'link',
    getAttrs: (tok) => ({
      href: tok['@href'],
      // title: tok.attrGet('title') || null,
    }),
    children: (odtElement) => odtElement['span'],
  },
  '$value': {
    children: (odtElement) => iterateEnum(odtElement),
  },
  '$text': {
    text: (odtElement) => String(odtElement || ''),
  },
  's': {
    text: (odtElement) => {
      const chars = odtElement['@c'] || 1;
      return '               '.substring(0, chars);
    },
  },
  'tab': {
    text: (odtElement) => '\t',
  },
  'table-of-content': {
    children: (odtElement) => odtElement['index-body']['p'] || [],
  },
  'frame': {
    ignore: true,
  },
  'rect': {
    ignore: true,
  },
  'annotation': {
    ignore: true,
  },
};

export class OdtParser {
  constructor(private readonly schema: Schema) {
    // this.tokenHandlers = tokenHandlers(schema, tokens);
  }

  parse(files: any) {
    const contentTree = files.contentTree;
    const stylesTree = files.stylesTree;

    const state = new OdtParseState(
      this.schema,
      stylesTree,
      contentTree['automatic-styles'],
    );

    state.handleElement('body', contentTree.body);

    let doc;
    do {
      doc = state.closeNode();
    } while (state.stack.length);
    return doc || null; //this.schema.topNodeType.createAndFill()!;
  }
}
