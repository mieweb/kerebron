import { AnyExtensionOrReq, Extension } from '@kerebron/editor';
import { ExtensionSelection } from './ExtensionSelection.ts';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { ExtensionMediaUpload } from './ExtensionMediaUpload.ts';
import { NodeText } from './NodeText.ts';
import { NodeDocumentCode } from '@kerebron/extension-codemirror';
import { ExtensionRemoteSelection } from './remote-selection/ExtensionRemoteSelection.ts';

export class ExtensionBasicCodeEditor extends Extension {
  name = 'basic-code-editor';
  requires: AnyExtensionOrReq[];

  constructor({ lang }: { lang: string }) {
    super();

    this.requires = [
      new ExtensionBaseKeymap(),
      new ExtensionDropcursor(),
      new ExtensionGapcursor(),
      new ExtensionHtml(),
      new ExtensionRemoteSelection(),
      new ExtensionSelection(),
      new NodeDocumentCode({ lang }),
      new NodeText(),
    ];
  }
}
