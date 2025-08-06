# Kerebron basic editor extension

Set of basic editor extensions, marks and nodes

Features:

- bold, italic, image, hr...
- basic keymap
- cursors: drop and gap
- history

## Usage:

```js
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';

this.editor = new CoreEditor({
  element: htmlElement,
  extensions: [
    new ExtensionBasicEditor(),
  ],
});
```

```js
const buffer = new TextEncoder().encode('# TEST \n\n1.  aaa\n2.  bbb');
await this.editor.loadDocument('text/x-markdown', buffer);
```

```js
const buffer = await this.editor.saveDocument('text/x-markdown');
const markdown = new TextDecoder().decode(buffer);
```
