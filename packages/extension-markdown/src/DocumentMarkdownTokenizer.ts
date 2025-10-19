import type { Node } from 'prosemirror-model';
import { Token } from './types.ts';
import {
  DocumentMarkdownInlineTokenizer,
  DocumentMarkdownTokenizerSpec,
  MarkTokenizerSpec,
} from './DocumentMarkdownInlineTokenizer.ts';

const blankNode: DocumentMarkdownTokenizerSpec = { open: '', close: '' };

export class DocumentMarkdownTokenizer {
  private tokens: Array<Token> = [];
  inlineTokenizer: DocumentMarkdownInlineTokenizer;

  constructor(
    readonly nodes: {
      [node: string]: (
        node: Node,
        index: number,
      ) => DocumentMarkdownTokenizerSpec;
    },
    readonly marks: { [mark: string]: MarkTokenizerSpec },
    readonly options: { hardBreakNodeName: string } = {
      hardBreakNodeName: 'hard_break',
    },
  ) {
    this.inlineTokenizer = new DocumentMarkdownInlineTokenizer(
      nodes,
      marks,
      options,
    );
  }

  iterateNode(node: Node, currentPos = 0, level = -1) {
    const nodeSpec = this.nodes[node.type.name]
      ? this.nodes[node.type.name](node, currentPos)
      : blankNode;

    let tag = '';
    if (node.type.spec.toDOM) {
      const dom = node.type.spec.toDOM(node);
      if (Array.isArray(dom) && dom.length > 0) {
        tag = dom[0];
      }
    }

    if (nodeSpec.open) {
      if (typeof nodeSpec.open === 'string') {
        const token = new Token(nodeSpec.open, tag, 1);
        token.level = level;
        token.meta = 'nodeSpec.open';
        token.map = [currentPos];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.open(node);
        token.level = level;
        token.meta = 'nodeSpec.open()';
        token.map = [currentPos];
        this.tokens.push(token);
      }
    }

    if (nodeSpec.selfClose) {
      if (typeof nodeSpec.selfClose === 'string') {
        const token = new Token(nodeSpec.selfClose, tag, 0);
        token.level = level;
        token.map = [currentPos];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.selfClose(node);
        token.level = level;
        token.map = [currentPos];
        this.tokens.push(token);
      }
    }

    if (node.inlineContent) {
      const token = new Token('inline', '', 0);
      token.level = level + 1;
      token.map = [currentPos];
      this.tokens.push(token);

      token.children = this.inlineTokenizer.renderInline(
        node,
        currentPos + 1,
        level + 1,
      );
    } else if (node.childCount > 0) {
      node.forEach((child, offset) => {
        this.iterateNode(child, currentPos + offset + 1, level + 1);
      });
    }

    if (nodeSpec.close) {
      if (typeof nodeSpec.close === 'string') {
        const token = new Token(nodeSpec.close, tag, -1);
        token.meta = 'nodeSpec.close';
        token.level = level;
        // token.map = [currentPos];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.close(node);
        token.meta = 'nodeSpec.close()';
        token.level = level;
        // token.map = [currentPos];
        this.tokens.push(token);
      }
    }
  }

  serialize(content: Node, options: {} = {}): Token[] {
    this.iterateNode(content);
    return this.tokens;
  }
}
