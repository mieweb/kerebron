import { assertEquals } from '@std/assert';
import {
  fromJSON,
  parse,
  setPathValue,
  stringify,
  toJSON,
} from '../src/utilities/yaml.ts';

Deno.test('parses flat object', () => {
  const input = `
name: Alice
age: 30
active: true
`;

  const expected = {
    name: 'Alice',
    age: 30,
    active: true,
  };

  assertEquals(toJSON(parse(input)), expected);
});

Deno.test('parses nested object', () => {
  const input = `
user:
  name: Bob
  age: 25
`;

  const expected = {
    user: {
      name: 'Bob',
      age: 25,
    },
  };

  assertEquals(toJSON(parse(input)), expected);
});

Deno.test('parses array of scalars', () => {
  const input = `
items:
  - a
  - b
  - c
`;

  const expected = {
    items: ['a', 'b', 'c'],
  };

  assertEquals(toJSON(parse(input)), expected);
});

Deno.test('parses nested arrays', () => {
  const input = `
matrix:
  -
    - 1
    - 2
  -
    - 3
    - 4
`;

  const expected = {
    matrix: [
      [1, 2],
      [3, 4],
    ],
  };

  const parsed = parse(input);

  assertEquals(toJSON(parsed), expected);
  assertEquals(
    stringify(parsed),
    input.split('\n').filter((line) => line.length > 0).join('\n'),
  );
});

Deno.test('parses mixed types', () => {
  const input = `
a: 1
b: "text"
c: false
d: null
`;

  const expected = {
    a: 1,
    b: 'text',
    c: false,
    d: null,
  };

  assertEquals(toJSON(parse(input)), expected);
});

Deno.test('stringify round trip simple object', () => {
  const obj = {
    name: 'Alice',
    age: 30,
    active: true,
  };

  const parsedBack = parse(stringify(obj));
  assertEquals(toJSON(parsedBack), obj);
});

Deno.test('stringify round trip nested structure', () => {
  const obj = {
    user: {
      name: 'Bob',
      tags: ['a', 'b', 'c'],
    },
  };

  const yaml = stringify(obj);
  assertEquals(yaml, `user:\n  name: Bob\n  tags:\n    - a\n    - b\n    - c`);

  const parsedBack = parse(yaml);
  assertEquals(toJSON(parsedBack), obj);
});

Deno.test('handles empty input', () => {
  const input = '';
  assertEquals(toJSON(parse(input)), {});
});

Deno.test('ignores comments', () => {
  const input = `
# comment
a: 1
# another comment
b: 2
`;

  assertEquals(parse(input), fromJSON({ a: 1, b: 2 }));
});

Deno.test('setPathValue sets flat key', () => {
  const doc = parse('a: 1\nb: 2');
  setPathValue(doc, 'a', 99);
  assertEquals(toJSON(doc), { a: 99, b: 2 });
});

Deno.test('setPathValue sets nested key', () => {
  const doc = parse('user:\n  name: Bob');
  setPathValue(doc, 'user.name', 'Alice');
  assertEquals(toJSON(doc), { user: { name: 'Alice' } });
});

Deno.test('setPathValue creates missing path', () => {
  const doc = parse('a: 1');
  setPathValue(doc, 'x.y.z', 5);
  assertEquals(toJSON(doc), { a: 1, x: { y: { z: 5 } } });
});

Deno.test('setPathValue sets array index', () => {
  const doc = parse('items:\n  - a\n  - b\n  - c');
  setPathValue(doc, 'items[1]', 'B');
  assertEquals(toJSON(doc), { items: ['a', 'B', 'c'] });
});

Deno.test('setPathValue sets nested array element field', () => {
  const doc = parse('list:\n  - text: a\n  - text: b');
  setPathValue(doc, 'list[1].text', 'B');
  assertEquals(toJSON(doc), { list: [{ text: 'a' }, { text: 'B' }] });
});
