import { Command, EditorState, NodeSelection, Plugin } from 'prosemirror-state';
import { MarkType, NodeType, Schema } from 'prosemirror-model';
import { undo, redo, undoDepth, redoDepth } from 'prosemirror-history';

import { type CoreEditor, Extension } from '@kerebron/editor';
import { toggleMark, wrapInList } from '@kerebron/editor/commands';

import {
  blockTypeItem,
  Dropdown,
  DropdownSubmenu,
  MenuElement,
  MenuItem,
  MenuItemSpec,
  wrapItem,
} from './menu.ts';
import { MenuPlugin } from './MenuPlugin.ts';
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

function markItem(markType: MarkType, options: Partial<MenuItemSpec>) {
  let passedOptions: Partial<MenuItemSpec> = {
    active(state) {
      return markActive(state, markType);
    },
  };
  for (let prop in options) {
    (passedOptions as any)[prop] = (options as any)[prop];
  }
  return cmdItem(toggleMark(markType), passedOptions);
}

function wrapListItem(nodeType: NodeType, options: Partial<MenuItemSpec>) {
  return cmdItem(wrapInList(nodeType, (options as any).attrs), options);
}

const cut = <T>(arr: T[]) => arr.filter((x) => x) as NonNullable<T>[];

export function buildMenu(editor: CoreEditor, schema: Schema): MenuElement[][] {
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
            toggleMark(markType)(state, dispatch);
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
              toggleMark(markType, attrs)(editor.view.state, editor.view.dispatch);
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
    const makeHeadMenu = [];

    for (let i = 1; i <= 6; i++) {
      makeHeadMenu.push(blockTypeItem(schema.nodes.heading, {
        title: 'Change to heading ' + i,
        label: 'Heading ' + i,
        attrs: { level: i },
      }));
    }

    typeMenu.push(new DropdownSubmenu(makeHeadMenu, { label: 'Headings' }));
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

  menu.push(
    new MenuItem({
      title: 'Undo last change',
      run: (state, dispatch) => {
        return undo(editor.view.state, editor.view.dispatch, editor.view);
      },
      enable: (state) => {
        return undo(state);
      },
      icon: icons.undo,
    }),
  );

  menu.push(
    new MenuItem({
      title: 'Redo last undone change',
      run: (state, dispatch) => {
        return redo(editor.view.state, editor.view.dispatch, editor.view);
      },
      enable: (state) => redo(state),
      icon: icons.redo,
    }),
  );

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

export interface MenuConfig {
  modifyMenu?(menus: MenuElement[][]): MenuElement[][];
  floating: boolean;
}

export class ExtensionMenu extends Extension {
  name = 'menu';

  constructor(protected config: MenuConfig = { floating: true }) {
    super(config);
  }

  getProseMirrorPlugins(editor: CoreEditor, schema: Schema): Plugin[] {
    const plugins: Plugin[] = [];

    let content = buildMenu(editor, schema);
    if (this.config.modifyMenu) {
      content = this.config.modifyMenu(content);
    }
    plugins.push(
      new MenuPlugin({
        content,
        floating: this.config.floating,
      }),
    );

    return plugins;
  }
}
