import { CoreEditor } from '@kerebron/editor';
import { BrowserLessEditorKit } from '@kerebron/editor-browserless/BrowserLessEditorKit';
import { type JSONContent } from '@kerebron/editor';

Deno.test('test command addColumnAfter', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().addColumnAfter().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command addColumnBefore', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().addColumnBefore().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command addRowAfter', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().addRowAfter().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command addRowBefore', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().addRowBefore().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command deleteColumn', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 2',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().deleteColumn().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command deleteRow', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 2',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().deleteRow().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command deleteTable', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().deleteTable().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command goToNextCell', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 2',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().goToNextCell(1).run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command mergeCells', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 2',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().mergeCells().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command setCellAttr', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().setCellAttr('colspan', 2).run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command splitCell', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'attrs': {
                  'colspan': 2,
                },
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().splitCell().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command toggleHeader', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().toggleHeader('column').run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command toggleHeaderCell', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().toggleHeaderCell().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command toggleHeaderColumn', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().toggleHeaderColumn().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});

Deno.test('test command toggleHeaderRow', () => {
  const content: JSONContent = {
    'type': 'doc',
    'content': [
      {
        'type': 'table',
        'content': [
          {
            'type': 'table_row',
            'content': [
              {
                'type': 'table_cell',
                'content': [
                  {
                    'type': 'paragraph',
                    'content': [
                      {
                        'type': 'text',
                        'text': 'Cell 1',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const editorKits = [
    new BrowserLessEditorKit(),
  ];

  const editor = CoreEditor.create({
    editorKits,
    content,
  });

  editor.chain().toggleHeaderRow().run();

  const modified = editor.getJSON();
  console.log('modified', modified);
});
