# Getting Started with Vanilla JavaScript/TypeScript

This guide shows you how to integrate Kerebron into a vanilla JavaScript or TypeScript project without any framework.

## Quick Try (No Installation)

Want to try Kerebron immediately? Use a CDN:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kerebron Editor</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/extension-menu/assets/custom-menu.css">
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 20px auto;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <h1>Kerebron Editor</h1>
  <div id="editor" class="kb-component"></div>

  <script type="module">
    import { CoreEditor } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor/+esm';
    import { AdvancedEditorKit } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor-kits/+esm';

    const editor = new CoreEditor({
      element: document.querySelector('#editor'),
      extensions: [new AdvancedEditorKit()],
    });

    const content = '# Hello World\n\nThis is **bold** and this is *italic*.';
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  </script>
</body>
</html>
```

Save this as `index.html` and open in your browser!

---

## Installation (For Production)

For production projects, install via npm:

```bash
npm install @kerebron/editor @kerebron/extension-basic-editor @kerebron/extension-menu @kerebron/extension-markdown
```

### Optional Extensions

```bash
npm install @kerebron/extension-tables      # Table support
npm install @kerebron/extension-codemirror  # Code blocks with syntax highlighting
npm install @kerebron/editor-kits           # Pre-configured extension bundles
```

## Basic Setup

### HTML Structure

Create your HTML file with a container for the editor:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kerebron Editor</title>
  
  <!-- Import CSS -->
  <link rel="stylesheet" href="node_modules/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="node_modules/@kerebron/extension-menu/assets/custom-menu.css">
  <link rel="stylesheet" href="node_modules/@kerebron/extension-tables/assets/tables.css">
</head>
<body>
  <div id="editor" class="kb-component"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

### JavaScript/TypeScript

Create `main.js` (or `main.ts` if using TypeScript):

```typescript
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionMenu } from '@kerebron/extension-menu';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionTables } from '@kerebron/extension-tables';

// Get the container element
const editorElement = document.querySelector('#editor');

// Create the editor with individual extensions
const editor = new CoreEditor({
  element: editorElement,
  extensions: [
    new ExtensionBasicEditor(),  // Bold, italic, lists, etc.
    new ExtensionMenu(),          // Toolbar menu
    new ExtensionMarkdown(),      // Markdown import/export
    new ExtensionTables(),        // Table support
  ],
});

// Load initial content
const content = '# Hello World\n\nThis is **bold** and this is *italic*.';
const buffer = new TextEncoder().encode(content);
await editor.loadDocument('text/x-markdown', buffer);

// Listen for changes
editor.addEventListener('transaction', async (event) => {
  const buffer = await editor.saveDocument('text/x-markdown');
  const markdown = new TextDecoder().decode(buffer);
  console.log('Current content:', markdown);
});
```

## Using Editor Kits (Recommended)

Instead of adding extensions individually, use pre-configured kits:

```typescript
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editor = new CoreEditor({
  element: document.querySelector('#editor'),
  extensions: [
    new AdvancedEditorKit(),  // Includes all common extensions
  ],
});

// Load content
const content = '# Getting Started\n\nStart editing!';
const buffer = new TextEncoder().encode(content);
await editor.loadDocument('text/x-markdown', buffer);
```

## Complete Example with UI

Here's a more complete example with buttons for loading and saving:

### Using CDN

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kerebron Editor</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/extension-menu/assets/custom-menu.css">
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .toolbar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
    button {
      padding: 8px 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>My Kerebron Editor</h1>
  
  <div class="toolbar">
    <button id="load-sample">Load Sample</button>
    <button id="load-file">Load File</button>
    <button id="save-markdown">Save as Markdown</button>
  </div>
  
  <div id="editor" class="kb-component"></div>
  
  <script type="module">
    import { CoreEditor } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor/+esm';
    import { AdvancedEditorKit } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor-kits/+esm';

    const editor = new CoreEditor({
      element: document.querySelector('#editor'),
      extensions: [new AdvancedEditorKit()],
    });

    // Load sample content
    document.querySelector('#load-sample').addEventListener('click', async () => {
      const content = `# Sample Document

This is a **sample** document with:

1. Bold and *italic* text
2. Lists
3. Code blocks

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## Tables

| Feature | Status |
|---------|--------|
| Tables  | ✓      |
| Code    | ✓      |
`;

      const buffer = new TextEncoder().encode(content);
      await editor.loadDocument('text/x-markdown', buffer);
    });

    // Load file from disk
    document.querySelector('#load-file').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.html';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await editor.loadDocument(file.type || 'text/x-markdown', uint8Array);
      };
      
      input.click();
    });

    // Save as markdown
    document.querySelector('#save-markdown').addEventListener('click', async () => {
      const buffer = await editor.saveDocument('text/x-markdown');
      const markdown = new TextDecoder().decode(buffer);
      
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.md';
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>
```

### Using NPM (with bundler)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kerebron Editor</title>
  <link rel="stylesheet" href="node_modules/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="node_modules/@kerebron/extension-menu/assets/custom-menu.css">
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .toolbar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
    button {
      padding: 8px 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>My Kerebron Editor</h1>
  
  <div class="toolbar">
    <button id="load-sample">Load Sample</button>
    <button id="load-file">Load File</button>
    <button id="save-markdown">Save as Markdown</button>
  </div>
  
  <div id="editor" class="kb-component"></div>
  
  <script type="module" src="./main.js"></script>
</body>
</html>
```

```javascript
// main.js
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editor = new CoreEditor({
  element: document.querySelector('#editor'),
  extensions: [new AdvancedEditorKit()],
});

// Load sample content
document.querySelector('#load-sample').addEventListener('click', async () => {
  const content = `# Sample Document

This is a **sample** document with:

1. Bold and *italic* text
2. Lists
3. Code blocks

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## Tables

| Feature | Status |
|---------|--------|
| Tables  | ✓      |
| Code    | ✓      |
`;

  const buffer = new TextEncoder().encode(content);
  await editor.loadDocument('text/x-markdown', buffer);
});

// Load file from disk
document.querySelector('#load-file').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.odt,.docx,.html';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await editor.loadDocument(file.type || 'text/x-markdown', uint8Array);
  };
  
  input.click();
});

// Save as markdown
document.querySelector('#save-markdown').addEventListener('click', async () => {
  const buffer = await editor.saveDocument('text/x-markdown');
  const markdown = new TextDecoder().decode(buffer);
  
  // Download the file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.md';
  a.click();
  URL.revokeObjectURL(url);
});

// Optional: Display markdown in console as you type
editor.addEventListener('transaction', async () => {
  const buffer = await editor.saveDocument('text/x-markdown');
  const markdown = new TextDecoder().decode(buffer);
  console.log('Current markdown:', markdown);
});
```

## Working with Different Document Formats

Kerebron supports multiple document formats:

```javascript
// Load markdown
const mdBuffer = new TextEncoder().encode('# Markdown');
await editor.loadDocument('text/x-markdown', mdBuffer);

// Load HTML
const htmlBuffer = new TextEncoder().encode('<h1>HTML</h1><p>Content</p>');
await editor.loadDocument('text/html', htmlBuffer);

// Load ODT (requires ExtensionOdt)
const response = await fetch('document.odt');
const odtBuffer = new Uint8Array(await response.arrayBuffer());
await editor.loadDocument('application/vnd.oasis.opendocument.text', odtBuffer);

// Save to different formats
const markdownBuffer = await editor.saveDocument('text/x-markdown');
const htmlBuffer = await editor.saveDocument('text/html');
```

## Module Bundlers

### Using with Vite

Create `vite.config.js`:

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@kerebron/editor', '@kerebron/extension-basic-editor'],
  },
});
```

### Using with Webpack

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
};
```

Then import CSS in your JavaScript:

```javascript
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';
```

## TypeScript Configuration

If using TypeScript, add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Next Steps

- **[Add Collaboration](./getting-started-collaboration.md)** - Enable real-time multi-user editing
- **[Add LSP Support](./getting-started-lsp.md)** - Get autocomplete and diagnostics
- **[Customize Menu](../packages/extension-menu/CUSTOM_MENU.md)** - Build a custom toolbar
- **[Check Examples](../examples/browser-vanilla-code-editor/)** - See a complete implementation

## Troubleshooting

### Editor Not Appearing

- Check that CSS files are imported
- Verify the element exists before creating the editor
- Check browser console for errors

### Module Import Errors

- Ensure you're using a module bundler (Vite, Webpack, etc.) or native ES modules
- Check that `type="module"` is set on your script tag

### TypeScript Errors

- Install `@types/node` if needed: `npm install -D @types/node`
- Make sure `moduleResolution` is set correctly in `tsconfig.json`
