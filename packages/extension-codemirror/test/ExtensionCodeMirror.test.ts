import { AnyExtensionOrReq, CoreEditor } from '@kerebron/editor';
import { type JSONContent } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';

import { ExtensionCodeMirror } from '../src/ExtensionCodeMirror.ts';

Deno.test('test command setCodeBlock', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'paragraph',
        'content': [
          {
            'type': 'text',
            'text': 'Hello, world!',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtensionOrReq[] = [
    new ExtensionBasicEditor(),
    new ExtensionCodeMirror({}),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().setCodeBlock('javascript').run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command ArrowLeft', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'code_block',
        'content': [
          {
            'type': 'text',
            'text': 'Hello, world!',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtensionOrReq[] = [
    new ExtensionBasicEditor(),
    new ExtensionCodeMirror({}),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().ArrowLeft().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command ArrowRight', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'code_block',
        'content': [
          {
            'type': 'text',
            'text': 'Hello, world!',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtensionOrReq[] = [
    new ExtensionBasicEditor(),
    new ExtensionCodeMirror({}),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().ArrowRight().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command ArrowUp', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'code_block',
        'content': [
          {
            'type': 'text',
            'text': 'Hello, world!',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtensionOrReq[] = [
    new ExtensionBasicEditor(),
    new ExtensionCodeMirror({}),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().ArrowUp().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command ArrowDown', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'code_block',
        'content': [
          {
            'type': 'text',
            'text': 'Hello, world!',
          },
        ],
      },
    ],
  };

  const extensions: AnyExtensionOrReq[] = [
    new ExtensionBasicEditor(),
    new ExtensionCodeMirror({}),
  ];

  const editor = new CoreEditor({
    extensions,
    content,
  });

  editor.chain().ArrowDown().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});
