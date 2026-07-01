import { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionCodeCrock } from '@kerebron/extension-codecrock';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionUi } from '@kerebron/extension-ui';
import { ExtensionAutocomplete } from '@kerebron/extension-ui/autocomplete';
import { ExtensionHover } from '@kerebron/extension-ui/hover';

export class AdvancedEditorKit implements EditorKit {
  name = 'advanced-editor';

  constructor(
    private menu?: ConstructorParameters<typeof ExtensionCustomMenu>[0],
  ) {
  }

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionDevToolkit(),
      new ExtensionCustomMenu(this.menu),
      new ExtensionCodeCrock(),
      new ExtensionUi(),
      new ExtensionAutocomplete(),
      new ExtensionHover(),
    ];
  }
}
