import { TextRange } from '@kerebron/editor';

export interface DiagnosticsConfig {
  decorationTag?: string;
  decorationClass?: string;
}

export interface DiagnosticsSource<I = any> {
  getItem: (range: TextRange) => I | Promise<I>;
}
