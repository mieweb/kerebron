# Quick Start

Get Kerebron running in under 5 minutes — no installation required!

## Try Without Installing (CDN)

The fastest way to try Kerebron is using a CDN. Just create an HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kerebron Editor</title>
  <!-- Import CSS from CDN -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kerebron/extension-menu/assets/custom-menu.css">
</head>
<body>
  <h1>Kerebron Editor Demo</h1>
  <div id="editor" class="kb-component"></div>

  <script type="module">
    import { CoreEditor } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor/+esm';
    import { AdvancedEditorKit } from 'https://cdn.jsdelivr.net/npm/@kerebron/editor-kits/+esm';

    const editor = new CoreEditor({
      element: document.querySelector('#editor'),
      extensions: [new AdvancedEditorKit()],
    });

    // Load initial content
    const content = '# Hello CDN!\n\nEdit this text. Try making it **bold** or *italic*.';
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  </script>
</body>
</html>
```

Open this file in your browser and start editing immediately!

### Try it Online

You can also try Kerebron on [CodePen](https://codepen.io), [JSFiddle](https://jsfiddle.net), or [StackBlitz](https://stackblitz.com) using the CDN approach above.

### Or Use Local Dev Server

If you have Kerebron cloned locally, you can use the dev server instead of the CDN:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kerebron - Local Dev</title>
  <link rel="stylesheet" href="http://localhost:8000/packages/editor/assets/index.css">
  <link rel="stylesheet" href="http://localhost:8000/packages/extension-menu/assets/custom-menu.css">
</head>
<body>
  <h1>Kerebron Editor (Local)</h1>
  <div id="editor" class="kb-component"></div>

  <script type="module">
    import { CoreEditor } from 'http://localhost:8000/packages/editor/src/index.ts';
    import { AdvancedEditorKit } from 'http://localhost:8000/packages/editor-kits/src/AdvancedEditorKit.ts';

    const editor = new CoreEditor({
      element: document.querySelector('#editor'),
      extensions: [new AdvancedEditorKit()],
    });

    const content = '# Local Dev!\n\nTesting local changes instantly.';
    const buffer = new TextEncoder().encode(content);
    await editor.loadDocument('text/x-markdown', buffer);
  </script>
</body>
</html>
```

Start the dev server first: `deno task -f examples/server-deno-hono start`

---

## Install with NPM

For production use, install via npm:

```bash
npm install @kerebron/editor @kerebron/extension-basic-editor @kerebron/extension-menu @kerebron/extension-markdown
```

## Vanilla JavaScript

### index.html

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@kerebron/editor/assets/index.css">
  <link rel="stylesheet" href="node_modules/@kerebron/extension-menu/assets/custom-menu.css">
</head>
<body>
  <div id="editor" class="kb-component"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

### main.js

```javascript
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editor = new CoreEditor({
  element: document.querySelector('#editor'),
  extensions: [new AdvancedEditorKit()],
});

// Load initial content
const content = '# Hello World\n\nStart editing!';
const buffer = new TextEncoder().encode(content);
await editor.loadDocument('text/x-markdown', buffer);
```

## React

```tsx
import { useEffect, useRef } from 'react';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import '@kerebron/editor/assets/index.css';
import '@kerebron/extension-menu/assets/custom-menu.css';

export default function MyEditor() {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new CoreEditor({
      element: editorRef.current,
      extensions: [new AdvancedEditorKit()],
    });

    const content = '# Hello World\n\nStart editing!';
    const buffer = new TextEncoder().encode(content);
    editor.loadDocument('text/x-markdown', buffer);

    return () => editor.destroy();
  }, []);

  return <div ref={editorRef} className="kb-component" />;
}
```

## Vue 3

```vue
<template>
  <div ref="editorRef" class="kb-component"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

const editorRef = ref(null);
let editor = null;

onMounted(async () => {
  editor = new CoreEditor({
    element: editorRef.value,
    extensions: [new AdvancedEditorKit()],
  });

  const content = '# Hello World\n\nStart editing!';
  const buffer = new TextEncoder().encode(content);
  await editor.loadDocument('text/x-markdown', buffer);
});

onUnmounted(() => editor?.destroy());
</script>

<style>
@import '@kerebron/editor/assets/index.css';
@import '@kerebron/extension-menu/assets/custom-menu.css';
</style>
```

## Next Steps

- **Full Guide**: See [Getting Started](./01-getting-started.md) for comprehensive documentation
- **Collaborative Editing**: Add Yjs for real-time collaboration
- **Advanced Features**: Explore LSP, tables, and code highlighting
- **Examples**: Check `examples/` directory for complete applications
