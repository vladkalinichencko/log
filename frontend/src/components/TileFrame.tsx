import { HTMLAttributes } from "react";
import { snapWidth, TILE_SIZE } from "../store/slices/tilesSlice";
import { useStore } from "../store/store";
import { ResizeHandle } from "./ResizeHandle";

interface TileFrameProps extends HTMLAttributes<HTMLDivElement> {
  path: string;
}

export function TileFrame({ path, children, ...attributes }: TileFrameProps) {
  const w = useStore((state) => state.tiles.get(path)?.w) ?? TILE_SIZE.w;
  const h = useStore((state) => state.tiles.get(path)?.h) ?? TILE_SIZE.h;
  const setSize = useStore((state) => state.tiles_setSize);

  return (
    <div className="tile" style={{ width: w, height: h }} {...attributes}>
      {children}
      <ResizeHandle
        onResize={(dw, dh, done) =>
          setSize(path, done ? snapWidth(w + dw, window.innerWidth - 24) : w + dw, h + dh)
        }
      />
    </div>
  );
}
