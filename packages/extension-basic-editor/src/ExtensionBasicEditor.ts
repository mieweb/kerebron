import { Extension } from '@kerebron/editor';
import { ExtensionSelection } from './ExtensionSelection.ts';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { ExtensionMediaUpload } from './ExtensionMediaUpload.ts';
import { MarkLink } from './MarkLink.ts';
import { MarkStrong } from './MarkStrong.ts';
import { MarkItalic } from './MarkItalic.ts';
import { MarkUnderline } from './MarkUnderline.ts';
import { MarkStrike } from './MarkStrike.ts';
import { MarkCode } from './MarkCode.ts';
import { MarkChange } from './MarkChange.ts';
import { MarkBookmark } from './MarkBookmark.ts';
import { MarkTextColor } from './MarkTextColor.ts';
import { MarkHighlight } from './MarkHighlight.ts';
import { NodeDocument } from './NodeDocument.ts';
import { NodeText } from './NodeText.ts';
import { NodeParagraph } from './NodeParagraph.ts';
import { NodeHardBreak } from './NodeHardBreak.ts';
import { NodeHorizontalRule } from './NodeHorizontalRule.ts';
import { NodeOrderedList } from './NodeOrderedList.ts';
import { NodeBulletList } from './NodeBulletList.ts';
import { NodeListItem } from './NodeListItem.ts';
import { NodeImage } from './NodeImage.ts';
import { NodeVideo } from './NodeVideo.ts';
import { NodeBlockquote } from './NodeBlockquote.ts';
import { NodeAside } from './NodeAside.ts';
import { NodeHeading } from './NodeHeading.ts';
import { NodeMath } from './NodeMath.ts';
import { NodeDefinitionList } from './NodeDefinitionList.ts';
import { NodeDefinitionTerm } from './NodeDefinitionTerm.ts';
import { NodeDefinitionDesc } from './NodeDefinitionDesc.ts';
import { NodeFrontmatter } from './NodeFrontmatter.ts';
import { NodeTaskList } from './NodeTaskList.ts';
import { NodeTaskItem } from './NodeTaskItem.ts';

export class ExtensionBasicEditor extends Extension {
  name = 'basic-editor';
  requires = [
    new ExtensionBaseKeymap(),
    new ExtensionDropcursor(),
    new ExtensionGapcursor(),
    new ExtensionHtml(),
    new ExtensionMediaUpload(),
    new ExtensionSelection(),
    new NodeDocument(),
    new NodeText(),
    new NodeParagraph(),
    new NodeHardBreak(),
    new NodeHorizontalRule(),
    new NodeOrderedList(),
    new NodeBulletList(),
    new NodeListItem(),
    new NodeTaskList(),
    new NodeTaskItem(),
    new NodeDefinitionList(),
    new NodeDefinitionTerm(),
    new NodeDefinitionDesc(),
    new NodeTaskList(),
    new NodeTaskItem(),
    new NodeFrontmatter(),
    new NodeImage(),
    new NodeVideo(),
    new NodeBlockquote(),
    new NodeAside(),
    new NodeHeading(),
    new NodeMath(),
    new MarkLink(),
    new MarkItalic(),
    new MarkStrong(),
    new MarkUnderline(),
    new MarkStrike(),
    new MarkCode(),
    new MarkChange(),
    new MarkBookmark(),
    new MarkTextColor(),
    new MarkHighlight(),
  ];
}
