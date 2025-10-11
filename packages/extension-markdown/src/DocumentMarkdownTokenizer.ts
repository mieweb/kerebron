import type { Mark, Node } from 'prosemirror-model';
import Token from 'markdown-it/lib/token.mjs';

type MarkTokenizerSpec = {
  open?: string | ((mark: Mark) => Token);
  close?: string | ((mark: Mark) => Token);
  mixable?: boolean;
  expelEnclosingWhitespace?: boolean;
  escape?: boolean;
};

type DocumentMarkdownTokenizerSpec = {
  open?: string | ((node: Node) => Token);
  close?: string | ((node: Node) => Token);
  selfClose?: string | ((node: Node) => Token);
};

const blankMark: MarkTokenizerSpec = { open: '', close: '', mixable: true };
const blankNode: DocumentMarkdownTokenizerSpec = { open: '', close: '' };

class InlineTokenizer {
  constructor(
    readonly nodes: {
      [node: string]: (
        node: Node,
        index: number,
      ) => DocumentMarkdownTokenizerSpec;
    },
    readonly marks: { [mark: string]: MarkTokenizerSpec },
    readonly options: { hardBreakNodeName: string },
  ) {
  }

  private getMark(name: string): MarkTokenizerSpec {
    let info = this.marks[name];
    if (!info) {
      // if (this.options.strict !== false) {
      //   throw new Error(
      //     `Mark type \`${name}\` not supported by Markdown renderer`,
      //   );
      // }
      return blankMark;
    }
    return info;
  }

  renderInline(parent: Node, currentPos: number, level: number) {
    const fromBlockStart = true;
    let atBlockStart = fromBlockStart;
    let active: Mark[] = [], trailing = '';

    const retVal: Array<Token> = [];

    const progress = (node: Node, offset: number, index: number) => {
      let marks = node ? node.marks : [];

      // Remove marks from `hard_break` that are the last node inside
      // that mark to prevent parser edge cases with new lines just
      // before closing marks.
      // TODO:
      if (node && node.type.name === this.options.hardBreakNodeName) {
        marks = marks.filter((m) => {
          if (index + 1 == parent.childCount) return false;
          let next = parent.child(index + 1);
          return m.isInSet(next.marks) &&
            (!next.isText || /\S/.test(next.text!));
        });
      }

      let leading = trailing;
      trailing = '';
      // If whitespace has to be expelled from the node, adjust
      // leading and trailing accordingly.
      if (
        node.isText && marks.some((mark) => {
          let info = this.getMark(mark.type.name);
          return info && info.expelEnclosingWhitespace && !mark.isInSet(active);
        })
      ) {
        let [_, lead, rest] = /^(\s*)(.*)$/m.exec(node.text!)!;
        if (lead) {
          leading += lead;
          node = rest ? (node as any).withText(rest) : null;
          if (!node) marks = active;
        }
      }
      if (
        node.isText && marks.some((mark) => {
          let info = this.getMark(mark.type.name);
          return info && info.expelEnclosingWhitespace &&
            (index == parent.childCount - 1 ||
              !mark.isInSet(parent.child(index + 1).marks));
        })
      ) {
        let [_, rest, trail] = /^(.*?)(\s*)$/m.exec(node.text!)!;
        if (trail) {
          trailing = trail;
          node = rest ? (node as any).withText(rest) : null;
          if (!node) marks = active;
        }
      }
      let inner = marks.length ? marks[marks.length - 1] : null;
      let noEsc = inner && this.getMark(inner.type.name).escape === false;
      let len = marks.length - (noEsc ? 1 : 0);

      // Try to reorder 'mixable' marks, such as em and strong, which
      // in Markdown may be opened and closed in different order, so
      // that order of the marks for the token matches the order in
      // active.
      outer: for (let i = 0; i < len; i++) {
        let mark = marks[i];
        if (!this.getMark(mark.type.name).mixable) break;
        for (let j = 0; j < active.length; j++) {
          let other = active[j];
          if (!this.getMark(other.type.name).mixable) break;
          if (mark.eq(other)) {
            if (i > j) {
              marks = marks.slice(0, j).concat(mark).concat(marks.slice(j, i))
                .concat(marks.slice(i + 1, len));
            } else if (j > i) {
              marks = marks.slice(0, i).concat(marks.slice(i + 1, j)).concat(
                mark,
              ).concat(marks.slice(j, len));
            }
            continue outer;
          }
        }
      }

      // Find the prefix of the mark set that didn't change
      let keep = 0;
      while (
        keep < Math.min(active.length, len) && marks[keep].eq(active[keep])
      ) ++keep;

      // Close the marks that need to be closed
      while (keep < active.length) {
        const x = active.pop()!;
        this.markString(x, false, retVal);
      }

      // Output any previously expelled trailing whitespace outside the marks
      if (leading) {
        const token = new Token('text', '', 0);
        token.meta = 'leading';
        token.content = leading;
        retVal.push(token);
      }

      // Open the marks that need to be opened
      while (active.length < len) {
        let add = marks[active.length];
        active.push(add);
        this.markString(add, true, retVal);
        atBlockStart = false;
      }

      // Render the node. Special case code marks, since their content
      // may not be escaped.
      if (noEsc && node.isText) {
        this.markString(inner!, true, retVal);
        if (node.text) {
          const token = new Token('text', '', 0);
          token.meta = 'noEscText';
          token.content = node.text;
          retVal.push(token);
        }
        this.markString(inner!, false, retVal);
      } else {
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

        if (nodeSpec.selfClose) {
          if (typeof nodeSpec.selfClose === 'string') {
            const token = new Token(nodeSpec.selfClose, tag, 0);
            token.level = level;
            token.map = [currentPos, currentPos + 1];
            retVal.push(token);
          } else {
            const token = nodeSpec.selfClose(node);
            token.level = level;
            token.map = [currentPos, currentPos + 1];
            retVal.push(token);
          }
        }
      }
      atBlockStart = false;

      if (node.isText && node.nodeSize > 0) {
        atBlockStart = false;
      }
    };

    parent.forEach((child, offset, index) => progress(child, offset, index));

    // Close the marks that need to be closed
    while (active.length > 0) {
      const x = active.pop()!;
      this.markString(x, false, retVal);
    }

    // Output any previously expelled trailing whitespace outside the marks
    if (trailing) {
      const token = new Token('text', '', 0);
      token.meta = 'trailing';
      token.content = trailing;
      retVal.push(token);
    }

    return retVal;
  }

  markString(mark: Mark, open: boolean, tokens: Token[]) {
    let info = this.getMark(mark.type.name);
    let value = open ? info.open : info.close;

    if (!value) {
      throw new Error(
        'Invalid mark type: ' + mark.type.name + ', available types: ' +
          Object.keys(this.marks),
      );
    }

    const token = typeof value == 'string' ? value : value(mark);

    let tag = '';
    if (mark.type.spec.toDOM) {
      const dom = mark.type.spec.toDOM(mark, true);
      if (Array.isArray(dom) && dom.length > 0) {
        tag = dom[0];
      }
    }

    if (typeof value === 'string') {
      const token = new Token(value, tag, open ? 1 : -1);
      token.meta = 'markString';
      tokens.push(token);
    } else {
      const token = value(mark);
      if (token) {
        token.meta = token.meta || 'markString()';
        tokens.push(token);
      }
    }
  }
}

export class DocumentMarkdownTokenizer {
  private tokens: Array<Token> = [];
  inlineTokenizer: InlineTokenizer;

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
    this.inlineTokenizer = new InlineTokenizer(nodes, marks, options);
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
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.open(node);
        token.level = level;
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      }
    }

    if (nodeSpec.selfClose) {
      if (typeof nodeSpec.selfClose === 'string') {
        const token = new Token(nodeSpec.selfClose, tag, 0);
        token.level = level;
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.selfClose(node);
        token.level = level;
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      }
    }

    if (node.inlineContent) {
      const token = new Token('inline', '', 0);
      token.level = level + 1;
      token.map = [currentPos, currentPos + 1];
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
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      } else {
        const token = nodeSpec.close(node);
        token.meta = 'nodeSpec.close()';
        token.level = level;
        token.map = [currentPos, currentPos + 1];
        this.tokens.push(token);
      }
    }
  }

  serialize(content: Node, options: {} = {}): Token[] {
    this.iterateNode(content);
    return this.tokens;
  }
}
