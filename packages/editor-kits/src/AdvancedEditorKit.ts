import { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { ExtensionBasicEditor } from '@kerebron/extension-basic-editor/ExtensionBasicEditor';
import { ExtensionCodeJar } from '@kerebron/extension-codejar';
import { ExtensionDevToolkit } from '@kerebron/extension-dev-toolkit';
import { ExtensionMarkdown } from '@kerebron/extension-markdown';
import { ExtensionCustomMenu } from '@kerebron/extension-menu';
import { ExtensionOdt } from '@kerebron/extension-odt';
import { ExtensionTables } from '@kerebron/extension-tables';
import { ExtensionAutocomplete } from '@kerebron/extension-autocomplete';

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
      new ExtensionCodeJar(),
      new ExtensionAutocomplete(),
    ];
  }
}
