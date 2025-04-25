import * as cmView from '@codemirror/view';

import * as cmState from '@codemirror/state';
import * as dom from 'lib0/dom';
import * as pair from 'lib0/pair';
import * as math from 'lib0/math';

import * as awarenessProtocol from 'y-protocols/awareness';

import { YSyncConfig, ySyncFacet } from './y-sync.ts';

export const yRemoteSelectionsTheme = cmView.EditorView.baseTheme({
  '.cm-ySelection': {},
  '.cm-yLineSelection': {
    padding: 0,
    margin: '0px 2px 0px 4px',
  },
  '.cm-ySelectionCaret': {
    position: 'relative',
    borderLeft: '1px solid black',
    borderRight: '1px solid black',
    marginLeft: '-1px',
    marginRight: '-1px',
    boxSizing: 'border-box',
    display: 'inline',
  },
  '.cm-ySelectionCaretDot': {
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
  '.cm-ySelectionCaret:hover > .cm-ySelectionCaretDot': {
    transformOrigin: 'bottom center',
    transform: 'scale(0)',
  },
  '.cm-ySelectionInfo': {
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
  '.cm-ySelectionCaret:hover > .cm-ySelectionInfo': {
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
      pair.create('class', 'ProseMirror-yjs-cursor ProseMirror-widget'),
      pair.create('style', `border-color: ${this.color}; position: fixed;`),
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
  conf: YSyncConfig;
  private _listener: (
    { added, updated, removed }: {
      added: number[];
      updated: number[];
      removed: number[];
    },
    s: any,
    t: any,
  ) => void;
  private _awareness: awarenessProtocol.Awareness;
  decorations: cmView.DecorationSet;

  constructor(view: cmView.EditorView) {
    this.conf = view.state.facet(ySyncFacet);
    this._listener = ({ added, updated, removed }) => {
      const clients = added.concat(updated).concat(removed);
      if (
        clients.findIndex((id: number) =>
          id !== this.conf.awareness.doc.clientID
        ) >= 0
      ) {
        view.dispatch({ annotations: [yRemoteSelectionsAnnotation.of([])] });
      }
    };
    this._awareness = this.conf.awareness;
    this._awareness.on('change', this._listener);
    this.decorations = cmState.RangeSet.of([]);
  }

  destroy() {
    this._awareness.off('change', this._listener);
  }

  update(update: cmView.ViewUpdate) {
    const awareness = this.conf.awareness;

    const decorations: cmState.Range<cmView.Decoration>[] = [];
    const localAwarenessState = this.conf.awareness.getLocalState();

    // set local awareness state (update cursors)

    if (localAwarenessState != null) {
      const hasFocus = update.view.hasFocus &&
        update.view.dom.ownerDocument.hasFocus();
      const sel = hasFocus ? update.state.selection.main : null;

      if (sel != null && 'function' === typeof this.conf.getPmPos) {
        const nodePos = this.conf.getPmPos();
        const currentAnchor = localAwarenessState['cm-cursor'] == null
          ? -1
          : localAwarenessState['cm-cursor'].anchor - nodePos;
        const currentHead = localAwarenessState['cm-cursor'] == null
          ? -1
          : localAwarenessState['cm-cursor'].head - nodePos;

        const anchor = nodePos + sel.anchor;
        const head = nodePos + sel.head;
        if (
          localAwarenessState['cm-cursor'] == null ||
          (currentAnchor != anchor) || (currentHead != head)
        ) {
          awareness.setLocalStateField('cm-cursor', {
            anchor,
            head,
          });
        }
      } else if (localAwarenessState['cm-cursor'] != null && hasFocus) {
        awareness.setLocalStateField('cm-cursor', null);
      }
    }

    // update decorations (remote selections)
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.doc.clientID) {
        return;
      }

      if (!state.user) {
        return;
      }

      const cursor = state['cm-cursor'];
      if (cursor == null || cursor.anchor == null || cursor.head == null) {
        return;
      }

      if ('function' === typeof this.conf.getPmPos) {
        const nodeAnchor = this.conf.getPmPos();
        const nodeHead = this.conf.getPmPos() + this.conf.getNode().nodeSize;

        if (cursor.anchor >= nodeAnchor && cursor.anchor <= nodeHead) {
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
                  class: 'cm-ySelection',
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
                  class: 'cm-ySelection',
                }),
              });
              // render text-selection in the last line
              decorations.push({
                from: endLine.from,
                to: end,
                value: cmView.Decoration.mark({
                  attributes: { style: `background-color: ${colorLight}` },
                  class: 'cm-ySelection',
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
                      class: 'cm-yLineSelection',
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
    });
    this.decorations = cmView.Decoration.set(decorations, true);
  }
}

export const yRemoteSelections = cmView.ViewPlugin.fromClass(
  YRemoteSelectionsPluginValue,
  {
    decorations: (v) => v.decorations,
  },
);
