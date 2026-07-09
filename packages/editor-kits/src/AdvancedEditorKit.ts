import { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionCodeCrock } from '@kerebron/extension-codecrock';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionUi } from '@kerebron/extension-ui';
import { ExtensionAutocomplete } from '@kerebron/extension-ui/autocomplete';
import { ExtensionHover } from '@kerebron/extension-ui/hover';

export class AdvancedEditorKit implements EditorKit {
  name = 'advanced-editor';

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionBasicEditor(),
      new ExtensionHistory(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionDevToolkit(),
      new ExtensionCustomMenu(),
      new ExtensionCodeCrock(),
      new ExtensionUi(),
      new ExtensionAutocomplete(),
      new ExtensionHover(),
    ];
  }
}
