import { lazy, Suspense } from "react";
import type { Data, Layout } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js"));

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  onRelayout?: (event: Record<string, number | boolean>) => void;
}

export function PlotlyChart({ data, layout, onRelayout }: PlotlyChartProps) {
  return (
    <Suspense fallback={<div>Loading chart…</div>}>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onRelayout={onRelayout as any}
      />
    </Suspense>
  );
}
