import {
  Attrs,
  Mark,
  MarkType,
  Node,
  NodeType,
  Schema,
} from 'prosemirror-model';

const COURIER_FONTS = ['Courier New', 'Courier', 'Roboto Mono'];

interface OdtElement {
}

export interface ParseSpec {
  node?: string;

  children?: (node: OdtElement) => OdtElement[];

  custom?: (state: OdtParseState, element?: OdtElement) => void;

  text?: (node: OdtElement) => string;

  block?: string | ((node: OdtElement, style: any) => [string]);

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
  name: string,
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
    const parentStyle = resolveStyle(
      stylesTree,
      automaticStyles,
      style['@parent-style-name'],
    );
    if (parentStyle) {
      const styles = [...style['styles'], ...parentStyle['styles']];
      for (const key in style) {
        if (typeof style[key] === 'undefined') {
          delete style[key];
        }
      }
      style = {
        ...parentStyle,
        ...style,
        styles,
      };
    }
  }
  return style;
}

interface TextMark {
  markName: string;
  markAttributes: Record<string, string>;
}

class OdtParseState {
  stack: {
    type: NodeType;
    attrs: Attrs | null;
    content: Node[];
    marks: readonly Mark[];
  }[];
  textMarks: Set<TextMark> = new Set();
  nextTextMarks: Set<TextMark> = new Set();

  constructor(
    readonly schema: Schema,
    readonly tokens: { [name: string]: ParseSpec },
    private readonly stylesTree: StylesTree,
    private readonly automaticStyles: AutomaticStyles,
  ) {
    this.stack = [];
    this.openNode(schema.topNodeType, null);
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

    let marks = top.marks;

    for (const textMark of this.textMarks) {
      const markType = this.schema.marks[textMark.markName];
      const mark = markType.create(textMark.markAttributes || {});
      marks = mark.addToSet(marks);
    }

    for (const textMark of this.nextTextMarks) {
      const markType = this.schema.marks[textMark.markName];
      const mark = markType.create(textMark.markAttributes || {});
      marks = mark.addToSet(marks);
    }
    this.nextTextMarks.clear();

    let node = this.schema.text(text, marks), merged;

    nodes.push(node);
  }

  // Adds the given mark to the set of active marks.
  openMark(mark: Mark) {
    let top = this.top();
    top.marks = mark.addToSet(top.marks);
    return mark.type;
  }

  // Removes the given mark from the set of active marks.
  closeMark(mark: MarkType) {
    let top = this.top();
    top.marks = mark.removeFromSet(top.marks);
  }

  // Add a node at the current position.
  addNode(
    type: NodeType,
    attrs: Attrs | null,
    content?: readonly Node[],
    marks = Mark.none,
  ) {
    let top = this.top();
    if (top?.marks) {
      marks = [...top.marks, ...marks];
    }
    let node = type.createAndFill(attrs, content, marks);
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
  closeNode(marks = Mark.none) {
    let info = this.stack.pop()!;
    return this.addNode(info.type, info.attrs, info.content, marks);
  }

  handleElement(nodeType: string, element: OdtElement) {
    const spec = this.tokens[nodeType];
    if (!spec) {
      console.warn(
        'No spec for:',
        nodeType,
        element,
        this.stack.map((item) => item.type.name),
      );
      return;
    }

    if (spec.custom) {
      spec.custom(this, element);
      return;
    }

    const children = spec.children ? spec.children(element) : [];

    const style = ('object' === typeof element && element['@style-name'])
      ? resolveStyle(
        this.stylesTree,
        this.automaticStyles,
        element['@style-name'],
      )
      : {};

    const markToClose = [];

    const textProperties = style && style['text-properties'] || {};

    const marks = [];

    if (COURIER_FONTS.indexOf(textProperties['@font-name'] || '') > -1) {
      this.textMarks.add({
        markName: 'code',
        markAttributes: {},
      });

      const markType = this.schema.mark('code');
      marks.push(markType);
    }

    // if (style.textProperties?.fontStyle === 'italic' && style.textProperties?.fontWeight === 'bold') {
    //   const block = this.chunks.createNode('BI');
    //   this.chunks.append(currentTagNode, block);
    //   currentTagNode = block;
    // } else
    if (textProperties['@font-style'] === 'italic') {
      const markType = this.schema.marks['em'];
      markToClose.push(
        this.openMark(markType.create(attrs(spec, element, style))),
      );
    } else if (textProperties['@font-weight'] === 'bold') {
      const markType = this.schema.marks['strong'];
      markToClose.push(
        this.openMark(markType.create(attrs(spec, element, style))),
      );
    }

    if (spec.block) {
      let block = spec.block;
      if ('string' !== typeof block) {
        block = block(element, style)[0];
      }

      let nodeType = this.schema.nodeType(block);

      this.openNode(nodeType, attrs(spec, element, style));

      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }

      // this.addText(withoutTrailingNewline(tok.content));
      this.closeNode(marks);
    } else if (spec.node) {
    } else if (spec.mark) {
      const markType = this.schema.marks[spec.mark];

      this.openMark(markType.create(attrs(spec, element, style)));

      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }

      this.closeMark(markType);
    } else if (spec.text) {
      this.addText(spec.text(element));
    } else {
      if (children) {
        iterateChildren(children, (nodeType, node) => {
          this.handleElement(nodeType, node);
        });
      }
    }

    while (markToClose.length > 0) {
      const markType = markToClose.pop();
      this.closeMark(markType);
    }

    if (COURIER_FONTS.indexOf(textProperties['@font-name'] || '') > -1) {
      this.textMarks.forEach((x) =>
        x.markName === 'code' ? this.textMarks.delete(x) : x
      );
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
      const keys = Object.keys(child).filter((key) => key !== 'annotation');
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

interface Config {
  linkFromRewriter?(href: string): string;
}

class ListNumbering {
  levels: { [level: number]: number } = {};
  levelNodes: { [level: number]: Node } = {};

  constructor() {
    for (let i = 0; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  clearAbove(level: number) {
    for (let i = level + 1; i < 20; i++) {
      this.levels[i] = 1;
    }
  }

  setLevelNode(level: number, node: Node) {
    this.levelNodes[level] = node;
  }
}

export class OdtParser {
  listStack = [];

  listNumberings: Map<string, ListNumbering> = new Map<string, ListNumbering>();
  private lastNumbering?: ListNumbering;
  preserveMinLevel = 999;

  constructor(
    private readonly schema: Schema,
    private readonly config: Config = {},
  ) {
    // this.tokenHandlers = tokenHandlers(schema, tokens);
  }

  parse(files: any) {
    const contentTree = files.contentTree;
    const stylesTree = files.stylesTree;
    const automaticStyles = contentTree['automatic-styles'];

    const tokens: { [name: string]: ParseSpec } = {
      'body': {
        children: (odtElement) => iterateEnum(odtElement.text?.$value),
      },
      'p': {
        block: (odtElement: OdtElement, style) => {
          if (style.styles.find((item) => item.startsWith('Heading_20_'))) {
            return ['heading'];
          }
          return ['paragraph'];
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
        custom: (state, odtElement) => {
          const list = {
            level: this.listStack.length + 1,
            odtElement,
          };
          this.listStack.push(list);

          let style = {};
          let listId = null;
          for (let i = this.listStack.length - 1; i >= 0; i--) {
            const element = this.listStack[i].odtElement;
            if (!listId) {
              if (element['@id']) {
                listId = element['@id'];
              }
            }
            if (!style['@style-name']) {
              style = ('object' === typeof element && element['@style-name'])
                ? resolveStyle(
                  stylesTree,
                  automaticStyles,
                  element['@style-name'],
                )
                : {};
            }
          }

          let nodeTypeName = 'bullet_list';
          const attrs = {};
          if (style) {
            const numLevelStyle = style['list-level-style-number'].find(
              (levelStyle) => parseInt(levelStyle['@level']) === list.level,
            );
            if (numLevelStyle) {
              attrs['type'] = numLevelStyle['@num-format'] || '1';
              nodeTypeName = 'ordered_list';
            }
          }

          let listNumbering = null;

          if (listId && this.listNumberings.has(listId)) {
            listNumbering = this.listNumberings.get(listId);
          }

          let isContinue = false;
          if (
            odtElement['@continue-list'] &&
            this.listNumberings.has(odtElement['@continue-list'])
          ) {
            listNumbering = this.listNumberings.get(
              odtElement['@continue-list'],
            );
            isContinue = true;
          }
          if (odtElement['@continue-numbering']) {
            listNumbering = this.lastNumbering;
            isContinue = true;
          }

          if (!listNumbering) {
            listNumbering = new ListNumbering();
          }

          if (isContinue) {
            this.preserveMinLevel = 999;
          }

          if (listId) {
            this.listNumberings.set(listId, listNumbering);
          }

          this.lastNumbering = listNumbering;

          if (this.preserveMinLevel <= list.level) {
            listNumbering.clearAbove(list.level - 1);
          }

          if (nodeTypeName === 'ordered_list') {
            attrs['start'] = listNumbering.levels[list.level] || 1;
          }

          let nodeType = this.schema.nodeType(nodeTypeName);

          state.openNode(nodeType, attrs);

          const children = odtElement['list-item'].map((item) => ({
            'list-item': item,
          }));

          if (children) {
            iterateChildren(children, (nodeType, node) => {
              state.handleElement(nodeType, node);
            });

            listNumbering.levels[list.level] += children.length;
          }

          state.closeNode();

          if (this.preserveMinLevel >= list.level) {
            this.preserveMinLevel = list.level;
          }

          this.listStack.pop();
        },
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
        getAttrs: (tok) => {
          let href = tok['@href'];
          if (this.config.linkFromRewriter) {
            href = this.config.linkFromRewriter(href);
          }
          return {
            href,
            // title: tok.attrGet('title') || null,
          };
        },
        children: (odtElement) => iterateEnum(odtElement.$value),
      },
      '$value': {
        children: (odtElement) => iterateEnum(odtElement),
      },
      '$text': {
        // TODO: fix trimming: https://github.com/tafia/quick-xml/issues/285
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
      'line-break': {
        block: 'br',
      },
      'soft-page-break': {
        block: 'br',
      },
      'table-of-content': {
        block: 'paragraph',
        children: (odtElement) => odtElement['index-body']['p'] || [],
      },
      'change-start': {
        custom(state) {
          state.textMarks.add({
            markName: 'change',
            markAttributes: {},
          });
        },
      },
      'change-end': {
        custom(state) {
          state.textMarks.forEach((x) =>
            x.markName === 'change' ? state.textMarks.delete(x) : x
          );
        },
      },
      'frame': {
        custom: (state, odtElement) => {
          if (odtElement.object && odtElement.object['@href']) { // TODO MathML
            // const fileName= drawFrame.object.href.replace(/\s/g, '_').replace(/^\.\//, '') + '.xml';
            // try {
            //   const mathMl = this.xmlMap[fileName];
            //   if (mathMl && mathMl.indexOf('<math ') > -1) {
            //     const node = this.chunks.createNode('MATHML');
            //     const latex = MathMLToLaTeX.convert(mathMl);
            //     this.chunks.appendText(node, latex);
            //     this.chunks.append(currentTagNode, node);
            //   }
            // } catch (err) {
            //   console.warn(err);
            // }
          }
          if (odtElement.image && odtElement.image['@href']) { // TODO links rewrite
            const nodeType = this.schema.nodeType('image');
            const alt = odtElement.description?.value || '';

            state.addNode(nodeType, {
              src: odtElement.image['@href'],
              alt,
            }, []);
          }
        },
      },
      'rect': {
        ignore: true,
      },
      'bookmark': {
        custom(state, element) {
          state.nextTextMarks.add({
            markName: 'bookmark',
            markAttributes: {
              id: element['@name'],
            },
          });
        },
      },
      'bookmark-start': {
        custom(state, element) {
          state.textMarks.add({
            markName: 'bookmark',
            markAttributes: {
              id: element['@name'],
            },
          });
        },
      },
      'bookmark-end': {
        custom(state, element) {
          state.textMarks.forEach((x) =>
            x.markName === 'bookmark' &&
              x.markAttributes.id === element['@name']
              ? state.textMarks.delete(x)
              : x
          );
        },
      },
      'annotation': {
        ignore: true,
      },
    };

    const state = new OdtParseState(
      this.schema,
      tokens,
      stylesTree,
      contentTree['automatic-styles'],
    );

    state.handleElement('body', contentTree.body);

    let doc;
    do {
      doc = state.closeNode();
    } while (state.stack.length);

    if (!doc) {
      throw new Error('Incorrect stack handling');
    }

    return doc || null; //this.schema.topNodeType.createAndFill()!;
  }
}
