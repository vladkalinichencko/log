import { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store/store";
import { search_selector } from "../store/selectors/searchSelectors";
import { fetchPaths } from "../api/client";
import { Button } from "./Button";

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

  const go = (path: string) => {
    navigate("/" + path);
    setQuery("");
  };

  return (
    <div className="group">
      <Button icon="back" ghost title="back" onClick={() => navigate(-1)} />
      <Button icon="forward" ghost title="forward" onClick={() => navigate(1)} />
      <nav>
        <span style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          Home
        </span>
        {segments.map((seg: string, i: number) => (
          <span key={i}>
            {" / "}
            <span
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/" + segments.slice(0, i + 1).join("."))}
            >
              {seg}
            </span>
          </span>
        ))}
      </nav>
      <div className="search">
        <input
          placeholder="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="menu">
            {matches.map((path: string) => (
              <div key={path} onClick={() => go(path)}>
                {path}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
