type EditorPos = number;

export interface ContentMapper {
  getTextContent(): string;
  toRawTextPos(pos: EditorPos): number;
  toRawTextLineCol(pos: EditorPos): [number, number];
  fromLineChar(line: number, column: number): EditorPos;
}
