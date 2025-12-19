import { Command, EditorState, NodeSelection } from 'prosemirror-state';
import { Attrs, MarkType, NodeType, Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';

import { type CoreEditor } from '@kerebron/editor';

import {
  Dropdown,
  DropdownSubmenu,
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

  // Group 1: Undo/Redo
  const undoRedoGroup: MenuElement[] = [];

  // === 1. Undo ===
  // Use a wrapper that dynamically gets the undo command from the editor
  // This handles both prosemirror-history and y-prosemirror undo
  undoRedoGroup.push(
    new MenuItem({
      title: 'Undo last change',
      run: (state, dispatch) => {
        const undoCmd = editor.commandFactories['undo']?.();
        if (undoCmd) {
          return undoCmd(state, dispatch);
        }
        return false;
      },
      enable: (state) => {
        const undoCmd = editor.commandFactories['undo']?.();
        if (undoCmd) {
          return undoCmd(state);
        }
        return false;
      },
      icon: icons.undo,
    }),
  );

  // === 2. Redo ===
  // Use a wrapper that dynamically gets the redo command from the editor
  undoRedoGroup.push(
    new MenuItem({
      title: 'Redo last undone change',
      run: (state, dispatch) => {
        const redoCmd = editor.commandFactories['redo']?.();
        if (redoCmd) {
          return redoCmd(state, dispatch);
        }
        return false;
      },
      enable: (state) => {
        const redoCmd = editor.commandFactories['redo']?.();
        if (redoCmd) {
          return redoCmd(state);
        }
        return false;
      },
      icon: icons.redo,
    }),
  );

  // Group 2: Structure tools (Heading, Lift, Join, Blockquote)
  const structureGroup: MenuElement[] = [];

  // === 3. Heading / Text style selector (the "H" dropdown) ===
  if (schema.nodes.heading) {
    const headingMenu = [];
    for (let i = 1; i <= 6; i++) {
      headingMenu.push(blockTypeItem(schema.nodes.heading, {
        title: 'Change to heading ' + i,
        label: 'Heading ' + i,
        attrs: { level: i },
      }));
    }
    structureGroup.push(
      new Dropdown(headingMenu, {
        label: 'Heading',
        icon: icons.heading,
      }),
    );
  }

  // === 4. Decrease indent (outdent) ===
  structureGroup.push(
    new MenuItem({
      title: 'Lift out of enclosing block',
      run: () => editor.chain().lift().run(),
      select: () => editor.can().lift().run(),
      icon: icons.outdent,
    }),
  );

  // === 5. Increase indent ===
  structureGroup.push(
    new MenuItem({
      title: 'Join with above block',
      run: () => editor.chain().joinUp().run(),
      select: () => editor.can().joinUp().run(),
      icon: icons.indent,
    }),
  );

  // === 6. Block quote ===
  if (schema.nodes.blockquote) {
    structureGroup.push(wrapItem(schema.nodes.blockquote, {
      title: 'Wrap in block quote',
      icon: icons.blockquote,
    }));
  }

  // Group 3: Text formatting (Bold through Link)
  const formattingGroup: MenuElement[] = [];

  // === 7. Bold ===
  if (schema.marks.strong) {
    formattingGroup.push(
      new MenuItem({
        title: 'Toggle bold',
        run: () => editor.chain().toggleStrong().run(),
        enable: (state) => editor.can().toggleStrong().run(),
        icon: icons.strong,
      }),
    );
  }

  // === 8. Italic ===
  if (schema.marks.em) {
    formattingGroup.push(
      new MenuItem({
        title: 'Toggle italic',
        run: () => editor.chain().toggleItalic().run(),
        enable: (state) => editor.can().toggleItalic().run(),
        icon: icons.em,
      }),
    );
  }

  // === 9. Strikethrough ===
  if (schema.marks.strike) {
    formattingGroup.push(markItem(schema.marks.strike, {
      title: 'Toggle strikethrough',
      icon: icons.strike,
    }));
  }

  // === 10. Inline code ===
  if (schema.marks.code) {
    formattingGroup.push(markItem(schema.marks.code, {
      title: 'Toggle code font',
      icon: icons.code,
    }));
  }

  // === 11. Underline ===
  if (schema.marks.underline) {
    formattingGroup.push(
      new MenuItem({
        title: 'Toggle underline',
        run: () => editor.chain().toggleUnderline().run(),
        enable: (state) => editor.can().toggleUnderline().run(),
        icon: icons.underline,
      }),
    );
  }

  // === 12. Highlight / Text color ===
  if (schema.marks.highlight) {
    formattingGroup.push(markItem(schema.marks.highlight, {
      title: 'Toggle highlight',
      icon: icons.highlight,
    }));
  }

  // === 13. Insert link ===
  if (schema.marks.link) {
    const markType = schema.marks.link;

    formattingGroup.push(
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

  // Group 4: Superscript/Subscript
  const scriptGroup: MenuElement[] = [];

  // === 14. Superscript ===
  if (schema.marks.superscript) {
    scriptGroup.push(markItem(schema.marks.superscript, {
      title: 'Toggle superscript',
      icon: icons.superscript,
    }));
  }

  // === 15. Subscript ===
  if (schema.marks.subscript) {
    scriptGroup.push(markItem(schema.marks.subscript, {
      title: 'Toggle subscript',
      icon: icons.subscript,
    }));
  }

  // Group 5: Text alignment
  const alignmentGroup: MenuElement[] = [];

  // === 16-19. Text alignment ===
  // Check if paragraph has textAlign attribute
  if (schema.nodes.paragraph?.spec?.attrs?.textAlign !== undefined) {
    alignmentGroup.push(
      new MenuItem({
        title: 'Align left',
        icon: icons.alignLeft,
        run: () => editor.chain().setTextAlignLeft().run(),
        enable: () => editor.can().setTextAlignLeft().run(),
      }),
    );
    alignmentGroup.push(
      new MenuItem({
        title: 'Align center',
        icon: icons.alignCenter,
        run: () => editor.chain().setTextAlignCenter().run(),
        enable: () => editor.can().setTextAlignCenter().run(),
      }),
    );
    alignmentGroup.push(
      new MenuItem({
        title: 'Align right',
        icon: icons.alignRight,
        run: () => editor.chain().setTextAlignRight().run(),
        enable: () => editor.can().setTextAlignRight().run(),
      }),
    );
    alignmentGroup.push(
      new MenuItem({
        title: 'Justify',
        icon: icons.alignJustify,
        run: () => editor.chain().setTextAlignJustify().run(),
        enable: () => editor.can().setTextAlignJustify().run(),
      }),
    );
  }

  // Group 6: Insert tools (Image, Lists, HR, Table, Type)
  const insertGroup: MenuElement[] = [];

  // === 20. Insert image ===
  if (schema.nodes.image) {
    const nodeType = schema.nodes.image;
    insertGroup.push(
      new MenuItem({
        title: 'Insert image',
        icon: icons.image,
        enable: (state) => canInsert(state, nodeType),
        run(state, dispatch) {
          let { from, to } = state.selection,
            attrs = null;
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

  // === 21. Lists dropdown (top-level) ===
  const listMenu = [];
  if (schema.nodes.bullet_list) {
    listMenu.push(
      wrapListItem(schema.nodes.bullet_list, {
        title: 'Wrap in bullet list',
        label: 'Bullet List',
        icon: icons.bulletList,
      }),
    );
  }
  if (schema.nodes.ordered_list) {
    listMenu.push(
      wrapListItem(schema.nodes.ordered_list, {
        title: 'Wrap in ordered list',
        label: 'Ordered List',
        icon: icons.orderedList,
      }),
    );
  }
  if (schema.nodes.task_list) {
    listMenu.push(
      wrapListItem(schema.nodes.task_list, {
        title: 'Wrap in task list',
        label: 'Task List',
        icon: icons.taskList,
      }),
    );
  }
  if (listMenu.length > 0) {
    insertGroup.push(
      new Dropdown(listMenu, {
        label: 'Lists',
        icon: icons.bulletList,
      }),
    );
  }

  // === 22. Horizontal rule ===
  if (schema.nodes.hr) {
    insertGroup.push(
      new MenuItem({
        title: 'Insert horizontal rule',
        icon: icons.horizontalRule,
        run: () => editor.chain().setHorizontalRule().run(),
        enable: (state) => editor.can().setHorizontalRule().run(),
      }),
    );
  }

  // === 23. Table dropdown (top-level) ===
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
    ];
    insertGroup.push(
      new Dropdown(tableMenu, { label: 'Table', icon: icons.table }),
    );
  }

  // === 24. Type dropdown (top-level) ===
  const typeMenu = [];
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
  if (typeMenu.length > 0) {
    insertGroup.push(
      new Dropdown(typeMenu, {
        label: 'Type',
        icon: icons.type,
      }),
    );
  }

  // Group 7: Block menu (Select parent node)
  const blockGroup: MenuElement[] = [];
  blockGroup.push(
    new MenuItem({
      title: 'Select parent node',
      run: () => editor.chain().selectParentNode().run(),
      select: () => editor.can().selectParentNode().run(),
      icon: icons.selectParentNode,
    }),
  );

  // Return all groups - separators will be placed between non-empty groups
  // Filter out empty groups to avoid unnecessary separators
  const allGroups: MenuElement[][] = [
    undoRedoGroup, // Undo, Redo
    structureGroup, // Heading, Lift, Join, Blockquote
    formattingGroup, // Bold, Italic, Strikethrough, Code, Underline, Highlight, Link
    scriptGroup, // Superscript, Subscript
    alignmentGroup, // Align left, center, right, Justify
    insertGroup, // Image, Lists, HR, Table, Type
    blockGroup, // Select parent node
  ].filter((group) => group.length > 0);

  return allGroups;
}
