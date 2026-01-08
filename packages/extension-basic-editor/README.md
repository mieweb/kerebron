# Kerebron basic editor extension

Set of basic editor extensions, marks and nodes

Features:

- bold, italic, image, hr...
- basic keymap
- cursors: drop and gap
- history

## Usage:

```js
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

this.editor = CoreEditor.create({
  element: htmlElement,
  editorKits: [
    new AdvancedEditorKit(),
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
