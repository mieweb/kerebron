import { Node } from 'prosemirror-model';

import {
  AnyExtensionOrReq,
  Extension,
  RawTextMapEntry,
  RawTextResult,
} from '@kerebron/editor';
import { NodeDocumentCode } from '@kerebron/extension-basic-editor/NodeDocumentCode';

import { ExtensionSelection } from './ExtensionSelection.ts';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { NodeText } from './NodeText.ts';
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

  toRawText(doc: Node): RawTextResult {
    const topNodeType = this.editor.schema.topNodeType;
    const spec = topNodeType.spec;
    const singleNodeDoc = spec.content?.indexOf('*') === -1;

    if (!singleNodeDoc) {
      throw new Error('Not a single node doc');
    }

    if (doc.children.length !== 1) {
      throw new Error('Not a single node doc');
    }

    const codeBlock = doc.children[0];

    const content = codeBlock.content.content
      .map((node) => node.text)
      .join('');

    const lines = content.split('\n');

    const rawTextMap: Array<RawTextMapEntry> = [];

    let nodeIdx = 1;
    let targetPos = 0;
    let targetRow = 0;
    for (const line of lines) {
      rawTextMap.push({
        nodeIdx: nodeIdx,
        targetRow,
        targetCol: 0,
        targetPos,
      });

      targetRow++;
      targetPos += line.length + 1;
      nodeIdx += line.length + 1;
    }

    return {
      content,
      rawTextMap,
    };
  }
}
