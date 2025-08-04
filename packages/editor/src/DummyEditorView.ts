// Headless View to be used on Server-side
// TODO: remove all unnecessary props and methods

import {
  EditorState,
  Plugin,
  PluginView,
  Transaction,
} from 'prosemirror-state';
import { Mark, Node } from 'prosemirror-model';

import { EditorView, MarkView, NodeView } from 'prosemirror-view';

import { Decoration, DecorationSource } from 'prosemirror-view';

/// An editor view manages the DOM structure that represents an
/// editable document. Its state and behavior are determined by its
/// [props](#view.DirectEditorProps).
export class DummyEditorView {
  /// @internal
  private _props: DirectEditorProps;
  private directPlugins: readonly Plugin[];
  /// @internal
  private nodeViews: NodeViewSet;
  private prevDirectPlugins: readonly Plugin[] = [];
  private pluginViews: PluginView[] = [];

  /// The view's current [state](#state.EditorState).
  public state: EditorState;

  /// Create a view. `place` may be a DOM node that the editor should
  /// be appended to, a function that will place it into the document,
  /// or an object whose `mount` property holds the node to use as the
  /// document container. If it is `null`, the editor will not be
  /// added to the document.
  constructor(props: DirectEditorProps) {
    this._props = props;
    this.state = props.state;
    this.directPlugins = props.plugins || [];
    this.directPlugins.forEach(checkStateComponent);

    this.dispatch = this.dispatch.bind(this);

    this.editable = getEditable(this);
    this.nodeViews = buildNodeViews(this);
    // TODO initInput(this)
    this.updatePluginViews();
  }

  /// Indicates whether the editor is currently [editable](#view.EditorProps.editable).
  editable: boolean;

  /// Holds `true` when a
  /// [composition](https://w3c.github.io/uievents/#events-compositionevents)
  /// is active.
  get composing() {
    return false;
  }

  get dom() {
    return {
      addEventListener() {},
      removeEventListener() {},
    };
  }

  /// The view's current [props](#view.EditorProps).
  get props() {
    if (this._props.state != this.state) {
      let prev = this._props;
      this._props = {} as any;
      for (let name in prev) (this._props as any)[name] = (prev as any)[name];
      this._props.state = this.state;
    }
    return this._props;
  }

  /// Update the view's props. Will immediately cause an update to
  /// the DOM.
  update(props: DirectEditorProps) {
    let prevProps = this._props;
    this._props = props;
    if (props.plugins) {
      props.plugins.forEach(checkStateComponent);
      this.directPlugins = props.plugins;
    }
    this.updateStateInner(props.state, prevProps);
  }

  /// Update the view by updating existing props object with the object
  /// given as argument. Equivalent to `view.update(Object.assign({},
  /// view.props, props))`.
  setProps(props: Partial<DirectEditorProps>) {
    let updated = {} as DirectEditorProps;
    for (let name in this._props) {
      (updated as any)[name] = (this._props as any)[name];
    }
    updated.state = this.state;
    for (let name in props) (updated as any)[name] = (props as any)[name];
    this.update(updated);
  }

  /// Update the editor's `state` prop, without touching any of the
  /// other props.
  updateState(state: EditorState) {
    this.updateStateInner(state, this._props);
  }

  private updateStateInner(state: EditorState, prevProps: DirectEditorProps) {
    let prev = this.state, redraw = false, updateSel = false;
    // When stored marks are added, stop composition, so that they can
    // be displayed.
    if (state.storedMarks && this.composing) {
      // TODO clearComposition(this)
      updateSel = true;
    }
    this.state = state;
    let pluginsChanged = prev.plugins != state.plugins ||
      this._props.plugins != prevProps.plugins;
    if (
      pluginsChanged || this._props.plugins != prevProps.plugins ||
      this._props.nodeViews != prevProps.nodeViews
    ) {
      let nodeViews = buildNodeViews(this);
      if (changedNodeViews(nodeViews, this.nodeViews)) {
        this.nodeViews = nodeViews;
        redraw = true;
      }
    }

    this.editable = getEditable(this);

    let updateDoc = redraw;
    if (updateDoc || !state.selection.eq(prev.selection)) updateSel = true;

    if (updateSel) {
      // Work around an issue in Chrome, IE, and Edge where changing
      // the DOM around an active selection puts it into a broken
      // state where the thing the user sees differs from the
      // selection reported by the Selection object (#710, #973,
      // #1011, #1013, #1035).
      let forceSelUpdate = false;
      if (updateDoc) {
        // If the node that the selection points into is written to,
        // Chrome sometimes starts misreporting the selection, so this
        // tracks that and forces a selection reset when our update
        // did write to the node.
        // TODO if (this.composing) this.input.compositionNode = findCompositionNode(this)
      }
    }

    this.updatePluginViews(prev);
  }

  /// @internal
  scrollToSelection() {
  }

  private destroyPluginViews() {
    let view;
    while (view = this.pluginViews.pop()) if (view.destroy) view.destroy();
  }

  private updatePluginViews(prevState?: EditorState) {
    if (
      !prevState || prevState.plugins != this.state.plugins ||
      this.directPlugins != this.prevDirectPlugins
    ) {
      this.prevDirectPlugins = this.directPlugins;
      this.destroyPluginViews();
      for (let i = 0; i < this.directPlugins.length; i++) {
        let plugin = this.directPlugins[i];
        if (plugin.spec.view) {
          this.pluginViews.push(plugin.spec.view(<any> this));
        }
      }
      for (let i = 0; i < this.state.plugins.length; i++) {
        let plugin = this.state.plugins[i];
        if (plugin.spec.view) {
          this.pluginViews.push(plugin.spec.view(<any> this));
        }
      }
    } else {
      for (let i = 0; i < this.pluginViews.length; i++) {
        let pluginView = this.pluginViews[i];
        if (pluginView.update) pluginView.update(<any> this, prevState);
      }
    }
  }

  /// Goes over the values of a prop, first those provided directly,
  /// then those from plugins given to the view, then from plugins in
  /// the state (in order), and calls `f` every time a non-undefined
  /// value is found. When `f` returns a truthy value, that is
  /// immediately returned. When `f` isn't provided, it is treated as
  /// the identity function (the prop value is returned directly).
  someProp<PropName extends keyof EditorProps, Result>(
    propName: PropName,
    f: (value: NonNullable<EditorProps[PropName]>) => Result,
  ): Result | undefined;
  someProp<PropName extends keyof EditorProps>(
    propName: PropName,
  ): NonNullable<EditorProps[PropName]> | undefined;
  someProp<PropName extends keyof EditorProps, Result>(
    propName: PropName,
    f?: (value: NonNullable<EditorProps[PropName]>) => Result,
  ): Result | undefined {
    let prop = this._props && this._props[propName], value;
    if (prop != null && (value = f ? f(prop as any) : prop)) {
      return value as any;
    }
    for (let i = 0; i < this.directPlugins.length; i++) {
      let prop = this.directPlugins[i].props[propName];
      if (prop != null && (value = f ? f(prop as any) : prop)) {
        return value as any;
      }
    }
    let plugins = this.state.plugins;
    if (plugins) {
      for (let i = 0; i < plugins.length; i++) {
        let prop = plugins[i].props[propName];
        if (
          prop != null && (value = f ? f(prop as any) : prop)
        ) return value as any;
      }
    }
  }

  /// Query whether the view has focus.
  hasFocus() {
    return false;
  }

  /// Focus the editor.
  focus() {
  }

  /// Removes the editor from the DOM and destroys all [node
  /// views](#view.NodeView).
  destroy() {
    this.destroyPluginViews();
  }

  /// This is true when the view has been
  /// [destroyed](#view.DummyEditorView.destroy) (and thus should not be
  /// used anymore).
  get isDestroyed() {
    return false;
  }

  /// Used for testing.
  dispatchEvent(event: Event) {
  }

  /// Dispatch a transaction. Will call
  /// [`dispatchTransaction`](#view.DirectEditorProps.dispatchTransaction)
  /// when given, and otherwise defaults to applying the transaction to
  /// the current state and calling
  /// [`updateState`](#view.DummyEditorView.updateState) with the result.
  /// This method is bound to the view instance, so that it can be
  /// easily passed around.
  declare dispatch: (tr: Transaction) => void;
}

DummyEditorView.prototype.dispatch = function (tr: Transaction) {
  let dispatchTransaction = this.props.dispatchTransaction;
  if (dispatchTransaction) dispatchTransaction.call(this, tr);
  else this.updateState(this.state.apply(tr));
};

function getEditable(view: DummyEditorView) {
  return !view.someProp('editable', (value) => value(view.state) === false);
}

function buildNodeViews(view: DummyEditorView) {
  let result: NodeViewSet = Object.create(null);
  function add(obj: NodeViewSet) {
    for (let prop in obj) {
      if (!Object.prototype.hasOwnProperty.call(result, prop)) {
        result[prop] = obj[prop];
      }
    }
  }
  view.someProp('nodeViews', add);
  view.someProp('markViews', add);
  return result;
}

function changedNodeViews(a: NodeViewSet, b: NodeViewSet) {
  let nA = 0, nB = 0;
  for (let prop in a) {
    if (a[prop] != b[prop]) return true;
    nA++;
  }
  for (let _ in b) nB++;
  return nA != nB;
}

function checkStateComponent(plugin: Plugin) {
  if (
    plugin.spec.state || plugin.spec.filterTransaction ||
    plugin.spec.appendTransaction
  ) {
    throw new RangeError(
      'Plugins passed directly to the view must not have a state component',
    );
  }
}

/// The type of function [provided](#view.EditorProps.nodeViews) to
/// create [node views](#view.NodeView).
export type NodeViewConstructor = (
  node: Node,
  view: EditorView,
  getPos: () => number | undefined,
  decorations: readonly Decoration[],
  innerDecorations: DecorationSource,
) => NodeView;

/// The function types [used](#view.EditorProps.markViews) to create
/// mark views.
export type MarkViewConstructor = (
  mark: Mark,
  view: EditorView,
  inline: boolean,
) => MarkView;

type NodeViewSet = {
  [name: string]: NodeViewConstructor | MarkViewConstructor;
};

/// Helper type that maps event names to event object types, but
/// includes events that TypeScript's HTMLElementEventMap doesn't know
/// about.
export interface DOMEventMap extends HTMLElementEventMap {
  [event: string]: any;
}

/// Props are configuration values that can be passed to an editor view
/// or included in a plugin. This interface lists the supported props.
export interface EditorProps<P = any> {
  /// Allows you to pass custom rendering and behavior logic for
  /// nodes. Should map node names to constructor functions that
  /// produce a [`NodeView`](#view.NodeView) object implementing the
  /// node's display behavior. The third argument `getPos` is a
  /// function that can be called to get the node's current position,
  /// which can be useful when creating transactions to update it.
  /// Note that if the node is not in the document, the position
  /// returned by this function will be `undefined`.
  ///
  /// (For backwards compatibility reasons, [mark
  /// views](#view.EditorProps.markViews) can also be included in this
  /// object.)
  nodeViews?: { [node: string]: NodeViewConstructor };

  /// Pass custom mark rendering functions. Note that these cannot
  /// provide the kind of dynamic behavior that [node
  /// views](#view.NodeView) can—they just provide custom rendering
  /// logic. The third argument indicates whether the mark's content
  /// is inline.
  markViews?: { [mark: string]: MarkViewConstructor };

  /// When this returns false, the content of the view is not directly
  /// editable.
  editable?: (this: P, state: EditorState) => boolean;

  /// Control the DOM attributes of the editable element. May be either
  /// an object or a function going from an editor state to an object.
  /// By default, the element will get a class `"ProseMirror"`, and
  /// will have its `contentEditable` attribute determined by the
  /// [`editable` prop](#view.EditorProps.editable). Additional classes
  /// provided here will be added to the class. For other attributes,
  /// the value provided first (as in
  /// [`someProp`](#view.DummyEditorView.someProp)) will be used.
  attributes?:
    | { [name: string]: string }
    | ((state: EditorState) => { [name: string]: string });
}

/// The props object given directly to the editor view supports some
/// fields that can't be used in plugins:
export interface DirectEditorProps extends EditorProps {
  /// The current state of the editor.
  state: EditorState;

  /// A set of plugins to use in the view, applying their [plugin
  /// view](#state.PluginSpec.view) and
  /// [props](#state.PluginSpec.props). Passing plugins with a state
  /// component (a [state field](#state.PluginSpec.state) field or a
  /// [transaction](#state.PluginSpec.filterTransaction) filter or
  /// appender) will result in an error, since such plugins must be
  /// present in the state to work.
  plugins?: readonly Plugin[];

  /// The callback over which to send transactions (state updates)
  /// produced by the view. If you specify this, you probably want to
  /// make sure this ends up calling the view's
  /// [`updateState`](#view.DummyEditorView.updateState) method with a new
  /// state that has the transaction
  /// [applied](#state.EditorState.apply). The callback will be bound to have
  /// the view instance as its `this` binding.
  dispatchTransaction?: (tr: Transaction) => void;
}
