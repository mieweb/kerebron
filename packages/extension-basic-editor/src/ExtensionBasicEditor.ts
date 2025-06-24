import { Extension } from '@kerebron/editor';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { NodeDocument } from './NodeDocument.ts';
import { NodeText } from './NodeText.ts';
import { NodeParagraph } from './NodeParagraph.ts';
import { NodeHardBreak } from './NodeHardBreak.ts';
import { NodeHorizontalRule } from './NodeHorizontalRule.ts';
import { NodeOrderedList } from './NodeOrderedList.ts';
import { NodeBulletList } from './NodeBulletList.ts';
import { NodeListItem } from './NodeListItem.ts';
import { NodeImage } from './NodeImage.ts';
import { NodeBlockquote } from './NodeBlockquote.ts';
import { NodeAside } from './NodeAside.ts';
import { NodeHeading } from './NodeHeading.ts';
import { MarkLink } from './MarkLink.ts';
import { MarkStrong } from './MarkStrong.ts';
import { MarkItalic } from './MarkItalic.ts';
import { MarkUnderline } from './MarkUnderline.ts';
import { MarkCode } from './MarkCode.ts';
import { MarkChange } from './MarkChange.ts';
import { MarkBookmark } from './MarkBookmark.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';

export class ExtensionBasicEditor extends Extension {
  name = 'basic-editor';
  requires = [
    new ExtensionBaseKeymap(),
    new ExtensionDropcursor(),
    new ExtensionGapcursor(),
    new ExtensionHtml(),
    new NodeDocument(),
    new NodeText(),
    new NodeParagraph(),
    new NodeHardBreak(),
    new NodeHorizontalRule(),
    new NodeOrderedList(),
    new NodeBulletList(),
    new NodeListItem(),
    new NodeImage(),
    new NodeBlockquote(),
    new NodeAside(),
    new NodeHeading(),
    new MarkLink(),
    new MarkItalic(),
    new MarkStrong(),
    new MarkUnderline(),
    new MarkCode(),
    new MarkChange(),
    new MarkBookmark(),
  ];
}
