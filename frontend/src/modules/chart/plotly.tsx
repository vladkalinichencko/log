import { lazy, Suspense, useRef, useState } from "react";
import type { Data, Layout, PlotRelayoutEvent } from "plotly.js";
import { Representation } from "../../types/domain";
import { Placeholder } from "../../components/Placeholder";
import { chart_theme, ChartWindow, column, end_label_selector, epoch_bands, line_series_selector, lowest, mark_window, separate_labels, window_summary_selector } from "./series";
import { end_value } from "../../store/selectors/runSelectors";
import type { ChartMark, ChartProps } from "./index";

const NEWEST_DOT = 7;
const GRADIENT_TOP = 0.28;

const FLAME_ROWS = 24;
const ROOMY_HEIGHT = 320;
const UNFOCUSED = 0.2;
const LABEL_GAP = 0.06;
const ROOMY_LABEL_GAP = 0.09;
const LANE_SHARE = 0.07;
const LANE_GAP = 0.02;
const LANE_MARKER = 9;
const LANES: { kind: ChartMark["kind"]; name: string; symbol: string }[] = [
  { kind: "alert", name: "alerts", symbol: "triangle-down" },
  { kind: "checkpoint", name: "checkpoints", symbol: "diamond" },
];

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

export interface ChartView {
  window: ChartWindow;
  roomy: boolean;
  focus: string | null;
}

const RESTING_VIEW: ChartView = { window: null, roomy: false, focus: null };

export function chartSpec(
  { table, representation, marks = [] }: ChartProps,
  { window, roomy, focus }: ChartView = RESTING_VIEW
): { data: Data[]; layout: Partial<Layout> } {
  const last = ((table.column_names ?? []).length || 1) - 1;
  const t = chart_theme();
  const base = baseLayout();

  if (representation === Representation.Line) {
    const series = line_series_selector(table, window, t.palette);
    const filled = series.length === 1 && series[0].ys.some(Number.isFinite) ? series[0] : null;
    const events = marks.filter((mark) => mark.kind !== "epoch");
    const lanes = LANES.filter((lane) => events.some((mark) => mark.kind === lane.kind));
    const laneShare = lanes.length * LANE_SHARE;
    const end = Math.max(...series.flatMap(({ xs }) => xs));
    const bands = epoch_bands(marks.filter((mark) => mark.kind === "epoch"), end);
    return {
      data: [
        ...(filled ? [{ x: filled.xs, y: filled.xs.map(() => lowest(filled.ys)), type: "scatter" as const, mode: "lines" as const, line: { width: 0 }, hoverinfo: "skip" as const }] : []),
        ...series.map(({ name, xs, ys, color }) => ({
          x: xs,
          y: ys,
          name,
          type: "scatter" as const,
          mode: "lines+markers" as const,
          opacity: focus && focus !== name ? UNFOCUSED : 1,
          line: { color, width: 2 },
          marker: { color, size: xs.map((_, i) => (i === xs.length - 1 ? NEWEST_DOT : 0)) },
          hovertemplate: `${name} %{y:.4~g}<extra></extra>`,
          ...(filled ? { fill: "tonexty" as const, fillgradient: { type: "vertical" as const, colorscale: [[0, fade(color, 0)], [1, fade(color, GRADIENT_TOP)]] as [number, string][] } } : {}),
        })),
        ...lanes.map((lane) => {
          const kept = events.filter((mark) => mark.kind === lane.kind);
          return {
            x: kept.map((mark) => mark.x),
            y: kept.map(() => lane.name),
            text: kept.map((mark) => mark.label),
            yaxis: "y2",
            type: "scatter" as const,
            mode: "markers" as const,
            marker: { symbol: lane.symbol, size: LANE_MARKER, color: lane.kind === "alert" ? t.warning : t.quiet },
            hovertemplate: "%{text}<extra></extra>",
          };
        }),
      ],
      layout: {
        ...base,
        margin: { ...base.margin, r: roomy ? 96 : 64 },
        hovermode: "x unified",
        xaxis: {
          ...base.xaxis,
          ...(window ? { range: window } : {}),
          ...(lanes.length > 0 ? { anchor: "y2" as const } : {}),
          showspikes: true,
          spikemode: "across",
          spikesnap: "cursor",
          spikethickness: 1,
          spikedash: "solid",
          spikecolor: t.quiet,
          ...(roomy ? { rangeslider: { visible: true, thickness: 0.1, bgcolor: "transparent" } } : {}),
        },
        yaxis: { ...base.yaxis, domain: [laneShare, 1], automargin: true },
        ...(lanes.length > 0
          ? { yaxis2: { domain: [0, laneShare - LANE_GAP], type: "category" as const, categoryarray: lanes.map((lane) => lane.name), fixedrange: true, showgrid: false, zeroline: false, automargin: true, tickfont: { color: t.quiet, size: t.text } } }
          : {}),
        shapes: bands.filter((band) => band.shaded).map((band) => ({
          type: "rect" as const,
          layer: "below" as const,
          x0: band.from,
          x1: band.to,
          yref: "paper" as const,
          y0: 0,
          y1: 1,
          line: { width: 0 },
          fillcolor: t.band,
        })),
        annotations: [
          ...bands.map((band) => ({ x: band.from, yref: "paper" as const, y: 1, yanchor: "bottom" as const, xanchor: "left" as const, xshift: 4, text: band.label, showarrow: false, font: { color: t.quiet, size: t.text } })),
          ...separate_labels(series.flatMap((line) => end_label_selector(line, window) ?? []), series, roomy ? ROOMY_LABEL_GAP : LABEL_GAP).map((label) => ({
            ...(label.edge ? { xref: "paper" as const, x: 1 } : { x: label.x }),
            y: label.y,
            text: roomy ? `<b>${label.text}</b>` : label.text,
            xanchor: "left" as const,
            xshift: 6,
            showarrow: false,
            opacity: focus && focus !== label.name ? UNFOCUSED : 1,
            font: { color: label.color, size: roomy ? t.label : t.text },
          })),
        ],
      } as Partial<Layout>,
    };
  }

  if (representation === Representation.Flame) {
    const cols = table.column_names ?? [];
    const at = (name: string) => cols.indexOf(name);
    const lane = at("lane") >= 0 ? at("lane") : at("rank");
    const bars = table.cells.map((row) => ({
      level: `${lane >= 0 ? row[lane].value : ""} · ${row[at("depth")].value}`,
      name: row[at("name")].value,
      start: Number(row[at("start")].value),
      duration: Number(row[at("duration")].value),
    }));
    const levels = [...new Set(bars.map((bar) => bar.level))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const names = [...new Set(bars.map((bar) => bar.name))];
    return {
      data: [{
        type: "bar",
        orientation: "h",
        base: bars.map((bar) => bar.start),
        x: bars.map((bar) => bar.duration),
        y: bars.map((bar) => bar.level),
        text: bars.map((bar) => bar.name),
        textposition: "inside",
        insidetextanchor: "start",
        textangle: 0,
        marker: { color: bars.map((bar) => t.palette[names.indexOf(bar.name) % t.palette.length]) },
        hovertemplate: "%{text} · %{x:.3s}s<extra></extra>",
      } as Data],
      layout: {
        ...base,
        barmode: "overlay",
        bargap: 0.08,
        uniformtext: { mode: "hide", minsize: t.text },
        xaxis: { ...base.xaxis, ticksuffix: " s" },
        yaxis: {
          ...base.yaxis,
          type: "category",
          categoryorder: "array",
          categoryarray: levels,
          range: [Math.max(levels.length, FLAME_ROWS) - 0.5, -0.5],
          automargin: true,
          tickvals: levels,
          ticktext: levels.map((level) => (level.endsWith(" · 0") ? level.slice(0, -4) : "")),
        },
      } as Partial<Layout>,
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
  const [focus, setFocus] = useState<string | null>(null);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const roomy = useRoomy();
  const newest = useRef<Map<string, number>>(new Map());
  const spec = chartSpec(props, { window, roomy: roomy.fits, focus });
  const t = chart_theme();
  const lines = props.representation === Representation.Line ? line_series_selector(props.table, window, t.palette) : [];
  const described = lines.find((line) => line.name === focus) ?? (lines.length === 1 ? lines[0] : null);
  const summary = described && window_summary_selector(described, window);

  const onRelayout = (event: Readonly<PlotRelayoutEvent>) => {
    const [from, to] = event["xaxis.range"] ?? [event["xaxis.range[0]"], event["xaxis.range[1]"]];
    if (from !== undefined && to !== undefined) setWindow([Number(from), Number(to)]);
    else if (event["xaxis.autorange"]) setWindow(null);
  };

  const onUpdate = (_: unknown, graph: HTMLElement) => {
    const { xaxis, yaxis } = (graph as unknown as PlottedGraph)._fullLayout;
    const landed = lines.flatMap(({ name, xs, ys, color }) => {
      const at = xs[xs.length - 1];
      const before = newest.current.get(name);
      newest.current.set(name, at);
      const shown = at >= xaxis.range[0] && at <= xaxis.range[1];
      return before !== undefined && at > before && shown ? [{ key: `${name}:${at}`, left: xaxis._offset + xaxis.l2p(at), top: yaxis._offset + yaxis.l2p(ys[ys.length - 1]), color }] : [];
    });
    if (landed.length > 0) setPulses(landed);
  };

  return (
    <div className="chart">
      {props.representation === Representation.Line && (
        <div className="chart-head">
          {lines.length > 1 &&
            lines.map((line) => (
              <button
                key={line.name}
                className="chart-chip"
                data-state={focus === null ? "idle" : focus === line.name ? "focused" : "dimmed"}
                style={{ color: line.color }}
                onMouseEnter={() => setFocus(line.name)}
                onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(line.name)}
                onBlur={() => setFocus(null)}
              >
                <span>{line.name}</span>
              </button>
            ))}
          <output className="chart-summary">
            {summary
              ? `steps ${end_value(summary.from)}–${end_value(summary.to)} · ${described!.name} ${end_value(summary.first)} → ${end_value(summary.last)} (${change(summary.first, summary.last)}) · min ${end_value(summary.min)} · max ${end_value(summary.max)}`
              : "\u00a0"}
          </output>
        </div>
      )}
      <div className="chart-plot" ref={roomy.ref}>
        <Suspense fallback={<Placeholder label="loading chart" />}>
          <Plot
            data={spec.data}
            layout={spec.layout}
            config={{ displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onRelayout={onRelayout}
            onUpdate={onUpdate}
            onClick={({ points }) => points[0]?.data.yaxis === "y2" && setWindow(mark_window(Number(points[0].x), lines[0].xs))}
          />
        </Suspense>
        {pulses.map((pulse) => (
          <i key={pulse.key} className="chart-pulse" style={{ left: pulse.left, top: pulse.top, color: pulse.color }} />
        ))}
      </div>
    </div>
  );
}

function useRoomy() {
  const [fits, setFits] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = (element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element || typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(([entry]) => setFits(entry.contentRect.height >= ROOMY_HEIGHT));
    observer.current.observe(element);
  };
  return { fits, ref };
}

interface Pulse {
  key: string;
  left: number;
  top: number;
  color: string;
}

interface PlottedAxis {
  range: [number, number];
  _offset: number;
  l2p: (value: number) => number;
}

interface PlottedGraph {
  _fullLayout: { xaxis: PlottedAxis; yaxis: PlottedAxis };
}

const change = (first: number, last: number) => (first === 0 ? "—" : `${last >= first ? "+" : "−"}${end_value(Math.abs((last - first) / first) * 100)}%`);

export async function saveChartImage(container: HTMLElement | null, filename: string) {
  const plot = container?.querySelector<HTMLElement>(".js-plotly-plot");
  if (!plot) throw new Error("this tile shows a table; switch it to a chart first");
  const Plotly = (await import("plotly.js/dist/plotly")).default;
  await Plotly.downloadImage(plot, { format: "png", width: 1600, height: 900, filename });
}
