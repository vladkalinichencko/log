import { ReactNode } from "react";
import { snapWidth, TILE_SIZE } from "../store/slices/tilesSlice";
import { useStore } from "../store/store";
import { ArrangeItem } from "../modules/arrange";
import { ResizeHandle } from "./ResizeHandle";

interface TileFrameProps {
  path: string;
  arranged?: boolean;
  children: ReactNode;
}

export function TileFrame({ path, arranged, children }: TileFrameProps) {
  const w = useStore((state) => state.tiles.get(path)?.w) ?? TILE_SIZE.w;
  const h = useStore((state) => state.tiles.get(path)?.h) ?? TILE_SIZE.h;
  const setSize = useStore((state) => state.tiles_setSize);
  const content = (
    <>
      {children}
      <ResizeHandle
        onResize={(dw, dh, done) =>
          setSize(path, done ? snapWidth(w + dw, window.innerWidth - 24) : w + dw, h + dh)
        }
      />
    </>
  );

  return arranged ? (
    <ArrangeItem id={path} className="tile" style={{ width: w, height: h }}>{content}</ArrangeItem>
  ) : (
    <div className="tile" style={{ width: w, height: h }}>{content}</div>
  );
}
