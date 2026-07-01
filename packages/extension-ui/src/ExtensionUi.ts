import { Extension } from '@kerebron/editor';
import { OverLayer } from '@kerebron/extension-ui/OverLayer';

export class ExtensionUi extends Extension {
  name = 'ui';

  override created(): void {
    this.editor.ci.register('overlayer', new OverLayer());
  }
}
