# Codemirror extension for Kerebron editor kit

## Usage as a code only editor

```js
import { CoreEditor } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor';
import {
  NodeCodeMirror,
  NodeDocumentCode,
} from '@kerebron/extension-codemirror';

this.editor = new CoreEditor({
  topNode: 'doc_code',
  element: document.querySelector('div#editor'),
  extensions: [
    new ExtensionBasicEditor(),
    new NodeDocumentCode({ lang: 'yaml' }),
    new NodeCodeMirror({ languageWhitelist: ['yaml'] }),
  ],
});
```

```js
this.editor.setDocument(
  '# Multiline string with literal block syntax -preserved new lines\n' +
    'string1: |\n' +
    '   Line1\n' +
    '   line2\n' +
    '   "line3"\n' +
    '  line4\n',
  'text/code-only',
);

const code = this.editor.getDocument('text/code-only');
```
