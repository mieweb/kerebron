import { parse_content, parse_styles, unzip } from './lib/rs_lib.js';

const input = Deno.readFileSync(
  '../extension-odt/test/odt_md/example-document.odt',
);
const files = unzip(input);

console.log(JSON.stringify(parse_content(files.get('content.xml')), null, 2));
// console.log(JSON.stringify(parse_styles(files.get('content.xml')), null, 2));
