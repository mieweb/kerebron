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

  async iterateNode(node: Node, currentPos: number, level = -1) {
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
        const token = await nodeSpec.open(node, currentPos);
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
        const token = await nodeSpec.selfClose(node, currentPos);
        token.level = level;
        token.map = [currentPos];
        this.tokens.push(token);
      }
      return;
    }

    if (node.inlineContent) {
      const token = new Token('inline', '', 0);
      token.level = level + 1;
      token.map = [currentPos];
      this.tokens.push(token);

      token.children = await this.inlineTokenizer.renderInline(
        node,
        currentPos + 1,
        level + 1,
      );
    } else if (node.childCount > 0) {
      let offset = 0;
      for (let idx = 0; idx < node.childCount; idx++) {
        const child = node.child(idx);
        await this.iterateNode(child, currentPos + offset + 1, level + 1);
        offset += child.nodeSize;
      }
    }

    if (nodeSpec.close) {
      if (typeof nodeSpec.close === 'string') {
        const token = new Token(nodeSpec.close, tag, -1);
        token.meta = 'nodeSpec.close';
        token.level = level;
        // token.map = [currentPos];
        this.tokens.push(token);
      } else {
        const token = await nodeSpec.close(node, currentPos);
        token.meta = 'nodeSpec.close()';
        token.level = level;
        // token.map = [currentPos];
        this.tokens.push(token);
      }
    }
  }

  async serialize(content: Node, options: {} = {}): Promise<Token[]> {
    await this.iterateNode(content, -1); // doc does not have index, so I put -1 for correct calculation
    return this.tokens;
  }
}
