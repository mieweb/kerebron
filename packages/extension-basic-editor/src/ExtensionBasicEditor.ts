import { Extension } from '@kerebron/editor';
import { ExtensionSelection } from './ExtensionSelection.ts';
import { ExtensionBaseKeymap } from './ExtensionBaseKeymap.ts';
import { ExtensionDropcursor } from './ExtensionDropcursor.ts';
import { ExtensionGapcursor } from './ExtensionGapcursor.ts';
import { ExtensionHistory } from './ExtensionHistory.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { MarkLink } from './MarkLink.ts';
import { MarkStrong } from './MarkStrong.ts';
import { MarkItalic } from './MarkItalic.ts';
import { MarkUnderline } from './MarkUnderline.ts';
import { MarkStrike } from './MarkStrike.ts';
import { MarkCode } from './MarkCode.ts';
import { MarkChange } from './MarkChange.ts';
import { MarkBookmark } from './MarkBookmark.ts';
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
import { NodeMath } from './NodeMath.ts';
import { MarkLink } from './MarkLink.ts';
import { MarkStrong } from './MarkStrong.ts';
import { MarkItalic } from './MarkItalic.ts';
import { MarkUnderline } from './MarkUnderline.ts';
import { MarkCode } from './MarkCode.ts';
import { MarkChange } from './MarkChange.ts';
import { MarkBookmark } from './MarkBookmark.ts';
import { ExtensionHtml } from './ExtensionHtml.ts';
import { NodeDefinitionList } from './NodeDefinitionList.ts';
import { NodeDefinitionTerm } from './NodeDefinitionTerm.ts';
import { NodeDefinitionDesc } from './NodeDefinitionDesc.ts';
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
    // new ExtensionHistory(), // Removed: conflicts with ExtensionYjs
    new ExtensionHtml(),
    new ExtensionSelection(),
    new NodeDocument(),
    new NodeText(),
    new NodeParagraph(),
    new NodeHardBreak(),
    new NodeHorizontalRule(),
    new NodeOrderedList(),
    new NodeBulletList(),
    new NodeListItem(),
    new NodeDefinitionList(),
    new NodeDefinitionTerm(),
    new NodeDefinitionDesc(),
    new NodeTaskList(),
    new NodeTaskItem(),
    new NodeDefinitionList(),
    new NodeDefinitionTerm(),
    new NodeDefinitionDesc(),
    new NodeFrontmatter(),
    new NodeImage(),
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
  ];
}
