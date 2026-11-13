import * as fs from 'node:fs';
import type { Hono } from 'hono';

import { markdownToHtml } from './markdown.ts';
import { renderTemplate } from './vento.ts';

const __dirname = import.meta.dirname;
const examplesDir = __dirname + '/../../../';
const docsDir = __dirname + '/../../../../docs/';

export const examples = fs.readdirSync(examplesDir, { withFileTypes: true })
  .filter((file) => file.name.startsWith('browser-'))
  .map((file) => ({ name: file.name }));

export async function install(
  { app, isBuild }: { app: Hono; isBuild: boolean | undefined },
) {
  const toc = JSON.parse(
    new TextDecoder().decode(fs.readFileSync(docsDir + '/toc.json')),
  );

  for (const example of examples) {
    app.get('/examples/' + example.name + '.html', async (c) => {
      const readmeMd = fs.readFileSync(
        examplesDir + example.name + '/README.md',
      );

      const readmeHtml = await markdownToHtml(readmeMd, {
        example: example.name,
      });

      const pageHtml = await renderTemplate('example.vto', {
        readmeHtml,
        examples,
        toc,
      });

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
