import { Extension } from '@kerebron/editor';
import { NodeCodeJar } from './NodeCodeJar.ts';

export * from './NodeCodeJar.ts';

export interface ExtensionCodeJarConfig {
  readOnly?: boolean;
  languageWhitelist?: string[];
}

export class ExtensionCodeJar extends Extension {
  override name = 'code-jar';

  nodeCodeJar = new NodeCodeJar({});
  requires = [
    this.nodeCodeJar,
  ];

  constructor(public override config: ExtensionCodeJarConfig = {}) {
    super(config);
  }

  override created(): void {
    this.nodeCodeJar.config.languageWhitelist = this.config.languageWhitelist;
    // theme: config.theme,
  }
}
