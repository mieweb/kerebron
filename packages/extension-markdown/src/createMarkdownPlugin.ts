import { EditorState, Plugin } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { debounce } from '@kerebron/editor/utilities';

import { Workspace } from '@kerebron/workspace';
import { MarkdownContentMapper } from './MarkdownContentMapper.ts';

class MarkdownPluginState {
  capturing = false;
  workspace: Workspace;

  constructor(
    private editor: CoreEditor,
    private extensionMarkdown: ExtensionMarkdown,
  ) {
    this.workspace = editor.ci.resolve('workspace')!;
    this.performSnapshot = debounce(
      this.performSnapshot.bind(this),
      800,
    ) as typeof this.performSnapshot;
  }

  async performSnapshot() {
    const editor = this.editor;

    const version = editor.version;

    const uri = this.editor.config.uri;
    if (!uri) {
      return;
    }

    const ctx: {
      version: number;
      state: EditorState;
      materialized?: MarkdownContentMapper;
    } = {
      version,
      state: this.editor.state,
      materialized: undefined,
    };
    const getContentMapper = async () => {
      if (ctx.materialized) {
        return ctx.materialized;
      }
      ctx.materialized = await MarkdownContentMapper.create(
        ctx.state,
        this.extensionMarkdown.config,
      );
      return ctx.materialized;
    };

    if (this.workspace.getFile(uri)) {
      this.workspace.modifyFile({
        uri,
        lang: 'markdown',
        version,
        getContentMapper,
      });
    } else {
      this.workspace.openFile({
        uri,
        lang: 'markdown',
        version,
        getContentMapper,
      });
    }
  }
}

export function createMarkdownPlugin<MarkdownPluginState>(
  extensionMarkdown: ExtensionMarkdown,
  editor: CoreEditor,
): Plugin {
  return new Plugin({
    state: {
      init() {
        return new MarkdownPluginState(editor, extensionMarkdown);
      },
      apply(tr, value, _oldState, _editorState) {
        if (tr.docChanged && value.capturing) {
          value.performSnapshot();
        }
        return value;
      },
    },
    view() {
      return {
        destroy() {
          const uri = editor.config.uri;
          if (!uri) {
            return;
          }
          const workspace: Workspace = editor.ci.resolve('workspace')!;
          workspace.closeFile(uri);
        },
      };
    },
  });
}
