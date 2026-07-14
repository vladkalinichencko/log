import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface TrajectoryViewProps {
  table: Table;
}

export function TrajectoryView({ table }: TrajectoryViewProps) {
  return <PlotlyChart {...chartSpec(table, "trajectory")} />;
}
