# Kerebron core editor

Core editor is basic agnostic. All you need is an HTML element.

## Usage

```js
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { ExtensionMenu } from '@kerebron/extension-menu';

this.editor = new CoreEditor({
  element: document.querySelector('div#editor'),
  extensions: [
    new ExtensionBasicEditor(),
    new ExtensionHistory(),
    new ExtensionMenu(),
  ],
});
```
