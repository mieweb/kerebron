// Tiny, slop yaml parser / stringifier
// Intended for frontmatters. For more advance usage external js-yaml or similar

export type YAMLValue =
  | string
  | number
  | boolean
  | null
  | YAMLMap
  | YAMLArray;

export type YAMLMap = Map<string, YAMLValue>;
export interface YAMLArray extends Array<YAMLValue> {}

const findUnquotedColon = (s: string): number => {
  let inSingle = false, inDouble = false;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === ':' && !inSingle && !inDouble) return k;
  }
  return -1;
};

export function parse(input: string): YAMLValue {
  const lines = input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));

  const parseValue = (v: string): YAMLValue => {
    v = v.trim();

    if (v === '') return null;
    if (v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;

    if (!isNaN(Number(v))) return Number(v);

    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return v.slice(1, -1);
    }

    return v;
  };

  let i = 0;

  const parseBlock = (parentIndent: number): YAMLValue => {
    let result: YAMLMap | YAMLArray | null = null;
    let isArray: boolean | null = null;

    while (i < lines.length) {
      const line = lines[i];
      const indent = line.match(/^ */)?.[0].length ?? 0;

      if (indent < parentIndent) break;

      const trimmed = line.trim();

      if (trimmed.startsWith('-')) {
        if (result === null) {
          result = [];
          isArray = true;
        }
        if (isArray === false) {
          throw new Error('Mixed array/object structure');
        }
        isArray = true;

        const valuePart = trimmed.slice(1).trim();

        if (valuePart === '') {
          i++;
          (result as YAMLArray).push(parseBlock(indent + 2));
        } else {
          const colonIdx = findUnquotedColon(valuePart);
          if (colonIdx === -1) {
            (result as YAMLArray).push(parseValue(valuePart));
            i++;
          } else {
            const map: YAMLMap = new Map();
            const key = valuePart.slice(0, colonIdx).trim();
            const rest = valuePart.slice(colonIdx + 1).trim();
            i++;
            map.set(
              key,
              rest === '' ? parseBlock(indent + 2) : parseValue(rest),
            );
            // parse remaining deeper-indented entries into the same map
            while (i < lines.length) {
              const nextLine = lines[i];
              const nextIndent = nextLine.match(/^ */)?.[0].length ?? 0;
              if (nextIndent <= indent) break;
              const nextTrimmed = nextLine.trim();
              const nextColon = findUnquotedColon(nextTrimmed);
              if (nextColon === -1) break;
              const k2 = nextTrimmed.slice(0, nextColon).trim();
              const r2 = nextTrimmed.slice(nextColon + 1).trim();
              i++;
              map.set(
                k2,
                r2 === '' ? parseBlock(nextIndent + 2) : parseValue(r2),
              );
            }
            (result as YAMLArray).push(map);
          }
        }

        continue;
      }

      const idx = trimmed.indexOf(':');
      if (idx === -1) {
        throw new Error(`Invalid line: ${line}`);
      }

      if (result === null) {
        result = new Map();
        isArray = false;
      }
      if (isArray === true) {
        throw new Error('Mixed array/object structure');
      }

      const key = trimmed.slice(0, idx).trim();
      const valuePart = trimmed.slice(idx + 1).trim();

      i++;
      (result as YAMLMap).set(
        key,
        valuePart === '' ? parseBlock(indent + 2) : parseValue(valuePart),
      );
    }

    return result ?? new Map();
  };

  return parseBlock(0);
}

export function stringify(value: any, indentSize = 2): string {
  value = fromJSON(value);
  const indent = (lvl: number) => ' '.repeat(lvl * indentSize);

  const isObj = (v: any) =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

  const lines: string[] = [];

  function emit(val: any, lvl: number, key?: string) {
    const prefix = key !== undefined ? indent(lvl) + key + ': ' : indent(lvl);

    if (val === null) {
      lines.push(prefix + 'null');
      return;
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
      lines.push(prefix + String(val));
      return;
    }

    if (typeof val === 'string') {
      const v = /[:\s]/.test(val) ? `"${val}"` : val;
      lines.push(prefix + v);
      return;
    }

    if (Array.isArray(val)) {
      if (key !== undefined) {
        lines.push(indent(lvl) + key + ':');
        lvl++;
      }

      for (const item of val) {
        if (Array.isArray(item)) {
          // nested array -> must expand, never join()
          lines.push(indent(lvl) + '-');
          emit(item, lvl + 1);
        } else if (isObj(item)) {
          lines.push(indent(lvl) + '-');
          emit(item, lvl + 1);
        } else {
          lines.push(indent(lvl) + '- ' + formatScalar(item));
        }
      }
      return;
    }

    if (isObj(val)) {
      if (key !== undefined) {
        lines.push(indent(lvl) + key + ':');
        lvl++;
      }

      for (const [k, v] of val) {
        emit(v, lvl, k);
      }
      return;
    }

    // fallback safety (should never hit)
    lines.push(prefix + String(val));
  }

  function formatScalar(v: any): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return /[:\s]/.test(v) ? `"${v}"` : v;
    return String(v);
  }

  emit(value, 0);
  return lines.join('\n');
}

export function fromJSON(value: unknown): YAMLValue {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map(fromJSON) as YAMLArray;
  }
  if (typeof value === 'object') {
    if (value instanceof Map) {
      return value;
    }
    const map: YAMLMap = new Map();
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      map.set(k, fromJSON(v));
    }
    return map;
  }
  if (
    typeof value === 'string' || typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  throw new Error(`Unsupported JSON value: ${typeof value}`);
}

export function toJSON(value: YAMLValue): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value) {
      obj[k] = toJSON(v);
    }
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map(toJSON);
  }
  return value;
}

export function setPathValue(
  root: YAMLValue,
  path: string,
  value: YAMLValue,
): void {
  const segs =
    path.match(/[^.\[\]]+|\[\d+\]/g)?.map((s) =>
      s.startsWith('[') ? Number(s.slice(1, -1)) : s
    ) ?? [];
  if (segs.length === 0) throw new Error('empty path');
  if (!(root instanceof Map) && !Array.isArray(root)) {
    throw new Error('root must be Map or array');
  }

  let cur: YAMLValue = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];

    let next: YAMLValue | undefined = typeof seg === 'number'
      ? Array.isArray(cur) ? cur[seg] : undefined
      : cur instanceof Map
      ? cur.get(seg)
      : undefined;

    if (!(next instanceof Map) && !Array.isArray(next)) {
      if (next !== undefined && next !== null) {
        console.log('next', next);
        throw new Error(`"${seg}" #${i} of "${path}" not container`);
      }
      const nextIsNum = typeof segs[i + 1] === 'number';
      next = nextIsNum ? [] : new Map();
      if (typeof seg === 'number') (cur as YAMLArray)[seg] = next;
      else (cur as YAMLMap).set(seg, next);
    }
    cur = next;
  }

  const last = segs[segs.length - 1];
  if (typeof last === 'number') {
    if (!Array.isArray(cur)) throw new Error('target not array');
    while (cur.length <= last) cur.push(null);
    cur[last] = value;
  } else {
    if (!(cur instanceof Map)) throw new Error('target not map');
    cur.set(last, value);
  }
}

export interface YamlService {
  parse: typeof parse;
  stringify: typeof stringify;
  toJSON: typeof toJSON;
  fromJSON: typeof fromJSON;
  setPathValue: typeof setPathValue;
}
