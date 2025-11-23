import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView as CodemirrorView } from '@codemirror/view';
import { Node } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { LanguageSupport } from '@codemirror/language';
import { Extension as CmExtension } from '@codemirror/state';
import { type Transport } from '@kerebron/extension-lsp';

export type LanguageLoaders = Record<string, () => Promise<LanguageSupport>>;

export type ThemeItem = { extension: CmExtension; name: string };

export type CodeBlockSettings = {
  createSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
  ) => () => void;
  updateSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    oldNode: Node,
  ) => void;
  createCopyButton: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    codeMirrorView: CodemirrorView,
    getPos: () => number | undefined,
  ) => () => void;
  stopEvent: (
    e: Event,
    node: Node,
    getPos: () => number | undefined,
    view: EditorView,
    dom: HTMLElement,
  ) => boolean;
  languageLoaders?: LanguageLoaders;
  languageNameMap?: Record<string, string>;
  languageWhitelist?: string[];
  undo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  redo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  theme?: CmExtension[];
  themes: ThemeItem[];
  readOnly?: boolean;
  getCurrentTheme?: () => string;
  codeBlockName?: string;
  lspTransport?: Transport;
};
