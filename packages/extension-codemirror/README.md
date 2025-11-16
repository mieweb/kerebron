# Codemirror extension for Kerebron editor kit

## Usage as a code only editor

```js
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import {
  ExtensionCodeMirror,
  NodeDocumentCode,
} from '@kerebron/extension-codemirror';

this.editor = new CoreEditor({
  topNode: 'doc_code',
  element: document.querySelector('div#editor'),
  extensions: [
    new ExtensionBasicEditor(),
    new NodeDocumentCode({ lang: 'yaml' }),
    new ExtensionCodeMirror({ languageWhitelist: ['yaml'] }),
  ],
});
```

```js
const buffer = new TextEncoder().encode(
  '# Multiline string with literal block syntax -preserved new lines\n' +
    'string1: |\n' +
    '   Line1\n' +
    '   line2\n' +
    '   "line3"\n' +
    '  line4\n',
);
this.editor.loadDocument('text/code-only', buffer);

const buffer = await this.editor.saveDocument('text/code-only');
const code = new TextDecoder().decode(buffer);
```
