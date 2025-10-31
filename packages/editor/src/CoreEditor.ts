import { EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode, Schema } from 'prosemirror-model';

import { ExtensionManager } from './ExtensionManager.ts';
import type { EditorOptions, JSONContent } from './types.ts';
import { EditorState, Transaction } from 'prosemirror-state';
import { CommandManager } from './commands/CommandManager.ts';
import { nodeToTreeString } from './nodeToTreeString.ts';
import { DummyEditorView } from './DummyEditorView.ts';
import { ChainedCommands } from '@kerebron/editor/commands';
import { createNodeFromObject } from './utilities/createNodeFromContent.ts';
import { Extension } from './Extension.ts';

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

export class CoreEditor extends EventTarget {
  public readonly options: Partial<EditorOptions> = {
    element: undefined,
    extensions: [],
  };
  private extensionManager: ExtensionManager;
  private commandManager: CommandManager;
  public view!: EditorView | DummyEditorView;
  public state!: EditorState;

  constructor(options: Partial<EditorOptions> = {}) {
    super();
    this.options = {
      ...this.options,
      ...options,
    };

    this.commandManager = new CommandManager(
      this,
    );

    this.extensionManager = new ExtensionManager(
      this.options.extensions || [],
      this,
      this.commandManager,
    );

    // const content = this.options.content ? this.options.content : {
    //   type: this.extensionManager.schema.topNodeType.name,
    //   content: this.extensionManager.schema.topNodeType.spec.EMPTY_DOC,
    // };
    const content = this.options.content
      ? this.options.content
      : this.extensionManager.schema.topNodeType.spec.EMPTY_DOC;

    this.createView(content);
    this.setupPlugins();
  }

  getExtension<T extends Extension>(name: string): T | undefined {
    return this.extensionManager.getExtension<T>(name);
  }

  public get schema() {
    return this.extensionManager.schema;
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

  private createView(content: any) {
    const doc = createNodeFromObject(content, this.schema);

    this.state = EditorState.create({ doc });

    if (this.options.element) {
      this.view = new EditorView(this.options.element, {
        state: this.state,
        attributes: {
          class: 'kb-editor',
        },
        dispatchTransaction: (tx: Transaction) => this.dispatchTransaction(tx),
      });
    } else {
      this.view = new DummyEditorView({
        state: this.state,
        dispatchTransaction: (tx: Transaction) => this.dispatchTransaction(tx),
      });
    }
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
      type: this.extensionManager.schema.topNodeType.name,
      content: this.extensionManager.schema.topNodeType.spec.EMPTY_DOC.content,
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
    const doc = await converter.toDoc(content);

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

  public clone(options: Partial<EditorOptions> = {}): CoreEditor {
    return new CoreEditor({
      ...options,
      extensions: [...(this.options.extensions || [])],
    });
  }

  public debug(doc?: ProseMirrorNode) {
    if (!doc) {
      doc = this.state.doc;
    }
    console.debug(nodeToTreeString(doc));
  }
}
