import vento from 'ventojs';
import { VERSION } from '@kerebron/editor';

const __dirname = import.meta.dirname;

export const ventoEnv = vento({
  includes: __dirname + '/../../tmpl',
});

export async function renderTemplate(
  name: string,
  data: Record<string, unknown>,
): Promise<string> {
  const template = await ventoEnv.load(name);
  return (await template({ version: VERSION, ...data })).content;
}
