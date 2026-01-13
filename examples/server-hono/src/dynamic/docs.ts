import * as fs from 'node:fs';
import type { Hono } from 'hono';

import { markdownToHtml } from './markdown.ts';
import { ventoEnv } from './vento.ts';
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

      const template = await ventoEnv.load('static.vto');
      const result = await template({ contentHtml, examples });

      return c.html(result.content);
    });
  }

  app.notFound(async (c) => {
    const template = await ventoEnv.load('404.vto');
    const result = await template({ examples });

    return c.html(result.content);
  });
}
