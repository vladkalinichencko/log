import { useSearchParams } from "react-router-dom";
import { Tile } from "./Tile";
import { Button } from "./Button";

export function Modal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const path = searchParams.get("modal");
  if (path === null) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: 20,
        right: 20,
        bottom: 20,
        background: "white",
        border: "1px solid",
        overflow: "auto",
      }}
    >
      <Button label="close" onClick={() => setSearchParams({})} />
      <Tile path={path} />
    </div>
  );
}
