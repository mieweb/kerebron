// md-to-prosemirror.ts
import { createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js";

async function loadWasm(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch WASM: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Load Markdown grammars (block and inline)
const markdownWasmUrl = "https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases/download/v0.5.0/tree-sitter-markdown.wasm";
const inlineWasmUrl = "https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases/download/v0.5.0/tree-sitter-markdown_inline.wasm";

const markdownWasm = await loadWasm(markdownWasmUrl);
const inlineWasm = await loadWasm(inlineWasmUrl);

const BlockParser = await createParser(markdownWasm);
const InlineParser = await createParser(inlineWasm);

// Two-pass parse: blocks first, then inline within blocks
function parseMarkdown(source: string, oldTree?: any) {
  let tree;
  if (oldTree) {
    tree = BlockParser.parse(source, oldTree); // Incremental parse
  } else {
    tree = BlockParser.parse(source); // Full parse
  }
  const root = tree.rootNode;

  // Traverse and parse inline nodes
  function parseInlines(node: any): void {
    if (node.type === "inline") {
      const inlineText = source.slice(node.startIndex, node.endIndex);
      const inlineTree = InlineParser.parse(inlineText);
      node.children = [inlineTree.rootNode];
    } else {
      for (const child of node.children) {
        parseInlines(child);
      }
    }
  }
  parseInlines(root);
  return tree;
}

// Transform Tree-sitter AST to ProseMirror JSON
function toProseMirrorJSON(node: any, source: string): any {
  if (!node.children || node.children.length === 0) {
    if (node.type === "text") {
      return { type: "text", text: node.text ?? "" };
    }
    // Log unhandled leaf nodes for debugging
    console.warn(`Unhandled leaf node type: ${node.type}`);
    return null;
  }

  switch (node.type) {
    case "document": {
      const content = node.children
        .map((child: any) => toProseMirrorJSON(child, source))
        .filter((node: any) => node !== null);
      return { type: "doc", content };
    }

    case "atx_h1_marker": {
      const levelNode = node.children.find((c: any) => c.type === "pound");
      const level = levelNode ? levelNode.childCount : 1;
      const contentNode = node.children.find((c: any) => c.type === "inline");
      let content: any[] = [];
      if (contentNode) {
        const inlineResult = toProseMirrorJSON(contentNode, source);
        // Handle case where inlineResult is null or lacks content
        content = (inlineResult && inlineResult.content) || [];
      }
      return { type: "heading", attrs: { level }, content };
    }

    case "paragraph": {
      const contentNode = node.firstChild; // Should be 'inline'
      let content: any[] = [];
      if (contentNode) {
        const inlineResult = toProseMirrorJSON(contentNode, source);
        content = (inlineResult && inlineResult.content) || [];
      }
      return { type: "paragraph", content };
    }

    case "list": {
      const items = node.children
        .filter((c: any) => c.type === "list_item")
        .map((item: any) => toProseMirrorJSON(item, source))
        .filter((node: any) => node !== null);
      return { type: "bullet_list", content: items };
    }

    case "list_item": {
      const contentNode = node.lastChild;
      let content: any[] = [];
      if (contentNode) {
        const contentResult = toProseMirrorJSON(contentNode, source);
        content = (contentResult && contentResult.content) || [];
      }
      return { type: "list_item", content };
    }

    case "inline": {
      const content = node.children
        .map((child: any) => toProseMirrorJSON(child, source))
        .filter((node: any) => node !== null);
      // Return a paragraph-like structure for inline content
      return content.length > 0 ? { type: "paragraph", content } : null;
    }

    case "strong": {
      const content = node.children
        .map((child: any) => toProseMirrorJSON(child, source))
        .filter((node: any) => node !== null);
      if (content.length === 1 && content[0].type === "text") {
        return { ...content[0], marks: [{ type: "strong" }] };
      }
      console.warn(`Unhandled strong node structure: ${JSON.stringify(content)}`);
      return null;
    }

    case "emphasis": {
      const content = node.children
        .map((child: any) => toProseMirrorJSON(child, source))
        .filter((node: any) => node !== null);
      if (content.length === 1 && content[0].type === "text") {
        return { ...content[0], marks: [{ type: "em" }] };
      }
      console.warn(`Unhandled emphasis node structure: ${JSON.stringify(content)}`);
      return null;
    }

    case "text":
      return { type: "text", text: node.text ?? "" };

    default:
      // Log unhandled node types for debugging
      console.warn(`Unhandled node type: ${node.type}, children: ${node.children.map((c: any) => c.type).join(", ")}`);
      return node.children
        .map((child: any) => toProseMirrorJSON(child, source))
        .filter((node: any) => node !== null)[0] || null;
  }
}

// Example: Incremental usage
let currentSource = `
# Initial Heading

Initial paragraph with **bold** text.
- Item 1
- Item 2 with *italic* text
`;

// Initial full parse
let currentTree = parseMarkdown(currentSource);
console.log("Initial ProseMirror JSON:");
console.log(JSON.stringify(toProseMirrorJSON(currentTree.rootNode, currentSource), null, 2));

// Simulate a change: Insert "Updated " at byte index 20 (after "Initial " in heading)
const insertStartByte = 20;
const insertEndByte = 20;
const insertedLength = "Updated ".length;

// Apply edit to old tree
currentTree.edit({
  startIndex: insertStartByte,
  oldEndIndex: insertEndByte,
  newEndIndex: insertStartByte + insertedLength,
  startPosition: { row: 1, column: 9 },
  oldEndPosition: { row: 1, column: 9 },
  newEndPosition: { row: 1, column: 9 + insertedLength },
});

// New source after change
currentSource = currentSource.slice(0, insertStartByte) + "Updated " + currentSource.slice(insertEndByte);

// Incremental parse using edited old tree
currentTree = parseMarkdown(currentSource, currentTree);
console.log("\nUpdated ProseMirror JSON:");
console.log(JSON.stringify(toProseMirrorJSON(currentTree.rootNode, currentSource), null, 2));
