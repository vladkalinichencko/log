# `log` design system

This is the implementation contract extracted from the 57 images and one video in `design inspiration/`. Filenames are treated as the author's annotations: a reference contributes a principle or component, not a palette or layout to copy wholesale.

## Direction

`log` is a research instrument, so the interface is dense, direct, and inspectable. The visual language combines the author's large red training timeline with the strongest recurring patterns: Swiss alignment, tabular numbers, compact operational controls, inline evidence, square geometry, and one loud signal color.

The system has three layers:

1. **Orientation** — one large page title and, for a run, one dominant time-based visualization.
2. **Evidence** — tables, charts, status strips, error lists, and execution timelines share alignments and color roles. Values stay visible without hover.
3. **Action** — compact square icon actions, segmented representation switches, menus, and a temporary comparison tray sit close to the object they change.

## Product paradigms

Short statements of how the product thinks. Every screen decision should be traceable to one of them.

- **Know where you are on the big map.** Zooming, scrolling or filtering never hides the context of the whole: a zoomed chart keeps the latest value and the full-run overview visible, a filtered table says how many rows it hides, a deep table keeps its breadcrumb.
- **Progressive disclosure pulls attributes up.** Every level is a view over the files below it. A higher level shows a chosen few attributes of the level below, in the form that helps a decision at that level — the run list shows each run's status as a dot and its start and duration, which are cells of that run's `meta` and `metrics`, not a copy.
- **One entity in code, many views in the UI.** The code handles one type (`Table`); the UI picks the view per place: an editable grid in the editor, a read-only preview in a tile, a chart, a status strip, a list. Not every view is a grid, and not every view is editable.
- **Content changes never move the layout.** See CLAUDE.md rule 8b: reserve space or overlay, wrap or ellipsize, never clip grown content.
- **One chart, every size.** There is one way to show a series over time. The run page's main chart is not a special widget: every line chart — tile, modal, overlay, hero — is the same component with the same layers, and only the room it is given decides how much shows (the overview strip and large end values appear from 320px of plot height). What is learned on the hero propagates everywhere by construction.

## Exact visual rules

- Spacing uses an `8px` base and only `4, 8, 16, 24, 32, 48, 64px`. Dense table cells pad `4px 8px`; comfortable cells use `16px` without changing type size. `npm run check:layout` fails on any other padding, margin or gap, on a font size outside the five text tokens, and on a radius other than `2px` / `6px`.
- Content is at most `1500px` wide, with `24px` desktop and `16px` mobile gutters (the scale has no `12px`).
- **One inset per surface.** The page pads its content by the gutter, a modal by `16px`, a tile by `8px`; everything inside a surface starts at that inset and is spaced by the surface's gap, never by its own margin. A surface never contains a second page inset.
- **One control height.** Every button, input and select outside a table is `32px` tall (`--control`); a segmented group shares that height. In-table actions (sort, filter) are `24px`, one level down on purpose.
- **One ink per control.** Icons are masks filled with `currentColor`, so an icon, its label and its state change color together: muted (`--gray-600`) at rest, ink (`--gray-900`) on hover or when active. Control borders and input borders are the same `--gray-200`.
- **Motion is a token.** `--motion-fast` (120ms), `--motion-slow` (240ms) and `--motion-curve` are the only durations and easing; both durations become 0 under `prefers-reduced-motion`. A component never writes its own duration.
- **Counts belong to their cause.** The `N of M rows` count appears under the filter only while a filter is active; the editor always shows `cols × rows` there.
- Labels align left and numbers right. Property lists are two-column grids; spaces and arbitrary flex gaps may not fake alignment.
- Section headings align index/title left and rationale right, separated by a `2px` top rule rather than a surrounding card.
- Corners are `2px` for controls and data surfaces, `6px` only for floating menus/modals. Borders are `1px`; selection may use `2px`. Shadows belong only to floating surfaces.
- IBM Plex Mono remains the UI family. Titles use `clamp(52px, 7vw, 104px)` at `.86` line-height; sections `18–20px`; controls/cells `11–14px`; annotations `9–11px`.
- Numeric regions use tabular figures. Units stay attached to values. Changes include direction and comparison basis.

| Color role | Light value | Meaning |
|---|---:|---|
| background | `#f2f2ef` | document field |
| surface | `#ffffff` | table, chart, menu |
| ink | `#151515` | text and structure |
| muted | `#72726d` | metadata/inactive controls |
| line | `#d9d9d3` | grid and separators |
| signal | `#f12626` | focus, anomaly, selected training series |
| positive | `#14a978` | healthy/completed/improved |
| warning | `#d99a1d` | needs attention |

Color is redundant with text, shape, or position. Red cannot mean both “selected” and “failed” inside one view without a label.

## Component contracts

**Chart (every line chart).** Layers, top to bottom: a head line (legend chips when there are several series — pointing at a chip spotlights its series and fades the rest to 20%; the summary `steps a–b · name first → last (±%) · min · max` of the single or spotlighted series, over the window); the plot (a single series fills to its minimum with a vertical gradient of its own color; the newest point is a dot that pulses once when a new point lands; end values in the series color, bold and larger when roomy; epochs as alternating quiet bands labelled at the top); event lanes on the shared time axis (`alerts` ▼ in `--warning`, `checkpoints` ◆ in gray; clicking one selects ±5% of the run around it); one cursor line through plot and lanes with a single readout of every series at that step; the overview strip when roomy. Non-finite values never reach the summary or the gradient baseline.

**Run timeline.** The run starts with a large time chart: visible series key, main plot, direct labels/current values at the right edge, epoch/step axis, and compact overview/range control. Zoom preserves latest-value context.

**Status strip.** Tiles form one contiguous strip. Each has a quiet label, large value, directional delta/context, and optionally one sparkline. Color marks meaning, not decoration.

**Table.** The table stays semantic HTML. Numeric columns align right and headers stay quiet. A cell may add one evidence-bearing microbar, sparkline, status background, interval, or outlier mark without replacing its readable value. Row/column counts remain visible in the editor.

**Representation switcher.** The first touch switches table/visualization, the second chooses a compatible family, and the third changes properties of that chart. Unsupported views are absent. Active state uses fill and contrast.

**Toolbar/menu.** Icon actions are square `32–36px` targets with `16px` SVGs. Text appears for ambiguous or consequential actions. Segments share straight edges. Floating menus are the only elevated surface and may use columns for chart type plus settings.

**Error/AI note.** An event row is `severity → concise title/evidence → time/source`. Details expand below. AI notes are sourced annotations attached to a row, operation, or interval, not an isolated chat feed.

**Comparison tray.** A temporary bottom tray collects runs, intervals, or plots and shows count, compare, clear, and compact item marks without covering evidence.

**Modal.** Fullscreen is a route-backed analytical workspace, not a centered dialog. Title/search sit left, representation/close actions right, and the table/chart fills the rest.

**3D.** Three-dimensional views require real depth: tensor volumes, surfaces, loss landscapes, point clouds, system geometry, or trajectories. They need labeled axes, reset-camera, 2D projection/slice fallback, and reduced-motion behavior.

## Proposals (not built — owner decides)

Ideas from the 2026-10-26 polish pass. Each is one module or one selector in the existing shape; none is built until accepted.

- **X-axis unit switch** on every chart: step / samples seen / wall time (the catalog's "align on step, sample, wall time"). The lanes and bands follow the same axis, which is also what lets phase spans (seconds) join the hero as a lane.
- **Trend column in the run list**: the project's hero metric as a sparkline per run, pulled up from each run's `metrics` (progressive disclosure, like status and duration).
- **Deltas in the status strip**: each stat shows its change over the visible window with direction color (the lab's `small.good / small.bad`).
- **Command palette** (Ctrl+K): the "Go to table…" search plus actions (compare selected, overlay a metric, switch an alert off) in one list.
- **Comparison tray previews**: each run in the bottom tray carries a tiny line of the hero metric, so the selection is checked before Compare.

## Reference audit

Every media file is accounted for below; related files are grouped because they specify the same family.

### Numbers, status, dashboard hierarchy

- `again, numbers layout and scale contrast.png`, `dense number layout & number contrast.png`, `характеристики с двойным выравниванием.png`: scale contrast, tabular figures, right-aligned values, paired label/value grids.
- `cool summary statistics overlay.png`, `status tiles 1.png`, `status tiles 2.png`, `status tiles with little plot previews 3.png`, `status tiles with little plot previews 4.png`: contiguous status strip, deltas, semantic color, sparklines.
- `general layout – numbers on top, plots next, similar colour plot coding, plot legend in separate tiles.png`, `cool major statistics ui under the plot.png`, `заголовок секции, верстка графиков, контраст в масштабе чисел и значения в графиках на концах.png`, `cool spatious settings, large plot with important numbers under it, but too sloppy.JPG`: metrics → main evidence → detail; the last reference's loose spacing is tightened.
- `status bar.png`, `top-table.png`, `basic resources allocation ui.png`: persistent health, ranked operations, labeled capacity bars.

### Time, execution, infrastructure, runs

- `plot with a resizable timeline with preview at the bottom, last large values at the end, colour coding and legend at the top.png` and `great plot – timeline with preview at the bottom, last large values at the end, colour coding and legend at the top.png`: the timeline contract.
- `plot with a timeline.png`, `plot details card.png`, `выделение участка пайплайна в большем масштабе.png`: event bands, interval detail, focus plus context.
- `flame graph 1.png`, `flame graph 2.png`, `cool waterfall ui for agent rollouts.png`: nested duration, multi-lane execution, causal rollout sequence.
- `полосчатая визуализация утилизации.png`, `графики и визуализация состояния системы.png`, `infrastructure:model gradient flow:deployed system tree-based ui.png`: dense state stripes, health summaries, topology.
- `cool plots by gpt to compare previous multiple runs. runs are chosen by combinations of characteristics instead of picking from table, flame charts and reward plots, project state.mp4`: run lanes, reward curves, thresholds, characteristic-based selection, project state; its paper styling is not copied.

### Tables, filtering, embedded evidence

- `brutal segmented controls in filters, dense table layout with icons and right alignment.jpg`, `brutalist icons and recrangles in search and filders, swiss layout in sections, minimum paddings and roundness in product items.png`: shared-edge filters, restrained radius, grid alignment, compact rows.
- `графики и цветовое кодирование внутри самих таблиц, сегментированный фильтр + таблички со статистикой в одном месте.png`, `выделение особенных значений в таблице.png`, `crappy ui but cool usecase for us. j-space analyzer, matrix cell highlights. new – input view, test run in ui, summary (most prominent tokens) view.jpeg`: inline bars/sparklines, anomaly cells, matrix selection, input/test/summary flow.
- `Own mockups/table draft.png`, `Own mockups/table editor visual exploration.png`, `Own mockups/table context menu draft.png`: finite Excel-like grid, exterior resize affordance, chart-rich context menu.

### Controls, icons, navigation, adjacent actions

- `как представлены тулбар и фильты (где текст, где иконки, где какие цвета, где какие шрифты).png`, `дизайн иконок.png`, `бруталистические иконки.png`, `квадратики и иконки в тулбаре + трехмерные визуализации.png`: square icon actions, consistent optical weight, compact chrome versus large evidence.
- `большие заголовки и крадиентный segmented control.png`: oversized headings and strong active segments; its decorative gradient is omitted.
- `temporary dynamic bar that works like a buffer for plots to compare & a context menu.png`: comparison tray.
- `in-app "ads" for next views & actions.png`: contextual next-view suggestions after evidence, without promotional styling.
- `embedded ai-notes.png`: sourced inline analysis notes.
- `название и тематика проекта при настройке.png`: explicit project naming and analysis-mode selection.
- `types of content to add in the future.png`: taxonomy of metrics, representations, architecture, dataset, hardware, checkpoints.

### Monitoring, alerts, whole screens

- `literal gold – service made by a human to help him track rl runs. logs, plots, ai-alerts, automatic checks.png`: the strongest product reference; logs, curves, checks, alerts, and contribution stay visible together.
- `example of cool tracking ui by gpt. reuses elements we talked about.png`: metric strip + temporal evidence + distribution + alerts.
- `full errors ui.png`, `another cool error list.png`: ordered severity lists with source/time and expandable diagnostics.

### Visualization bank and author mockups

- `огромное количество потрясающих примеров визуализаций вместе с числами – нужно их добавить в банк, вдохновиться, и в такой же логике визуализировать различные феномены нашего домена.png`: small multiples, sparklines, deviation bands, bullet charts, vertical profiles, anomaly callouts.
- `примеры очень классных визуализаций которые думаю надо добавить.png`: difference bars, period bands, residue indicators, threshold bullets, paired numeric differences.
- `модальное окно и классные трехмерные визуализации чтоб понятно все было сразу.png`: selection, parameters, 2D/3D evidence, clear action.
- `plot type switcher (right).png`: chart selector adjacent to the plot.
- `Own mockups/main logs screen visual exploration.png`: primary run art direction — giant title, black field, red loss curve, epoch rail, current point.
- `Own mockups/table:chart switcher draft.png`: three-level representation selector.
- `Own mockups/fullscreen modal draft.png`: route-backed fullscreen workspace.
- `Own mockups/export context menu visual exploration.png`: multi-column export/styling controls with preview.
- `Own mockups/tree-like plots visual exploration.png`: related child plots composed as a tree.

## Rollout

The first implementation is the `/design-system` laboratory plus semantic tokens in `frontend/src/styles/tokens.css`. There is one vocabulary: the laboratory uses the same tokens as the product (`--gray-*`, `--accent`, `--series-1…6`, `--text-*`, `--space*`), so a proposal that is accepted moves as markup, never as a second palette. Production migration proceeds through chrome/controls, tables/inline encodings, run timeline/status strip, alerts/comparison tray, then additional `Representation` renderers. A renderer is added only after its data predicate and analytical question are defined in `VISUALIZATION-CATALOG.md`.
