import { Mark, Node, Schema } from 'prosemirror-model';
import {
  getBasicNodesHandlers,
  getInlineNodesHandlers,
} from './node_handlers/basic_node_handlers.ts';
import { getListNodesHandlers } from './node_handlers/list_node_handlers.ts';
import { getTableNodesHandlers } from './node_handlers/table_node_handlers.ts';
import { ListTracker } from './lists.ts';

const COURIER_FONTS = ['Courier New', 'Courier', 'Roboto Mono'];

export interface OdtElement {
  $value: 'TODO';
}

export type NodeHandler = (ctx: OdtStashContext, value: any) => void;

export interface ListLevelStyleBullet {
  '@level': number;
}

export interface ListLevelStyleNumber {
  '@level': number;
  '@start-value'?: number;
  '@num-format': string;
}

export interface ListStyle {
  '@name'?: string;
  'list-level-style-bullet': ListLevelStyleBullet[];
  'list-level-style-number': ListLevelStyleNumber[];
}

export interface TextProperty {
  '@font-name'?: string;
  '@font-weight'?: string;
  '@font-style'?: string;
  '@font-size'?: string;
  '@text-underline-style'?: string;
  '@color'?: string;
}

export interface Style {
  '@name'?: string;
  '@parent-style-name'?: string;
  styles: string[];
  'text-properties'?: TextProperty;
}

export interface StylesTree {
  styles: {
    'list-style': Array<ListStyle>;
    'style': Array<Style>;
  };
}

export interface AutomaticStyles {
  'style': Array<Style>;
}

export function resolveListStyle(
  stylesTree: StylesTree,
  automaticStyles: AutomaticStyles,
  name: string,
): ListStyle {
  let style: ListStyle | undefined;

  style = stylesTree.styles['list-style'].find((item) =>
    item['@name'] === name
  );

  if (!style) {
    style = {
      '@name': name,
      'list-level-style-number': [],
      'list-level-style-bullet': [],
    };
  }

  return style;
}

export function resolveStyle(
  stylesTree: StylesTree,
  automaticStyles: AutomaticStyles,
  name: string,
): Style {
  let style: Style | undefined;

  if (!style) {
    style = stylesTree.styles['style'].find((item) => item['@name'] === name);
  }
  if (!style) {
    style = automaticStyles.style.find((item) => item['@name'] === name);
  }

  if (!style) {
    style = {
      '@name': name,
      styles: [],
    };
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
      for (const key of Object.keys(style) as (keyof Style)[]) {
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

export interface TaggedEnum {
  tag: string;
  value: any;
}

export function tagEnum(item: any) {
  if ('string' === typeof item) {
    return {
      tag: item, // '$text',
      value: item,
    };
  }
  if ('object' === typeof item) {
    const entries = Object.entries(item);
    if (entries.length === 1) {
      return {
        tag: entries[0][0],
        value: entries[0][1],
      };
    }
  }

  throw new Error('Incorrect enum: ' + JSON.stringify(item));
}

export function iterateChildren(
  nodes: unknown[],
  callback: (item: TaggedEnum) => void,
) {
  for (const child of nodes) {
    if ('Unknown' === child) {
      continue;
    }

    const item = tagEnum(child);

    callback(item);
  }
}

export function iterateEnum($value: unknown[]): Array<TaggedEnum> {
  if (!$value) {
    return [];
  }
  return $value.map(tagEnum);
}

export interface OdtParserConfig {
}

export interface OdtContext {
  handlers: Record<string, NodeHandler>;
  content: Node[];
  marks: Mark[];
  meta: Record<string, any>;
}

export class OdtStashContext {
  private ctxStash: Array<OdtContext> = [];
  private currentCtx: OdtContext;
  public listTracker = new ListTracker();
  constructor(
    readonly schema: Schema,
    handlers: Record<string, NodeHandler>,
    readonly stylesTree: StylesTree,
    readonly automaticStyles: AutomaticStyles,
  ) {
    this.currentCtx = {
      handlers,
      content: [],
      marks: [],
      meta: {},
    };
    this.stash();
  }

  public stash(): number {
    this.ctxStash.push(this.currentCtx);
    const funcs = {};
    const handlers = { ...this.currentCtx.handlers };
    const content = this.currentCtx.content;
    const marks = this.currentCtx.marks;
    this.currentCtx = {
      ...structuredClone({
        ...this.currentCtx,
        content: undefined,
        marks: undefined,
        handlers: undefined,
      }),
      ...funcs,
      content,
      marks,
      handlers,
    };

    return this.ctxStash.length - 1;
  }

  public unstash() {
    const ctx = this.ctxStash.pop();
    if (!ctx) {
      throw new Error('Unstash failed');
    }
    this.currentCtx = ctx;
  }

  public openNode() {
    this.stash();
    this.current.content = [];
  }

  public dropNode() {
    this.unstash();
  }

  public closeNode(type: string, attrs = {}, marks = Mark.none) {
    const node = this.createNode(type, attrs, marks);
    this.unstash();
    if (node) {
      this.current.content.push(node);
    }
    return node;
  }

  private createNode(type: string, attrs = {}, marks = Mark.none) {
    const nodeType = this.schema.nodes[type];
    if (!nodeType) {
      throw new Error('Invalid node type: ' + type);
    }
    const node = nodeType.createAndFill(attrs, this.current.content, marks);
    if (!node) {
      throw new Error('Error creating node: ' + type);
    }
    return node;
  }

  createText(text: string) {
    if (!text) return;
    const marks = uniqMarks(this.current.marks);
    return this.schema.text(text, marks);
  }

  public styleToMarks(style: Style): Mark[] {
    const marks: Mark[] = [];
    const textProperties = style && style['text-properties'] || {};

    if (COURIER_FONTS.indexOf(textProperties['@font-name'] || '') > -1) {
      const markType = this.schema.mark('code');
      marks.push(markType);
    }

    if (textProperties['@font-style'] === 'italic') {
      const markType = this.schema.mark('em');
      marks.push(markType);
    }
    if (textProperties['@font-weight'] === 'bold') {
      const markType = this.schema.mark('strong');
      marks.push(markType);
    }

    return marks;
  }

  public handle(nodeType: string, value: any) {
    if (!this.current.handlers[nodeType]) {
      throw new Error('No handler for node: ' + nodeType);
    }
    if ('function' !== typeof this.current.handlers[nodeType]) {
      throw new Error('Invalid handler for node: ' + nodeType);
    }

    this.current.handlers[nodeType](this, value);
  }

  public getElementStyle(element: any): Style {
    const style = ('object' === typeof element && element['@style-name'])
      ? resolveStyle(
        this.stylesTree,
        this.automaticStyles,
        element['@style-name'],
      )
      : {
        styles: [],
      };

    return style;
  }

  get current() {
    return this.currentCtx;
  }
}

export class OdtParser {
  constructor(
    private readonly schema: Schema,
    private readonly config: OdtParserConfig = {},
  ) {}

  public filesMap?: Record<string, Uint8Array<ArrayBufferLike>>;

  parse(files: any) {
    const contentTree = files.contentTree;
    const stylesTree = files.stylesTree;

    const handlers: Record<string, NodeHandler> = {
      ...getInlineNodesHandlers(),
      ...getBasicNodesHandlers(),
      ...getListNodesHandlers(),
      ...getTableNodesHandlers(),

      'change-start': () => {
        // custom(state) {
        //   state.textMarks.add({
        //     markName: 'change',
        //     markAttributes: {},
        //   });
        // },
      },
      'change-end': () => {
        // custom(state) {
        //   state.textMarks.forEach((x) =>
        //     x.markName === 'change' ? state.textMarks.delete(x) : x
        //   );
        // },
      },
      'g': () => { // Test is: embedded-diagram-example.odt
        // DrawG draw:g
      },
      'frame': (ctx: OdtStashContext, odtElement: any) => {
        if (odtElement.object && odtElement.object['@href']) {
          const fullPath = odtElement.object['@href'].replace(/^\.\//, '') +
            '/content.xml';
          if (files[fullPath]) {
            const content = new TextDecoder().decode(files[fullPath]);
            ctx.openNode();
            ctx.closeNode('math', {
              lang: 'mathml',
              content,
            });
            return;
          }
        }
        if (odtElement.image && odtElement.image['@href']) { // TODO links rewrite
          const alt = odtElement.description?.value || '';
          const src = odtElement.image['@href'];
          ctx.openNode();
          ctx.closeNode('image', {
            src,
            alt,
          });
        }
      },

      'annotation': () => {
        // ignore: true,
      },
    };

    const ctx = new OdtStashContext(
      this.schema,
      handlers,
      stylesTree,
      contentTree['automatic-styles'],
    );

    ctx.openNode();
    ctx.handle('body', contentTree.body);
    return ctx.closeNode('doc');
  }
}

function uniqMarks(marks: Mark[]): Mark[] {
  const retVal: Mark[] = [];
  for (const mark of marks) {
    if (
      ['strong', 'italic', 'underline', 'subscript', 'superscript', 'code']
        .includes(mark.type.name)
    ) {
      if (retVal.find((m) => m.type === mark.type)) {
        continue;
      }
    }
    retVal.push(mark);
  }

  return retVal;
}
