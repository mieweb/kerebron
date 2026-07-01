import { Plugin } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { debounce } from '@kerebron/editor/utilities';

import { PositionMapper } from './PositionMapper.ts';
import { MarkdownResult } from './pmToMdConverter.ts';

export interface MarkdownMeta {
  snapshot?: {
    version: number;
    mapper: PositionMapper;
    markdownResult: MarkdownResult;
  };
  clearSnapshot?: boolean;
}

class MarkdownPluginState {
  capturing = false;

  constructor(
    private editor: CoreEditor,
    private extensionMarkdown: ExtensionMarkdown,
  ) {
    this.performSnapshot = debounce(
      this.performSnapshot.bind(this),
      800,
    ) as typeof this.performSnapshot;
  }

  snapshot?: {
    version: number;
    mapper: PositionMapper;
    markdownResult: MarkdownResult;
  };

  async performSnapshot() {
    const editor = this.editor;

    const version = editor.version;
    if (version === this.snapshot?.version) {
      return;
    }

    const markdownResult = await this.extensionMarkdown.toMarkdown(
      editor.state.doc,
    );
    if (editor.version !== version) { // Changed during toMarkdown
    }

    const mapper = new PositionMapper(editor, markdownResult.rawTextMap);

    this.snapshot = {
      markdownResult,
      version,
      mapper,
    };

    this.dispatchMeta({
      snapshot: this.snapshot,
    });
  }

  dispatchMeta(meta: MarkdownMeta) {
    const tr = this.editor.state.tr;
    tr.setMeta('markdown', meta);
    this.editor.dispatchTransaction(tr);
  }
}

export function createMarkdownPlugin<MarkdownPluginState>(
  extensionMarkdown: ExtensionMarkdown,
  editor: CoreEditor,
): Plugin {
  editor.version;
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
  });
}
