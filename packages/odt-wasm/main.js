import { unzip, parse_styles } from "./lib/rs_lib.js";

const input = Deno.readFileSync("./example-document.odt");
const files = unzip(input);

console.log(files.get('content.xml'));
console.log(JSON.stringify(parse_styles(files.get('content.xml')), null, 2));
