import { assertEquals } from '@kerebron/test-utils';

import { MarkdownSerializer } from '@kerebron/extension-markdown/MarkdownSerializer';
import { sitterTokenizer } from '../src/treeSitterTokenizer.ts';
import { denoCdn } from '@kerebron/wasm/deno';

// import sampleMarkdown from './markdown-it.md' with { type: 'text' }; // --unstable-raw-imports
const __dirname = import.meta.dirname;
const sampleMarkdown = new TextDecoder().decode(
  Deno.readFileSync(__dirname + '/markdown-it.md'),
);

// Deno.test('md test 1', async () => {
//   const md = new MarkdownIt();
//   const markdownText = '# Hello, World!\nThis is a **test**.';
//   const html = md.render(markdownText);
//   console.log(html);
// });

// Deno.test('md test 2', async () => {
//   const md = new MarkdownIt({
//     html: true, // Allow HTML tags
//     breaks: true, // Convert newlines to <br>
//     linkify: true // Autoconvert URLs to links
//   });
//   const markdownText = '# Hello, World!\nThis is a **test**.\nhttp://example.com';
//   const html = md.render(markdownText);
//   console.log(html);
// });

// Deno.test('md test 3', async () => {
//   const md = new MarkdownIt();
//   const markdownText = '# Heading\nParagraph with **bold** text.';
//   const tokens = md.parse(markdownText, {});
//   const jsonOutput = JSON.stringify(tokens, null, 2);
//   console.log(jsonOutput);
// });

Deno.test('md test 4', async () => {
  // Example usage
  const markdownText = `# Heading
  This is a **bold** and *italic* paragraph with a [link](https://example.com).

  - List item 1
  - List item 2

  \`\`\`javascript
  console.log('Hello, World!');
  \`\`\``;

  const tokenizer = await sitterTokenizer(denoCdn());
  const tokens = tokenizer.parse(sampleMarkdown);

  Deno.writeTextFileSync(
    __dirname + '/markdown-it.tokens.json',
    JSON.stringify(tokens, null, 2),
  );

  const serializer = new MarkdownSerializer();
  const output = await serializer.serialize(tokens);
  const serializedMarkdown = output.toString();

  Deno.writeTextFileSync(
    __dirname + '/markdown-it.result.md',
    serializedMarkdown,
  );

  assertEquals(serializedMarkdown, sampleMarkdown);
});
