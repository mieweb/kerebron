import { unzip, parseContent } from "./lib/rs_lib.js";

const input = Deno.readFileSync("./example-document.odt");
const files = unzip(input);

console.log(files.get('content.xml'));
console.log(JSON.stringify(parseContent(files.get('content.xml')), null, 2));
