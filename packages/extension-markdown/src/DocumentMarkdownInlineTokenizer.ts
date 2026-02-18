import type { Mark, Node } from 'prosemirror-model';
import { Token } from './types.ts';

export type MarkTokenizerSpec = {
  open?: string | ((mark: Mark) => Promise<Token>);
  close?: string | ((mark: Mark) => Promise<Token>);
  mixable?: boolean;
  expelEnclosingWhitespace?: boolean;
  escape?: boolean;
};

export type DocumentMarkdownTokenizerSpec = {
  open?: string | ((node: Node, pos: number, idx: number) => Promise<Token>);
  close?:
    | string
    | ((
      node: Node,
      pos: number,
      idx: number,
      openToken: Token,
    ) => Promise<Token>);
  selfClose?:
    | string
    | ((node: Node, pos: number, idx: number) => Promise<Token>);
  margin?: 'before' | 'after' | 'both';
};

const blankMark: MarkTokenizerSpec = { open: '', close: '', mixable: true };
const blankNode: DocumentMarkdownTokenizerSpec = { open: '', close: '' };

function generateInlineTokens(input: Array<[string, number]>): Array<Token> {
  const tokens: Array<Token> = [];

  let currentPos = -1;
  let currentText = '';

  for (const [text, inlinePos] of input) {
    if (true || currentPos !== inlinePos) {
      if (currentText.length > 0) {
        const token = new Token('text', '', 0);
        token.meta = 'generateInline1';
        token.map = [currentPos];
        token.content = currentText;
        tokens.push(token);
      }

      currentText = '';
      currentPos = inlinePos;
    }

    currentText += text;
  }

  if (currentText.length > 0) {
    const token = new Token('text', '', 0);
    token.meta = 'generateInline2';
    token.map = [currentPos];
    token.content = currentText;
    tokens.push(token);
  }

  return tokens;
}

export class DocumentMarkdownInlineTokenizer {
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

  async renderInline(
    parent: Node,
    currentPos: number,
    level: number,
  ): Promise<Token[]> {
    const active: Mark[] = [];
    const trailing: Array<[string, number]> = [];

    const inlineTokens: Array<Token> = [];

    const progress = async (node: Node, offset: number, index: number) => {
      const inlinePos = currentPos + offset;
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

      const leading: Array<[string, number]> = trailing.splice(
        0,
        trailing.length,
      );
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
          leading.push([lead, inlinePos]);
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
          trailing.push([trail, inlinePos]);
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
        await this.markString(x, false, inlineTokens);
      }

      // Output any previously expelled trailing whitespace outside the marks
      inlineTokens.push(
        ...generateInlineTokens(leading.splice(0, leading.length)),
      );

      // Open the marks that need to be opened
      while (active.length < len) {
        let add = marks[active.length];
        active.push(add);
        await this.markString(add, true, inlineTokens);
      }

      // Render the node. Special case code marks, since their content
      // may not be escaped.
      if (noEsc && node.isText) {
        await this.markString(inner!, true, inlineTokens);
        if (node.text) {
          const token = new Token('text', '', 0);
          token.meta = 'noEscText';
          token.map = [inlinePos];
          token.content = node.text;
          inlineTokens.push(token);
        }
        await this.markString(inner!, false, inlineTokens);
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
            token.meta = 'nodeSpec.selfClose';
            token.level = level;
            token.map = [inlinePos];
            inlineTokens.push(token);
          } else {
            const token = await nodeSpec.selfClose(node, inlinePos, index);
            token.meta = '!nodeSpec.selfClose';
            token.level = level;
            token.map = [inlinePos];
            inlineTokens.push(token);
          }
        }
      }
    };

    let offset = 0;
    for (let idx = 0; idx < parent.childCount; idx++) {
      const child = parent.child(idx);
      await progress(child, offset, idx);
      offset += child.nodeSize;
    }

    // Close the marks that need to be closed
    while (active.length > 0) {
      const x = active.pop()!;
      await this.markString(x, false, inlineTokens);
    }

    // Output any previously expelled trailing whitespace outside the marks
    inlineTokens.push(
      ...generateInlineTokens(trailing.splice(0, trailing.length)),
    );

    return inlineTokens;
  }

  async markString(mark: Mark, open: boolean, tokens: Token[]) {
    let info = this.getMark(mark.type.name);
    let value = open ? info.open : info.close;

    if (!value) {
      /** Skip unknown marks (like textColor, highlight) - they'll be lost in markdown but won't crash */
      console.warn(
        'Unsupported mark type for markdown: ' + mark.type.name +
          ', available types: ' +
          Object.keys(this.marks).join(', ') + '. Mark will be ignored.',
      );
      return;
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
      const token = await value(mark);
      if (token) {
        token.meta = token.meta || 'markString()';
        tokens.push(token);
      }
    }
  }
}
