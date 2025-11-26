import { Command, EditorState, NodeSelection } from 'prosemirror-state';
import { Attrs, MarkType, NodeType, Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';

import { type CoreEditor } from '@kerebron/editor';

import {
  Dropdown,
  type MenuElement,
  MenuItem,
  type MenuItemSpec,
} from './menu.ts';
import { icons } from './icons.ts';
import { openPrompt, TextField } from './prompt.ts';

function canInsert(state: EditorState, nodeType: NodeType) {
  let $from = state.selection.$from;
  for (let d = $from.depth; d >= 0; d--) {
    let index = $from.index(d);
    if ($from.node(d).canReplaceWith(index, index, nodeType)) return true;
  }
  return false;
}

function cmdItem(cmd: Command, options: Partial<MenuItemSpec>) {
  let passedOptions: MenuItemSpec = {
    label: options.title as string | undefined,
    run: cmd,
  };
  for (let prop in options) {
    (passedOptions as any)[prop] = (options as any)[prop];
  }
  if (!options.enable && !options.select) {
    passedOptions[options.enable ? 'enable' : 'select'] = (state) => cmd(state);
  }

  return new MenuItem(passedOptions);
}

function markActive(state: EditorState, type: MarkType) {
  let { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  else return state.doc.rangeHasMark(from, to, type);
}

const cut = <T>(arr: T[]) => arr.filter((x) => x) as NonNullable<T>[];

export function buildMenu(editor: CoreEditor, schema: Schema): MenuElement[][] {
  function markItem(markType: MarkType, options: Partial<MenuItemSpec>) {
    let passedOptions: Partial<MenuItemSpec> = {
      active(state) {
        return markActive(state, markType);
      },
    };
    for (let prop in options) {
      (passedOptions as any)[prop] = (options as any)[prop];
    }
    return cmdItem(editor.commandFactories.toggleMark(markType), passedOptions);
  }

  function wrapItem(
    nodeType: NodeType,
    options: Partial<MenuItemSpec> & { attrs?: Attrs | null },
  ) {
    let passedOptions: MenuItemSpec = {
      run(state, dispatch) {
        return editor.commandFactories.wrapIn(nodeType, options.attrs)(
          state,
          dispatch,
        );
      },
      select(state) {
        return editor.commandFactories.wrapIn(nodeType, options.attrs)(state);
      },
    };
    for (let prop in options) {
      (passedOptions as any)[prop] = (options as any)[prop];
    }
    return new MenuItem(passedOptions);
  }

  function wrapListItem(nodeType: NodeType, options: Partial<MenuItemSpec>) {
    return cmdItem(
      editor.commandFactories.wrapInList(nodeType, (options as any).attrs),
      options,
    );
  }

  /// Build a menu item for changing the type of the textblock around the
  /// selection to the given type. Provides `run`, `active`, and `select`
  /// properties. Others must be given in `options`. `options.attrs` may
  /// be an object to provide the attributes for the textblock node.
  function blockTypeItem(
    nodeType: NodeType,
    options: Partial<MenuItemSpec> & { attrs?: Attrs | null },
  ) {
    let command = editor.commandFactories.setBlockType(nodeType, options.attrs);
    let passedOptions: MenuItemSpec = {
      run: command,
      enable(state) {
        return command(state);
      },
      active(state) {
        let { $from, to, node } = state.selection as NodeSelection;
        if (node) return node.hasMarkup(nodeType, options.attrs);
        return to <= $from.end() &&
          $from.parent.hasMarkup(nodeType, options.attrs);
      },
    };
    for (let prop in options) {
      (passedOptions as any)[prop] = (options as any)[prop];
    }
    return new MenuItem(passedOptions);
  }

  const menu = [];

  if (schema.marks.strong) {
    menu.push(
      new MenuItem({
        title: 'Toggle strong assets',
        run: () => editor.chain().toggleStrong().run(),
        enable: (state) => editor.can().toggleStrong().run(),
        icon: icons.strong,
      }),
    );
  }
  if (schema.marks.em) {
    menu.push(
      new MenuItem({
        title: 'Toggle emphasis',
        run: () => editor.chain().toggleItalic().run(),
        enable: (state) => editor.can().toggleItalic().run(),
        icon: icons.em,
      }),
    );
  }
  if (schema.marks.underline) {
    menu.push(
      new MenuItem({
        title: 'Toggle underline',
        label: '_',
        run: () => editor.chain().toggleUnderline().run(),
        enable: (state) => editor.can().toggleUnderline().run(),
        // icon: icons.underline
      }),
    );
  }

  if (schema.marks.code) {
    menu.push(markItem(schema.marks.code, {
      title: 'Toggle code font',
      icon: icons.code,
    }));
  }

  if (schema.marks.link) {
    const markType = schema.marks.link;

    menu.push(
      new MenuItem({
        title: 'Add or remove link',
        icon: icons.link,
        active(state) {
          return markActive(state, markType);
        },
        enable(state) {
          return !state.selection.empty;
        },
        run(state, dispatch) {
          if (markActive(state, markType)) {
            editor.commandFactories.toggleMark(markType)(state, dispatch);
            return true;
          }
          openPrompt({
            title: 'Create a link',
            fields: {
              href: new TextField({
                label: 'Link target',
                required: true,
              }),
              title: new TextField({ label: 'Title' }),
            },
            callback(attrs) {
              editor.commandFactories.toggleMark(markType, attrs)(
                editor.view.state,
                editor.view.dispatch,
              );
              editor.view.focus();
            },
          });
          return true;
        },
      }),
    );
  }

  const blockMenu = [];
  const insertMenu = [];
  const typeMenu = [];

  if (schema.nodes.bullet_list) {
    blockMenu.push(wrapListItem(schema.nodes.bullet_list, {
      title: 'Wrap in bullet list',
      icon: icons.bulletList,
    }));
  }
  if (schema.nodes.ordered_list) {
    blockMenu.push(wrapListItem(schema.nodes.ordered_list, {
      title: 'Wrap in ordered list',
      icon: icons.orderedList,
    }));
  }
  if (schema.nodes.blockquote) {
    blockMenu.push(wrapItem(schema.nodes.blockquote, {
      title: 'Wrap in block quote',
      icon: icons.blockquote,
    }));
  }
  if (schema.nodes.paragraph) {
    typeMenu.push(blockTypeItem(schema.nodes.paragraph, {
      title: 'Change to paragraph',
      label: 'Plain',
    }));
  }
  if (schema.nodes.code_block) {
    typeMenu.push(blockTypeItem(schema.nodes.code_block, {
      title: 'Change to code block',
      label: 'Code',
    }));
  }
  if (schema.nodes.heading) {
    for (let i = 1; i <= 6; i++) {
      typeMenu.push(blockTypeItem(schema.nodes.heading, {
        title: 'Change to heading ' + i,
        label: 'Heading ' + i,
        attrs: { level: i },
      }));
    }
  }

  blockMenu.push(
    new MenuItem({
      title: 'Join with above block',
      run: () => editor.chain().joinUp().run(),
      select: () => editor.can().joinUp().run(),
      icon: icons.join,
    }),
  );

  blockMenu.push(
    new MenuItem({
      title: 'Lift out of enclosing block',
      run: () => editor.chain().lift().run(),
      select: () => editor.can().lift().run(),
      icon: icons.lift,
    }),
  );
  blockMenu.push(
    new MenuItem({
      title: 'Select parent node',
      run: () => editor.chain().selectParentNode().run(),
      select: () => editor.can().selectParentNode().run(),
      icon: icons.selectParentNode,
    }),
  );

  if (schema.nodes.image) {
    const nodeType = schema.nodes.image;
    insertMenu.push(
      new MenuItem({
        title: 'Insert image',
        label: 'Image',
        // enable: (state) => editor.can().setHorizontalRule().run(),
        enable: (state) => canInsert(state, nodeType),
        run(state, dispatch) {
          let { from, to } = state.selection, attrs = null;
          if (
            state.selection instanceof NodeSelection &&
            state.selection.node.type == nodeType
          ) {
            attrs = state.selection.node.attrs;
          }
          openPrompt({
            title: 'Insert image',
            fields: {
              src: new TextField({
                label: 'Location',
                required: true,
                value: attrs && attrs.src,
              }),
              title: new TextField({
                label: 'Title',
                value: attrs && attrs.title,
              }),
              alt: new TextField({
                label: 'Description',
                value: attrs ? attrs.alt : state.doc.textBetween(from, to, ' '),
              }),
            },
            callback(attrs) {
              editor.view.dispatch(
                editor.view.state.tr.replaceSelectionWith(
                  nodeType.createAndFill(attrs)!,
                ),
              );
              editor.view.focus();
            },
          });
          return true;
        },
      }),
    );
  }

  if (schema.nodes.hr) {
    insertMenu.push(
      new MenuItem({
        title: 'Insert horizontal rule',
        label: 'Horizontal rule',
        run: () => editor.chain().setHorizontalRule().run(),
        enable: (state) => editor.can().setHorizontalRule().run(),
      }),
    );
  }

  menu.push(
    new Dropdown(cut(insertMenu), {
      label: 'Insert',
    }),
  );

  menu.push(
    new Dropdown(cut(typeMenu), {
      label: 'Type',
    }),
  );

  /*
  r.blockMenu = [
    cut([
      r.wrapBulletList,
      r.wrapOrderedList,
      r.wrapBlockQuote,
      joinUpItem,
      liftItem,
      selectParentNodeItem,
    ]),
  ];
  */

  const editorView = editor.view;
  if (editorView instanceof EditorView) {
    menu.push(
      new MenuItem({
        title: 'Undo last change',
        run: (state, dispatch) => {
          return editor.commandFactories.undo()(
            editor.view.state,
            editor.view.dispatch,
            editorView,
          );
        },
        enable: (state) => {
          return editor.commandFactories.undo()(state);
        },
        icon: icons.undo,
      }),
    );

    menu.push(
      new MenuItem({
        title: 'Redo last undone change',
        run: (state, dispatch) => {
          return editor.commandFactories.redo()(state, dispatch);
        },
        enable: (state) => editor.commandFactories.redo()(state),
        icon: icons.redo,
      }),
    );
  }

  if (schema.nodes.table) {
    const item = (label: string, cmdName: string) => {
      return new MenuItem({
        label,
        enable: () => editor.can()[cmdName]().run(),
        run: () => editor.chain()[cmdName]().run(),
      });
    };
    const tableMenu = [
      item('Insert table', 'insertTable'),
      item('Insert column before', 'addColumnBefore'),
      item('Insert column after', 'addColumnAfter'),
      item('Delete column', 'deleteColumn'),
      item('Insert row before', 'addRowBefore'),
      item('Insert row after', 'addRowAfter'),
      item('Delete row', 'deleteRow'),
      item('Delete table', 'deleteTable'),
      item('Merge cells', 'mergeCells'),
      item('Split cell', 'splitCell'),
      item('Toggle header column', 'toggleHeaderColumn'),
      item('Toggle header row', 'toggleHeaderRow'),
      item('Toggle header cells', 'toggleHeaderCell'),
      // item('Make cell green', setCellAttr('background', '#dfd')),
      // item('Make cell not-green', setCellAttr('background', null)),
    ];
    menu.push(new Dropdown(tableMenu, { label: 'Table' }));
  }

  return [menu, blockMenu];
}
