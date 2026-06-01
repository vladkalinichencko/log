import { useNavigate, useLocation } from "react-router-dom";

export function NavBar() {
  const navigate = useNavigate();
  const currentPath = decodeURIComponent(useLocation().pathname.slice(1));
  const segments: string[] = currentPath.split(".").filter(Boolean);

  return (
    <div>
      <button onClick={() => navigate(-1)}>←</button>
      <button onClick={() => navigate(1)}>→</button>
      <span>
        {segments.length === 0
          ? "Home"
          : segments.map((seg: string, i: number) => (
              <span key={i}>
                {i > 0 && " / "}
                {seg}
              </span>
            ))}
      </span>
    </div>
  );
}
