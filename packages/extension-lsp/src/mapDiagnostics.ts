import * as lsp from 'vscode-languageserver-protocol';
import type { Diagnostic } from '@kerebron/ui/diagnostics';
import { ContentMapper } from '@kerebron/workspace';

export function mapDiagnostics(
  lspDiagnostics: lsp.Diagnostic[],
  contentMapper: ContentMapper,
  pos: number,
): Diagnostic[] {
  const retVal: Diagnostic[] = [];

  for (const diag of lspDiagnostics) {
    const from = contentMapper.fromLineChar(
      diag.range.start.line,
      diag.range.start.character,
    );
    const end = contentMapper.fromLineChar(
      diag.range.end.line,
      diag.range.end.character,
    );

    if (from > -1 && end > -1) {
      retVal.push({
        id: crypto.randomUUID(),
        message: diag.message,
        range: { from: pos + from, to: pos + end },
      });
    }
  }

  return retVal;
}
