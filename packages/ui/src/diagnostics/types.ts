import { TextRange } from '@kerebron/editor';

export interface DiagnosticsConfig {
  decorationClass?: string;
}

export interface DiagnosticsSource<I = any> {
  getItem: (range: TextRange) => I | Promise<I>;
}

export interface Diagnostic {
  id: string;
  message: string;
  hint?: string;
  range: TextRange;
  attrs?: Record<string, string>;
  // fix?: Fix[];
}
