import { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { NodeViewConstructor } from 'prosemirror-view';

import { Converter, Extension } from './Extension.ts';
import { AnyExtension } from './types.ts';
import { CoreEditor } from './CoreEditor.ts';
import { Mark } from './Mark.ts';
import { Node } from './Node.ts';
import {
  InputRule,
  InputRulesPlugin,
} from './plugins/input-rules/InputRulesPlugin.ts';
import { chainCommands } from './commands/mod.ts';
import { type Command } from 'prosemirror-state';
import { addAttributesToSchema } from './utilities/getHtmlAttributes.ts';

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

  readonly commandConstructors: { [key: string]: () => Command } = {};
  private converters: Record<string, Converter> = {};

  private debug = true;

  constructor(extensions: Set<AnyExtension>, private editor: CoreEditor) {
    this.setupExtensions(extensions);
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

  private getPlugins() {
    const plugins: Plugin[] = [];

    const inputRules: InputRule[] = [];
    const commands: Map<string, () => Command> = new Map();
    const keyBindings: Map<string, Command> = new Map();

    const mergeCommands = (
      toInsert: Record<string, () => Command>,
      extName: string,
    ) => {
      for (const key in toInsert) {
        const commandConstructor = toInsert[key];

        if (this.debug) {
          const wrappedConstructor = () => {
            const realCommand = commandConstructor();

            const command: Command = (state, dispatch, view) => {
              if (dispatch) {
                console.debug(`Command: ${extName}.${key}`);
              }
              return realCommand(state, dispatch, view);
            };

            return command;
          };

          commands.set(key, wrappedConstructor);
          this.commandConstructors[key] = wrappedConstructor;
        } else {
          commands.set(key, commandConstructor);
          this.commandConstructors[key] = commandConstructor;
        }
      }
    };

    function mergeShortcuts(toInsert: Record<string, string>, extName: string) {
      for (const key in toInsert) {
        const commandConstructor = commands.get(toInsert[key]);
        if (!commandConstructor) {
          console.warn(`No command constructor: ${toInsert[key]}`);
          continue;
        }
        const command = commandConstructor();

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
          extension.getCommands(this.editor, nodeType),
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
          extension.getCommands(this.editor, markType),
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
        mergeCommands(extension.getCommands(this.editor), extension.name);
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
        const wrapperCommand: Command = (state, dispatch, view) => {
          console.debug(`Key: ${key}`);
          return true;
        };
        keyBindings.set(
          key,
          chainCommands(wrapperCommand, keyBindings.get(key)),
        );
      }
    }

    this.converters = converters;

    plugins.push(new InputRulesPlugin(inputRules));
    plugins.push(keymap(Object.fromEntries(keyBindings)));

    return plugins;
  }

  private setupExtensions(extensions: Set<AnyExtension>) {
    const allExtensions = new Map<string, AnyExtension>();

    const createMap = (extensions: Set<AnyExtension>) => {
      for (const extension of extensions) {
        allExtensions.set(extension.name, extension);
        if (extension.requires) {
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

    function recursiveInitializeExtension(extension: AnyExtension) {
      if (initialized.has(extension.name)) {
        return;
      }

      const requires = (extension.requires || []).map((e) =>
        typeof e === 'string' ? e : e.name
      );

      for (const require of requires) {
        if (!initialized.has(require)) {
          const requiredExtension = allExtensions.get(require);
          if (!requiredExtension) {
            throw new Error('Required extension not found: ' + require);
          }
          recursiveInitializeExtension(requiredExtension);
        }
      }

      initializeExtension(extension);

      initialized.add(extension.name);
      allExtensions.delete(extension.name);
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
        baseExtensions.setupSpec(spec);
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
