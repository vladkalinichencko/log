import { createContext, KeyboardEvent, useContext, useState } from "react";
import { closestCenter, DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import type { ArrangeItemProps, ArrangeProps } from "./index";

const NEIGHBOR_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const motion_timing = () => ({
  milliseconds: parseFloat(token("--motion-slow")) || 0,
  curve: token("--motion-curve") || "ease",
});

const swallowClickAfterDrop = () => {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", swallow, true);
  setTimeout(() => window.removeEventListener("click", swallow, true));
};

const ArrangeContext = createContext<Pick<ArrangeProps, "keys" | "onMove"> & { dragging: boolean }>({
  keys: [],
  onMove: () => {},
  dragging: false,
});

export function Arrange({ keys, onMove, className, children }: ArrangeProps) {
  const [dragging, setDragging] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const drop = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    swallowClickAfterDrop();
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragging(true)}
      onDragEnd={drop}
      onDragCancel={() => setDragging(false)}
    >
      <SortableContext items={keys} strategy={rectSortingStrategy}>
        <ArrangeContext.Provider value={{ keys, onMove, dragging }}>
          <div className={className}>{children}</div>
        </ArrangeContext.Provider>
      </SortableContext>
    </DndContext>
  );
}

export function ArrangeItem({ id, className, style, children }: ArrangeItemProps) {
  const { keys, onMove, dragging } = useContext(ArrangeContext);
  const { milliseconds, curve } = motion_timing();
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: milliseconds, easing: curve },
  });
  const moveWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const neighbor = keys[keys.indexOf(id) + NEIGHBOR_STEPS[event.key]];
    if (!event.altKey || event.target !== event.currentTarget || !neighbor) return;
    event.preventDefault();
    onMove(id, neighbor);
  };

  return (
    <motion.div
      ref={setNodeRef}
      className={className}
      data-state={isDragging ? "dragging" : "idle"}
      tabIndex={0}
      aria-label={`${id}: Alt+arrow moves it`}
      layout={!dragging}
      transition={{ duration: milliseconds / 1000 }}
      onMouseDown={(event) => listeners?.onMouseDown?.(event)}
      onTouchStart={(event) => listeners?.onTouchStart?.(event)}
      onKeyDown={moveWithKeys}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
    >
      {children}
    </motion.div>
  );
}
