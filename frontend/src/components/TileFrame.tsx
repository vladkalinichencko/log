import { ReactNode, useState } from "react";
import { dragFsm } from "../fsm/dragFsm";
import { snapWidth, TILE_SIZE } from "../store/slices/tilesSlice";
import { useStore } from "../store/store";
import { ArrangeItem } from "../modules/arrange";
import { ResizeHandle } from "./ResizeHandle";

const SIZE_TRANSITION = "width var(--motion-slow) var(--motion-curve), height var(--motion-slow) var(--motion-curve)";

interface TileFrameProps {
  path: string;
  arranged?: boolean;
  children: ReactNode;
}

export function TileFrame({ path, arranged, children }: TileFrameProps) {
  const w = useStore((state) => state.tiles.get(path)?.w) ?? TILE_SIZE.w;
  const h = useStore((state) => state.tiles.get(path)?.h) ?? TILE_SIZE.h;
  const setSize = useStore((state) => state.tiles_setSize);
  const [resize, setResize] = useState(dragFsm.initial);
  const style = { width: w, height: h, transition: resize === "dragging" ? undefined : SIZE_TRANSITION };
  const content = (
    <>
      {children}
      <ResizeHandle
        onResize={(dw, dh, done) => {
          setResize((state) => dragFsm.next(state, done ? "up" : "down"));
          setSize(path, done ? snapWidth(w + dw, window.innerWidth - 24) : w + dw, h + dh);
        }}
      />
    </>
  );

  return arranged ? (
    <ArrangeItem id={path} className="tile" style={style}>{content}</ArrangeItem>
  ) : (
    <div className="tile" style={style}>{content}</div>
  );
}
