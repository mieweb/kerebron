import { DOMOutputSpec } from 'prosemirror-model';

export interface TemplatesRegistry {
  [key: string]: (...args: any[]) => DOMOutputSpec;
}
