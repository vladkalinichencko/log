import { Representation, Table } from "../../types/domain";

export interface ChartProps {
  table: Table;
  representation: Representation;
  overview?: boolean;
}

export { Chart, saveChartImage } from "./plotly";
