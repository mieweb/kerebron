/** Error codes returned from tree-sitter query parsing */
export const QueryErrorKind = {
  Syntax: 1,
  NodeName: 2,
  FieldName: 3,
  CaptureName: 4,
  PatternStructure: 5,
} as const;

/** An error that occurred while parsing a query string. */
export type QueryErrorKind = typeof QueryErrorKind[keyof typeof QueryErrorKind];

/** Information about a {@link QueryError}. */
export interface QueryErrorInfo {
  [QueryErrorKind.NodeName]: { word: string };
  [QueryErrorKind.FieldName]: { word: string };
  [QueryErrorKind.CaptureName]: { word: string };
  [QueryErrorKind.PatternStructure]: { suffix: string };
  [QueryErrorKind.Syntax]: { suffix: string };
}

export class QueryError extends Error {
  constructor(
    public kind: QueryErrorKind,
    public info: QueryErrorInfo[typeof kind],
    public index: number,
    public length: number,
  ) {
    super(QueryError.formatMessage(kind, info));
    this.name = 'QueryError';
  }

  /** Formats an error message based on the error kind and info */
  private static formatMessage(
    kind: QueryErrorKind,
    info: QueryErrorInfo[QueryErrorKind],
  ): string {
    switch (kind) {
      case QueryErrorKind.NodeName:
        return `Bad node name '${(info as QueryErrorInfo[2]).word}'`;
      case QueryErrorKind.FieldName:
        return `Bad field name '${(info as QueryErrorInfo[3]).word}'`;
      case QueryErrorKind.CaptureName:
        return `Bad capture name @${(info as QueryErrorInfo[4]).word}`;
      case QueryErrorKind.PatternStructure:
        return `Bad pattern structure at offset ${
          (info as QueryErrorInfo[5]).suffix
        }`;
      case QueryErrorKind.Syntax:
        return `Bad syntax at offset ${(info as QueryErrorInfo[1]).suffix}`;
    }
  }
}

export interface QueryOptions {
  matchLimit?: number;
}
