import { useState } from "react";
import { Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { PlotlyChart } from "./PlotlyChart";

interface LineChartViewProps {
  table: Table;
}

export function LineChartView({ table }: LineChartViewProps) {
  const [window, setWindow] = useState<[number, number] | null>(null);

  const onRelayout = (event: Record<string, number | boolean>) => {
    const from = event["xaxis.range[0]"];
    const to = event["xaxis.range[1]"];
    if (typeof from === "number" && typeof to === "number") setWindow([from, to]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  return <PlotlyChart {...chartSpec(table, "line", window)} onRelayout={onRelayout} />;
}
