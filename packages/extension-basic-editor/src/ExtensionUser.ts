import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';

import { CommandFactories, Extension } from '@kerebron/editor';
import { CommandFactory } from '@kerebron/editor/commands';
import { ColorMapper, generateRandomUser, User } from '@kerebron/editor/user';

export const userPluginKey = new PluginKey<UserPluginState>('user');

interface UserPluginState {
  user: User;
}

export interface UserMeta {
  changeUser?: {
    user: User;
  };
  setColorMapper?: {
    colorMapper: ColorMapper;
  };
}

const createUserPlugin: () => Plugin<UserPluginState> = () =>
  new Plugin<UserPluginState>({
    key: userPluginKey,
    state: {
      init() {
        return {
          user: generateRandomUser(),
        };
      },
      apply: (tr, pluginState: UserPluginState) => {
        const changeUser = tr.getMeta('changeUser');

        if (changeUser) {
          pluginState.user = { ...changeUser.user };
        }

        return pluginState;
      },
    },
  });

export class ExtensionUser extends Extension {
  override name = 'user';

  override getCommandFactories(): Partial<CommandFactories> {
    const changeUser: CommandFactory = (user: User) => {
      return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        const tr = state.tr;
        tr.setMeta('changeUser', { user });

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      };
    };

    return {
      changeUser,
    };
  }

  override getProseMirrorPlugins(): Plugin[] {
    return [
      createUserPlugin(),
    ];
  }
}
