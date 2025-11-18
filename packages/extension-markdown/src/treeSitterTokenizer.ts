import { createParser } from '$deno_tree_sitter/main.js';
import type { Parser } from '$deno_tree_sitter/tree_sitter/parser.js';
import type { Tree } from '$deno_tree_sitter/tree_sitter/tree.js';
import {
  NESTING_CLOSING,
  NESTING_OPENING,
  NESTING_SELF_CLOSING,
  Token,
} from './types.ts';

function treeToTokens(tree: Tree, inlineParser: Parser): Array<Token> {
  const retVal: Array<Token> = [];
  let blockLevel = 0;

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
    blockToken.content = blockToken.children.map((c) => c.content || '').join(
      '',
    );
    retVal.push(blockToken);
  };

  const walkInline = (
    children: any[],
    startPosition = { row: 0, column: 0 },
  ) => {
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
        token.content = node.text ?? '';
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
            token.content = node.text ?? '';
            pushInlineNode(token, 'text');
            break;
          }
          break;

        case 'latex_block':
          {
            const delimiter = node.children
              .find((c) => c.type === 'latex_span_delimiter');

            const content = node.children
              .filter((c) => c.type !== 'latex_span_delimiter')
              .map((c) => c.text)
              .join('');

            if (delimiter?.text === '$$') {
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
          if (node.text === '\n') {
            const token = new Token('hardbreak', 'br', NESTING_SELF_CLOSING);
            token.map = map;
            token.content = node.text ?? '';
            pushInlineNode(token, 'whitespace \n');
            break;
          }
          if (node.text && node.text.match(/^\s+$/)) {
            const token = new Token('text', 'br', NESTING_SELF_CLOSING);
            token.map = map;
            token.meta = 'noEscText';
            token.content = node.text ?? '';
            pushInlineNode(token, 'whitespace space');
            break;
          }
          if (node.text.trim().length > 0) {
            const token = new Token('text', '', NESTING_SELF_CLOSING);
            token.map = map;
            token.meta = 'noEscText';
            token.content = node.text ?? '';
            pushInlineNode(token, 'whitespace other');
            break;
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
              .find((c) => c.type === 'link_destination');
            openToken.attrSet('href', destination?.text || '');

            const title = node.children
              .find((c) => c.type === 'link_title');
            if (title) {
              openToken.attrSet('title', title.text || '');
            }

            pushInlineNode(openToken, 'shortcut_link');

            node.children
              .filter((c) => c.type === 'link_text')
              .forEach((c) => {
                const token = new Token('text', '', NESTING_SELF_CLOSING);
                token.map = map;
                token.meta = 'noEscText';
                token.content = c.text ?? '';
                pushInlineNode(token, 'link_text');
              });

            // walkInline(node.children);

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
                token.content = c.text ?? '';
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
            const tokenName = 'strong';
            const tagName = 'strong';
            const openToken = new Token(
              tokenName + '_open',
              tagName,
              NESTING_OPENING,
            );
            pushInlineNode(openToken, 'strongem');

            walkInline(node.children);

            const closeToken = new Token(
              tokenName + '_close',
              tagName,
              NESTING_CLOSING,
            );
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

            walkInline(children);

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

            walkInline(node.children);

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

            walkInline(node.children);

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

            token.content = node.text;

            pushInlineNode(token, 'html_block');
          }
          break;
        default:
          console.debug('inline_node', node);
          throw new Error(`Unhandled inline node type: ${node.type}`);
      }
    }
  };

  const walkRecursive = (node?, ctx = { tableRowType: 'tbody' }) => {
    if (!node) {
      return;
    }

    if (node.type === 'inline') {
      const inlineText = node.text;
      if (!inlineText) {
        throw new Error('!inlineText');
      }
      const inlineTree = inlineParser.parse(inlineText);
      if (!inlineTree) {
        throw new Error('!inlineTree');
      }

      walkInline(inlineTree?.rootNode.children, node.startPosition);

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
        token.content = node.text ?? '';
        pushInlineNode(token, 'txt2');
        return;
      }
      if (node.type === 'whitespace') {
        if (blockLevel === 0) {
          return;
        }
        if (node.text.match(/^\n+$/)) {
          //   const token = new Token('hardbreak', 'br', NESTING_SELF_CLOSING);
          // token.map = [ +node.startPosition?.row, +node.endPosition?.row, +node.startPosition?.column, +node.endPosition?.column ];
          //   token.content = node.text ?? '';
          //   retVal.push(token);
          return;
        }

        if (node.text && node.text.match(/^\s+$/)) {
          const token = new Token('text', 'br', NESTING_SELF_CLOSING);
          token.map = [
            +node.startPosition?.row,
            +node.endPosition?.row,
            +node.startPosition?.column,
            +node.endPosition?.column,
          ];
          token.meta = 'noEscText';
          token.content = node.text ?? '';
          pushInlineNode(token, 'txt3');
          return;
        }
        if (node.text.trim().length > 0) {
          const token = new Token('text', '', NESTING_SELF_CLOSING);
          token.map = [
            +node.startPosition?.row,
            +node.endPosition?.row,
            +node.startPosition?.column,
            +node.endPosition?.column,
          ];
          token.meta = 'noEscText';
          token.content = node.text ?? '';
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
        node.children?.forEach((child) => walkRecursive(child, ctx));
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
          token.markup = node.text;
          retVal.push(token);
        }
        break;

      case 'atx_heading':
        {
          const tokenName = 'heading';

          const marker = node.children.find((child) =>
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
          openToken.markup = marker?.text || '#';
          retVal.push(openToken);

          const children = [...node.children];
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

          token.content = node.text || '';

          retVal.push(token);
        }
        break;

      case 'fenced_code_block':
        {
          const tokenName = 'fence';
          const tagName = 'pre';

          const info = node.children.find((child) =>
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
            token.info = info.text;
          }

          const children = [...node.children
            .filter((item) => item.type === 'code_fence_content')];

          const content = children.map((item) =>
            item.children
              .map((inline) => inline.text || '')
              .join('')
          ).join('');

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
          // TODO indent from first whitespace

          // const children = [...node.children
          // .filter((item) => item.type === 'code_fence_content')];

          const content = node.children.map((item) =>
            item.children
              .map((inline) => inline.text || '')
              .join('')
          ).join('');

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
            ?.filter((c) => c.type === 'pipe_table_cell')
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

          const headRows = node.children
            ?.filter((c) => c.type === 'pipe_table_header');
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
              walkRecursive(child, { ...ctx, tableRowType: 'thead' })
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
            ?.filter((c) => c.type === 'pipe_table_row');

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
            bodyRows.forEach((child) =>
              walkRecursive(child, { ...ctx, tableRowType: 'tbody' })
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
          const firstItem = node.children.find((item) =>
            item.type === 'list_item'
          );
          if (firstItem) {
            const taskListMarker = firstItem.children.find((item) =>
              item.type.startsWith('task_list_marker')
            );
            const listMarker = firstItem.children.find((item) =>
              item.type.startsWith('list_marker_dot')
            );
            if (taskListMarker) {
              tokenName = 'task_list';
              tagName = 'ul';
            } else if (listMarker) {
              tokenName = 'ordered_list';
              tagName = 'ol';
              start = listMarker.text.trim().replace('.', '');
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

      case 'list_item':
        {
          const taskListMarker = node.children.find((item) =>
            item.type.startsWith('task_list_marker_')
          );
          const listMarker = node.children.find((item) =>
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
          openToken.markup = listMarker.text.trim();

          if (listMarker.type === 'list_marker_dot') {
            // openToken.info = listMarker.text.trim().replace('.', '');
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
            node.children.find((item) => item.type === 'paragraph'),
            ctx,
          );
          walkRecursive(
            node.children.find((item) => item.type === 'list'),
            ctx,
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

      case 'html_block':
        {
          const token = new Token('html_block', '', NESTING_SELF_CLOSING);
          token.level = blockLevel;
          token.content = node.text ?? '';
          retVal.push(token);
        }
        break;

      case 'text':
        {
          const token = new Token('text', '', NESTING_SELF_CLOSING);
          token.level = blockLevel;
          token.content = node.text ?? '';
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
    }
  };

  walkRecursive(tree.rootNode);

  return retVal;
}

export async function sitterTokenizer() {
  const response = await fetch(
    '/wasm/tree-sitter-markdown/tree-sitter-markdown.wasm',
  );
  const markdownWasm = new Uint8Array(await response.arrayBuffer());

  const response2 = await fetch(
    '/wasm/tree-sitter-markdown/tree-sitter-markdown_inline.wasm',
  );
  const inlineWasm = new Uint8Array(await response2.arrayBuffer());

  const blockParser: Parser = await createParser(markdownWasm);
  const inlineParser: Parser = await createParser(inlineWasm);

  return {
    parse: (source: string): Array<Token> => {
      const tree: Tree = blockParser.parse(source);
      return treeToTokens(tree, inlineParser);
    },
  };
}
