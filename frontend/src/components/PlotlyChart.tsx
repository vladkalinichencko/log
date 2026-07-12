import { lazy, Suspense } from "react";
import type { Data, Layout } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js"));

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
}

export function PlotlyChart({ data, layout }: PlotlyChartProps) {
  return (
    <Suspense fallback={<div>Loading chart…</div>}>
      <Plot data={data} layout={layout} config={{ displayModeBar: false }} style={{ width: "100%", height: "100%" }} useResizeHandler />
    </Suspense>
  );
}
