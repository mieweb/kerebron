import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';

import { CoreEditor } from '@kerebron/editor';
import { type UrlRewriter } from '@kerebron/editor';
import { debounce } from '@kerebron/editor/utilities';
import { Workspace } from '@kerebron/workspace';

import { ExtensionMarkdown, HookArray, HookMap } from './ExtensionMarkdown.ts';
import { MarkdownContentMapper } from './MarkdownContentMapper.ts';
import { getDefaultsPreProcessFilters } from './pm2md/preProcess.ts';
import { rewriteUrls } from './pm2md/rewriteUrls.ts';

interface MarkdownMeta {
  setMarkdownHooks?: {
    type: string;
    hooks: HookArray;
  };
  setFromMarkdownUrlRewriter?: {
    urlRewriter: UrlRewriter;
  };
  setToMarkdownUrlRewriter?: {
    urlRewriter: UrlRewriter;
  };
}

class MarkdownPluginState {
  capturing = true;
  workspace: Workspace;
  hooks: HookMap = {};

  urlFromRewriter?: UrlRewriter;
  urlToRewriter?: UrlRewriter;

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
        { ...this.extensionMarkdown.config, sourceMap: true },
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

  handleCommands(
    pluginMeta: MarkdownMeta | undefined,
    transaction: Transaction,
  ) {
    if (!pluginMeta) {
      return false;
    }

    if (pluginMeta.setMarkdownHooks) {
      const { type, hooks } = pluginMeta.setMarkdownHooks;
      this.hooks[type] = hooks;
    }
    if (pluginMeta.setFromMarkdownUrlRewriter) {
      const { urlRewriter } = pluginMeta.setFromMarkdownUrlRewriter;
      this.urlFromRewriter = urlRewriter;
    }
    if (pluginMeta.setToMarkdownUrlRewriter) {
      const { urlRewriter } = pluginMeta.setToMarkdownUrlRewriter;
      this.urlToRewriter = urlRewriter;
    }
    return true;
  }
}

export const MarkdownPluginKey = new PluginKey<MarkdownPluginState>('markdown');

export function createMarkdownPlugin(
  extensionMarkdown: ExtensionMarkdown,
  editor: CoreEditor,
): Plugin {
  return new Plugin<MarkdownPluginState>({
    key: MarkdownPluginKey,
    state: {
      init(_config, state) {
        const pluginState = new MarkdownPluginState(editor, extensionMarkdown);
        if (state.schema.topNodeType.name === 'doc') {
          pluginState.hooks['pm2md.pre'] = getDefaultsPreProcessFilters({
            getUrlRewriter: () => pluginState.urlToRewriter,
          });
        } else {
          pluginState.hooks['pm2md.pre'] = [];
        }
        pluginState.hooks['md2pm.post'] = [
          rewriteUrls(() => pluginState.urlFromRewriter),
        ];

        return pluginState;
      },
      apply(tr, value, _oldState, _editorState) {
        const oldClonedState: EditorState | undefined = tr.getMeta('cloned');
        if (oldClonedState) {
          const oldClonedPluginState = MarkdownPluginKey.getState(
            oldClonedState,
          );
          if (oldClonedPluginState) {
            return oldClonedPluginState;
          }
        }

        const pluginMeta: MarkdownMeta | undefined = tr.getMeta(
          MarkdownPluginKey,
        );
        if (value.handleCommands(pluginMeta, tr)) {
          return value;
        }

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
