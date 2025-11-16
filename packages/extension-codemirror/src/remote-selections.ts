import * as cmView from '@codemirror/view';

import * as cmState from '@codemirror/state';
import * as dom from 'lib0/dom';
import * as pair from 'lib0/pair';
import * as math from 'lib0/math';

import { RemoteSyncConfig, remoteSyncFacet } from './remote-sync.ts';
import type { CoreEditor } from '@kerebron/editor';

import type { ExtensionRemoteSelection } from '@kerebron/extension-basic-editor/ExtensionRemoteSelection';

export const yRemoteSelectionsTheme = cmView.EditorView.baseTheme({
  '.cm-rSelection': {},
  '.cm-rLineSelection': {
    padding: 0,
    margin: '0px 2px 0px 4px',
  },
  '.cm-rSelectionCaret': {
    position: 'relative',
    borderLeft: '1px solid black',
    borderRight: '1px solid black',
    marginLeft: '-1px',
    marginRight: '-1px',
    boxSizing: 'border-box',
    display: 'inline',
  },
  '.cm-rSelectionCaretDot': {
    borderRadius: '50%',
    position: 'absolute',
    width: '.4em',
    height: '.4em',
    top: '-.2em',
    left: '-.2em',
    backgroundColor: 'inherit',
    transition: 'transform .3s ease-in-out',
    boxSizing: 'border-box',
  },
  '.cm-rSelectionCaret:hover > .cm-rSelectionCaretDot': {
    transformOrigin: 'bottom center',
    transform: 'scale(0)',
  },
  '.cm-rSelectionInfo': {
    position: 'absolute',
    top: '-1.05em',
    left: '-1px',
    fontSize: '.75em',
    fontFamily: 'serif',
    fontStyle: 'normal',
    fontWeight: 'normal',
    lineHeight: 'normal',
    userSelect: 'none',
    color: 'white',
    paddingLeft: '2px',
    paddingRight: '2px',
    zIndex: 101,
    transition: 'opacity .3s ease-in-out',
    backgroundColor: 'inherit',
    // these should be separate
    opacity: 0,
    transitionDelay: '0s',
    whiteSpace: 'nowrap',
  },
  '.cm-rSelectionCaret:hover > .cm-rSelectionInfo': {
    opacity: 1,
    transitionDelay: '0s',
  },
});

const yRemoteSelectionsAnnotation: cmState.AnnotationType<Array<number>> =
  cmState.Annotation.define();

class YRemoteCaretWidget extends cmView.WidgetType {
  constructor(public color: string, public name: string) {
    super();
  }

  toDOM(): HTMLElement {
    return <HTMLElement> (dom.element('span', [
      pair.create('class', 'kb-yjs__cursor kb-widget'),
      pair.create('style', `border-color: ${this.color};`),
    ], [
      dom.text('\u2060'),
      dom.element('div', [
        pair.create('style', `background-color: ${this.color}`),
      ], [
        dom.text(this.name),
      ]),
      dom.text('\u2060'),
    ]));
  }

  override eq(widget: YRemoteCaretWidget) {
    return widget.color === this.color;
  }

  compare(widget: YRemoteCaretWidget) {
    return widget.color === this.color;
  }

  override updateDOM() {
    return false;
  }

  override get estimatedHeight() {
    return -1;
  }

  override ignoreEvent() {
    return true;
  }
}

export class YRemoteSelectionsPluginValue {
  conf: RemoteSyncConfig;
  private editor: CoreEditor;
  decorations: cmView.DecorationSet;
  private _remoteSelectionChange: () => void;

  constructor(view: cmView.EditorView) {
    this.conf = view.state.facet(remoteSyncFacet);
    this.editor = this.conf.editor;
    this.decorations = cmState.RangeSet.of([]);

    this._remoteSelectionChange = () => {
      view.dispatch({ annotations: [yRemoteSelectionsAnnotation.of([])] });
    };
    this.editor.addEventListener(
      'remoteSelectionChange',
      this._remoteSelectionChange,
    );
  }

  destroy() {
    this.editor.removeEventListener(
      'remoteSelectionChange',
      this._remoteSelectionChange,
    );
  }

  update(update: cmView.ViewUpdate) {
    const decorations: cmState.Range<cmView.Decoration>[] = [];

    const extension: ExtensionRemoteSelection = this.editor.getExtension(
      'remote-selection',
    )!;

    const remoteStates = extension.getRemoteStates();
    for (const state of remoteStates) {
      const clientId = state.clientId;

      const cursor = state.cursor;
      if (cursor?.anchor == null || cursor?.head == null) {
        return;
      }

      const nodeAnchor = this.conf.getPmPos();
      if ('undefined' !== typeof nodeAnchor) {
        const nodeHead = nodeAnchor + this.conf.getNode().nodeSize;

        if (
          cursor.anchor >= nodeAnchor && cursor.anchor < nodeHead &&
          cursor.head >= nodeAnchor && cursor.head < nodeHead
        ) {
          const anchor = { index: cursor.anchor - nodeAnchor };
          const head = { index: cursor.head - nodeAnchor };

          try {
            const { color = '#ffa500', name = `User: ${clientId}` } =
              state.user || {};
            const colorLight = (state.user && state.user.colorLight) ||
              color + '33';
            const start = math.min(anchor.index, head.index);
            const end = math.max(anchor.index, head.index);
            const startLine = update.view.state.doc.lineAt(start);
            const endLine = update.view.state.doc.lineAt(end);
            if (startLine.number === endLine.number) {
              // selected content in a single line.
              decorations.push({
                from: start,
                to: end,
                value: cmView.Decoration.mark({
                  attributes: { style: `background-color: ${colorLight}` },
                  class: 'cm-rSelection',
                }),
              });
            } else {
              // selected content in multiple lines
              // first, render text-selection in the first line
              decorations.push({
                from: start,
                to: startLine.from + startLine.length,
                value: cmView.Decoration.mark({
                  attributes: { style: `background-color: ${colorLight}` },
                  class: 'cm-rSelection',
                }),
              });
              // render text-selection in the last line
              decorations.push({
                from: endLine.from,
                to: end,
                value: cmView.Decoration.mark({
                  attributes: { style: `background-color: ${colorLight}` },
                  class: 'cm-rSelection',
                }),
              });
              for (let i = startLine.number + 1; i < endLine.number; i++) {
                const linePos = update.view.state.doc.line(i).from;
                decorations.push({
                  from: linePos,
                  to: linePos,
                  value: cmView.Decoration.line({
                    attributes: {
                      style: `background-color: ${colorLight}`,
                      class: 'cm-rLineSelection',
                    },
                  }),
                });
              }
            }
            decorations.push({
              from: head.index,
              to: head.index,
              value: cmView.Decoration.widget({
                side: head.index - anchor.index > 0 ? -1 : 1, // the local cursor should be rendered outside the remote selection
                block: false,
                widget: new YRemoteCaretWidget(color, name),
              }),
            });
          } catch (err) {
            console.warn(err, `User: ${clientId}`);
          }
        }
      }
    }

    this.decorations = cmView.Decoration.set(decorations, true);

    const hasFocus = update.view.hasFocus &&
      update.view.dom.ownerDocument.hasFocus();
    const sel = hasFocus ? update.state.selection.main : null;
    const nodePos = this.conf.getPmPos();
    if (sel != null && 'undefined' !== typeof nodePos) {
      const anchor = nodePos + sel.anchor;
      const head = nodePos + sel.head;

      const event = new CustomEvent('localPositionChanged', {
        detail: {
          anchor,
          head,
        },
      });
      this.editor.dispatchEvent(event);
    }
  }
}

export const yRemoteSelections = cmView.ViewPlugin.fromClass(
  YRemoteSelectionsPluginValue,
  {
    decorations: (v) => v.decorations,
  },
);
