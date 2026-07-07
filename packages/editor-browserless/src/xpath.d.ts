declare module 'xpath' {
  export interface XPathEvaluateOptions {
    node: Node;
    namespaces?: Record<string, string>;
    functions?: Record<string, (...args: any[]) => any>;
    variables?: Record<string, unknown>;
    allowAnyNamespaceForNoPrefix?: boolean;
    isHtml?: boolean;
  }

  export interface XPathEvalResult {
    nodes: Node[];
    numberValue(): number;
    stringValue(): string;
    booleanValue(): boolean;
    nodeset(): { toArray(): Node[] };
  }

  export interface XPathEvaluator {
    evaluate(options: XPathEvaluateOptions): XPathEvalResult;
    evaluateNumber(options: XPathEvaluateOptions): number;
    evaluateString(options: XPathEvaluateOptions): string;
    evaluateBoolean(options: XPathEvaluateOptions): boolean;
    evaluateNodeSet(options: XPathEvaluateOptions): { toArray(): Node[] };
    select(options: XPathEvaluateOptions): Node[];
    select1(options: XPathEvaluateOptions): Node | undefined;
  }

  export function parse(expression: string): XPathEvaluator;
}
