import { lazy, Suspense, useRef, useState } from "react";
import type { Data, Layout, PlotRelayoutEvent } from "plotly.js";
import { Representation } from "../../types/domain";
import { Placeholder } from "../../components/Placeholder";
import { chart_theme, ChartWindow, column, end_label_selector, line_series_selector, mark_window, separate_labels, window_summary_selector } from "./series";
import { end_value } from "../../store/selectors/runSelectors";
import type { ChartProps } from "./index";

const NEWEST_DOT = 7;
const GRADIENT_TOP = 0.28;

const fade = (hex: string, alpha: number) => `rgba(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(", ")}, ${alpha})`;

const Plot = lazy(() => import("react-plotly.js"));

const baseLayout = (): Partial<Layout> => {
  const t = chart_theme();
  return {
    autosize: true,
    paper_bgcolor: t.paper,
    plot_bgcolor: t.paper,
    font: { family: t.font, size: t.text, color: t.ink },
    margin: { l: 44, r: 16, t: 16, b: 32 },
    hoverlabel: { bgcolor: t.paper, bordercolor: t.grid, font: { family: t.font, size: t.text, color: t.ink } },
    xaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    yaxis: { gridcolor: t.grid, zerolinecolor: t.grid },
    showlegend: false,
  };
};

export function chartSpec(
  { table, representation, marks = [], hero = false }: ChartProps,
  window: ChartWindow = null
): { data: Data[]; layout: Partial<Layout> } {
  const last = ((table.column_names ?? []).length || 1) - 1;
  const t = chart_theme();
  const base = baseLayout();

  if (representation === Representation.Line) {
    const series = line_series_selector(table, window, t.palette);
    const filled = hero && series.length === 1 ? series[0] : null;
    return {
      data: [
        ...(filled ? [{ x: filled.xs, y: filled.xs.map(() => Math.min(...filled.ys)), type: "scatter" as const, mode: "lines" as const, line: { width: 0 }, hoverinfo: "skip" as const, showlegend: false }] : []),
        ...series.map(({ name, xs, ys, color }) => ({
          x: xs,
          y: ys,
          name,
          type: "scatter" as const,
          mode: (hero ? "lines+markers" : "lines") as "lines",
          line: { color, width: 2 },
          marker: { color, size: xs.map((_, i) => (hero && i === xs.length - 1 ? NEWEST_DOT : 0)) },
          ...(filled ? { fill: "tonexty" as const, fillgradient: { type: "vertical" as const, colorscale: [[0, fade(color, 0)], [1, fade(color, GRADIENT_TOP)]] as [number, string][] } } : {}),
        })),
      ],
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
            captureevents: true,
            showarrow: false,
            font: { color: t.warning, size: t.text },
          })),
          ...separate_labels(series.flatMap((line) => end_label_selector(line, window) ?? []), series).map((label) => ({
            ...(label.edge ? { xref: "paper" as const, x: 1 } : { x: label.x }),
            y: label.y,
            text: label.text,
            xanchor: "left" as const,
            xshift: 4,
            showarrow: false,
            font: { color: label.color, size: t.text },
          })),
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

export function Chart(props: ChartProps) {
  const [window, setWindow] = useState<ChartWindow>(null);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const newest = useRef<Map<string, number>>(new Map());
  const spec = chartSpec(props, window);
  const t = chart_theme();
  const lines = props.representation === Representation.Line ? line_series_selector(props.table, window, t.palette) : [];
  const summary = props.hero && lines.length === 1 ? window_summary_selector(lines[0], window) : null;

  const onRelayout = (event: Readonly<PlotRelayoutEvent>) => {
    const [from, to] = event["xaxis.range"] ?? [event["xaxis.range[0]"], event["xaxis.range[1]"]];
    if (from !== undefined && to !== undefined) setWindow([Number(from), Number(to)]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  const onUpdate = (_: unknown, graph: HTMLElement) => {
    if (!props.hero) return;
    const { xaxis, yaxis, _size } = (graph as unknown as PlottedGraph)._fullLayout;
    const landed = lines.flatMap(({ name, xs, ys, color }) => {
      const at = xs[xs.length - 1];
      const before = newest.current.get(name);
      newest.current.set(name, at);
      const shown = at >= xaxis.range[0] && at <= xaxis.range[1];
      return before !== undefined && at > before && shown ? [{ key: `${name}:${at}`, left: _size.l + xaxis.l2p(at), top: _size.t + yaxis.l2p(ys[ys.length - 1]), color }] : [];
    });
    if (landed.length > 0) setPulses(landed);
  };

  return (
    <div className="chart" data-hero={props.hero ? "" : undefined}>
      {props.hero && (
        <output className="chart-summary">
          {summary
            ? `steps ${end_value(summary.from)}–${end_value(summary.to)} · ${lines[0].name} ${end_value(summary.first)} → ${end_value(summary.last)} (${change(summary.first, summary.last)}) · min ${end_value(summary.min)} · max ${end_value(summary.max)}`
            : "\u00a0"}
        </output>
      )}
      <div className="chart-plot">
        <Suspense fallback={<Placeholder label="loading chart" />}>
          <Plot
            data={spec.data}
            layout={props.hero ? { ...spec.layout, xaxis: { ...spec.layout.xaxis, rangeslider: { visible: true, thickness: 0.12, bgcolor: "transparent" } } } : spec.layout}
            config={{ displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onRelayout={onRelayout}
            onUpdate={onUpdate}
            onClickAnnotation={({ annotation }) => setWindow(mark_window(Number(annotation.x), lines[0].xs))}
          />
        </Suspense>
        {pulses.map((pulse) => (
          <i key={pulse.key} className="chart-pulse" style={{ left: pulse.left, top: pulse.top, color: pulse.color }} />
        ))}
      </div>
    </div>
  );
}

interface Pulse {
  key: string;
  left: number;
  top: number;
  color: string;
}

interface PlottedAxis {
  range: [number, number];
  l2p: (value: number) => number;
}

interface PlottedGraph {
  _fullLayout: { xaxis: PlottedAxis; yaxis: PlottedAxis; _size: { l: number; t: number } };
}

const change = (first: number, last: number) => (first === 0 ? "—" : `${last >= first ? "+" : "−"}${end_value(Math.abs((last - first) / first) * 100)}%`);

export async function saveChartImage(container: HTMLElement | null, filename: string) {
  const plot = container?.querySelector<HTMLElement>(".js-plotly-plot");
  if (!plot) throw new Error("this tile shows a table; switch it to a chart first");
  const Plotly = (await import("plotly.js/dist/plotly")).default;
  await Plotly.downloadImage(plot, { format: "png", width: 1600, height: 900, filename });
}
