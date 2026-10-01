import * as fs from 'node:fs';
import type { Hono } from 'hono';

import { markdownToHtml } from './markdown.ts';
import { renderTemplate } from './vento.ts';

const __dirname = import.meta.dirname;
const examplesDir = __dirname + '/../../../';

export const examples = fs.readdirSync(examplesDir, { withFileTypes: true })
  .filter((file) => file.name.startsWith('browser-'))
  .map((file) => file.name);

export async function install(
  { app, isBuild }: { app: Hono; isBuild: boolean | undefined },
) {
  for (const example of examples) {
    const readmeMd = fs.readFileSync(examplesDir + example + '/README.md');

    const readmeHtml = await markdownToHtml(readmeMd, { example });

    const pageHtml = await renderTemplate('example.vto', {
      readmeHtml,
      examples,
    });

    app.get('/examples/' + example + '.html', async (c) => {
      try {
        return c.html(pageHtml);
      } catch (error) {
        if (isBuild) {
          throw error;
        }
        return c.html(await renderTemplate('error.vto', { error }), 500);
      }
    });
  }
}
