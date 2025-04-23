import { CellSelection } from './CellSelection.ts';

export function isCellSelection(value: unknown): value is CellSelection {
  return value instanceof CellSelection;
}
