import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { CoreEditor, debugNode, JSONContent } from '@kerebron/editor';
import { assertEquals } from '@std/assert';
import { ExtensionSelection } from '@kerebron/extension-basic-editor/ExtensionSelection';

Deno.test('ExtensionSelection should handle commands', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'paragraph',
        'content': [
          {
            'type': 'text',
            'text': 'Lorem ipsum',
          },
        ],
      },
      {
        'type': 'paragraph',
        'content': [
          {
            'type': 'br',
          },
          {
            'type': 'text',
            'text': 'dolor sit amet',
          },
        ],
      },
    ],
  };

  const editor = new CoreEditor({
    extensions: [new ExtensionBasicEditor()],
    content,
  });

  // debugNode(editor.getDocument());

  editor.chain().selectAll().run();
  {
    const extensionSelection = editor.getExtension<ExtensionSelection>(
      'selection',
    );
    if (!extensionSelection) {
      throw new Error('No ExtensionSelection loader');
    }
    const slice = extensionSelection.extractSelection();
    assertEquals('Lorem ipsumdolor sit amet', slice.textContent.toString());
  }

  editor.chain().selectText(1, 4).run();
  {
    const extensionSelection = editor.getExtension<ExtensionSelection>(
      'selection',
    );
    if (!extensionSelection) {
      throw new Error('No ExtensionSelection loader');
    }
    const slice = extensionSelection.extractSelection();
    assertEquals('orem', slice.textContent.toString());
  }

  editor.chain().selectText(1, 4, 1).run();
  {
    const extensionSelection = editor.getExtension<ExtensionSelection>(
      'selection',
    );
    if (!extensionSelection) {
      throw new Error('No ExtensionSelection loader');
    }
    const slice = extensionSelection.extractSelection();
    assertEquals('dolo', slice.textContent.toString());
  }

  editor.chain().selectText(1, 400, 1).run();
  {
    const extensionSelection = editor.getExtension<ExtensionSelection>(
      'selection',
    );
    if (!extensionSelection) {
      throw new Error('No ExtensionSelection loader');
    }
    const slice = extensionSelection.extractSelection();
    assertEquals('dolor sit amet', slice.textContent.toString());
  }
});
