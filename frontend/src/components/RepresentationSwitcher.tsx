import { Table } from "../types/domain";
import { applicable } from "./render";
import { useStore } from "../store/store";
import { Button } from "./Button";

interface RepresentationSwitcherProps {
  table: Table;
  tileId: string;
}

export function RepresentationSwitcher({ table, tileId }: RepresentationSwitcherProps) {
  const setRepresentation = useStore((state: any) => state.tiles_setRepresentation);
  return (
    <div>
      {applicable(table).map((rep) => (
        <Button key={rep} label={rep} onClick={() => setRepresentation(tileId, rep)} />
      ))}
    </div>
  );
}
