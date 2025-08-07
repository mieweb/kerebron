import { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { NodeViewConstructor } from 'prosemirror-view';

import { Converter, Extension } from './Extension.ts';
import { AnyExtension, AnyExtensionOrReq } from './types.ts';
import { CoreEditor } from './CoreEditor.ts';
import { Mark } from './Mark.ts';
import { Node } from './Node.ts';
import {
  InputRule,
  InputRulesPlugin,
} from './plugins/input-rules/InputRulesPlugin.ts';
import { KeymapPlugin } from './plugins/keymap/keymap.ts';
import {
  chainCommands,
  CommandFactories,
  CommandFactory,
  CommandShortcuts,
} from './commands/mod.ts';
import { type Command } from 'prosemirror-state';
import { addAttributesToSchema } from './utilities/getHtmlAttributes.ts';
import { base } from './plugins/keymap/w3c-keyname.ts';

export function findDuplicates(items: any[]): any[] {
  const filtered = items.filter((el, index) => items.indexOf(el) !== index);

  return Array.from(new Set(filtered));
}

export function splitExtensions(extensions: Iterable<AnyExtension>) {
  const baseExtensions = Array.from(extensions).filter((extension) =>
    extension.type === 'extension'
  ) as Extension[];
  const nodeExtensions = Array.from(extensions).filter((extension) =>
    extension.type === 'node'
  ) as Node[];
  const markExtensions = Array.from(extensions).filter((extension) =>
    extension.type === 'mark'
  ) as Mark[];

  return {
    baseExtensions,
    nodeExtensions,
    markExtensions,
  };
}

export class ExtensionManager {
  public readonly schema: Schema;

  private extensions: Set<AnyExtension> = new Set();
  readonly plugins: Plugin[];
  readonly nodeViews: Record<string, NodeViewConstructor> = {};

  readonly commandFactories: { [key: string]: CommandFactory } = {};
  public converters: Record<string, Converter> = {};

  private debug = true;

  constructor(extensions: AnyExtensionOrReq[], private editor: CoreEditor) {
    this.setupExtensions(new Set(extensions));
    this.schema = this.getSchemaByResolvedExtensions(editor);

    const event = new CustomEvent('schema:ready', {
      detail: {
        editor,
        schema: this.schema,
      },
    });
    editor.dispatchEvent(event);
    this.plugins = this.getPlugins();
  }

  getExtension<T extends Extension>(name: string): T | undefined {
    const { nodeExtensions, markExtensions, baseExtensions } = splitExtensions(
      this.extensions,
    );

    for (const extension of baseExtensions) {
      if (extension.name === name) {
        return <T>extension;
      }
    }
  }

  private getPlugins() {
    const plugins: Plugin[] = [];

    const inputRules: InputRule[] = [];
    const commands: Map<string, CommandFactory> = new Map();
    const keyBindings: Map<string, Command> = new Map();

    const mergeCommands = (
      toInsert: Partial<CommandFactories>,
      extName: string,
    ) => {
      for (const key in toInsert) {
        const commandFactory = toInsert[key];
        if (!commandFactory) {
          continue;
        }

        if (this.debug) {
          const wrappedFactory = (...args: unknown[]) => {
            const realCommand = commandFactory(...args);

            const command: Command = (state, dispatch, view) => {
              if (dispatch) {
                console.debug(`Command: ${extName}.${key}`);
              }
              return realCommand(state, dispatch, view);
            };

            return command;
          };

          commands.set(key, wrappedFactory);
          this.commandFactories[key] = wrappedFactory;
        } else {
          commands.set(key, commandFactory);
          this.commandFactories[key] = commandFactory;
        }
      }
    };

    function mergeShortcuts(
      toInsert: Partial<CommandShortcuts>,
      extName: string,
    ) {
      for (const key in toInsert) {
        if (!toInsert[key]) {
          continue;
        }

        const commandFactory = commands.get(toInsert[key]);
        if (!commandFactory) {
          console.warn(`No command constructor: ${toInsert[key]}`);
          continue;
        }
        const command = commandFactory();

        const keyBinding = keyBindings.get(key);
        if (keyBinding) {
          keyBindings.set(key, chainCommands(keyBinding, command));
        } else {
          keyBindings.set(key, command);
        }
      }
    }

    let converters = {};

    for (const extension of this.extensions) {
      if (extension.type === 'node') {
        const nodeType = this.schema.nodes[extension.name];
        inputRules.push(...extension.getInputRules(nodeType));
        plugins.push(
          ...extension.getProseMirrorPlugins(this.editor, this.schema),
        );
        mergeCommands(
          extension.getCommandFactories(this.editor, nodeType),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(this.editor),
          extension.name,
        );
        converters = {
          ...converters,
          ...extension.getConverters(this.editor, this.schema),
        };
        const nodeView = extension.getNodeView();
        if (nodeView) {
          this.nodeViews[extension.name] = nodeView;
        }
      }
      if (extension.type === 'mark') {
        const markType = this.schema.marks[extension.name];
        inputRules.push(...extension.getInputRules(markType));
        mergeCommands(
          extension.getCommandFactories(this.editor, markType),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(this.editor),
          extension.name,
        );
      }
      if (extension.type === 'extension') {
        plugins.push(
          ...extension.getProseMirrorPlugins(this.editor, this.schema),
        );
        mergeCommands(
          extension.getCommandFactories(this.editor),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(this.editor),
          extension.name,
        );
        converters = {
          ...converters,
          ...extension.getConverters(this.editor, this.schema),
        };
      }
    }

    if (this.debug) {
      for (const key in keyBindings) {
        const keyBinding = keyBindings.get(key);
        if (!keyBinding) {
          continue;
        }

        const wrapperCommand: Command = (state, dispatch, view) => {
          console.debug(`Key: ${key}`);
          return true;
        };
        keyBindings.set(
          key,
          chainCommands(wrapperCommand, keyBinding),
        );
      }
    }

    this.converters = converters;

    plugins.push(new InputRulesPlugin(inputRules));
    plugins.push(new KeymapPlugin(Object.fromEntries(keyBindings)));

    return plugins;
  }

  private setupExtensions(extensions: Set<AnyExtensionOrReq>) {
    const allExtensions = new Map<string, AnyExtensionOrReq>();

    const createMap = (extensions: Set<AnyExtensionOrReq>) => {
      for (const extension of extensions) {
        if ('name' in extension) {
          allExtensions.set(extension.name, extension);
        }
        if ('requires' in extension) {
          const childExtensions = Array.from(extension.requires).filter((e) =>
            typeof e !== 'string'
          );
          createMap(new Set(childExtensions));
        }
      }
    };

    createMap(extensions);

    const initialized: Set<string> = new Set();

    const initializeExtension = (extension: AnyExtension) => {
      console.info(`Initialize ${extension.type} ${extension.name}`);
      this.extensions.add(extension);
    };

    function recursiveInitializeExtension(extension: AnyExtensionOrReq) {
      if ('name' in extension && initialized.has(extension.name)) {
        return;
      }

      if ('requires' in extension) {
        const requires = extension.requires || [];
        const requireNames = requires.map((
          e: string | AnyExtensionOrReq,
        ): string => typeof e === 'string' ? e : ('name' in e ? e.name : ''));

        for (const require of requireNames) {
          if (!initialized.has(require)) {
            const requiredExtension = allExtensions.get(require);
            if (!requiredExtension) {
              throw new Error('Required extension not found: ' + require);
            }
            recursiveInitializeExtension(requiredExtension);
          }
        }
      }

      if ('name' in extension) {
        initializeExtension(extension);

        initialized.add(extension.name);
        allExtensions.delete(extension.name);
      }
    }

    for (const extension of allExtensions.values()) {
      recursiveInitializeExtension(extension);
    }

    if (allExtensions.size > 0) {
      throw new Error(
        'Not all extensions initialized: ' +
          Array.from(allExtensions.keys()).join(', '),
      );
    }
  }

  getSchemaByResolvedExtensions(editor: CoreEditor): Schema {
    const { nodeExtensions, markExtensions, baseExtensions } = splitExtensions(
      this.extensions,
    );

    const nodes: { [name: string]: NodeSpec } = {};
    for (const extension of nodeExtensions) {
      nodes[extension.name] = extension.getNodeSpec();
      addAttributesToSchema(nodes[extension.name], extension);
    }

    const marks: { [name: string]: MarkSpec } = {};
    for (const extension of markExtensions) {
      marks[extension.name] = extension.getMarkSpec();
      addAttributesToSchema(marks[extension.name], extension);
    }

    const spec = {
      topNode: this.editor.options.topNode || 'doc',
      nodes,
      marks,
    };

    for (const extension of baseExtensions) {
      if ('setupSpec' in baseExtensions) {
        extension.setupSpec(spec);
      }
    }

    const event = new CustomEvent('schema:spec', {
      detail: {
        editor,
        spec,
      },
    });
    editor.dispatchEvent(event);

    return new Schema(spec);
  }
}
