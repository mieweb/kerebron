import { EditorView } from 'prosemirror-view';
import {
  DOMSerializer,
  Fragment,
  Node as ProseMirrorNode,
  ParseOptions,
  type Schema,
} from 'prosemirror-model';

import { ExtensionManager } from './ExtensionManager.ts';
import type { Content, EditorOptions, JSONContent } from './types.ts';
import { EditorState, Transaction } from 'prosemirror-state';
import { createNodeFromContent } from './utilities/createNodeFromContent.ts';
import { ChainedCommands, CommandManager } from './commands/CommandManager.ts';

export function getHTMLFromFragment(
  fragment: Fragment,
  schema: Schema,
): string {
  const documentFragment = DOMSerializer.fromSchema(schema).serializeFragment(
    fragment,
  );

  const temporaryDocument = document.implementation.createHTMLDocument();
  const container = temporaryDocument.createElement('div');

  container.appendChild(documentFragment);

  return container.innerHTML;
}

function createDocument(
  content: Content | ProseMirrorNode | Fragment,
  schema: Schema,
  parseOptions: ParseOptions = {},
  options: { errorOnInvalidContent?: boolean } = {},
): ProseMirrorNode {
  return createNodeFromContent(content, schema, {
    slice: false,
    parseOptions,
    errorOnInvalidContent: options.errorOnInvalidContent,
  }) as ProseMirrorNode;
}

export class CoreEditor extends EventTarget {
  public readonly options: Partial<EditorOptions> = {
    element: null, // document.createElement('div'),
    extensions: [],
  };
  private extensionManager: ExtensionManager;
  private commandManager: CommandManager;
  public view!: EditorView;
  public state!: EditorState;

  constructor(options: Partial<EditorOptions> = {}) {
    super();
    this.options = {
      ...this.options,
      ...options,
    };

    this.extensionManager = new ExtensionManager(this.options.extensions, this);

    // const content = this.options.content ? this.options.content : {
    //   type: this.extensionManager.schema.topNodeType.name,
    //   content: this.extensionManager.schema.topNodeType.spec.EMPTY_DOC,
    // };
    const content = this.options.content
      ? this.options.content
      : this.extensionManager.schema.topNodeType.spec.EMPTY_DOC;

    this.createView(content);
    this.commandManager = new CommandManager(
      this,
      this.extensionManager.commandConstructors,
    );
    this.setupPlugins();
  }

  public get schema() {
    return this.extensionManager.schema;
  }

  public chain(): ChainedCommands {
    return this.commandManager.chain();
  }

  public can(): ChainedCommands {
    return this.commandManager.can();
  }

  private createView(content: any) {
    let doc = createDocument(
      content,
      this.schema,
      this.options.parseOptions,
      { errorOnInvalidContent: false },
    );

    this.state = EditorState.create({ doc });

    if (this.options.element) {
      this.view = new EditorView(this.options.element, {
        state: this.state,
        dispatchTransaction: (tx: Transaction) => this.dispatchTransaction(tx),
      });
    }
  }

  private dispatchTransaction(transaction: Transaction) {
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

  public getJSON(): JSONContent {
    return this.state.doc.toJSON();
  }

  /**
   * Get the document as HTML.
   */
  public getHTML(): string {
    return getHTMLFromFragment(this.state.doc.content, this.schema);
  }

  public setDocument(content?: any, mediaType?: string) {
    if (!content) { // clear
      content = {
        type: this.extensionManager.schema.topNodeType.name,
        content:
          this.extensionManager.schema.topNodeType.spec.EMPTY_DOC.content,
        // content: this.extensionManager.schema.topNodeType.createAndFill(),
      };
      mediaType = undefined;
    }

    let doc;
    if (mediaType) {
      const converter = this.extensionManager.converters[mediaType];
      if (converter) {
        doc = converter.toDoc(content);
      }
    } else {
      doc = createDocument(
        content,
        this.schema,
        this.options.parseOptions,
        { errorOnInvalidContent: false },
      );
    }

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

  public getDocument(mediaType?: string) {
    if (mediaType) {
      const converter = this.extensionManager.converters[mediaType];
      if (converter) {
        return converter.fromDoc(this.state.doc);
      }
    }

    return this.state.doc;
  }
}
