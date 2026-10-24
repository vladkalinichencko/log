import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tile } from "./Tile";
import { Settings } from "./Settings";
import { Button } from "./Button";
import { with_param } from "../store/selectors/pathSelectors";

export function Modal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const path = searchParams.get("modal");
  const settings = searchParams.get("settings");
  const open = path !== null || settings !== null;
  const close = () => setSearchParams(with_param(with_param(searchParams, "modal", null), "settings", null));

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, searchParams, setSearchParams]);

  if (!open) return null;
  return (
    <div className="modal">
      {settings ? (
        <>
          <div className="bar">
            <span className="tile-name">settings</span>
            <Button icon="close" ghost title="close" onClick={close} />
          </div>
          <Settings />
        </>
      ) : (
        <Tile path={path!} editor titled />
      )}
    </div>
  );
}
