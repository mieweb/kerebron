# Kerebron core editor

Core editor is basic agnostic. All you need is an HTML element.

## Usage

```js
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { ExtensionMenu } from '@kerebron/extension-menu/ExtensionMenu';

this.editor = CoreEditor.create({
  element: document.querySelector('div#editor'),
  editorKits: [
    new AdvancedEditorKit(),
  ],
});
```
