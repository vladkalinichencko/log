import { lazy, Suspense, useState } from "react";
import type { PlotRelayoutEvent } from "plotly.js";
import { Representation, Table } from "../types/domain";
import { chartSpec } from "./chartSpec";

const Plot = lazy(() => import("react-plotly.js"));

interface ChartViewProps {
  table: Table;
  representation: Representation;
}

export function ChartView({ table, representation }: ChartViewProps) {
  const [window, setWindow] = useState<[number, number] | null>(null);

  const onRelayout = (event: Readonly<PlotRelayoutEvent>) => {
    const from = event["xaxis.range[0]"];
    const to = event["xaxis.range[1]"];
    if (from !== undefined && to !== undefined) setWindow([from, to]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  return (
    <Suspense fallback={<div>Loading chart…</div>}>
      <Plot
        {...chartSpec(table, representation, window)}
        config={{ displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onRelayout={onRelayout}
      />
    </Suspense>
  );
}
