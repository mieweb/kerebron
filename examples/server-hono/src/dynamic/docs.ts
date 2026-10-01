import * as fs from 'node:fs';
import type { Hono } from 'hono';

import { markdownToHtml } from './markdown.ts';
import { renderTemplate } from './vento.ts';
import { examples } from './examples.ts';

const __dirname = import.meta.dirname;
const docsDir = __dirname + '/../../../../docs/';

const docSites = fs.readdirSync(docsDir, { withFileTypes: true })
  .filter((file) => file.isFile() && file.name.endsWith('.md'))
  .map((file) => file.name);

export function install({ app }: { app: Hono }) {
  for (const docSite of docSites) {
    let targetUri = docSite.replace('.md', '.html');
    if (targetUri.endsWith('/index.html')) {
      targetUri = targetUri.substring(
        0,
        targetUri.length - '/index.html'.length,
      );
    }
    if (targetUri === 'index.html') {
      targetUri = '';
    }

    app.get('/' + targetUri, async (c) => {
      const buffer = fs.readFileSync(docsDir + docSite);

      const contentHtml = await markdownToHtml(buffer);

      return c.html(
        await renderTemplate('static.vto', { contentHtml, examples }),
      );
    });
  }

  app.notFound(async (c) => {
    return c.html(await renderTemplate('404.vto', { examples }));
  });
}
