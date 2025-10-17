// https://github.com/markdown-it/markdown-it/blob/master/lib/token.mjs

type TupleArray = Array<[string, string]>;

export const NESTING_OPENING = 1;
export const NESTING_SELF_CLOSING = 0;
export const NESTING_CLOSING = -1;

type Nesting = -1 | 0 | 1;

export class Token {
  attrs: TupleArray | null = null;
  map: [number, number] | [number, number, number, number] | null = null;
  level: number = 0;
  children: Array<Token> | null = null;
  content: string = '';
  markup: string = '';
  info: string = '';
  meta: any = null;
  block = false;
  hidden = false;

  constructor(
    public type: string,
    public tag: string,
    public nesting: Nesting,
  ) {
  }

  attrIndex(name: string) {
    if (!this.attrs) return -1;

    const attrs = this.attrs;

    for (let i = 0, len = attrs.length; i < len; i++) {
      if (attrs[i][0] === name) return i;
    }
    return -1;
  }

  attrPush(attrData: [string, string]) {
    if (this.attrs) {
      this.attrs.push(attrData);
    } else {
      this.attrs = [attrData];
    }
  }

  attrSet(name: string, value: string) {
    const idx = this.attrIndex(name);
    const attrData: [string, string] = [name, value];

    if (idx < 0 || !this.attrs) {
      this.attrPush(attrData);
    } else {
      this.attrs[idx] = attrData;
    }
  }

  attrGet(name: string) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0 && this.attrs) {
      value = this.attrs[idx][1];
    }
    return value;
  }

  attrJoin(name: string, value: string) {
    const idx = this.attrIndex(name);

    if (idx < 0 || !this.attrs) {
      this.attrPush([name, value]);
    } else {
      this.attrs[idx][1] = this.attrs[idx][1] + ' ' + value;
    }
  }
}
