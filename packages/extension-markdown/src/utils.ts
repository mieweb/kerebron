export function spaces(num: number) {
  return ' '.repeat(num || 0);
}

export function inchesToSpaces(value: string): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith('in')) {
    return Math.floor(parseFloat(value.substring(0, value.length - 2)) / 0.125);
  }
  return 0;
}

export function inchesToMm(value: string): number {
  if (!value) {
    return 0;
  }
  if (value.endsWith('pt')) {
    return parseFloat(value.substring(0, value.length - 2)) * 0.3528;
  }
  if (value.endsWith('in')) {
    return parseFloat(value.substring(0, value.length - 2)) * 25.4;
  }
  if (value.endsWith('em')) {
    return parseFloat(value.substring(0, value.length - 2)) / 0.125 * 25.4;
  }
  return 0;
}

export function inchesToPixels(value): number {
  if (!value) {
    return 0;
  }
  return Math.floor(100 * inchesToMm(value));
}

export function fixCharacters(text) {
  return text
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    // deno-lint-ignore no-control-regex
    .replace(/\x0b/g, ' ')
    .replace(/\u201d/g, '"')
    .replace(/\u201c/g, '"');
}

export function numberString(num: number, symbol = '1') {
  if (['a'].includes(symbol)) {
    return String.fromCharCode('a'.charCodeAt(0) + num - 1) + '.  ';
  }
  if (['A'].includes(symbol)) {
    return String.fromCharCode('A'.charCodeAt(0) + num - 1) + '.  ';
  }
  if (['I'].includes(symbol)) {
    return `${romanize(num)}. `;
  }
  if (['i'].includes(symbol)) {
    return `${romanize(num).toLowerCase()}. `;
  }
  if (['1'].includes(symbol)) {
    return `${num}. `;
  }

  return `${num}. `;
}

export function romanize(num: number): string {
  const lookup: [string, number][] = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ];

  let roman = '';
  for (const [symbol, value] of lookup) {
    while (num >= value) {
      roman += symbol;
      num -= value;
    }
  }
  return roman;
}
