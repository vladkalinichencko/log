import { useStore } from "../store/store";

export function NavBar() {
  const currentPath = useStore((state: any) => state.currentPath) as string;
  const route_back = useStore((state: any) => state.route_back);
  const route_forward = useStore((state: any) => state.route_forward);

  const segments: string[] = currentPath.split(".").filter(Boolean);

  return (
    <div>
      <button onClick={route_back}>←</button>
      <button onClick={route_forward}>→</button>
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
