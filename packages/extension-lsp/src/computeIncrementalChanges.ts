import * as lsp from 'vscode-languageserver-protocol';

/**
 * Compares two strings and computes the minimal set of text changes
 * using a diff-based approach (simple line-by-line + character diff for simplicity).
 * Returns an array of TextEdit-like changes that transform `previous` into `current`.
 */
export function computeIncrementalChanges(
  previous: string,
  current: string,
): lsp.TextDocumentContentChangeEvent[] {
  if (previous.length === 0) {
    return [
      {
        text: current,
      },
    ];
  }

  const prevLines = previous.split(/\r\n|\r|\n/);
  const currLines = current.split(/\r\n|\r|\n/);

  const changes: lsp.TextDocumentContentChangeEvent[] = [];
  let startLine = 0;
  let insertedText = '';

  // Find common prefix
  while (startLine < prevLines.length && startLine < currLines.length) {
    if (prevLines[startLine] === currLines[startLine]) {
      startLine++;
    } else {
      break;
    }
  }

  // If entire document is the same
  if (
    startLine === prevLines.length &&
    startLine === currLines.length
  ) {
    return changes; // No changes
  }

  // Find common suffix starting from the end
  let endLinePrev = prevLines.length - 1;
  let endLineCurr = currLines.length - 1;
  while (
    endLinePrev >= startLine &&
    endLineCurr >= startLine &&
    prevLines[endLinePrev] === currLines[endLineCurr]
  ) {
    endLinePrev--;
    endLineCurr--;
  }

  // Region to replace: from startLine to endLinePrev (inclusive)
  const replaceStart: lsp.Position = { line: startLine, character: 0 };
  let replaceEnd: lsp.Position;

  if (endLinePrev >= startLine) {
    const lastDeletedLine = prevLines[endLinePrev];
    replaceEnd = {
      line: endLinePrev,
      character: lastDeletedLine.length,
    };
  } else {
    // Deletion ends at the start of the next line
    replaceEnd = { line: startLine, character: 0 };
  }

  // Build inserted text: lines from startLine to endLineCurr
  const insertedLines = currLines.slice(startLine, endLineCurr + 1);
  insertedText = insertedLines.join('\n');

  // If we're inserting at the end of the file, adjust range
  if (startLine === prevLines.length) {
    // Inserting after last line
    replaceEnd = {
      line: prevLines.length - 1,
      character: prevLines[prevLines.length - 1].length,
    };
    if (insertedLines.length === 0) {
      // Inserting empty at EOF
      insertedText = '\n';
    }
  }

  // Create the range for deletion
  const range: lsp.Range = {
    start: replaceStart,
    end: replaceEnd,
  };

  // Push the incremental change
  changes.push({
    range,
    text: insertedText,
  });

  return changes;
}
