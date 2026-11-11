import { TemplatesRegistry } from '../mod.ts';
import { roomTemplateRegistry } from './roomTemplateRegistry.ts';

export const bootstrapTemplateRegistry: TemplatesRegistry = {
  ...roomTemplateRegistry,
};
