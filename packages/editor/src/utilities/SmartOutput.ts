export interface OutputMeta<K> {
  rowPos: number;
  colPos: number;
  item: K;
}

interface Mapping {
  sourceNo: number;
  sourceRowPos: number;
  sourceColPos: number;
}

export interface SourceMap {
  'version': 3; //  3,
  'file': string; // "out.js",
  'sourceRoot': string; // ""
  'sources': Array<string>; // ["foo.js", "bar.js"],
  'sourcesContent': Array<string>; // [null, null],
  'names': Array<string>; // ["src", "maps", "are", "fun"],
  'mappings': string; // "A,AAAB;;ABCDE;"
}

export class SmartOutput<K> {
  private _rowPos = 0;
  private _colPos = 0;

  private chunks: Array<string> = [];
  private metas: Array<OutputMeta<K>> = [];

  log(text: string, item: K) {
    this.chunks.push(text);

    if (text.length === 0) {
      return;
    }
    const lines = text.split('\n');

    this.metas.push({
      colPos: this._colPos,
      rowPos: this._rowPos,
      item,
    });

    if (lines.length === 1) {
      this._colPos += lines[lines.length - 1].length;
    } else {
      this._rowPos += lines.length - 1;
      this._colPos = lines[lines.length - 1].length;
    }
  }

  get chunkPos() {
    return this.chunks.length;
  }

  rollback(pos: number) {
    this.chunks.splice(pos);
    this.metas.splice(pos);
  }

  get rowPos() {
    return this._rowPos;
  }

  get colPos() {
    return this._colPos;
  }

  endsWith(text: string) {
    return this.chunks.join('').endsWith(text);
  }

  toString() {
    return this.chunks.join('');
  }

  getSourceMap(
    mapper: (item: K, rowPos: number, colPos: number) => Mapping | void,
  ): SourceMap {
    const mappingRows: Array<Array<Array<number>>> = [];

    let lastRow = -1;
    let lastCol = -1;

    let prevSourceNo = 0;
    let prevSourceRowPos = 0;
    let prevSourceColPos = 0;

    let prevColPos = 0;
      
    for (const meta of this.metas) {
      while (meta.rowPos >= mappingRows.length) {
        mappingRows.push([]);
      }

      if (lastRow != meta.rowPos || lastCol != meta.colPos) {
        const currentRow = mappingRows[meta.rowPos];

        if (lastRow != meta.rowPos) {
          prevColPos = 0;
        }
        const mapping = mapper(meta.item, meta.rowPos, meta.colPos);
        if (mapping) {
          currentRow.push([
            meta.colPos - prevColPos,
            mapping.sourceNo - prevSourceNo,
            mapping.sourceRowPos - prevSourceRowPos,
            mapping.sourceColPos - prevSourceColPos,
          ]);
          prevColPos = meta.colPos;
          prevSourceNo = mapping.sourceNo;
          prevSourceRowPos = mapping.sourceRowPos;
          prevSourceColPos = mapping.sourceColPos;
        }
      }

      lastRow = meta.rowPos;
      lastCol = meta.colPos;
    }

    const mappings = mappingRows
      .map((row) =>
        row.map(
          (group) => encode(group),
        )
          .join(',')
      )
      .join(';');

    return {
      version: 3,
      file: '',
      sourceRoot: '',
      sources: [],
      sourcesContent: [],
      names: [],
      mappings,
    };
  }
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toVLQ(value: number): number[] {
  const vlq: number[] = [];
  const isNegative = value < 0;
  value = Math.abs(value);

  if (value === 0) {
    vlq.push(0);
    return vlq;
  }

  while (value > 0) {
    let digit = value & 0x1F;
    value >>= 5;
    if (value > 0) {
      digit |= 0x20;
    }
    vlq.push(digit);
    if (vlq.length === 1) {
      digit = isNegative ? (digit | 0x1) : (digit & ~0x1);
      vlq[0] = digit;
    }
  }

  return vlq;
}

function encodeVLQ(input: number | number[]): string {
  const numbers = Array.isArray(input) ? input : [input];
  let result = '';

  for (const num of numbers) {
    const vlq = toVLQ(num);
    for (const digit of vlq) {
      result += BASE64_CHARS[digit];
    }
  }

  return result;
}

const char_to_integer: Record<string, number> = {};
const integer_to_char: Record<number, string> = {};

'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  .split('')
  .forEach(function (char, i) {
    char_to_integer[char] = i;
    integer_to_char[i] = char;
  });

export function decode(string: string) {
  let result: number[] = [];

  let shift = 0;
  let value = 0;

  for (let i = 0; i < string.length; i += 1) {
    let integer = char_to_integer[string[i]];

    if (integer === undefined) {
      throw new Error('Invalid character (' + string[i] + ')');
    }

    const has_continuation_bit = integer & 32;

    integer &= 31;
    value += integer << shift;

    if (has_continuation_bit) {
      shift += 5;
    } else {
      const should_negate = value & 1;
      value >>>= 1;

      if (should_negate) {
        result.push(value === 0 ? -0x80000000 : -value);
      } else {
        result.push(value);
      }

      // reset
      value = shift = 0;
    }
  }

  return result;
}

export function encode(value: number | number[]) {
  if (typeof value === 'number') {
    return encode_integer(value);
  }

  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    result += encode_integer(value[i]);
  }

  return result;
}

function encode_integer(num: number) {
  let result = '';

  if (num < 0) {
    num = (-num << 1) | 1;
  } else {
    num <<= 1;
  }

  do {
    let clamped = num & 31;
    num >>>= 5;

    if (num > 0) {
      clamped |= 32;
    }

    result += integer_to_char[clamped];
  } while (num > 0);

  return result;
}
