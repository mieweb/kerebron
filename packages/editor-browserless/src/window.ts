// import { DOMParser } from 'jsr:@b-fuze/deno-dom'; // No xml support (mathML) https://github.com/b-fuze/deno-dom/issues?q=is%3Aissue%20state%3Aopen%20xml
import { DOMParser } from 'linkedom';
import { XMLSerializer } from 'xmldom';

globalThis.DOMParser = DOMParser as any;
globalThis.XMLSerializer = XMLSerializer;
const doc: any = new DOMParser().parseFromString(
  '<html lang="en"><body></body></html>',
  'text/html',
)!;
// const doc = new DOMParser().parseFromString('<html><body></body></html>', "application/xhtml+xml")!;

doc.implementation = {
  createHTMLDocument() {
    return new DOMParser().parseFromString(
      '<html lang="en"><body></body></html>',
      'text/html',
    )!;
  },
};

globalThis.document = doc as any;
