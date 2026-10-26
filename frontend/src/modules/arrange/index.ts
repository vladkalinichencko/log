import { CSSProperties, ReactNode } from "react";

export interface ArrangeProps {
  keys: string[];
  onMove: (moved: string, target: string) => void;
  className: string;
  children: ReactNode;
}

export interface ArrangeItemProps {
  id: string;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}

export { Arrange, ArrangeItem } from "./dndkit";
