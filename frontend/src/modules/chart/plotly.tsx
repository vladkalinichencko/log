import { lazy, Suspense, useState } from "react";
import type { Data, Layout, PlotRelayoutEvent } from "plotly.js";
import { Representation, Table } from "../../types/domain";
import { Placeholder } from "../../components/Placeholder";
import { chart_theme, ChartWindow, column, end_label_selector, line_series_selector } from "./series";
import type { ChartMark, ChartProps } from "./index";

const Plot = lazy(() => import("react-plotly.js"));

const baseLayout = (): Partial<Layout> => {
  const t = chart_theme();
  return {
    autosize: true,
    paper_bgcolor: t.paper,
    plot_bgcolor: t.paper,
    font: { family: t.font, size: t.text, color: t.ink },
    margin: { l: 44, r: 16, t: 16, b: 32 },
    xaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    yaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    showlegend: false,
  };
};

export function chartSpec(
  table: Table,
  representation: Representation,
  window: ChartWindow = null,
  marks: ChartMark[] = []
): { data: Data[]; layout: Partial<Layout> } {
  const last = ((table.column_names ?? []).length || 1) - 1;
  const t = chart_theme();
  const base = baseLayout();

  if (representation === Representation.Line) {
    const series = line_series_selector(table, window, t.palette);
    return {
      data: series.map(({ name, xs, ys, color }) => ({
        x: xs,
        y: ys,
        name,
        type: "scatter" as const,
        mode: "lines" as const,
        line: { color, width: 2 },
      })),
      layout: {
        ...base,
        margin: { ...base.margin, r: 64 },
        showlegend: series.length > 1,
        xaxis: { ...base.xaxis, ...(window ? { range: window } : {}) },
        shapes: marks.map((mark) => ({
          type: "line" as const,
          x0: mark.x,
          x1: mark.x,
          yref: "paper" as const,
          y0: 0,
          y1: 1,
          line: { color: t.warning, width: 1, dash: "dot" as const },
        })),
        annotations: [
          ...marks.map((mark) => ({
            x: mark.x,
            yref: "paper" as const,
            y: 1,
            yanchor: "bottom" as const,
            text: "⚑",
            hovertext: mark.label,
            showarrow: false,
            font: { color: t.warning, size: t.text },
          })),
          ...series.flatMap((line) => {
            const label = end_label_selector(line, window);
            if (!label) return [];
            return [{
              ...(label.edge ? { xref: "paper" as const, x: 1 } : { x: label.x }),
              y: label.y,
              text: label.text,
              xanchor: "left" as const,
              xshift: 4,
              showarrow: false,
              font: { color: label.color, size: t.text },
            }];
          }),
        ],
      },
    };
  }

  if (representation === Representation.Histogram) {
    return {
      data: [{ x: column(table, last), type: "histogram", marker: { color: t.muted } }],
      layout: base,
    };
  }

  if (representation === Representation.Scatter) {
    return {
      data: [{ x: column(table, 0), y: column(table, 1), type: "scatter", mode: "markers", marker: { color: t.ink, size: 5 } }],
      layout: base,
    };
  }

  if (representation === Representation.Trajectory) {
    const steps = column(table, 0);
    const points = column(table, 1);
    const xs = column(table, 2);
    const ys = column(table, 3);
    const lastStep = Math.max(...steps);
    const trailX: (number | null)[] = [];
    const trailY: (number | null)[] = [];
    const headX: number[] = [];
    const headY: number[] = [];
    for (const point of [...new Set(points)]) {
      for (let i = 0; i < points.length; i++) {
        if (points[i] !== point) continue;
        trailX.push(xs[i]);
        trailY.push(ys[i]);
        if (steps[i] === lastStep) {
          headX.push(xs[i]);
          headY.push(ys[i]);
        }
      }
      trailX.push(null);
      trailY.push(null);
    }
    return {
      data: [
        { x: trailX, y: trailY, type: "scatter", mode: "lines", line: { color: t.muted, width: 1 } },
        { x: headX, y: headY, type: "scatter", mode: "markers", marker: { color: t.ink, size: 6 } },
      ],
      layout: base,
    };
  }

  const z = table.cells.map((row) => row.map((cell) => Number(cell.value)));
  return {
    data: [{ z, type: "heatmap", colorscale: "Greys", showscale: false }],
    layout: { ...base, yaxis: { ...base.yaxis, autorange: "reversed" } },
  };
}

export function Chart({ table, representation, overview, marks }: ChartProps) {
  const [window, setWindow] = useState<ChartWindow>(null);

  const onRelayout = (event: Readonly<PlotRelayoutEvent>) => {
    const [from, to] = event["xaxis.range"] ?? [event["xaxis.range[0]"], event["xaxis.range[1]"]];
    if (from !== undefined && to !== undefined) setWindow([Number(from), Number(to)]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  const spec = chartSpec(table, representation, window, marks);
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

export async function saveChartImage(container: HTMLElement | null, filename: string) {
  const plot = container?.querySelector<HTMLElement>(".js-plotly-plot");
  if (!plot) throw new Error("this tile shows a table; switch it to a chart first");
  const Plotly = (await import("plotly.js/dist/plotly")).default;
  await Plotly.downloadImage(plot, { format: "png", width: 1600, height: 900, filename });
}
