import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { search_selector } from "../store/selectors/searchSelectors";
import { path_segments } from "../store/selectors/pathSelectors";
import { useCurrentPath } from "./useCurrentPath";
import { Button } from "./Button";
import { Menu } from "./Menu";

export function NavBar() {
  const navigate = useNavigate();
  const currentPath = useCurrentPath();
  const segments = path_segments(currentPath);
  const query = useStore((state) => state.query);
  const paths = useStore((state) => state.paths);
  const matches = useMemo(() => search_selector({ query, paths }), [query, paths]);
  const setQuery = useStore((state) => state.search_setQuery);
  const crumbs = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = crumbs.current;
    if (!nav) return;
    nav.classList.toggle("scrollable", nav.scrollWidth > nav.clientWidth + 1);
  }, [currentPath]);

  const go = (path: string) => {
    navigate("/" + path);
    setQuery("");
  };

  const historyIndex = (window.history.state?.idx as number | undefined) ?? 0;

  return (
    <div className="group grow">
      <Button icon="back" ghost title="back" disabled={historyIndex === 0} onClick={() => navigate(-1)} />
      <Button icon="forward" ghost title="forward" onClick={() => navigate(1)} />
      <nav className="fade-scroll-x" ref={crumbs}>
        <Link className="link" to="/">
          Home
        </Link>
        {segments.map((segment, i) => (
          <span key={i}>
            {" › "}
            <Link className="link" to={"/" + segments.slice(0, i + 1).join(".")}>
              {segment}
            </Link>
          </span>
        ))}
      </nav>
      <div className="anchor push">
        <input placeholder="Go to table…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {matches.length > 0 && <Menu items={matches.map((path) => ({ label: path, onPick: () => go(path) }))} />}
      </div>
    </div>
  );
}
