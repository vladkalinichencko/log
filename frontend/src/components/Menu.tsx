interface MenuItem {
  label: string;
  onPick: () => void;
}

interface MenuProps {
  items: MenuItem[];
  at?: { x: number; y: number };
}

export function Menu({ items, at }: MenuProps) {
  return (
    <div className="menu" style={at ? { position: "fixed", left: at.x, top: at.y } : undefined}>
      {items.map((item) => (
        <div key={item.label} onClick={item.onPick}>
          {item.label}
        </div>
      ))}
    </div>
  );
}
