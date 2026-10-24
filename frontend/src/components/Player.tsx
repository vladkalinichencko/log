import { useEffect, useState } from "react";
import { Button } from "./Button";
import { playerFsm } from "../fsm/playerFsm";
import { trailFsm } from "../fsm/trailFsm";
import { TRAJECTORY_COLUMNS } from "./render";
import { TensorFrames } from "../store/slices/tablesSlice";
import { useStore } from "../store/store";
import { Table, Cell, CellType, Frame, TableKind, Representation } from "../types/domain";

interface PlayerProps {
  path: string;
  leaf: string;
  tensor: TensorFrames;
}

const numberCell = (value: number): Cell => ({
  type: CellType.Number,
  value: String(value),
  ref: null,
});

const gridTable = (name: string, tileId: string, column_names: string[] | null, cells: Cell[][]): Table => ({
  name,
  kind: TableKind.Grid,
  column_names,
  row_names: null,
  cells,
  representation: Representation.Grid,
  source_path: tileId,
});

export function frameTable(name: string, tileId: string, frame: Frame): Table {
  const rows = frame.shape[0] ?? 1;
  const cols = frame.shape[1] ?? frame.data.length;
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => numberCell(frame.data[r * cols + c]))
  );
  return gridTable(name, tileId, null, cells);
}

export function trajectoryTable(
  name: string,
  tileId: string,
  steps: number[],
  frames: Frame[],
  uptoIndex: number
): Table {
  const cells: Cell[][] = [];
  for (let i = 0; i <= uptoIndex; i++) {
    const points = frames[i].shape[0] ?? 1;
    for (let p = 0; p < points; p++) {
      cells.push([
        numberCell(steps[i]),
        numberCell(p),
        numberCell(frames[i].data[p * 2]),
        numberCell(frames[i].data[p * 2 + 1]),
      ]);
    }
  }
  return gridTable(name, tileId, [...TRAJECTORY_COLUMNS], cells);
}

export function Player({ path, leaf, tensor: { steps, frames } }: PlayerProps) {
  const loadTable = useStore((state) => state.tables_loadTable);
  const [playState, setPlayState] = useState(playerFsm.initial);
  const [trailState, setTrailState] = useState(trailFsm.initial);
  const [index, setIndex] = useState(steps.length - 1);

  useEffect(() => {
    const name = `${leaf} @ step ${steps[index]}`;
    loadTable(
      path,
      trailState === "on"
        ? trajectoryTable(name, path, steps, frames, index)
        : frameTable(name, path, frames[index])
    );
  }, [index, frames, trailState]);

  useEffect(() => {
    if (playState !== "playing") return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1 < steps.length ? i + 1 : i)),
      500
    );
    return () => window.clearInterval(timer);
  }, [playState]);

  useEffect(() => {
    if (playState === "playing" && index === steps.length - 1)
      setPlayState((s) => playerFsm.next(s, "end"));
  }, [index, playState]);

  const playing = playState === "playing";
  const isPoints = frames[0]?.shape[1] === 2;
  return (
    <div className="bar">
      <Button
        icon={playing ? "pause" : "play"}
        ghost
        title={playing ? "pause" : "play"}
        onClick={() => {
          if (!playing && index === steps.length - 1) setIndex(0);
          setPlayState((s) => playerFsm.next(s, playing ? "pause" : "play"));
        }}
      />
      {isPoints && (
        <Button
          icon="trail"
          ghost
          active={trailState === "on"}
          title="trajectory"
          onClick={() => setTrailState((s) => trailFsm.next(s, "toggle"))}
        />
      )}
      <input
        className="grow"
        type="range"
        min={0}
        max={steps.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
      />
      <span>step {steps[index]}</span>
    </div>
  );
}
