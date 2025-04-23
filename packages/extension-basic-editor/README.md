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
this.editor.setDocument('# TEST \n\n1.  aaa\n2.  bbb', 'text/x-markdown');
```

```js
const markdown = this.editor.getDocument('text/x-markdown');
```
