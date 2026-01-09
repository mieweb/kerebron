import { Extension } from '@kerebron/editor';
import { BasicEditorKit } from './BasicEditorKit.ts';

const kit = new BasicEditorKit();

export class ExtensionBasicEditor extends Extension {
  name = 'basic-editor';
  requires = kit.getExtensions();
}
