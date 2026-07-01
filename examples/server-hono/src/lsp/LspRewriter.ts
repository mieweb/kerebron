export interface LspRewriter {
  rewriteEditorData(data: string): string;
  rewriteLspData(data: string): string;
  init(): void;
  destroy(): void;
}
