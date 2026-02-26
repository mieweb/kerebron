import { RewriteRule, wgdTest } from './wgdTest.ts';

const rewriteRules: RewriteRule[] = [
  {
    match:
      /(?:https?:\/\/)?(?:www\\.)?(?:youtube\.com\/(?:[^\/\\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    replace: 'https://youtube.be/$1',
    mdTemplate: '[$label]($href)',
  },
  {
    match: /https:\/\/github.com\/mieweb\/docs_video\/blob\/main\/([^/]+)$/,
    replace: 'https://cloudflare.com/$1',
    mdTemplate:
      '[https://cloudflare.com/$basename](https://cloudflare.com/$basename)',
  },
  {
    match: /.png$/,
    mdTemplate: '<img src="$src" />',
  },
];

wgdTest('rewrite-rules.odt', { debug: true, rewriteRules });
