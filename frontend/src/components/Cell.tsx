import { Link } from "react-router-dom";
import { Cell as CellData, CellType } from "../types/domain";
import { EditableText } from "./EditableText";

interface CellProps {
  cell: CellData;
  editable?: boolean;
  selected: boolean;
  onCommit: (value: string) => void;
  onSelect: (event: React.MouseEvent) => void;
  onExtend: () => void;
}

export function Cell({ cell, editable, selected, onCommit, onSelect, onExtend }: CellProps) {
  if (cell.type === CellType.TableRef && cell.ref) {
    return (
      <Link className="cell link" to={`/${cell.ref}`}>
        {cell.value}
      </Link>
    );
  }
  if (!editable) {
    return <span className="cell">{cell.value}</span>;
  }
  return (
    <EditableText
      className={selected ? "cell selected" : "cell"}
      value={cell.value}
      onCommit={onCommit}
      onMouseDown={onSelect}
      onMouseEnter={onExtend}
    />
  );
}
