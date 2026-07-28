import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const origin = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    const anchor = at
      ? { left: at.x, top: at.y, bottom: at.y }
      : origin.current?.parentElement?.getBoundingClientRect();
    if (!anchor) return;
    const rect = root.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - rect.width - 8));
    const below = anchor.bottom + 4;
    const top = below + rect.height <= window.innerHeight - 8
      ? below
      : Math.max(8, anchor.top - rect.height - 4);
    setMenuPosition({ left, top });
    for (const pane of [root.current, ...root.current.querySelectorAll(".fade-scroll-y")]) {
      pane.classList.toggle("scrollable", pane.scrollHeight > pane.clientHeight + 1);
    }
  }, [flat.length, at?.x, at?.y]);

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
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
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
    left: menuPosition?.left ?? 0,
    top: menuPosition?.top ?? 0,
    visibility: menuPosition ? "visible" as const : "hidden" as const,
  };
  let offset = 0;
  const menu = sections ? (
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
  ) : (
    <div className="menu fade-scroll-y" style={position} ref={root}>
      {flat.map(item)}
    </div>
  );
  return (
    <>
      <span className="menu-origin" ref={origin} />
      {createPortal(menu, document.body)}
    </>
  );
}
