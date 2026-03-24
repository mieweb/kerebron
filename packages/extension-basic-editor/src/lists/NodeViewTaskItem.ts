import { Node } from 'prosemirror-model';
import { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';

import { CoreEditor } from '@kerebron/editor';

export class NodeViewTaskItem implements NodeView {
  public readonly dom: HTMLLIElement;
  public readonly contentDOM: HTMLDivElement;
  public readonly checkbox: HTMLInputElement;

  private node: Node;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;

  config = {};

  constructor(
    private editor: CoreEditor,
    ...args: Parameters<NodeViewConstructor>
  ) {
    this.node = args[0];
    this.view = args[1];
    this.getPos = args[2];

    const listItem = document.createElement('li');
    this.dom = listItem;

    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.contentEditable = 'false';

    const checkbox = document.createElement('input');
    this.checkbox = checkbox;
    checkbox.type = 'checkbox';
    checkbox.checked = this.node.attrs.checked;
    checkboxWrapper.append(checkbox);

    const content = document.createElement('div');
    this.contentDOM = content;

    listItem.append(checkboxWrapper, content);
    listItem.dataset.checked = this.node.attrs.checked;

    checkbox.addEventListener('mousedown', (event) => event.preventDefault());
    checkbox.addEventListener('change', (event) => {
      const position = this.getPos();
      if (typeof position !== 'number') {
        return;
      }
      const isEditable = this.editor.view.editable;

      const { checked } = event.target as any;

      const tr = editor.state.tr;

      const currentNode = tr.doc.nodeAt(position);
      tr.setNodeMarkup(position, undefined, {
        ...currentNode?.attrs,
        checked,
      });

      editor.dispatchTransaction(tr);
    });
  }

  static create = (
    editor: CoreEditor,
    ...args: Parameters<NodeViewConstructor>
  ) => {
    return new NodeViewTaskItem(editor, ...args);
  };

  update(updatedNode: Node) {
    if (updatedNode.type.name !== this.node.type.name) {
      return false;
    }

    this.dom.dataset.checked = updatedNode.attrs.checked;
    this.checkbox.checked = updatedNode.attrs.checked;

    return true;
  }
}
