import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store/store";
import { search_selector } from "../store/selectors/searchSelectors";
import { fetchPaths } from "../api/client";
import { Button } from "./Button";
import { Menu } from "./Menu";

export function NavBar() {
  const navigate = useNavigate();
  const currentPath = decodeURIComponent(useLocation().pathname.slice(1));
  const segments: string[] = currentPath.split(".").filter(Boolean);

  const query = useStore((state: any) => state.query);
  const paths = useStore((state: any) => state.paths);
  const setQuery = useStore((state: any) => state.search_setQuery);
  const setPaths = useStore((state: any) => state.search_setPaths);
  const matches = useMemo(() => search_selector({ query, paths }), [query, paths]);

  useEffect(() => {
    fetchPaths()
      .then(setPaths)
      .catch((err) => console.error("Failed to fetch paths:", err));
  }, []);

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
        <span className="link" onClick={() => navigate("/")}>
          Home
        </span>
        {segments.map((seg: string, i: number) => (
          <span key={i}>
            {" › "}
            <span
              className="link"
              onClick={() => navigate("/" + segments.slice(0, i + 1).join("."))}
            >
              {seg}
            </span>
          </span>
        ))}
      </nav>
      <div className="anchor push">
        <input
          placeholder="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <Menu items={matches.map((path: string) => ({ label: path, onPick: () => go(path) }))} />
        )}
      </div>
    </div>
  );
}
