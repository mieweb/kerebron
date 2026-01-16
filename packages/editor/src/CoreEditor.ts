import { EditorView } from 'prosemirror-view';
import {
  Node as ProseMirrorNode,
  ParseOptions,
  Schema,
} from 'prosemirror-model';

import { ExtensionManager } from './ExtensionManager.ts';
import type { Content, EditorKit, JSONContent } from './types.ts';
import { EditorState, Transaction } from 'prosemirror-state';
import { CommandManager } from './commands/CommandManager.ts';
import { nodeToTreeString } from './nodeToTreeString.ts';
import { DummyEditorView } from './DummyEditorView.ts';
import { createNodeFromObject } from './utilities/createNodeFromContent.ts';
import { Extension } from './Extension.ts';
import { defaultUi, EditorUi } from './ui.ts';
import { runInputRulesTexts } from './plugins/input-rules/InputRulesPlugin.ts';
import {
  ChainedCommands,
  Command,
  CommandFactories,
} from './commands/types.ts';

function ensureDocSchema(
  doc: ProseMirrorNode,
  schema: Schema,
): ProseMirrorNode {
  if (doc.type.schema === schema) {
    return doc;
  }

  const json = doc.toJSON();
  return ProseMirrorNode.fromJSON(schema, json);
}

export interface EditorConfig {
  element: HTMLElement;
  content: Content;
  parseOptions: ParseOptions;
  // extensions: AnyExtensionOrReq[];
  cdnUrl?: string;
  uri?: string;
  languageID?: string;
  topNode?: string;
  readOnly?: boolean;
}

export class CoreEditor extends EventTarget {
  public readonly config: Partial<EditorConfig>;
  private commandManager: CommandManager;
  public view!: EditorView | DummyEditorView;
  public state!: EditorState;
  public ui: EditorUi = defaultUi(this);
  private linkListener?: EventListenerOrEventListenerObject;
  private linkSource?: CoreEditor;

  private constructor(
    config: Partial<EditorConfig>,
    public readonly schema: Schema,
    private extensionManager: ExtensionManager,
  ) {
    super();

    this.config = { ...config };

    this.commandManager = new CommandManager(
      this,
    );
  }

  static create(config: Partial<EditorConfig> & { editorKits: EditorKit[] }) {
    const extensionManager = new ExtensionManager(config.editorKits);

    const schema = extensionManager.getSchemaByResolvedExtensions();

    const instance = new CoreEditor(config, schema, extensionManager);
    extensionManager.created(instance, schema);

    const content = config.content
      ? config.content
      : schema.topNodeType.spec.EMPTY_DOC;

    instance.createView(content);
    instance.setupPlugins();

    return instance;
  }

  public clone(config?: EditorConfig): CoreEditor {
    const extensionManager = new ExtensionManager(
      this.extensionManager.editorKits,
    );

    const instance = new CoreEditor(
      {
        ...config,
        element: undefined,
      },
      this.schema,
      extensionManager,
    );
    extensionManager.created(instance, this.schema);

    const content = this.getJSON();

    instance.createView(content);
    instance.setupPlugins();

    return instance;
  }

  getExtension<T extends Extension>(name: string): T | undefined {
    return this.extensionManager.getExtension<T>(name);
  }

  public get run() {
    return this.commandManager.run;
  }

  public get commandFactories() {
    return this.commandManager.commandFactories;
  }

  public chain(): ChainedCommands {
    return this.commandManager.createChain();
  }

  public can(): ChainedCommands {
    return this.commandManager.createCan();
  }

  public link(source: CoreEditor): ChainedCommands {
    if (source === this) {
      throw new Error('You cannot chain editor to itself');
    }

    this.unlink();

    this.state = EditorState.create({ doc: source.getDocument() });

    const { commandFactories } = this.commandManager;
    const commands: Command[] = [];

    const chain = {
      ...Object.fromEntries(
        Object.entries(commandFactories).map(([name, commandFactory]) => {
          const chainedCommand = (...args: never[]) => {
            const command = commandFactory(...args);
            commands.push(command);
            return chain;
          };
          return [name, chainedCommand];
        }),
      ),
      run: () => {
        this.linkSource = source;
        this.linkListener = () => {
          let state = source.state;
          const dispatch = (tr: Transaction) => {
            state = state.apply(tr);
          };

          for (const command of commands) {
            if (!command(state, dispatch)) {
              return;
            }
          }

          this.state = state.reconfigure({
            plugins: this.extensionManager.plugins,
          });
          if (this.view) {
            this.view.updateState(this.state);
          }

          const event = new CustomEvent('changed', {
            detail: {
              editor: this,
            },
          });
          this.dispatchEvent(event);
        };
        source.addEventListener('changed', this.linkListener);
      },
    } as unknown as ChainedCommands;

    return chain;
  }

  public unlink() {
    if (this.linkListener && this.linkSource) {
      this.linkSource.removeEventListener('changed', this.linkListener);
      this.linkListener = undefined;
      this.linkSource = undefined;
    }
  }

  private createView(content: any) {
    const doc = createNodeFromObject(content, this.schema);

    this.state = EditorState.create({ doc });

    if (this.config.element) {
      const view = new EditorView(this.config.element, {
        state: this.state,
        attributes: {
          class: 'kb-editor',
        },
        dispatchTransaction: (tx: Transaction) => this.dispatchTransaction(tx),
        editable: () => !this.config.readOnly,
      });
      this.view = view;

      const parent = this.config.element.parentNode;
      if (parent) {
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const removedNode of mutation.removedNodes) {
              if (removedNode.contains(view.dom)) {
                // Editor DOM was removed
                observer.disconnect(); // Prevent multiple calls
                view.destroy();
                return;
              }
            }
          }
        });
      }
    } else {
      this.view = new DummyEditorView({
        state: this.state,
        dispatchTransaction: (tx: Transaction) => this.dispatchTransaction(tx),
      });
    }

    const event = new CustomEvent('doc:loaded', {
      detail: {
        editor: this,
        doc,
      },
    });
    this.dispatchEvent(event);
  }

  public dispatchTransaction(transaction: Transaction) {
    this.state = this.state.apply(transaction);
    if (this.view) {
      this.view.updateState(this.state);
      const event = new CustomEvent('transaction', {
        detail: {
          editor: this,
          transaction,
        },
      });
      this.dispatchEvent(event);
    }
    if (transaction.docChanged) {
      const event = new CustomEvent('changed', {
        detail: {
          editor: this,
        },
      });
      this.dispatchEvent(event);
    }
  }

  private setupPlugins() {
    this.state = this.state.reconfigure({
      plugins: this.extensionManager.plugins,
    });

    if (this.view) {
      this.view.updateState(this.state);

      this.view.setProps({
        nodeViews: this.extensionManager.nodeViews,
      });
    }
  }

  public clearDocument() {
    const content = {
      type: this.schema.topNodeType.name,
      content: this.schema.topNodeType.spec.EMPTY_DOC.content,
    };

    this.setDocument(content);
  }

  public setDocument(content: any) {
    let doc = createNodeFromObject(content, this.schema, {
      errorOnInvalidContent: true,
    });
    doc = ensureDocSchema(doc, this.schema);

    this.state = EditorState.create({
      doc,
      plugins: this.state.plugins,
      storedMarks: this.state.storedMarks,
    });

    if (this.view) {
      this.view.updateState(this.state);
    }

    const event = new CustomEvent('doc:loaded', {
      detail: {
        editor: this,
        doc,
      },
    });
    this.dispatchEvent(event);
  }

  public getDocument() {
    return this.state.doc;
  }

  public async loadDocument(mediaType: string, content: Uint8Array) {
    const converter = this.extensionManager.converters[mediaType];
    if (!converter) {
      throw new Error('Converter not found for: ' + mediaType);
    }
    const parsedDoc = await converter.toDoc(content);

    let newState = EditorState.create({
      doc: parsedDoc,
      plugins: this.state.plugins,
      storedMarks: this.state.storedMarks,
    });
    const dispatch = (tr: Transaction) => {
      newState = newState.apply(tr);
    };

    const cmd = runInputRulesTexts();
    cmd(newState, dispatch);

    this.state = newState;

    if (this.view) {
      this.view.updateState(this.state);
    }

    const event = new CustomEvent('doc:loaded', {
      detail: {
        editor: this,
        doc: this.state.doc,
      },
    });
    this.dispatchEvent(event);
  }

  public async saveDocument(mediaType: string): Promise<Uint8Array> {
    const converter = this.extensionManager.converters[mediaType];
    if (!converter) {
      throw new Error('Converter not found for: ' + mediaType);
    }

    const json = this.state.doc.toJSON();
    const clonedDoc = ProseMirrorNode.fromJSON(this.state.schema, json);

    return await converter.fromDoc(clonedDoc);
  }

  public getJSON(): JSONContent {
    return this.state.doc.toJSON();
  }

  public debug(doc?: ProseMirrorNode) {
    if (!doc) {
      doc = this.state.doc;
    }
    console.debug(nodeToTreeString(doc));
  }

  public destroy() {
    const event = new CustomEvent('beforeDestroy', {
      detail: {},
    });
    this.dispatchEvent(event);
    this.view.destroy();
  }

  mergeCommandFactories(toInsert: Partial<CommandFactories>, name: string) {
    this.commandManager.mergeCommandFactories(toInsert, name);
  }
}
