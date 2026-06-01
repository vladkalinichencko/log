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
      </span>
    </div>
  );
}
