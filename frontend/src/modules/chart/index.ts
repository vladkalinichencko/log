import { Representation, Table } from "../../types/domain";

export interface ChartMark {
  x: number;
  label: string;
  kind: "alert" | "checkpoint" | "epoch";
}

export interface ChartProps {
  table: Table;
  representation: Representation;
  marks?: ChartMark[];
}

export { Chart, saveChartImage } from "./plotly";
