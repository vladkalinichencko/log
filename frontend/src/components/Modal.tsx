import { useSearchParams } from "react-router-dom";
import { Tile } from "./Tile";
import { Button } from "./Button";

export function Modal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const path = searchParams.get("modal");
  if (path === null) return null;
  return (
    <div className="modal">
      <Button label="close" onClick={() => setSearchParams({})} />
      <Tile path={path} />
    </div>
  );
}
