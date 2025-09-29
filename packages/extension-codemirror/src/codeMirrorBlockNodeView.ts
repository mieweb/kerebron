import { Node } from 'prosemirror-model';
import {
  EditorView,
  EditorView as PMEditorView,
  NodeView,
} from 'prosemirror-view';
import { exitCode, selectAll } from '@kerebron/editor/commands';

import {
  drawSelection,
  EditorView as CodeMirror,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import {
  highlightSelectionMatches,
  selectNextOccurrence,
} from '@codemirror/search';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';

import {
  backspaceHandler,
  computeChange,
  forwardSelection,
  maybeEscape,
  setMode,
  setTheme,
  valueChanged,
} from './utils.ts';
import { CodeBlockSettings } from './types.ts';
import { YSyncConfig, ySyncFacet } from './y-sync.ts';
import {
  yRemoteSelections,
  yRemoteSelectionsTheme,
} from './y-remote-selections.ts';
import { CoreEditor } from '@kerebron/editor';

export const themeCallbacks: Array<(theme: string) => void> = [];

class CodeMirrorBlockNodeView implements NodeView {
  dom: HTMLDivElement;
  codeMirrorView: CodeMirror;
  updating: boolean;
  createCopyButtonCB: () => void;
  selectDeleteCB: () => void;
  languageConf: Compartment;

  constructor(
    private node: Node,
    private view: EditorView,
    private getPos: boolean | (() => number),
    private settings: CodeBlockSettings,
    private editor: CoreEditor,
  ) {
    this.updating = false;
    const dom = document.createElement('div');
    this.dom = dom;
    dom.className = 'codeblock-root';
    this.languageConf = new Compartment();
    const themeConfig = new Compartment();

    const yCollab = () => {
      const plugins = [];
      if (settings.provider?.awareness) {
        const ySyncConfig = new YSyncConfig(
          () => this.node,
          getPos,
          settings.provider.awareness,
        );
        plugins.push(ySyncFacet.of(ySyncConfig));
        plugins.push(
          yRemoteSelectionsTheme,
          yRemoteSelections,
        );
      }
      return plugins;
    };

    const state = EditorState.create({
      extensions: [
        EditorState.readOnly.of(settings.readOnly),
        CodeMirror.editable.of(!settings.readOnly),
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        autocompletion(),
        rectangularSelection(),
        drawSelection({ cursorBlinkRate: 1000 }), // broken focus
        EditorState.allowMultipleSelections.of(true),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        this.languageConf.of([]),
        indentOnInput(),
        keymap.of([
          { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
          {
            key: 'ArrowUp',
            run: (cmView) => maybeEscape('line', -1, cmView, view, getPos),
          },
          {
            key: 'ArrowLeft',
            run: (cmView) => maybeEscape('char', -1, cmView, view, getPos),
          },
          {
            key: 'ArrowDown',
            run: (cmView) => maybeEscape('line', 1, cmView, view, getPos),
          },
          {
            key: 'ArrowRight',
            run: (cmView) => maybeEscape('char', 1, cmView, view, getPos),
          },
          {
            key: 'Ctrl-Enter',
            run: () => {
              if (!exitCode(view.state, view.dispatch)) return false;
              view.focus();
              return true;
            },
          },
          {
            key: 'Mod-z',
            run: () => settings.undo?.(view.state, view.dispatch) || true,
            shift: () => settings.redo?.(view.state, view.dispatch) || true,
          },
          {
            key: 'Mod-y',
            run: () => settings.redo?.(view.state, view.dispatch) || true,
          },
          { key: 'Backspace', run: (cmView) => backspaceHandler(view, cmView) },
          {
            key: 'Mod-Backspace',
            run: (cmView) => backspaceHandler(view, cmView),
          },
          {
            key: 'Mod-a',
            run: () => {
              const result = selectAll(view.state, view.dispatch);
              view.focus();
              return result;
            },
          },
          {
            key: 'Enter',
            run: (cmView) => {
              const sel = cmView.state.selection.main;
              if (
                cmView.state.doc.line(cmView.state.doc.lines).text === '' &&
                sel.from === sel.to &&
                sel.from === cmView.state.doc.length
              ) {
                exitCode(view.state, view.dispatch);
                view.focus();
                return true;
              }
              return false;
            },
          },
          ...defaultKeymap,
          ...foldKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          indentWithTab,
          {
            key: 'Ctrl-`',
            run: () => {
              editor.chain().toggleDevToolkit().run();
              return true;
            },
          },
        ]),
        ...(settings.theme ? settings.theme : []),
        themeConfig.of([]),
        yCollab(),
      ],
      doc: node.textContent,
    });

    const root = settings.shadowRoot || document;

    this.codeMirrorView = new CodeMirror({
      state,
      root,
      dispatch: (tr) => {
        this.codeMirrorView.update([tr]);
        if (!this.updating) {
          const textUpdate = tr.state.toJSON().doc;
          valueChanged(textUpdate, this.node, getPos, view);
          forwardSelection(this.codeMirrorView, view, getPos);
        }
      },
    });
    dom.append(this.codeMirrorView.dom);

    if (
      !(Array.isArray(settings.languageWhitelist) &&
        settings.languageWhitelist.length === 1)
    ) {
      this.selectDeleteCB = settings.createSelect(
        settings,
        dom,
        node,
        view,
        getPos,
      );
    }

    this.createCopyButtonCB = settings.createCopyButton(
      settings,
      dom,
      node,
      view,
      this.codeMirrorView,
      getPos,
    );

    setMode(node.attrs.lang, this.codeMirrorView, settings, this.languageConf);

    const currentTheme = settings.getCurrentTheme?.();
    setTheme(this.codeMirrorView, themeConfig, [
      settings.themes.find((t) => t.name === currentTheme),
    ]);

    this.updateTheme = (theme: string) => {
      setTheme(this.codeMirrorView, themeConfig, [
        settings.themes.find((t) => t.name === theme),
      ]);
    };
    themeCallbacks.push(this.updateTheme);
  }

  updateTheme(updateTheme: any) {
    throw new Error('Method not implemented.');
  }

  selectNode() {
    this.codeMirrorView.focus();
  }

  stopEvent(e: Event) {
    return this.settings.stopEvent(
      e,
      this.node,
      this.getPos,
      this.view,
      this.dom,
    );
  }

  setSelection(anchor: number, head: number) {
    this.codeMirrorView.focus();
    this.updating = true;
    this.codeMirrorView.dispatch({ selection: { anchor, head } });
    this.updating = false;
  }

  update(updateNode: Node) {
    if (updateNode.type.name !== this.node.type.name) return false;
    if (updateNode.attrs.lang !== this.node.attrs.lang) {
      setMode(
        updateNode.attrs.lang,
        this.codeMirrorView,
        this.settings,
        this.languageConf,
      );
    }

    const oldNode = this.node;
    this.node = updateNode;
    const change = computeChange(
      this.codeMirrorView.state.doc.toString(),
      this.node.textContent,
    );
    if (change) {
      this.updating = true;
      this.codeMirrorView.dispatch({
        changes: {
          from: change.from,
          to: change.to,
          insert: change.text,
        },
        selection: { anchor: change.from + change.text.length },
      });
      this.updating = false;
    }
    this.settings.updateSelect(
      this.settings,
      this.dom,
      updateNode,
      this.view,
      this.getPos,
      oldNode,
    );
    return true;
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    if (this.selectDeleteCB) {
      this.selectDeleteCB();
    }
    this.createCopyButtonCB();
    themeCallbacks.splice(themeCallbacks.indexOf(this.updateTheme), 1);
  }
}

export const codeMirrorBlockNodeView: (
  settings: CodeBlockSettings,
  editor: CoreEditor,
) => (
  pmNode: Node,
  view: PMEditorView,
  getPos: (() => number) | boolean,
) => NodeView = (settings, editor) => {
  return (
    pmNode: Node,
    view: PMEditorView,
    getPos: (() => number) | boolean,
  ) => {
    return new CodeMirrorBlockNodeView(pmNode, view, getPos, settings, editor);
  };
};
