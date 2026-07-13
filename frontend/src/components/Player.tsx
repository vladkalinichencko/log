import { useEffect, useState } from "react";
import { Button } from "./Button";
import { playerFsm } from "../fsm/playerFsm";
import { fetchTensorFrame } from "../api/client";
import { useStore } from "../store/store";
import { Table, Cell, CellType, TableKind, Representation } from "../types/domain";

interface PlayerProps {
  path: string;
  run: string;
  tensorPath: string;
  steps: number[];
}

interface Frame {
  shape: number[];
  data: number[];
}

function frameTable(name: string, tileId: string, frame: Frame): Table {
  const rows = frame.shape[0] ?? 1;
  const cols = frame.shape[1] ?? frame.data.length;
  const cells: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      type: CellType.Number,
      value: String(frame.data[r * cols + c]),
      ref: null,
    }))
  );
  return {
    name,
    kind: TableKind.Grid,
    column_names: null,
    row_names: null,
    cells,
    representation: Representation.Grid,
    source_path: tileId,
  };
}

export function Player({ path, run, tensorPath, steps }: PlayerProps) {
  const loadTable = useStore((state: any) => state.tables_loadTable);
  const [playState, setPlayState] = useState(playerFsm.initial);
  const [index, setIndex] = useState(steps.length - 1);

  useEffect(() => {
    let stale = false;
    fetchTensorFrame(run, tensorPath, steps[index])
      .then((frame) => {
        if (stale) return;
        loadTable(path, frameTable(`${tensorPath} @ step ${steps[index]}`, path, frame));
      })
      .catch((err) => console.error("Failed to fetch frame:", err));
    return () => {
      stale = true;
    };
  }, [index]);

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
