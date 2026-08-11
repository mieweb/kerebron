type DiffOp =
  | { type: 'equal'; line: string }
  | { type: 'add'; line: string }
  | { type: 'remove'; line: string };

export function diffLines(a: string, b: string): DiffOp[] {
  const left = a.split('\n');
  const right = b.split('\n');

  const m = left.length;
  const n = right.length;

  // LCS table
  const dp: number[][] = Array.from(
    { length: m + 1 },
    () => Array(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (left[i] === right[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffOp[] = [];

  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (left[i] === right[j]) {
      result.push({ type: 'equal', line: left[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'remove', line: left[i++] });
    } else {
      result.push({ type: 'add', line: right[j++] });
    }
  }

  while (i < m) {
    result.push({ type: 'remove', line: left[i++] });
  }

  while (j < n) {
    result.push({ type: 'add', line: right[j++] });
  }

  return result;
}

export function normalizeDiff(diff: DiffOp[]): DiffOp[] {
  const result: DiffOp[] = [];

  let i = 0;

  while (i < diff.length) {
    const op = diff[i];

    if (op.type === 'remove') {
      const removed: DiffOp[] = [];

      while (
        i < diff.length &&
        diff[i].type === 'remove'
      ) {
        removed.push(diff[i]);
        i++;
      }

      const added: DiffOp[] = [];

      while (
        i < diff.length &&
        diff[i].type === 'add'
      ) {
        added.push(diff[i]);
        i++;
      }

      const count = Math.max(
        removed.length,
        added.length,
      );

      for (let j = 0; j < count; j++) {
        if (removed[j]) result.push(removed[j]);
        if (added[j]) result.push(added[j]);
      }

      continue;
    }

    result.push(op);
    i++;
  }

  return result;
}

export function countDiffLines(diff: DiffOp[]) {
  let added = 0;
  let removed = 0;
  let totalNotWhitespace = 0;

  for (const op of diff) {
    if (op.type === 'add') {
      added++;

      if (op.line.trim().length > 0) {
        totalNotWhitespace++;
      }
    }

    if (op.type === 'remove') {
      removed++;

      if (op.line.trim().length > 0) {
        totalNotWhitespace++;
      }
    }
  }

  const total = added + removed;

  return {
    added,
    removed,
    total,
    changed: total,
    totalNotWhitespace,
  };
}

export function formatDiff(diff: DiffOp[]): string {
  return diff.map((op) => {
    switch (op.type) {
      case 'equal':
        return ` ${op.line}`;
      case 'add':
        return `+${op.line}`;
      case 'remove':
        return `-${op.line}`;
    }
  }).join('\n');
}

const ANSI = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: string, enabled: boolean) {
  return enabled ? `${color}${text}${ANSI.reset}` : text;
}

function diffWords(oldLine: string, newLine: string, colors = true) {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);

  const removed = new Set<string>();
  const added = new Set<string>();

  const newSet = new Set(newWords);
  const oldSet = new Set(oldWords);

  for (const w of oldWords) {
    if (!newSet.has(w)) removed.add(w);
  }

  for (const w of newWords) {
    if (!oldSet.has(w)) added.add(w);
  }

  const oldResult = oldWords.map((w) =>
    removed.has(w) && colors ? `${ANSI.red}${w}${ANSI.reset}` : w
  ).join('');

  const newResult = newWords.map((w) =>
    added.has(w) && colors ? `${ANSI.green}${w}${ANSI.reset}` : w
  ).join('');

  return {
    old: oldResult,
    new: newResult,
  };
}

function splitIndent(line: string) {
  const match = line.match(/^(\s*)(.*)$/);
  return {
    indent: match?.[1] ?? '',
    text: match?.[2] ?? '',
  };
}

function visibleWhitespace(text: string): string {
  return text
    .replace(/\t/g, '→')
    .replace(/ /g, '·');
}

export function formatCompactDiff(
  diff: DiffOp[],
  options: {
    colors?: boolean;
    wordDiff?: boolean;
    preserveIndent?: boolean;
  } = {},
): string {
  const {
    colors = true,
    wordDiff = true,
    preserveIndent = true,
  } = options;

  const out: string[] = [];

  for (let i = 0; i < diff.length; i++) {
    const op = diff[i];

    // Replace: old line followed by new line
    if (op.type === 'remove' && diff[i + 1]?.type === 'add') {
      const next = diff[i + 1];

      if (preserveIndent) {
        const oldParts = splitIndent(op.line);
        const newParts = splitIndent(next.line);

        const oldIndent = colorize(
          visibleWhitespace(oldParts.indent),
          ANSI.red,
          colors,
        );

        const newIndent = colorize(
          visibleWhitespace(newParts.indent),
          ANSI.green,
          colors,
        );

        const oldText = wordDiff
          ? diffWords(oldParts.text, newParts.text, colors).old
          : oldParts.text;

        const newText = wordDiff
          ? diffWords(oldParts.text, newParts.text, colors).new
          : newParts.text;

        out.push(`- ${oldIndent}${oldText}`);
        out.push(`+ ${newIndent}${newText}`);
      } else {
        out.push(
          `- ${wordDiff ? diffWords(op.line, next.line, colors).old : op.line}`,
        );
        out.push(
          `+ ${
            wordDiff ? diffWords(op.line, next.line, colors).new : next.line
          }`,
        );
      }

      i++;
      continue;
    }

    // Single remove
    if (op.type === 'remove') {
      out.push(
        colors ? `${ANSI.red}- ${op.line}${ANSI.reset}` : `- ${op.line}`,
      );
      continue;
    }

    // Single add
    if (op.type === 'add') {
      out.push(
        colors ? `${ANSI.green}+ ${op.line}${ANSI.reset}` : `+ ${op.line}`,
      );
    }
  }

  return out.join('\n');
}

export function formatDiffHeader(
  filename: string,
  diff: DiffOp[],
  colors = true,
): string {
  let added = 0;
  let removed = 0;

  for (const op of diff) {
    if (op.type === 'add') added++;
    if (op.type === 'remove') removed++;
  }

  const changed = added + removed;

  const stats = `+${added} -${removed} (${changed} lines)`;

  return colors
    ? `${ANSI.bold}${filename}${ANSI.reset} ${stats}`
    : `${filename} ${stats}`;
}
