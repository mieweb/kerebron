import * as path from '@std/path';
import { xmlStylePreview } from 'https://deno.land/x/deno_tree_sitter@0.2.8.6/main.js';

// import { parseMarkdown } from '../../../tree-sitter/md-to-html-incremental.ts';
import { type Point as TsPoint, type SyntaxNode, type Tree } from 'tree-sitter';
import { WSContext, WSEvents, WSMessageReceive } from 'hono/ws';

// md-to-html-incremental.ts
import { createParser } from 'https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js';

const __dirname = import.meta.dirname!;

async function loadWasm(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch WASM: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Load Markdown grammars (block and inline)
const markdownWasm = await Deno.readFile(
  path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'wasm',
    'files',
    'tree-sitter-markdown',
    'tree-sitter-markdown.wasm',
  ),
);
const inlineWasm = await Deno.readFile(
  path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'packages',
    'wasm',
    'files',
    'tree-sitter-markdown',
    'tree-sitter-markdown_inline.wasm',
  ),
);

const BlockParser = await createParser(markdownWasm);
const InlineParser = await createParser(inlineWasm);

function parseMarkdown(source: string, oldTree?: any) {
  let tree;
  if (false && oldTree) {
    tree = BlockParser.parse(source, oldTree); // Incremental parse
  } else {
    tree = BlockParser.parse(source); // Full parse
  }
  const root = tree.rootNode;

  // Traverse and parse inline nodes (they contain raw text initially)
  // For simplicity, we re-parse inlines fully; optimize if needed by tracking changes
  function parseInlines(node: any): void {
    if (node.type === 'inline') {
      const inlineText = source.slice(node.startIndex, node.endIndex);
      const inlineTree = InlineParser.parse(inlineText);
      // Replace the inline node's content with the parsed inline tree
      node.children = [inlineTree.rootNode];
    } else {
      for (const child of node.children) {
        parseInlines(child);
      }
    }
  }
  parseInlines(root);

  console.log(
    'parseMarkdown.xmlStylePreview:\n',
    xmlStylePreview(root, { alwaysShowTextAttr: true }),
  );

  // const jsonPreview = typeof root.toJSON === "function" ? root.toJSON() : root;
  // console.log("JSON Tree Preview:\n", JSON.stringify(jsonPreview, null, 2));

  return tree;
}

interface JsonRpcRequest<T> {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: T;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification<T> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

interface InitializeParams {
  processId: number | null;
  rootUri: string | null;
  capabilities: unknown;
}

interface InitializeResult {
  capabilities: {
    textDocumentSync: number;
    completionProvider: {
      triggerCharacters: string[];
      resolveProvider: boolean;
    };
    hoverProvider: boolean;
  };
}

interface DidOpenParams {
  textDocument: {
    uri: string;
    languageId: string;
    version: number;
    text: string;
  };
}

interface DidChangeParams {
  textDocument: { uri: string; version: number };
  contentChanges: { text: string }[];
}

interface CompletionParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
  context?: unknown;
}

interface HoverParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
}

interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  insertText?: string;
  sortText?: string;
  documentation?: { kind: 'markdown'; value: string };
}

interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

interface HoverResult {
  contents: { kind: 'markdown'; value: string };
  range?: LspRange;
}

interface Document {
  uri: string;
  text: string;
  version: number;
}

type LspPosition = { line: number; character: number };
type LspRange = { start: LspPosition; end: LspPosition };

interface Diagnostic {
  range: LspRange;
  severity?: number;
  source?: string;
  message: string;
}

interface PublishDiagnosticsParams {
  uri: string;
  diagnostics: Diagnostic[];
}

interface DocumentState extends Document {
  languageId: string;
  tree: Tree | null;
  lineOffsets: number[];
}

const COMPLETION_SNIPPETS: Array<{
  label: string;
  insertText: string;
  detail: string;
}> = [
  { label: '# Heading 1', insertText: '# ', detail: 'Heading level 1' },
  { label: '## Heading 2', insertText: '## ', detail: 'Heading level 2' },
  { label: '### Heading 3', insertText: '### ', detail: 'Heading level 3' },
  { label: '- List item', insertText: '- ', detail: 'Bullet list item' },
  { label: '* List item', insertText: '* ', detail: 'Bullet list item' },
  { label: '1. Ordered list', insertText: '1. ', detail: 'Ordered list item' },
  {
    label: '``` code block',
    insertText: '```language\n$0\n```',
    detail: 'Fenced code block',
  },
  { label: '**bold**', insertText: '**bold**', detail: 'Bold emphasis' },
  { label: '*italic*', insertText: '*italic*', detail: 'Italic emphasis' },
  { label: '`inline code`', insertText: '`code`', detail: 'Inline code' },
  { label: '[link](url)', insertText: '[text](url)', detail: 'Inline link' },
  { label: '![image](url)', insertText: '![alt](url)', detail: 'Image' },
];

const CODE_LANG_COMPLETIONS = [
  'bash',
  'c',
  'cpp',
  'css',
  'html',
  'java',
  'javascript',
  'json',
  'markdown',
  'python',
  'rust',
  'typescript',
  'yaml',
];

export class LspWsAdapter {
  private documents: Map<string, DocumentState> = new Map();
  // Removed Parser/Markdown in favor of md-to-html-incremental.parseMarkdown

  async handleRequest(
    ws: WebSocket,
    id: number | string | null,
    method: string,
    params: unknown,
  ) {
    let result: unknown = null;
    let error: { code: number; message: string } | undefined;

    try {
      switch (method) {
        case 'initialize':
          result = this.handleInitialize();
          break;

        case 'textDocument/completion': {
          const compParams = params as CompletionParams;
          result = await this.handleCompletion(compParams);
          break;
        }

        case 'textDocument/hover': {
          const hoverParams = params as HoverParams;
          result = await this.handleHover(hoverParams);
          break;
        }

        case 'shutdown':
          result = null;
          break;

        case 'workspace/configuration':
          console.log('workspace/configuration', params);
          break;

        default:
          error = { code: -32601, message: 'Method not found' };
      }
    } catch (e) {
      error = {
        code: -32603,
        message: e instanceof Error ? e.message : 'Internal error',
      };
    }

    const response: JsonRpcResponse<unknown> = {
      jsonrpc: '2.0',
      id: id ?? 0,
      result,
      error,
    };
    ws.send(JSON.stringify(response));
  }

  async handleNotification(ws: WebSocket, method: string, params: unknown) {
    try {
      switch (method) {
        case 'initialized':
          break;

        case 'textDocument/didOpen': {
          const openParams = params as DidOpenParams;
          await this.onDidOpen(ws, openParams);
          break;
        }

        case 'textDocument/didChange': {
          const changeParams = params as DidChangeParams;
          await this.onDidChange(ws, changeParams);
          break;
        }

        case 'textDocument/didClose': {
          const { textDocument } = params as { textDocument: { uri: string } };
          this.documents.delete(textDocument.uri);
          this.sendNotification(ws, 'textDocument/publishDiagnostics', {
            uri: textDocument.uri,
            diagnostics: [],
          });
          break;
        }

        case 'exit':
          ws.close();
          break;

        default:
          break;
      }
    } catch (e) {
      console.error(
        `Notification error: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  upgradeWebSocket(): WSEvents<WebSocket> {
    return {
      onOpen: (_evt: Event, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }
      },
      onError: (error, _wsContext: WSContext<WebSocket>) => {
        console.warn(new Error('LspWsAdapter.onError', { cause: error }));
      },
      onMessage: (
        message: MessageEvent<WSMessageReceive>,
        wsContext: WSContext<WebSocket>,
      ) => {
        if (!wsContext.raw) {
          return;
        }
        if (typeof message.data === 'string') {
          this.receiveMessage(message.data, wsContext.raw);
        }
      },
      onClose: (_event, wsContext: WSContext<WebSocket>) => {
        if (!wsContext.raw) {
          return;
        }
        this.documents.clear();
        console.log('Connection closed');
      },
    };
  }

  async receiveMessage(data: string, ws: WebSocket) {
    try {
      const parsed: JsonRpcRequest<unknown> | JsonRpcNotification<unknown> =
        JSON.parse(data);
      if ('id' in parsed && parsed.id !== null) {
        await this.handleRequest(ws, parsed.id, parsed.method, parsed.params);
      } else {
        await this.handleNotification(ws, parsed.method, parsed.params);
      }
    } catch (e) {
      console.error(e, data);
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' },
        }),
      );
    }
  }

  private handleInitialize(): InitializeResult {
    return {
      capabilities: {
        textDocumentSync: 1,
        completionProvider: {
          triggerCharacters: ['#', '-', '*', '`', '[', '!'],
          resolveProvider: false,
        },
        hoverProvider: true,
      },
    };
  }

  private async handleCompletion(
    params: CompletionParams,
  ): Promise<CompletionList> {
    const doc = this.documents.get(params.textDocument.uri);
    if (!doc) {
      throw new Error('Document not open');
    }

    const items = this.computeCompletions(doc, params.position);
    return {
      isIncomplete: false,
      items,
    };
  }

  private async handleHover(params: HoverParams): Promise<HoverResult | null> {
    const doc = this.documents.get(params.textDocument.uri);
    if (!doc) {
      throw new Error('Document not open');
    }

    const hover = this.computeHover(doc, params.position);
    return hover;
  }

  private async onDidOpen(ws: WebSocket, params: DidOpenParams) {
    const { textDocument } = params;
    const doc = await this.refreshDocument(
      textDocument.uri,
      textDocument.text,
      textDocument.version,
      textDocument.languageId,
    );
    const diagnostics = this.computeDiagnostics(doc);
    this.publishDiagnostics(ws, textDocument.uri, diagnostics);
  }

  private async onDidChange(ws: WebSocket, params: DidChangeParams) {
    const { textDocument, contentChanges } = params;
    const change = contentChanges[0];
    if (!change) {
      return;
    }
    const existing = this.documents.get(textDocument.uri);
    const languageId = existing?.languageId ?? 'markdown';
    const doc = await this.refreshDocument(
      textDocument.uri,
      change.text,
      textDocument.version,
      languageId,
    );
    const diagnostics = this.computeDiagnostics(doc);
    this.publishDiagnostics(ws, textDocument.uri, diagnostics);
  }

  private publishDiagnostics(
    ws: WebSocket,
    uri: string,
    diagnostics: Diagnostic[],
  ) {
    const notification: JsonRpcNotification<PublishDiagnosticsParams> = {
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri,
        diagnostics,
      },
    };
    ws.send(JSON.stringify(notification));
  }

  private sendNotification(ws: WebSocket, method: string, params: unknown) {
    const notification: JsonRpcNotification<unknown> = {
      jsonrpc: '2.0',
      method,
      params,
    };
    ws.send(JSON.stringify(notification));
  }

  private async refreshDocument(
    uri: string,
    text: string,
    version: number,
    languageId: string,
  ): Promise<DocumentState> {
    let doc = this.documents.get(uri);
    if (!doc) {
      doc = {
        uri,
        text,
        version,
        languageId,
        tree: null,
        lineOffsets: [],
      };
    }
    doc.text = text;
    doc.version = version;
    doc.languageId = languageId;
    doc.lineOffsets = this.computeLineOffsets(text);
    doc.tree = parseMarkdown(text, doc.tree ?? undefined);
    this.documents.set(uri, doc);
    return doc;
  }

  // Removed ensureParser: using md-to-html-incremental.parseMarkdown for parsing

  private computeCompletions(
    doc: DocumentState,
    position: LspPosition,
  ): CompletionItem[] {
    const lineText = this.getLineText(doc, position.line);
    const beforeCursor = lineText.slice(0, position.character);
    const isAtLineStart = /^\s*$/.test(beforeCursor);
    const node = this.getNodeAtPosition(doc, position);
    const insideCodeBlock = this.nodeIsWithin(node, 'fenced_code_block');
    const insideInfoString = node?.type === 'info_string' ||
      node?.parent?.type === 'info_string';

    const items: CompletionItem[] = [];
    const push = (item: CompletionItem) => {
      if (!items.some((existing) => existing.label === item.label)) {
        items.push(item);
      }
    };

    if (insideInfoString) {
      CODE_LANG_COMPLETIONS.forEach((lang, index) => {
        push({
          label: lang,
          kind: 14,
          detail: 'Code fence language',
          insertText: lang,
          sortText: `0${index.toString().padStart(2, '0')}`,
        });
      });
    } else if (insideCodeBlock) {
      push({
        label: 'Insert snippet placeholder',
        kind: 15,
        detail: 'Insert snippet placeholder',
        insertText: '${0}',
      });
    } else {
      if (isAtLineStart) {
        COMPLETION_SNIPPETS.slice(0, 6).forEach((snippet, index) => {
          push({
            label: snippet.label,
            kind: 15,
            detail: snippet.detail,
            insertText: snippet.insertText,
            sortText: `1${index.toString().padStart(2, '0')}`,
          });
        });
      }

      COMPLETION_SNIPPETS.slice(6).forEach((snippet, index) => {
        push({
          label: snippet.label,
          kind: 15,
          detail: snippet.detail,
          insertText: snippet.insertText,
          sortText: `2${index.toString().padStart(2, '0')}`,
          documentation: {
            kind: 'markdown',
            value: `\`\`\`markdown\n${snippet.insertText}\n\`\`\``,
          },
        });
      });

      if (/\[([^[\]]{0,20})$/.test(beforeCursor)) {
        push({
          label: 'Complete link',
          kind: 15,
          detail: 'Complete markdown link',
          insertText: '](url)',
          sortText: '099',
          documentation: {
            kind: 'markdown',
            value: 'Completes a markdown link destination.',
          },
        });
      }
    }

    return items;
  }

  private computeHover(
    doc: DocumentState,
    position: LspPosition,
  ): HoverResult | null {
    const node = this.getNodeAtPosition(doc, position);
    if (!node) {
      return null;
    }

    const semanticNode = this.findSemanticNode(node);
    if (!semanticNode) {
      return null;
    }

    const hoverText = this.buildHoverText(doc, semanticNode);
    if (!hoverText) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: hoverText,
      },
      range: this.rangeFromNode(semanticNode),
    };
  }

  private computeDiagnostics(doc: DocumentState): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const tree = doc.tree;
    if (!tree) {
      return diagnostics;
    }

    const collect = (node: SyntaxNode) => {
      // console.log('diag', node.type);

      switch (node.type) {
        case 'atx_heading': {
          const text = this.extractText(doc, node).replace(/^#+\s*/, '').trim();
          if (text.length === 0) {
            diagnostics.push({
              range: this.rangeFromNode(node),
              severity: 2,
              source: 'markdown-lsp',
              message: 'Heading should contain descriptive text.',
            });
          }
          break;
        }

        case 'fenced_code_block': {
          const text = this.extractText(doc, node);
          const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
          if (lines.length >= 2) {
            const first = lines[0];
            const last = lines[lines.length - 1];
            const fenceMatch = first.match(/^(`{3,}|~{3,})/);
            if (fenceMatch) {
              const fenceChar = fenceMatch[0][0];
              const fenceLength = fenceMatch[0].length;
              const closingMatch = last.match(/^(`{3,}|~{3,})/);
              if (
                !closingMatch ||
                closingMatch[0][0] !== fenceChar ||
                closingMatch[0].length < fenceLength
              ) {
                diagnostics.push({
                  range: this.rangeFromNode(node),
                  severity: 2,
                  source: 'markdown-lsp',
                  message:
                    'Code fence closing delimiter should match the opening fence.',
                });
              }
            }
          }
          break;
        }

        case 'link': {
          const raw = this.extractText(doc, node);
          const match = raw.match(/^\[([^\]]*)\]\(([^)]*)\)/);
          if (match) {
            const [, , destination] = match;
            if (!destination || destination.trim().length === 0) {
              diagnostics.push({
                range: this.rangeFromNode(node),
                severity: 2,
                source: 'markdown-lsp',
                message: 'Link destination should not be empty.',
              });
            }
          }
          break;
        }

        default:
          break;
      }

      if (node.namedChildren) {
        node.namedChildren.forEach(collect);
      }
      if (node.children) {
        node.children.forEach(collect);
      }
    };

    collect(tree.rootNode);
    return diagnostics;
  }

  private getNodeAtPosition(
    doc: DocumentState,
    position: LspPosition,
  ): SyntaxNode | null {
    const tree = doc.tree;
    if (!tree) {
      return null;
    }
    const point: TsPoint = { row: position.line, column: position.character };
    return tree.rootNode.descendantForPosition(point, point);
  }

  private nodeIsWithin(node: SyntaxNode | null, type: string): boolean {
    let current: SyntaxNode | null = node;
    while (current) {
      if (current.type === type) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private findSemanticNode(node: SyntaxNode): SyntaxNode | null {
    const interesting = new Set([
      'atx_heading',
      'fenced_code_block',
      'link',
      'image',
      'emphasis',
      'strong_emphasis',
      'inline_code',
      'list_item',
      'block_quote',
    ]);
    let current: SyntaxNode | null = node;
    while (current) {
      if (interesting.has(current.type)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private buildHoverText(doc: DocumentState, node: SyntaxNode): string | null {
    switch (node.type) {
      case 'atx_heading': {
        const raw = this.extractText(doc, node).trim();
        const level = raw.match(/^#+/)?.[0].length ?? 1;
        const title = raw.replace(/^#+\s*/, '') || '<empty heading>';
        return `**Heading (level ${level})**\n\n${title}`;
      }

      case 'fenced_code_block': {
        const info = node.childForFieldName?.('info') ?? null;
        const infoText = info ? this.extractText(doc, info).trim() : '';
        const language = infoText.split(/\s+/)[0] || 'plaintext';
        return `**Code block**\n\nLanguage: \`${language}\``;
      }

      case 'link': {
        const raw = this.extractText(doc, node).trim();
        const match = raw.match(/^\[([^\]]*)\]\(([^)]*)\)/);
        if (!match) {
          return null;
        }
        const [, text, destination] = match;
        return `**Link**\n\n- Text: ${text || '_<empty>_'}\n- Destination: ${
          destination || '_<empty>_'
        }`;
      }

      case 'image': {
        const raw = this.extractText(doc, node).trim();
        const match = raw.match(/^!\[([^\]]*)\]\(([^)]*)\)/);
        if (!match) {
          return null;
        }
        const [, alt, destination] = match;
        return `**Image**\n\n- Alt text: ${alt || '_<empty>_'}\n- Source: ${
          destination || '_<empty>_'
        }`;
      }

      case 'inline_code':
        return `**Inline code**\n\n\`${this.extractText(doc, node)}\``;

      case 'emphasis':
        return `**Emphasis**\n\n${this.extractText(doc, node)}`;

      case 'strong_emphasis':
        return `**Strong emphasis**\n\n${this.extractText(doc, node)}`;

      case 'list_item': {
        const text = this.extractText(doc, node).trim();
        return `**List item**\n\n${text}`;
      }

      case 'block_quote': {
        const text = this.extractText(doc, node).trim();
        return `**Block quote**\n\n${text}`;
      }

      default:
        return null;
    }
  }

  private rangeFromNode(node: SyntaxNode): LspRange {
    return {
      start: this.toLspPosition(node.startPosition),
      end: this.toLspPosition(node.endPosition),
    };
  }

  private extractText(doc: DocumentState, node: SyntaxNode): string {
    const start = this.offsetForPoint(doc, node.startPosition);
    const end = this.offsetForPoint(doc, node.endPosition);
    return doc.text.slice(start, end);
  }

  private offsetForPoint(doc: DocumentState, point: TsPoint): number {
    const lineOffset = doc.lineOffsets[point.row] ?? doc.text.length;
    return Math.min(lineOffset + point.column, doc.text.length);
  }

  private toLspPosition(point: TsPoint): LspPosition {
    return { line: point.row, character: point.column };
  }

  private getLineText(doc: DocumentState, line: number): string {
    if (line < 0 || line >= doc.lineOffsets.length) {
      return '';
    }
    const start = doc.lineOffsets[line];
    const end = line + 1 < doc.lineOffsets.length
      ? doc.lineOffsets[line + 1]
      : doc.text.length;
    return doc.text.slice(start, end).replace(/\r?\n$/, '');
  }

  private computeLineOffsets(text: string): number[] {
    const offsets = [0];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '\n') {
        offsets.push(i + 1);
      }
    }
    return offsets;
  }
}
