// md-to-html-incremental.ts
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
// Now supports optional oldTree for incremental parsing
function parseMarkdown(source: string, oldTree?: any) {
  let tree;
  if (oldTree) {
    tree = BlockParser.parse(source, oldTree); // Incremental parse
  } else {
    tree = BlockParser.parse(source); // Full parse
  }
  const root = tree.rootNode;

  // Traverse and parse inline nodes (they contain raw text initially)
  // For simplicity, we re-parse inlines fully; optimize if needed by tracking changes
  function parseInlines(node: any): void {
    if (node.type === "inline") {
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
  return tree;
}

// Recursive AST-to-HTML transformer (unchanged from previous example)
function toHTML(node: any, source: string): string {
  if (!node.children || node.children.length === 0) {
    // Leaf text node
    return node.text ?? "";
  }

  let html = "";
  switch (node.type) {
    case "document":
      return node.children.map((child: any) => toHTML(child, source)).join("\n");
    
    case "heading": {
      // Level from count of '#' children
      const levelNode = node.children.find((c: any) => c.type === "pound");
      const level = levelNode ? levelNode.childCount : 1;
      const contentNode = node.children.find((c: any) => c.type === "inline");
      const content = contentNode ? toHTML(contentNode, source) : "";
      return `<h${level}>${content}</h${level}>`;
    }
    
    case "paragraph": {
      const contentNode = node.firstChild; // Should be 'inline'
      const content = contentNode ? toHTML(contentNode, source) : "";
      return `<p>${content}</p>`;
    }
    
    case "list": {
      // Assume bullet list (ul); filter list_items
      const items = node.children.filter((c: any) => c.type === "list_item");
      const itemHtml = items.map((item: any) => {
        // Last child of list_item is usually the inline content (or paragraph)
        const content = item.lastChild ? toHTML(item.lastChild, source) : "";
        return `<li>${content}</li>`;
      }).join("");
      return `<ul>${itemHtml}</ul>`;
    }
    
    case "list_item": {
      // Handled in parent 'list'; recurse to content
      return node.children.map((child: any) => toHTML(child, source)).join("");
    }
    
    // Inline elements
    case "strong": {
      const content = node.firstChild ? toHTML(node.firstChild, source) : "";
      return `<strong>${content}</strong>`;
    }
    
    case "emphasis": {
      const content = node.firstChild ? toHTML(node.firstChild, source) : "";
      return `<em>${content}</em>`;
    }
    
    case "text":
      return node.text ?? "";
    
    default:
      // Fallback: recurse on children (e.g., for blockquotes, code blocks)
      return node.children.map((child: any) => toHTML(child, source)).join("");
  }
}

// Example: Incremental usage
let currentSource = `
# Initial Heading

Initial paragraph.
`;

// Initial full parse
let currentTree = parseMarkdown(currentSource);
console.log("Initial HTML:");
console.log(toHTML(currentTree.rootNode, currentSource));

// Simulate a change: Insert text at byte index 20-20 (after "Initial " in heading), adding "Updated "
const insertStartByte = 20; // Adjust based on actual change position (use UTF-8 byte indices)
const insertEndByte = 20;   // For insertion, start === end
const insertedLength = "Updated ".length; // Bytes added

// Apply edit to old tree (Tree-sitter uses byte indices, not char indices)
currentTree.edit({
  startIndex: insertStartByte,
  oldEndIndex: insertEndByte,
  newEndIndex: insertStartByte + insertedLength,
  startPosition: { row: 1, column: 9 }, // Optional: row/column for the start (0-indexed)
  oldEndPosition: { row: 1, column: 9 },
  newEndPosition: { row: 1, column: 9 + insertedLength },
});

// New source after change
currentSource = currentSource.slice(0, insertStartByte) + "Updated " + currentSource.slice(insertEndByte);

// Incremental parse using edited old tree
currentTree = parseMarkdown(currentSource, currentTree);
console.log("\nUpdated HTML:");
console.log(toHTML(currentTree.rootNode, currentSource));
