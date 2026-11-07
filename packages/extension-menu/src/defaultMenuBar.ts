import { CoreEditor } from '@kerebron/editor';
import { icons } from '@kerebron/ui/icons';

import { MenuBar, MenuNode } from './model.ts';
import { markActive, nodeActive, topNodeActive } from './renderMenu.ts';

export function createDefaultMenuBar(editor: CoreEditor): MenuBar {
  const schema = editor.schema;

  const items: MenuNode[] = [];

  // Group 1: Undo/Redo
  items.push(
    {
      type: 'item',
      id: 'undo',
      title: 'Undo last change',
      icon: icons.undo,
      can: (editor) => editor.can().undo().run(),
      action: (editor) => editor.run.undo(),
    },
    {
      type: 'item',
      id: 'redo',
      title: 'Redo last undone change',
      icon: icons.redo,
      can: (editor) => editor.can().redo().run(),
      action: (editor) => editor.run.redo(),
    },
    {
      type: 'separator',
      id: 'separator-undo-redo',
    },
  );

  // Group 2: Structure tools (Type, Heading, Lists, Lift, Blockquote)
  const typeMenu: MenuNode[] = [];
  if (schema.nodes.paragraph) {
    const nodeType = schema.nodes.paragraph;
    typeMenu.push({
      type: 'item',
      id: 'set-paragraph',
      title: 'Change to paragraph',
      label: 'Plain',
      active: (editor) => nodeActive(editor.state, [nodeType]),
      can: (editor) => editor.can().setParagraph().run(),
      action: (editor) => editor.run.setParagraph(),
    });
  }
  if (schema.nodes.code_block) {
    const nodeType = schema.nodes.code_block;
    typeMenu.push({
      type: 'item',
      id: 'set-code-block',
      title: 'Change to code block',
      label: 'Code',
      active: (editor) => nodeActive(editor.state, [nodeType]),
      can: (editor) => editor.can().setCodeBlock().run(),
      action: (editor) => editor.run.setCodeBlock(),
    });
  }
  if (typeMenu.length > 0) {
    items.push({
      type: 'dropdown',
      id: 'type',
      title: 'Type',
      icon: icons.type,
      items: typeMenu,
      active: (editor) =>
        topNodeActive(editor.state, [
          schema.nodes.paragraph,
          schema.nodes.code_block,
        ]),
    });
  }

  if (schema.nodes.heading) {
    const nodeType = schema.nodes.heading;
    const headingMenu: MenuNode[] = [];
    for (let i = 1; i <= 6; i++) {
      headingMenu.push({
        type: 'item',
        id: 'set-heading-' + i,
        title: 'Change to heading ' + i,
        label: 'Heading ' + i,
        active: (editor) => !editor.can()['setHeading' + i]().run(),
        action: (editor) =>
          editor.chain()['setHeading' + i]().clearPopups().run(),
      });
    }
    items.push({
      type: 'dropdown',
      id: 'heading',
      title: 'Heading',
      icon: icons.heading,
      items: headingMenu,
      active: (editor) => topNodeActive(editor.state, [nodeType]),
    });
  }

  const listMenu: MenuNode[] = [];
  if (schema.nodes.bullet_list) {
    const nodeType = schema.nodes.bullet_list;
    listMenu.push({
      type: 'item',
      id: 'toggle-bullet-list',
      title: 'Wrap in bullet list',
      label: 'Bullet List',
      icon: icons.bulletList,
      active: (editor) => nodeActive(editor.state, [nodeType]),
      can: (editor) => editor.can().toggleBulletList().run(),
      action: (editor) => editor.run.toggleBulletList(),
    });
  }
  if (schema.nodes.ordered_list) {
    const nodeType = schema.nodes.ordered_list;
    listMenu.push({
      type: 'item',
      id: 'toggle-ordered-list',
      title: 'Wrap in ordered list',
      label: 'Ordered List',
      icon: icons.orderedList,
      active: (editor) => nodeActive(editor.state, [nodeType]),
      can: (editor) => editor.can().toggleOrderedList().run(),
      action: (editor) => editor.run.toggleOrderedList(),
    });
  }
  if (schema.nodes.task_list) {
    const nodeType = schema.nodes.task_list;
    listMenu.push({
      type: 'item',
      id: 'toggle-task-list',
      title: 'Wrap in task list',
      label: 'Task List',
      icon: icons.taskList,
      active: (editor) => nodeActive(editor.state, [nodeType]),
      can: (editor) => editor.can().toggleTaskList().run(),
      action: (editor) => editor.run.toggleTaskList(),
    });
  }
  if (listMenu.length > 0) {
    items.push({
      type: 'dropdown',
      id: 'lists',
      title: 'Lists',
      icon: icons.bulletList,
      items: listMenu,
      active: (editor) =>
        nodeActive(
          editor.state,
          Object.entries(schema.nodes).filter((i) => i[0].endsWith('_list'))
            .map((i) => i[1]),
        ),
    });
  }

  items.push({
    type: 'item',
    id: 'lift',
    title: 'Lift out of enclosing block',
    icon: icons.outdent,
    can: (editor) => editor.can().lift().run(),
    action: (editor) => editor.run.lift(),
  });

  if (schema.nodes.blockquote) {
    items.push({
      type: 'item',
      id: 'blockquote',
      title: 'Wrap in block quote',
      icon: icons.blockquote,
      // can: (editor) => editor.can().wrapInBlockquote().run(), TOFIX
      action: (editor) => editor.run.wrapInBlockquote(),
    });
  }

  items.push({
    type: 'separator',
    id: 'separator-structure-formatting',
  });

  // Group 3: Text formatting (Bold through Link)
  if (schema.marks.strong) {
    const markType = editor.schema.marks.strong;
    items.push({
      type: 'item',
      id: 'strong',
      title: 'Toggle bold',
      icon: icons.strong,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleStrong().run(),
      action: (editor) => editor.run.toggleStrong(),
    });
  }
  if (schema.marks.em) {
    const markType = editor.schema.marks.em;
    items.push({
      type: 'item',
      id: 'em',
      title: 'Toggle italic',
      icon: icons.em,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleItalic().run(),
      action: (editor) => editor.run.toggleItalic(),
    });
  }
  if (schema.marks.strike) {
    const markType = editor.schema.marks.strike;
    items.push({
      type: 'item',
      id: 'strike',
      title: 'Toggle strikethrough',
      icon: icons.strike,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleStrike().run(),
      action: (editor) => editor.run.toggleStrike(),
    });
  }
  if (schema.marks.code) {
    const markType = editor.schema.marks.code;
    items.push({
      type: 'item',
      id: 'code',
      title: 'Toggle code font',
      icon: icons.code,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleCode().run(),
      action: (editor) => editor.run.toggleCode(),
    });
  }
  if (schema.marks.underline) {
    const markType = editor.schema.marks.underline;
    items.push({
      type: 'item',
      id: 'underline',
      title: 'Toggle underline',
      icon: icons.underline,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleUnderline().run(),
      action: (editor) => editor.run.toggleUnderline(),
    });
  }
  if (schema.marks.highlight) {
    const markType = editor.schema.marks.highlight;
    items.push({
      type: 'item',
      id: 'highlight',
      title: 'Toggle highlight',
      icon: icons.highlight,
      active: (editor) => markActive(editor.state, markType),
      // can: (editor) => editor.can().toggleHighlight().run(), // TOFIX
      action: (editor) => editor.run.toggleHighlight(),
    });
  }
  if (schema.marks.link) {
    const markType = editor.schema.marks.link;
    items.push({
      type: 'item',
      id: 'link',
      title: 'Add or remove link',
      icon: icons.link,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleLink().run(),
      action: (editor) => editor.run.toggleLink(),
    });
  }

  // Group 4: Superscript/Subscript
  if (schema.marks.superscript) {
    const markType = editor.schema.marks.superscript;
    items.push({
      type: 'item',
      id: 'superscript',
      title: 'Toggle superscript',
      icon: icons.superscript,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleSuperscript().run(),
      action: (editor) => editor.run.toggleSuperscript(),
    });
  }
  if (schema.marks.subscript) {
    const markType = editor.schema.marks.subscript;
    items.push({
      type: 'item',
      id: 'subscript',
      title: 'Toggle subscript',
      icon: icons.subscript,
      active: (editor) => markActive(editor.state, markType),
      can: (editor) => editor.can().toggleSubscript().run(),
      action: (editor) => editor.run.toggleSubscript(),
    });
  }

  items.push({
    type: 'separator',
    id: 'separator-script-alignment',
  });

  // Group 5: Text alignment
  if (schema.nodes.paragraph?.spec?.attrs?.textAlign !== undefined) {
    items.push(
      {
        type: 'item',
        id: 'align-left',
        title: 'Align left',
        icon: icons.alignLeft,
        can: (editor) => editor.can().setTextAlignLeft().run(),
        action: (editor) => editor.run.setTextAlignLeft(),
      },
      {
        type: 'item',
        id: 'align-center',
        title: 'Align center',
        icon: icons.alignCenter,
        can: (editor) => editor.can().setTextAlignCenter().run(),
        action: (editor) => editor.run.setTextAlignCenter(),
      },
      {
        type: 'item',
        id: 'align-right',
        title: 'Align right',
        icon: icons.alignRight,
        can: (editor) => editor.can().setTextAlignRight().run(),
        action: (editor) => editor.run.setTextAlignRight(),
      },
      {
        type: 'item',
        id: 'align-justify',
        title: 'Justify',
        icon: icons.alignJustify,
        can: (editor) => editor.can().setTextAlignJustify().run(),
        action: (editor) => editor.run.setTextAlignJustify(),
      },
    );
  }

  items.push({
    type: 'separator',
    id: 'separator-alignment-insert',
  });

  // Group 6: Insert tools (Image, HR, Table)
  if (schema.nodes.image) {
    items.push({
      type: 'item',
      id: 'insert-image',
      title: 'Insert image',
      icon: icons.image,
      can: (editor) => editor.can().insertImage().run(),
      action: (editor) => editor.run.insertImage(),
    });
  }
  if (schema.nodes.hr) {
    items.push({
      type: 'item',
      id: 'insert-horizontal-rule',
      title: 'Insert horizontal rule',
      icon: icons.horizontalRule,
      can: (editor) => editor.can().setHorizontalRule().run(),
      action: (editor) => editor.run.setHorizontalRule(),
    });
  }
  if (schema.nodes.table) {
    const tableMenu: MenuNode[] = [
      'insertTable',
      'addColumnBefore',
      'addColumnAfter',
      'deleteColumn',
      'addRowBefore',
      'addRowAfter',
      'deleteRow',
      'deleteTable',
      'mergeCells',
      'splitCell',
      'toggleHeaderColumn',
      'toggleHeaderRow',
      'toggleHeaderCell',
    ].map((cmdName) => ({
      type: 'item' as const,
      id: 'table-' + cmdName,
      title: cmdName,
      can: (editor: CoreEditor) => (editor.can() as any)[cmdName]().run(),
      action: (editor: CoreEditor) => (editor.run as any)[cmdName](),
    }));
    items.push({
      type: 'dropdown',
      id: 'table',
      title: 'Table',
      icon: icons.table,
      items: tableMenu,
    });
  }

  // Group 7: Block menu (Select parent node)
  items.push(
    {
      type: 'separator',
      id: 'separator-insert-block',
    },
    {
      type: 'item',
      id: 'select-parent-node',
      title: 'Select parent node',
      icon: icons.selectParentNode,
      can: (editor) => editor.can().selectParentNode().run(),
      action: (editor) => editor.run.selectParentNode(),
    },
  );

  return {
    items,
    tray: [{
      type: 'item',
      id: 'more-tools',
      title: 'More tools',
      icon: '&#x2026;',
      can: (editor) => editor.can().showCollapsedMenu().run(),
      action: (editor) => editor.run.showCollapsedMenu(),
    }],
  };
}
