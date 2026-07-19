import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, IconName } from "./Icon";

interface MenuItem {
  label: string;
  icon?: IconName;
  swatch?: string;
  onPick: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuProps {
  items?: MenuItem[];
  sections?: MenuSection[];
  at?: { x: number; y: number };
}

export function Menu({ items, sections, at }: MenuProps) {
  const flat = sections ? sections.flatMap((section) => section.items) : items ?? [];
  const [active, setActive] = useState(-1);
  const [shift, setShift] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    const rect = root.current.getBoundingClientRect();
    const overflow = rect.right - shift - (window.innerWidth - 8);
    setShift(overflow > 0 ? -overflow : 0);
    for (const pane of [root.current, ...root.current.querySelectorAll(".fade-scroll-y")]) {
      pane.classList.toggle("scrollable", pane.scrollHeight > pane.clientHeight + 1);
    }
  }, [flat.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((index) => {
          const next =
            e.key === "ArrowDown"
              ? (index + 1) % flat.length
              : (index - 1 + flat.length) % flat.length;
          root.current
            ?.querySelectorAll("[data-pick]")
            [next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        flat[active]?.onPick();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flat.length, active]);

  const item = (entry: MenuItem, index: number) => (
    <div
      key={entry.label}
      data-pick
      className={index === active ? "active" : undefined}
      onClick={entry.onPick}
    >
      {entry.icon && <Icon name={entry.icon} />}
      {entry.swatch && <span className="dot" style={{ background: entry.swatch }} />}
      {entry.label}
    </div>
  );

  const position = {
    ...(at ? { position: "fixed" as const, left: at.x, top: at.y } : {}),
    transform: shift ? `translateX(${shift}px)` : undefined,
  };
  let offset = 0;
  if (sections) {
    return (
      <div className="menu columns" style={position} ref={root}>
        {sections.map((section) => {
          const start = offset;
          offset += section.items.length;
          return (
            <div className="menu-section fade-scroll-y" key={section.title}>
              <h3>{section.title}</h3>
              {section.items.map((entry, i) => item(entry, start + i))}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="menu fade-scroll-y" style={position} ref={root}>
      {flat.map(item)}
    </div>
  );
}
