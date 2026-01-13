import { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { NodeViewConstructor } from 'prosemirror-view';

import { Converter, Extension } from './Extension.ts';
import type { AnyExtension, AnyExtensionOrReq, EditorKit } from './types.ts';
import type { CoreEditor } from './CoreEditor.ts';
import { Mark } from './Mark.ts';
import { Node } from './Node.ts';
import {
  InputRule,
  InputRulesPlugin,
} from './plugins/input-rules/InputRulesPlugin.ts';
import { KeymapPlugin } from './plugins/keymap/keymap.ts';
import { CommandShortcuts, firstCommand } from './commands/mod.ts';
import { type Command } from 'prosemirror-state';
import { addAttributesToSchema } from './utilities/getHtmlAttributes.ts';
import { type CommandManager } from './commands/CommandManager.ts';
import { TrackSelecionPlugin } from './plugins/TrackSelecionPlugin.ts';

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
  public readonly extensions: Set<AnyExtension> = new Set();
  readonly plugins: Plugin[] = [];
  readonly nodeViews: Record<string, NodeViewConstructor> = {};

  public converters: Record<string, Converter> = {};

  private debug = true;

  constructor(public readonly editorKits: EditorKit[]) {
    const extensions: AnyExtensionOrReq[] = editorKits
      .reduce(
        (prev: AnyExtensionOrReq[], cur) => prev.concat(cur.getExtensions()),
        [],
      );

    this.setupExtensions(new Set(extensions));
  }

  getExtension<T extends Extension>(name: string): T | undefined {
    const { nodeExtensions, markExtensions, baseExtensions } = splitExtensions(
      this.extensions,
    );

    for (const extension of baseExtensions) {
      if (extension.name === name) {
        return <T> extension;
      }
    }
  }

  private initPlugins(editor: CoreEditor, schema: Schema) {
    const inputRules: InputRule[] = [];
    const keyBindings: Map<string, Command> = new Map();

    const mergeShortcuts = (
      toInsert: Partial<CommandShortcuts>,
      extName: string,
    ) => {
      for (const key in toInsert) {
        if (!toInsert[key]) {
          continue;
        }

        const commandFactory = editor.commandFactories[toInsert[key]];
        if (!commandFactory) {
          console.warn(`No command constructor: ${toInsert[key]}`);
          continue;
        }
        const command = commandFactory();

        const keyBinding = keyBindings.get(key);
        if (keyBinding) {
          keyBindings.set(key, firstCommand(command, keyBinding));
        } else {
          keyBindings.set(key, command);
        }
      }
    };

    let converters = {};

    for (const extension of this.extensions) {
      extension.setEditor(editor);

      if (extension.type === 'node') {
        const nodeType = schema.nodes[extension.name];
        inputRules.push(...extension.getInputRules(nodeType));
        this.plugins.push(
          ...extension.getProseMirrorPlugins(),
        );
        editor.mergeCommandFactories(
          extension.getCommandFactories(editor, nodeType),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(editor),
          extension.name,
        );
        converters = {
          ...converters,
          ...extension.getConverters(editor, schema),
        };
        const nodeView = extension.getNodeView(editor);
        if (nodeView) {
          this.nodeViews[extension.name] = nodeView;
        }
      }
      if (extension.type === 'mark') {
        const markType = schema.marks[extension.name];
        inputRules.push(...extension.getInputRules(markType));
        editor.mergeCommandFactories(
          extension.getCommandFactories(editor, markType),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(editor),
          extension.name,
        );
      }
      if (extension.type === 'extension') {
        this.plugins.push(
          ...extension.getProseMirrorPlugins(),
        );
        editor.mergeCommandFactories(
          extension.getCommandFactories(editor),
          extension.name,
        );
        mergeShortcuts(
          extension.getKeyboardShortcuts(editor),
          extension.name,
        );
        converters = {
          ...converters,
          ...extension.getConverters(editor, schema),
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
          firstCommand(wrapperCommand, keyBinding),
        );
      }
    }

    this.converters = converters;

    this.plugins.push(new InputRulesPlugin(inputRules));
    this.plugins.push(new KeymapPlugin(Object.fromEntries(keyBindings)));
    this.plugins.push(new TrackSelecionPlugin(editor));
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
              throw new Error(
                `Required extension for (${
                  'name' in extension ? extension.name : extension
                }) not found: ${require}`,
              );
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

  getSchemaByResolvedExtensions(): Schema {
    const { nodeExtensions, markExtensions, baseExtensions } = splitExtensions(
      this.extensions,
    );

    const nodes: { [name: string]: NodeSpec } = {};
    let topNode = '';
    for (const extension of nodeExtensions) {
      nodes[extension.name] = extension.getNodeSpec();

      if (nodes[extension.name].EMPTY_DOC) {
        if (topNode) {
          throw new Error(`Multiple topNodes: ${extension.name}, ${topNode}`);
        }
        topNode = extension.name;
      }

      addAttributesToSchema(nodes[extension.name], extension);
    }

    const marks: { [name: string]: MarkSpec } = {};
    for (const extension of markExtensions) {
      marks[extension.name] = extension.getMarkSpec();
      addAttributesToSchema(marks[extension.name], extension);
    }

    const spec = {
      topNode: topNode || 'doc',
      nodes,
      marks,
    };

    for (const extension of baseExtensions) {
      if ('setupSpec' in baseExtensions) {
        extension.setupSpec(spec);
      }
    }

    return new Schema(spec);
  }

  created(editor: CoreEditor, schema: Schema) {
    const { nodeExtensions, markExtensions, baseExtensions } = splitExtensions(
      this.extensions,
    );

    for (const extension of baseExtensions) {
      if (Array.isArray(extension.conflicts)) {
        for (const name of extension.conflicts) {
          if (this.getExtension(name)) {
            throw new Error(`Extension conflict: ${extension.name} vs ${name}`);
          }
        }
      }
    }

    this.initPlugins(editor, schema);

    for (const extension of this.extensions) {
      extension.created();
    }
  }
}
