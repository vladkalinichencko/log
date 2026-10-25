import { lazy, Suspense, useState } from "react";
import type { PlotRelayoutEvent } from "plotly.js";
import { Representation, Table } from "../types/domain";
import { chartSpec } from "./chartSpec";
import { Placeholder } from "./Placeholder";

const Plot = lazy(() => import("react-plotly.js"));

interface ChartViewProps {
  table: Table;
  representation: Representation;
  overview?: boolean;
}

export function ChartView({ table, representation, overview }: ChartViewProps) {
  const [window, setWindow] = useState<[number, number] | null>(null);

  const onRelayout = (event: Readonly<PlotRelayoutEvent>) => {
    const from = event["xaxis.range[0]"];
    const to = event["xaxis.range[1]"];
    if (from !== undefined && to !== undefined) setWindow([from, to]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  const spec = chartSpec(table, representation, window);
  const xaxis = { ...spec.layout.xaxis, rangeslider: { visible: true, thickness: 0.12, bgcolor: "transparent" } };

  return (
    <Suspense fallback={<Placeholder label="loading chart" />}>
      <Plot
        data={spec.data}
        layout={overview ? { ...spec.layout, xaxis } : spec.layout}
        config={{ displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onRelayout={onRelayout}
      />
    </Suspense>
  );
}
