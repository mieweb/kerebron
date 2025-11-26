export type LspPosition = { line: number; character: number };
export type LspRange = { start: LspPosition; end: LspPosition };

export interface Diagnostic {
  range: LspRange;
  severity?: number;
  source?: string;
  message: string;
}

export interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}
