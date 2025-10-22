import { Command, EditorState, NodeSelection, Plugin } from 'prosemirror-state';
import { MarkType, NodeType, Schema } from 'prosemirror-model';
import { redo, redoDepth, undo, undoDepth } from 'prosemirror-history';

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

  // Create custom icon for underline - just shows underlined underscore
  const createUnderlineIcon = () => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;';
    
    const text = document.createElement('span');
    text.textContent = '_';
    text.style.cssText = 'font-weight: bold; font-size: 18px; text-decoration: underline;';
    
    wrapper.appendChild(text);
    
    return wrapper;
  };

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
        label: 'Toggle underline',
        icon: { dom: createUnderlineIcon() },
        run: () => editor.chain().toggleUnderline().run(),
        enable: (state) => editor.can().toggleUnderline().run(),
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
              toggleMark(markType, attrs)(
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

  /** Color picker for text color */
  if (schema.marks.textColor) {
    const markType = schema.marks.textColor;
    const defaultColors = [
      '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
      '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
      '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
      '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
      '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
      '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
      '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
      '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
    ];

    // Create custom icon with "A" and colored line below
    const createTextColorIcon = () => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: relative; display: inline-flex; flex-direction: column; align-items: center; padding-bottom: 2px; border-bottom: 3px solid #000; width: 20px;';
      
      const text = document.createElement('span');
      text.textContent = 'A';
      text.style.cssText = 'font-weight: bold; font-size: 16px; line-height: 20px;';
      
      wrapper.appendChild(text);
      
      return wrapper;
    };

    menu.push(
      new MenuItem({
        title: 'Text color',
        icon: { dom: createTextColorIcon() },
        label: 'Text Color',
        active(state) {
          return markActive(state, markType);
        },
        enable(state) {
          return !state.selection.empty;
        },
        run(state, dispatch) {
          /** Create color picker popup */
          const wrapper = document.createElement('div');
          wrapper.className = 'kb-color-picker';
          wrapper.style.cssText = 'position: fixed; z-index: 1000; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
          
          /** Position near the editor */
          const editorRect = editor.view.dom.getBoundingClientRect();
          wrapper.style.top = (editorRect.top + 40) + 'px';
          wrapper.style.left = editorRect.left + 'px';

          const colorGrid = document.createElement('div');
          colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(10, 24px); gap: 4px; margin-bottom: 8px;';

          defaultColors.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `width: 24px; height: 24px; border: 1px solid #ddd; border-radius: 2px; cursor: pointer; background: ${color}; padding: 0;`;
            btn.title = color;
            btn.onclick = () => {
              toggleMark(markType, { color })(editor.view.state, editor.view.dispatch);
              if (wrapper.parentNode) {
                document.body.removeChild(wrapper);
              }
              editor.view.focus();
            };
            colorGrid.appendChild(btn);
          });

          wrapper.appendChild(colorGrid);

          /** Remove color button */
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = 'Remove color';
          removeBtn.style.cssText = 'width: 100%; padding: 4px; cursor: pointer;';
          removeBtn.onclick = () => {
            toggleMark(markType)(editor.view.state, editor.view.dispatch);
            if (wrapper.parentNode) {
              document.body.removeChild(wrapper);
            }
            editor.view.focus();
          };
          wrapper.appendChild(removeBtn);

          /** Close on click outside */
          const closeHandler = (e: MouseEvent) => {
            if (!wrapper.contains(e.target as Node)) {
              if (wrapper.parentNode) {
                document.body.removeChild(wrapper);
              }
              document.removeEventListener('click', closeHandler);
            }
          };
          setTimeout(() => document.addEventListener('click', closeHandler), 100);

          document.body.appendChild(wrapper);
          return true;
        },
      }),
    );
  }

  /** Color picker for highlight/background color */
  if (schema.marks.highlight) {
    const markType = schema.marks.highlight;
    const highlightColors = [
      '#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffa500', '#ff69b4',
      '#fff2cc', '#fce5cd', '#f4cccc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3',
      '#ffe599', '#f9cb9c', '#ea9999', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8',
    ];

    // Create custom icon with pencil and colored line below
    const createHighlightIcon = () => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: relative; display: inline-flex; flex-direction: column; align-items: center; padding-bottom: 4px; border-bottom: 3px solid #ffff00;';
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.style.cssText = 'display: block;';
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z');
      path.setAttribute('fill', 'currentColor');
      
      svg.appendChild(path);
      wrapper.appendChild(svg);
      
      return wrapper;
    };

    menu.push(
      new MenuItem({
        title: 'Text highlight',
        icon: { dom: createHighlightIcon() },
        label: 'Text Highlight',
        active(state) {
          return markActive(state, markType);
        },
        enable(state) {
          return !state.selection.empty;
        },
        run(state, dispatch) {
          /** Create color picker popup */
          const wrapper = document.createElement('div');
          wrapper.className = 'kb-color-picker';
          wrapper.style.cssText = 'position: fixed; z-index: 1000; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
          
          /** Position near the editor */
          const editorRect = editor.view.dom.getBoundingClientRect();
          wrapper.style.top = (editorRect.top + 40) + 'px';
          wrapper.style.left = (editorRect.left + 50) + 'px';

          const colorGrid = document.createElement('div');
          colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 24px); gap: 4px; margin-bottom: 8px;';

          highlightColors.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = `width: 24px; height: 24px; border: 1px solid #ddd; border-radius: 2px; cursor: pointer; background: ${color}; padding: 0;`;
            btn.title = color;
            btn.onclick = () => {
              toggleMark(markType, { color })(editor.view.state, editor.view.dispatch);
              if (wrapper.parentNode) {
                document.body.removeChild(wrapper);
              }
              editor.view.focus();
            };
            colorGrid.appendChild(btn);
          });

          wrapper.appendChild(colorGrid);

          /** Remove highlight button */
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = 'Remove highlight';
          removeBtn.style.cssText = 'width: 100%; padding: 4px; cursor: pointer;';
          removeBtn.onclick = () => {
            toggleMark(markType)(editor.view.state, editor.view.dispatch);
            if (wrapper.parentNode) {
              document.body.removeChild(wrapper);
            }
            editor.view.focus();
          };
          wrapper.appendChild(removeBtn);

          /** Close on click outside */
          const closeHandler = (e: MouseEvent) => {
            if (!wrapper.contains(e.target as Node)) {
              if (wrapper.parentNode) {
                document.body.removeChild(wrapper);
              }
              document.removeEventListener('click', closeHandler);
            }
          };
          setTimeout(() => document.addEventListener('click', closeHandler), 100);

          document.body.appendChild(wrapper);
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
