# Kerebron core editor

Core editor is basic agnostic. All you need is an HTML element.

## Usage

```js
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';

this.editor = CoreEditor.create({
  element: document.querySelector('div#editor'),
  editorKits: [
    new AdvancedEditorKit(),
  ],
});
```
