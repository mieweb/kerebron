import {
  createParser,
  type Node as TreeSitterNode,
  Parser,
  type Tree,
} from '@kerebron/tree-sitter';

import {
  NESTING_CLOSING,
  NESTING_OPENING,
  NESTING_SELF_CLOSING,
  Token,
} from './types.ts';
import { fetchWasm, getLangTreeSitter } from '@kerebron/wasm';

interface HasStartPosition {
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}

function treeToTokens(
  tree: Tree,
  inlineParser: Parser,
  source: string,
): Array<Token> {
  const retVal: Array<Token> = [];
  let blockLevel = 0;

  const nodeText = (node?: TreeSitterNode | null) => {
    if (!node) {
      return undefined;
    }
    return source.substring(node.startIndex, node.endIndex);
  };

  const pushInlineNode = (someInlineToken: Token, debug: string) => {
    const lastBlockToken: Token | undefined = retVal[retVal.length - 1];

    if (lastBlockToken?.type === 'inline') {
      if (!lastBlockToken.children) {
        lastBlockToken.children = [];
      }
      lastBlockToken.children.push(someInlineToken);
      lastBlockToken.content = someInlineToken.content;
      return;
    }

    const blockToken = new Token('inline', '', NESTING_SELF_CLOSING);
    blockToken.info = debug;
    blockToken.level = blockLevel;
    blockToken.children = [someInlineToken];
    blockToken.content = blockToken.children
      .map((c) => c.content || '').join(
        '',
      );
    retVal.push(blockToken);
  };

  const walkInline = (
    children: TreeSitterNode[],
    inlineContent: string,
    startPosition = { row: 0, column: 0 },
  ) => {
    const nodeText = (node?: TreeSitterNode | null) => {
      if (!node) {
        return undefined;
      }
      return inlineContent.substring(node.startIndex, node.endIndex);
    };

    for (const node of children) {
      const map: [number, number, number, number] = [
        startPosition.row + node.startPosition?.row,
        startPosition.row + node.endPosition?.row,
        startPosition.column + node.startPosition?.column,
        (+node.endPosition.row === +node.startPosition.row
          ? startPosition.column
          : 0) + node.endPosition?.column,
      ];
      if (node.type.length === 1) { // single letter type is text
        const token = new Token('text', '', NESTING_SELF_CLOSING);
        token.map = map;
        token.meta = 'noEscText';
        token.content = nodeText(node) || '';
        pushInlineNode(token, 'walkInline');
        continue;
      }

      switch (node.type) {
        case 'block_continuation':
        case 'emphasis_delimiter':
        case 'code_span_delimiter':
          break;

        case 'text':
          {
            const token = new Token('text', '', NESTING_SELF_CLOSING);
            token.map = map;
            token.meta = 'noEscText';
            token.content = nodeText(node) ?? '';
            pushInlineNode(token, 'text');
            break;
          }
          break;

        case 'latex_block':
          {
            const delimiter = node.children
              .find((c) => c?.type === 'latex_span_delimiter');

            const content = node.children
              .filter((c) => c?.type !== 'latex_span_delimiter')
              .map((c) => nodeText(c))
              .join('');

            if (nodeText(delimiter) === '$$') {
              const token = new Token(
                'fence',
                'pre',
                NESTING_SELF_CLOSING,
              );
              token.level = blockLevel;
              token.markup = '$$';
              token.info = 'latex';

              token.content = content.trim();
              retVal.push(token);
            } else {
              const token = new Token('math', '', NESTING_SELF_CLOSING);
              token.map = map;
              token.meta = 'noEscText';

              token.content = content;
              pushInlineNode(token, 'latex_block');
            }
          }
          break;

        case 'whitespace':
          {
            const text = nodeText(node) || '';
            if (text === '\n') {
              const token = new Token('hardbreak', 'br', NESTING_SELF_CLOSING);
              token.map = map;
              token.content = text ?? '';
              pushInlineNode(token, 'whitespace \n');
              break;
            }
            if (text && text.match(/^\s+$/)) {
              const token = new Token('text', 'br', NESTING_SELF_CLOSING);
              token.map = map;
              token.meta = 'noEscText';
              token.content = text ?? '';
              pushInlineNode(token, 'whitespace space');
              break;
            }
            if (text?.trim().length > 0) {
              const token = new Token('text', '', NESTING_SELF_CLOSING);
              token.map = map;
              token.meta = 'noEscText';
              token.content = text ?? '';
              pushInlineNode(token, 'whitespace other');
              break;
            }
          }

          break;

        case 'shortcut_link':
          {
            const tokenName = 'link';
            const tagName = 'a';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );

            const destination = node.children
              .find((c) => c?.type === 'link_destination');
            openToken.attrSet('href', nodeText(destination) || '');

            const title = node.children
              .find((c) => c?.type === 'link_title');
            if (title) {
              openToken.attrSet('title', nodeText(title) || '');
            }

            pushInlineNode(openToken, 'shortcut_link');

            node.children
              .filter((c) => c.type === 'link_text')
              .forEach((c) => {
                const token = new Token('text', '', NESTING_SELF_CLOSING);
                token.map = map;
                token.meta = 'noEscText';
                token.content = nodeText(c) ?? '';
                pushInlineNode(token, 'link_text');
              });

            // walkInline(node.children, inlineContent);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            pushInlineNode(closeToken, '/shortcut_link');
          }
          break;

        case 'inline_link':
          {
            const tokenName = 'link';
            const tagName = 'a';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );

            const destination = node.children
              .find((c) => c.type === 'link_destination');
            openToken.attrSet('href', destination?.text || '');

            const title = node.children
              .find((c) => c.type === 'link_title');
            if (title) {
              openToken.attrSet('title', title.text || '');
            }

            pushInlineNode(openToken, 'inline_link');

            node.children
              .filter((c) => c.type === 'link_text')
              .forEach((c) => {
                const token = new Token('text', '', NESTING_SELF_CLOSING);
                token.map = map;
                token.meta = 'noEscText';
                token.content = nodeText(c) ?? '';
                pushInlineNode(token, 'inline_link_txt');
              });

            // walkInline(node.children);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            pushInlineNode(closeToken, '/inline_link');
          }
          break;
        case 'image':
          {
            const tokenName = 'image';
            const tagName = 'img';
            const token = new Token(
              tokenName,
              tagName,
              NESTING_SELF_CLOSING,
            );

            const image_description = node.children
              .find((c) => c.type === 'image_description');
            token.attrSet('alt', image_description?.text || '');

            const destination = node.children
              .find((c) => c.type === 'link_destination');
            token.attrSet('src', destination?.text || '');

            const title = node.children
              .find((c) => c.type === 'link_title');
            if (title) {
              token.attrSet('title', title.text || '');
            }

            pushInlineNode(token, 'image');
          }
          break;
        case 'strong_emphasis':
          {
            const delimiter = node.children
              .find((c) => c.type === 'emphasis_delimiter');

            const tokenName = delimiter?.text === '_' ? 'underline' : 'strong';
            const tagName = delimiter?.text === '_' ? 'u' : 'strong';

            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            if (delimiter?.text === '_') {
              openToken.markup = '__';
            }
            pushInlineNode(openToken, 'strongem');

            walkInline(node.children, inlineContent);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            if (nodeText(delimiter) === '_') {
              closeToken.markup = '__';
            }
            pushInlineNode(closeToken, '/strongem');
          }
          break;
        case 'emphasis':
          {
            const delimiter = node.children
              .find((c) => c.type === 'emphasis_delimiter');

            const children = node.children
              .filter((c) => c.type !== 'emphasis_delimiter');

            const tokenName = delimiter?.text === '_' ? 'underline' : 'em';
            const tagName = delimiter?.text === '_' ? 'u' : 'em';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            pushInlineNode(openToken, 'em');

            walkInline(children.filter((c) => !!c), inlineContent);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            pushInlineNode(closeToken, '/em');
          }
          break;
        case 'strikethrough':
          {
            const tokenName = 'strike';
            const tagName = 'strike';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            pushInlineNode(openToken, 's');

            walkInline(node.children.filter((c) => !!c), inlineContent);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            pushInlineNode(closeToken, '/s');
          }
          break;
        case 'code_span':
          {
            const tokenName = 'code';
            const tagName = 'code';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            pushInlineNode(openToken, 'code');

            walkInline(node.children.filter((c) => !!c), inlineContent);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            pushInlineNode(closeToken, '/code');
          }
          break;
        case 'html_tag':
          {
            const tokenName = 'html_block';
            const tagName = '';
            const token = new Token(
              tokenName,
              tagName,
              NESTING_SELF_CLOSING,
            );

            token.content = nodeText(node) || '';

            pushInlineNode(token, 'html_block');
          }
          break;
        default:
          console.debug('inline_node', node);
          throw new Error(`Unhandled inline node type: ${node.type}`);
      }
    }
  };

  const walkRecursive = (
    node?: TreeSitterNode,
    ctx: {
      tableRowType: 'thead' | 'tbody';
      cellNo: number;
      cellAlign: Array<'left' | 'right'>;
    } = { tableRowType: 'tbody', cellNo: 0, cellAlign: [] },
  ) => {
    if (!node) {
      return;
    }

    if (node.type === 'inline') {
      const inlineText = nodeText(node);
      if (!inlineText) {
        throw new Error('!inlineText');
      }

      if (node.children.length > 0) {
        walkInline(node.children, source, node.startPosition);
      } else {
        const inlineTree = inlineParser.parse(inlineText);
        if (!inlineTree) {
          throw new Error('!inlineTree');
        }
        walkInline(
          inlineTree?.rootNode.children,
          inlineText,
          node.startPosition,
        );
      }

      return;
    }

    if (!node.children || node.children.length === 0) {
      if (node.type === 'text' || node.type.length === 1) {
        const token = new Token('text', '', NESTING_SELF_CLOSING);
        token.map = [
          +node.startPosition?.row,
          +node.endPosition?.row,
          +node.startPosition?.column,
          +node.endPosition?.column,
        ];
        token.meta = 'noEscText';
        token.content = nodeText(node) ?? '';
        pushInlineNode(token, 'txt2');
        return;
      }
      if (node.type === 'whitespace') {
        if (blockLevel === 0) {
          return;
        }
        if ((nodeText(node) || '').match(/^\n+$/)) {
          //   const token = new Token('hardbreak', 'br', NESTING_SELF_CLOSING);
          // token.map = [ +node.startPosition?.row, +node.endPosition?.row, +node.startPosition?.column, +node.endPosition?.column ];
          //   token.content = nodeText(node) ?? '';
          //   retVal.push(token);
          return;
        }

        const text = nodeText(node) || '';
        if (text && text.match(/^\s+$/)) {
          const token = new Token('text', 'br', NESTING_SELF_CLOSING);
          token.map = [
            +node.startPosition?.row,
            +node.endPosition?.row,
            +node.startPosition?.column,
            +node.endPosition?.column,
          ];
          token.meta = 'noEscText';
          token.content = nodeText(node) ?? '';
          pushInlineNode(token, 'txt3');
          return;
        }
        if (text.trim().length > 0) {
          const token = new Token('text', '', NESTING_SELF_CLOSING);
          token.map = [
            +node.startPosition?.row,
            +node.endPosition?.row,
            +node.startPosition?.column,
            +node.endPosition?.column,
          ];
          token.meta = 'noEscText';
          token.content = text ?? '';
          pushInlineNode(token, 'txt4');
          return;
        }
      }
    }

    switch (node.type) {
      case 'block_continuation':
        break;
      case 'document':
      case 'section':
        node.children
          .filter((c) => !!c)
          .forEach((child) => walkRecursive(child, ctx));
        break;

      case 'thematic_break':
        {
          const token = new Token('hr', 'hr', NESTING_SELF_CLOSING);
          token.level = blockLevel;
          token.map = [
            +node.startPosition?.row,
            +node.endPosition?.row,
            +node.startPosition?.column,
            +node.endPosition?.column,
          ];
          token.markup = nodeText(node) || '';
          retVal.push(token);
        }
        break;

      case 'setext_heading':
        // case 'setext_h2_underline':
        // TODO
        // TODO

        {
          const tokenName = 'heading';

          const underline = node.children
            .filter((c) => !!c).find((child) =>
              child.type.startsWith('setext_') &&
              child.type.endsWith('_underline')
            );

          // const marker = node.children.find((child) =>
          //   child.type.startsWith('atx_') && child.type.endsWith('_marker')
          // );
          const tagName =
            underline?.type.substring('setext_'.length, 'setext_'.length + 2) ||
            'h1';

          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          openToken.markup = nodeText(underline) || '#';
          retVal.push(openToken);

          const children = node.children
            .filter((c) => !!c).filter((c) => !c.type.startsWith('setext_'));

          blockLevel++;
          children.forEach((child) => walkRecursive(child, ctx));
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          closeToken.markup = nodeText(underline) || '';

          retVal.push(closeToken);
        }
        break;

      case 'atx_heading':
        {
          const tokenName = 'heading';

          const marker = node.children.filter((c) => !!c).find((child) =>
            child.type.startsWith('atx_') && child.type.endsWith('_marker')
          );
          const tagName =
            marker?.type.substring('atx_'.length, 'atx_'.length + 2) || 'h1';

          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          openToken.markup = nodeText(marker) || '#';
          retVal.push(openToken);

          const children = [...node.children.filter((c) => !!c)];
          if (children.length > 0 && children[0].type.endsWith('_marker')) {
            children.splice(0, 1);
          }
          if (children.length > 0 && children[0].type === 'whitespace') { // ' '
            children.splice(0, 1);
          }
          if (
            children.length > 0 &&
            children[children.length - 1].type === 'whitespace'
          ) { // /n
            children.splice(children.length - 1, 1);
          }

          blockLevel++;
          children.forEach((child) => walkRecursive(child, ctx));
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'minus_metadata':
        {
          const tokenName = 'frontmatter';
          const tagName = 'frontmatter';
          const token = new Token(
            tokenName,
            tagName,
            NESTING_SELF_CLOSING,
          );
          token.level = blockLevel;

          token.content = nodeText(node) || '';

          retVal.push(token);
        }
        break;

      case 'fenced_code_block':
        {
          const tokenName = 'fence';
          const tagName = 'pre';

          const info = node.children.filter((c) => !!c).find((child) =>
            child.type === 'info_string'
          );

          const token = new Token(
            tokenName,
            tagName,
            NESTING_SELF_CLOSING,
          );
          token.level = blockLevel;
          token.markup = '```';
          if (info) {
            token.attrSet('lang', nodeText(info) || '');
          }

          const children = [
            ...node.children.filter((c) => !!c)
              .filter((item) => item?.type === 'code_fence_content'),
          ];

          const content = children
            .map((inline) => nodeText(inline) || '')
            .join('');

          token.content = content;

          retVal.push(token);
        }
        break;

      case 'block_quote':
        {
          const tokenName = 'blockquote';
          const tagName = 'blockquote';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          retVal.push(openToken);

          blockLevel++;
          node.children
            ?.filter((child) => !['block_quote_marker'].includes(child.type))
            .forEach((child) => walkRecursive(child, ctx));
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'indented_code_block':
        {
          const tokenName = 'code_block';
          const tagName = 'code_block';

          const token = new Token(
            tokenName,
            tagName,
            NESTING_SELF_CLOSING,
          );
          token.level = blockLevel;

          let indent = 80;
          if ('indent' in node) {
            indent = (node.indent as string).length;
          }

          const lines = node.text.split('\n');
          for (const line of lines) {
            if (line.trim().length === 0) {
              continue;
            }
            const m = line.match(/^ +/);
            if (!m) {
              indent = 0;
            } else {
              if (indent > m[0].length) {
                indent = m[0].length;
              }
            }
          }

          const content = lines
            .map((line) => line.substring(indent))
            .join('\n');

          token.attrSet('indent', '' + indent);
          token.content = content;

          retVal.push(token);
        }
        break;

      case 'paragraph':
        {
          const tokenName = 'paragraph';
          const tagName = 'p';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          retVal.push(openToken);

          blockLevel++;
          node.children?.forEach((child) => walkRecursive(child, ctx));
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'pipe_table_cell':
        {
          const tokenName = ctx.tableRowType === 'thead' ? 'th' : 'td';
          const tagName = ctx.tableRowType === 'thead' ? 'th' : 'td';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.attrSet('align', ctx.cellAlign[ctx.cellNo] || 'left');
          openToken.level = blockLevel;
          retVal.push(openToken);

          blockLevel++;

          {
            const tokenName = 'paragraph';
            const tagName = 'p';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            openToken.level = blockLevel;
            retVal.push(openToken);

            const children = [...node.children];
            while (children.length > 0) {
              if (children[children.length - 1].type === 'whitespace') {
                children.splice(children.length - 1, 1);
              } else {
                break;
              }
            }

            if (children.length > 0) {
              children
                .forEach((child) => walkRecursive(child, ctx));
            } else {
              const map: [number, number, number, number] = [
                node.startPosition?.row,
                node.endPosition?.row,
                node.startPosition?.column,
                node.endPosition?.column,
              ];

              const token = new Token('text', '', NESTING_SELF_CLOSING);
              token.map = map;
              token.meta = 'noEscText';
              token.content = node.text?.replace(/\s+$/, '') ?? '';
              pushInlineNode(token, 'txt5');
            }

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            closeToken.level = blockLevel;
            retVal.push(closeToken);
          }

          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);

          ctx.cellNo++;
        }
        break;

      case 'pipe_table_header':
      case 'pipe_table_row':
        {
          const tokenName = 'tr';
          const tagName = 'tr';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          retVal.push(openToken);

          blockLevel++;
          node.children
            .filter((c) => !!c)
            .filter((c) => c.type === 'pipe_table_cell')
            .forEach((child) => walkRecursive(child, ctx));
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'pipe_table':
        {
          const tokenName = 'table';
          const tagName = 'table';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          retVal.push(openToken);

          blockLevel++;

          const delimiterRows = node.children
            .filter((c) => !!c)
            .filter((c) => c.type === 'pipe_table_delimiter_row');

          const cellAlign: Array<'left' | 'right'> = [];
          if (delimiterRows.length > 0) {
            const delimiterRow = delimiterRows[0];
            const delimiterCells = delimiterRow.children
              .filter((c) => !!c)
              .filter((c) => c.type === 'pipe_table_delimiter_cell');

            for (let cellNo = 0; cellNo < delimiterCells.length; cellNo++) {
              const cell = delimiterCells[cellNo];
              if (
                cell.children
                  .filter((c) => !!c)
                  .find((c) => c.type === 'pipe_table_align_right')
              ) {
                cellAlign.push('right');
              } else {
                cellAlign.push('left');
              }
            }
          }

          const headRows = node.children
            .filter((c) => !!c)
            .filter((c) => c.type === 'pipe_table_header');
          if (headRows.length > 0) {
            const tokenName = 'thead';
            const tagName = 'thead';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            openToken.level = blockLevel;
            retVal.push(openToken);

            blockLevel++;
            headRows.forEach((child) =>
              walkRecursive(child, {
                ...ctx,
                tableRowType: 'thead',
                cellNo: 0,
                cellAlign: cellAlign,
              })
            );
            blockLevel--;

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
            closeToken.level = blockLevel;
            retVal.push(closeToken);
          }

          const bodyRows = node.children
            ?.filter((c) => c?.type === 'pipe_table_row');

          if (bodyRows.length > 0) {
            // const tokenName = 'tbody';
            // const tagName = 'tbody';
            // const openToken = new Token(
            //   tokenName + '_open',
            //   tagName,
            //   NESTING_OPENING,
            // );
            // openToken.level = blockLevel;
            // retVal.push(openToken);

            blockLevel++;
            bodyRows
              .filter((c) => !!c)
              .forEach((child) =>
                walkRecursive(child, {
                  ...ctx,
                  tableRowType: 'tbody',
                  cellAlign: cellAlign,
                })
              );
            blockLevel--;

            // const closeToken = new Token(
            //   tokenName + '_close',
            //   tagName,
            //   NESTING_CLOSING,
            // );
            // closeToken.level = blockLevel;
            // retVal.push(closeToken);
          }

          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'list':
        {
          let tokenName = 'bullet_list';
          let tagName = 'ul';

          let start = '';
          const firstItem = node.children.filter((c) => !!c).find((item) =>
            item.type === 'list_item'
          );
          if (firstItem) {
            const taskListMarker = firstItem.children.filter((c) => !!c).find((
              item,
            ) => item.type.startsWith('task_list_marker'));
            const listMarker = firstItem.children.filter((c) => !!c).find((
              item,
            ) => item.type.startsWith('list_marker_dot'));
            if (taskListMarker) {
              tokenName = 'task_list';
              tagName = 'ul';
            } else if (listMarker) {
              tokenName = 'ordered_list';
              tagName = 'ol';
              start = (nodeText(listMarker) || '').trim().replace('.', '');
            }
          }

          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          openToken.markup = tagName === 'ol' ? '.' : '*';
          openToken.attrSet('symbol', tagName === 'ol' ? '1' : '*');
          if (start) {
            openToken.attrSet('start', start);
          }
          retVal.push(openToken);

          blockLevel++;
          node.children.filter((c) => !!c).forEach((child) =>
            walkRecursive(child, ctx)
          );
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }
        break;

      case 'list_item':
        {
          const taskListMarker = node.children.filter((c) => !!c).find((item) =>
            item.type.startsWith('task_list_marker_')
          );
          const listMarker = node.children.filter((c) => !!c).find((item) =>
            item.type.startsWith('list_marker_')
          );
          if (!listMarker) {
            break;
          }

          let tokenName = taskListMarker ? 'task_item' : 'list_item';
          const tagName = 'li';
          const openToken = new Token(
            tokenName + '_open',
            tagName,
            NESTING_OPENING,
          );
          openToken.level = blockLevel;
          openToken.markup = (nodeText(listMarker) || '').trim();

          if (listMarker.type === 'list_marker_dot') {
            // openToken.info = (nodeText(listMarker) || '').trim().replace('.', '');
            // openToken.markup = '.';
            openToken.info = '';
            openToken.markup = '';
          }

          if (taskListMarker) {
            if (taskListMarker.type === 'task_list_marker_checked') {
              // throw new Error('aaaa')
            }
            openToken.attrSet(
              'checked',
              taskListMarker.type === 'task_list_marker_checked'
                ? 'checked'
                : '',
            );
          }

          retVal.push(openToken);

          // node.children?.forEach((child) => walkRecursive(child, ctx));
          blockLevel++;
          walkRecursive(
            node.children
              .filter((c) => !!c)
              .find((item) => item.type === 'paragraph'),
            ctx,
          );

          const lists = node.children
            .filter((c) => !!c)
            .filter((item) => item.type === 'list');
          for (const list of lists) {
            walkRecursive(list, ctx);
          }
          blockLevel--;

          const closeToken = new Token(
            tokenName + '_close',
            tagName,
            NESTING_CLOSING,
          );
          closeToken.level = blockLevel;
          retVal.push(closeToken);
        }

        break;

      case 'html_block':
        {
          const token = new Token('html_block', '', NESTING_SELF_CLOSING);
          token.level = blockLevel;
          token.content = nodeText(node) ?? '';
          retVal.push(token);
        }
        break;

      case 'text':
        {
          const token = new Token('text', '', NESTING_SELF_CLOSING);
          token.level = blockLevel;
          token.content = nodeText(node) ?? '';
          retVal.push(token);
        }
        break;

      default:
        // Log unhandled node types for debugging
        console.warn(
          `Unhandled node type: ${node.type}, children: ${
            node.children.map((c: any) => c.type).join(', ')
          }`,
          {
            ...node,
            children: undefined,
            _children: undefined,
            tree: undefined,
          },
        );
        throw new Error('aaa');
    }
  };

  walkRecursive(tree.rootNode);

  return retVal;
}

export async function sitterTokenizer(cdnUrl: string) {
  const jsonManifest = getLangTreeSitter('markdown', cdnUrl);
  const blockUrl: string = jsonManifest.files.find((url) =>
    url.indexOf('_inline') === -1
  )!;
  const inlineUrl: string = jsonManifest.files.find((url) =>
    url.indexOf('_inline') > -1
  )!;

  const markdownWasm = await fetchWasm(blockUrl);
  const inlineWasm = await fetchWasm(inlineUrl);

  const blockParser: Parser =
    (await createParser(markdownWasm)) as unknown as Parser;
  const inlineParser: Parser =
    (await createParser(inlineWasm)) as unknown as Parser;

  return {
    parse: (source: string): Array<Token> => {
      const tree: Tree | null = blockParser.parse(source);
      if (!tree) {
        throw new Error('Tree is null');
      }

      return treeToTokens(tree, inlineParser, source);
    },
  };
}
