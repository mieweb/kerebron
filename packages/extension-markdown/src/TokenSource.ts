export class TokenSource<K> {
  private currentPos: number;

  constructor(private tokens: Array<K>) {
    this.currentPos = 0;
  }

  get pos() {
    return this.currentPos;
  }

  iterate(start: number, callback: (token: K, tokenNo: number) => void) {
    for (
      this.currentPos = start;
      this.currentPos < this.tokens.length;
      this.currentPos++
    ) {
      const token = this.tokens[this.currentPos];
      callback(token, this.currentPos);
    }
  }

  append(tokens: Array<K>) {
    this.tokens.push(...tokens);
    return this.tokens.length - tokens.length;
  }

  trim(pos: number) {
    this.tokens.splice(pos);
  }

  rewind(tokenNo: number = -1) {
    if (tokenNo < 0) {
      throw new RangeError('Invalid rewind pos: ' + tokenNo);
    }
    this.currentPos = tokenNo;
  }
}
