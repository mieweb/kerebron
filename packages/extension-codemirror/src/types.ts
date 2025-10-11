import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView as CodemirrorView } from '@codemirror/view';
import { Node } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { LanguageSupport } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { Transport } from '@codemirror/lsp-client';

export type LanguageLoaders = Record<string, () => Promise<LanguageSupport>>;

export type ThemeItem = { extension: Extension; name: string };

export type CodeBlockSettings = {
  provider?: any;
  createSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: (() => number) | boolean,
  ) => () => void;
  updateSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: (() => number) | boolean,
    oldNode: Node,
  ) => void;
  createCopyButton: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    codeMirrorView: CodemirrorView,
    getPos: (() => number) | boolean,
  ) => () => void;
  stopEvent: (
    e: Event,
    node: Node,
    getPos: (() => number) | boolean,
    view: EditorView,
    dom: HTMLElement,
  ) => boolean;
  languageLoaders?: LanguageLoaders;
  languageNameMap?: Record<string, string>;
  languageWhitelist?: string[];
  undo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  redo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  theme?: Extension[];
  readOnly: boolean;
  themes: ThemeItem[];
  getCurrentTheme?: () => string;
  codeBlockName?: string;
  shadowRoot?: ShadowRoot;
  lspTransport?: Transport;
};
