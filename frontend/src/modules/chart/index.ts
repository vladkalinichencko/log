import { Representation, Table } from "../../types/domain";

export interface ChartMark {
  x: number;
  label: string;
}

export interface ChartProps {
  table: Table;
  representation: Representation;
  overview?: boolean;
  marks?: ChartMark[];
}

export { Chart, saveChartImage } from "./plotly";
