import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tile } from "./Tile";

export function Modal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const path = searchParams.get("modal");

  useEffect(() => {
    if (path === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") setSearchParams({});
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [path]);

  if (path === null) return null;
  return (
    <div className="modal">
      <Tile path={path} editor titled />
    </div>
  );
}
