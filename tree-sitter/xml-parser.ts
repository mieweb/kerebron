import { createParser } from 'https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js';

async function loadWasm(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch WASM: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

const xmlWasmUrl =
  'https://github.com/tree-sitter-grammars/tree-sitter-xml/releases/download/v0.7.0/tree-sitter-xml.wasm';
const xmlWasm = await loadWasm(xmlWasmUrl);
const parser = await createParser(xmlWasm);

// Sample XML
const xmlSource = `
<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
  <book id="1">
    <title>Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>1984</title>
    <author>George Orwell</author>
    <price>9.99</price>
  </book>
</bookstore>
`.trim();

// Parse the XML
const tree = parser.parse(xmlSource)!;
const root = tree.rootNode;

// Helper to traverse and extract nodes
function findNodesByType(node: any, type: string, results: any[] = []): any[] {
  if (node.type === type) {
    results.push(node);
  }
  for (const child of node.children || []) {
    findNodesByType(child, type, results);
  }
  return results;
}

// Example: Find all <title> nodes and log their text
const titles = findNodesByType(root, 'element') // Filter for title elements
  .filter((el) => el.children?.[0]?.textContent?.includes('title')) // Rough tag name check
  .map((el) => el.children?.[1]?.textContent?.trim()); // Extract text content

console.log('Parsed XML Tree (S-Expression):', root.toString());
console.log('Book Titles:', titles); // Output: ['Great Gatsby', '1984']

// Pretty-print tree as XML-like (using built-in preview)
import { xmlStylePreview } from 'https://deno.land/x/deno_tree_sitter@0.2.8.6/main.js';
console.log(
  'XML-Style Tree Preview:\n',
  xmlStylePreview(root, { alwaysShowTextAttr: true }),
);

const jsonPreview = typeof root.toJSON === 'function' ? root.toJSON() : root;
console.log('JSON Tree Preview:\n', JSON.stringify(jsonPreview, null, 2));
