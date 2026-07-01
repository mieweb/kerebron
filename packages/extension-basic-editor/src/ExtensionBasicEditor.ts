import { Extension } from '@kerebron/editor';
import { OverLayer } from '@kerebron/extension-ui/OverLayer';

import { BasicEditorKit } from './BasicEditorKit.ts';

const kit = new BasicEditorKit();

export class ExtensionBasicEditor extends Extension {
  name = 'basic-editor';
  requires = kit.getExtensions();

  override created(): void {
    this.editor.ci.register('overlayer', new OverLayer());
  }
}
