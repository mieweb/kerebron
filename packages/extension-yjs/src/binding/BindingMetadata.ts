import { ProsemirrorMapping } from '../lib.ts';

export interface BindingMetadata {
  mapping: ProsemirrorMapping;
  isOverlappingMark: Map<string, boolean>;
}
