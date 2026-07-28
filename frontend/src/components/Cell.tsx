import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cell as CellData, CellType } from "../types/domain";
import { cellEditFsm } from "../fsm/cellEditFsm";
import { useStore } from "../store/store";

interface CellProps {
  cell: CellData;
  tableId: string;
  rowIndex: number;
  colIndex: number;
  editable?: boolean;
  selected?: boolean;
  onSelect?: (event: React.MouseEvent) => void;
  onExtend?: () => void;
}

export function Cell({
  cell,
  tableId,
  rowIndex,
  colIndex,
  editable,
  selected,
  onSelect,
  onExtend,
}: CellProps) {
  const editCell = useStore((state: any) => state.tables_editCell);
  const navigate = useNavigate();
  const [editState, setEditState] = useState(cellEditFsm.initial);
  const [editValue, setEditValue] = useState(cell.value);

  if (cell.type === CellType.TableRef && cell.ref) {
    return (
      <span className="cell link" onClick={() => navigate(`/${cell.ref}`)}>
        {cell.value}
      </span>
    );
  }

  if (!editable) {
    return <span className="cell">{cell.value}</span>;
  }

  const handleDoubleClick = () => {
    setEditState(cellEditFsm.next(editState, "dblclick"));
    setEditValue(cell.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      editCell(tableId, rowIndex, colIndex, editValue);
      setEditState(cellEditFsm.next(editState, "enter"));
    } else if (e.key === "Escape") {
      setEditState(cellEditFsm.next(editState, "esc"));
      setEditValue(cell.value);
    }
  };

  if (editState === "editing") {
    return (
      <input
        className="cell-input"
        type="text"
        size={1}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <span
      className={selected ? "cell selected" : "cell"}
      onMouseDown={onSelect}
      onMouseEnter={onExtend}
      onDoubleClick={handleDoubleClick}
    >
      {cell.value}
    </span>
  );
}
