import { type NodeSpec } from 'prosemirror-model';
import { Node } from '@kerebron/editor';

// import { MathMLToLaTeX } from 'mathml-to-latex';
// const latex = MathMLToLaTeX.convert(mathMl);
// https://mathlive.io/mathfield/

export class NodeMath extends Node {
  override name = 'math';
  requires = ['doc'];

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      attrs: {
        type: { default: 'mathml' },
        content: {},
      },
      group: 'inline',
      draggable: true,
      // parseDOM: [
      //   {
      //     tag: 'math',
      //     getAttrs(dom: HTMLElement) {
      //       return {
      //         content: dom.outerHTML,
      //       };
      //     },
      //   },
      // ],
      parseDOM: [{
        tag: 'math',
        getAttrs: (dom) => ({
          type: 'mathml',
          content: new XMLSerializer().serializeToString(dom),
        }),
      }],
      toDOM(node) {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(
          node.attrs.content,
          'application/xml',
        );

        // Check for parsing errors (e.g., invalid XML)
        const errorNode = parsed.getElementsByTagName('parsererror');
        if (errorNode.length > 0) {
          return ['span', { class: 'mathml-error' }, 'Invalid MathML'];
        }

        // Import and return the parsed MathML element
        return document.importNode(parsed.documentElement, true);
        // const { xml } = node.attrs;
        // return ['math', {}, []];
      },
    };
  }
}

/*
MathML vs. LaTeX: Which is Better for Web Math Equations?
Neither is universally "better"—it depends on your goals (authoring, rendering, accessibility, or storage). MathML and LaTeX serve different primary purposes but can complement each other on the web (e.g., via converters like MathJax). Here's a comparison focused on web use:
Key Differences

Purpose:

LaTeX: A human-readable markup language for typesetting math (e.g., $E=mc^2$). It's concise and widely used for authoring documents, papers, and web input. Not native to HTML; requires a processor (e.g., MathJax, KaTeX) to render as HTML/CSS/SVG.
MathML: An XML-based standard (part of HTML5) for describing math structure and presentation (Presentation MathML for visuals; Content MathML for semantics). Designed for direct embedding in web pages (e.g., <math><mi>E</mi>=<mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math>). Browsers like Firefox and Safari support it natively; others need polyfills.


Ease of Authoring:

LaTeX: Wins for humans—shorter, intuitive syntax familiar to mathematicians. Easier to write/edit manually or in editors like Overleaf. Verbose MathML is painful for hand-coding complex equations.
MathML: Better for programmatic generation (e.g., from tools or APIs) due to its structured XML. Use WYSIWYG editors (like those above) to avoid writing tags.


Rendering on Web:

LaTeX: Requires a JS library (MathJax ~300KB, KaTeX lighter ~100KB) for cross-browser display. Renders beautifully everywhere but adds load time and JS dependency. No native browser support.
MathML: Native in Firefox/Safari (fast, no JS). Improving in Chrome/Edge (as of 2023+), but still needs MathJax fallback for full support. Outputs scalable HTML/CSS without images.


Accessibility:

MathML: Superior—semantic structure allows screen readers (e.g., NVDA with MathCAT, JAWS) to read equations meaningfully (e.g., "E equals m times c squared"). Essential for WCAG/ADA compliance.
LaTeX: Poor native accessibility; screen readers treat it as plain text. MathJax can convert to MathML internally for better support, but raw LaTeX fails.


Performance & Compatibility:

LaTeX: Faster authoring, but rendering depends on the library. Universal via JS, but increases page weight.
MathML: Lightweight native rendering where supported; more robust for search engines/parsing (e.g., Google indexes MathML). Less portable outside web (LaTeX dominates PDFs/print).


Storage/Interoperability:

LaTeX: Compact for databases/files. Easy to convert to MathML (via tools like texmath or Pandoc).
MathML: Better for web standards (XML parsable), but bulkier. Ideal for exchange between math tools.



Recommendation

Use LaTeX if your focus is easy input/authoring (e.g., users typing equations) and you're okay with a renderer like MathJax. It's more practical for most web projects today due to familiarity and tools. Store as LaTeX, render via JS, and convert to MathML for accessibility if needed.
Use MathML if prioritizing native web standards, accessibility, or programmatic output (e.g., from editors). It's "better" for semantic web math and future-proofing (browser support is growing), but pair with LaTeX input for usability.
Hybrid Approach: Best for web—author in LaTeX, convert/output MathML for display/storage. Libraries like MathJax handle both seamlessly (input LaTeX, output rendered MathML). This gives LaTeX's simplicity with MathML's benefits.

If accessibility is key, always generate MathML (even from LaTeX source). Test in browsers: LaTeX+MathJax works everywhere; pure MathML shines in Firefox but needs fallbacks elsewhere.
*/
