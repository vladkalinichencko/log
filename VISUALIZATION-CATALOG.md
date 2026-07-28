# Table operations and visualization catalog

This maps the existing `Table` model to analytical operations and representations. Nothing here runs automatically: every aggregation, threshold, smoothing rule, projection, anomaly method, or missing-value policy must be explicitly chosen and recorded with its parameters.

## Data shapes

Cells already support empty, string, number, boolean, tensor reference, and table reference. Tables support scalar, row, column, grid, and folder.

| Shape | Examples | Required metadata |
|---|---|---|
| `1 × 1` | learning rate, seed, final loss | unit, step/time, source |
| `1 × M` | configuration, checkpoint summary | column names and types |
| `N × 1` | loss, throughput, latency samples | order, step/time, unit |
| `N × 2` | embedding x/y, prediction/target | column roles, correspondence |
| `N × M` | run list, logs, layer metrics | row identity, typed columns |
| `T × S` | metrics/runs over steps | time unit, sampling, gaps |
| matrix | attention, confusion, correlation | row and column identities |
| rank `3+` tensor | activations, volumes, weights | axis names, shape, dtype |
| hierarchy | project/run/epoch/module | parent, depth, ordering |
| graph | model, dataflow, dependencies | node/edge types, direction |
| event stream | logs, warnings, spans | timestamp, severity, duration |
| ensemble | runs × metrics × steps | run identity, comparable config |

Every view exposes row/column count and, for tensors, shape/dtype. Large figures show displayed versus total points and whether downsampling is active.

## Operations

**Structural.** Select, rename, reorder, sort, filter, slice, sample, concatenate, join, pivot/unpivot, group, aggregate, window, resample, align on step/time, and compare runs. Missing values remain visible; fill/interpolation creates explicit derived data.

**Statistical.** Count, distinct count, min/max/range, sum, mean, median, quantiles, variance, standard deviation, MAD, IQR, skewness, kurtosis, covariance, Pearson/Spearman correlation, confidence/credible intervals, bootstrap, effect size, hypothesis tests, and multiple-comparison correction.

**Temporal/signal.** Difference, derivative, cumulative sum, rolling and exponential statistics, lag, autocorrelation, cross-correlation, trend/season decomposition, FFT/power spectrum, wavelets, peaks, changepoints, drift, and time-to-threshold. Window, boundary behavior, and smoothing strength stay visible.

**Multivariate/geometry.** Normalize/standardize, distance/similarity, nearest neighbors, clustering, PCA/SVD/ICA/NMF, UMAP/t-SNE, Procrustes alignment, convex hull, density estimation, vector field, and trajectory comparison. Projections expose method, seed, and parameters and never replace the source table.

**ML evaluation/interpretability.** Confusion and per-class metrics, ROC/PR, calibration, residuals, error/fairness slices, feature and permutation importance, SHAP, PDP, ICE, saliency, integrated gradients, attention, activation statistics, CKA/SVCCA, gradient flow, parameter/update ratios, loss landscape, ablation comparison, and counterfactuals.

**Systems/execution.** Span duration, critical path, utilization, queue/wait ratio, bandwidth, allocation versus capacity, memory lifetime, communication/computation overlap, flame aggregation, anomaly rules, and run-to-run regression. Threshold source and baseline accompany the result.

## Representation matrix

| Question | Primary | Alternatives |
|---|---|---|
| one value/progress | big number, delta, bullet, progress | gauge only with a meaningful fixed bound |
| category comparison | sorted bar, dot, lollipop, table microbars | slope/dumbbell for two states |
| time change | line, step, area, horizon, sparkline | small multiples, events, overview brush |
| distribution | histogram, ECDF, box, violin | KDE, strip/beeswarm, ridgeline, QQ |
| relationship | scatter, hexbin, density contour | regression/residual, connected scatter |
| many variables | correlation heatmap, small multiples | parallel coordinates; radar only for few normalized variables |
| composition | stacked bar/area | waterfall, streamgraph, mosaic; pie only for few stable parts |
| flow | Sankey/alluvial, sequence lanes | chord for dense symmetric exchange |
| hierarchy | indented tree, icicle, treemap | sunburst, dendrogram |
| graph | node-link, adjacency matrix | layered DAG, arc diagram |
| matrix | labeled heatmap | clustered heatmap, matrix profile |
| execution | Gantt, flame graph, event raster | waterfall, resource lanes, critical-path graph |
| logs/errors | severity list, event timeline | rate sparkline, grouped cause table |
| uncertainty | interval/forest, fan chart | ensemble spaghetti with summary, density |
| geography | proportional symbol, choropleth, route | hexbin/raster density; only for spatial questions |
| tensors | slice grid, heatmap, small multiples | volume, isosurface, surface, point cloud |
| trajectories | 2D/3D path, phase portrait | correspondence, density tube, animation plus static trail |

## Domain bank

### Training and run comparison

- Hero loss/reward timeline with last values, epochs, evaluation/checkpoint events, and overview brush.
- Run small multiples aligned by step, sample, wall time, or compute; difference and ratio views name their baseline.
- Characteristic-based selection groups by model, dataset, precision, seed, optimizer, or tag before curves are shown.
- Parallel coordinates or a typed comparison table reveal configuration differences while outcome values stay on the same rows.
- Pareto frontiers compare quality with time, memory, energy, or cost; dominated runs remain visible but muted.
- State lanes show queued, loading, forward, backward, sync, checkpoint, evaluation, failure, and completion.

### Optimization and gradients

- Gradient/parameter norm timelines by layer, update-to-weight ratio, clipping events, zero/NaN incidence.
- Layer × step heatmaps for gradient flow, activation saturation, dead units, or learning-rate groups.
- Histograms/ridgelines for weight, gradient, activation, and update distributions over checkpoints.
- Loss landscapes use 2D contour first and optional 3D surface.
- Optimizer state and momentum use phase portraits or selected parameter trajectories.

### Representations and interpretability

- Embeddings use scatter/hexbin with class, time, run, or cluster encodings; large sets use WebGL traces.
- Activations/attention default to tensor slices and small multiples; volume/isosurface is for meaningful depth adjacency.
- Attention uses matrix heatmaps, sparse token arcs, head small multiples, and rollout/flow.
- Attribution uses signed waterfall/bars, token heatmaps, saliency overlays, SHAP beeswarm, dependence, and ICE/PDP.
- Representation similarity uses CKA/SVCCA matrices, clustered blocks, and layer-matching flow.
- Error analysis uses confusion, calibration, residuals, slice tables, exemplar grids, and error-transition Sankey.

### Systems and infrastructure

- CPU/GPU/memory/network capacity uses labeled bullet or allocation bars with current/total values.
- Kernel/operation timing uses flame graphs, Gantt lanes, event rasters, and ranked tables with microbars.
- Communication overlap uses aligned compute/communication lanes and bandwidth plots.
- Model/system topology uses a layered DAG or tree with node status and measured edge flow.
- Many-worker state uses stripes or horizon charts rather than dozens of gauges.
- Alerts use an ordered event list with rate sparklines and links to the responsible interval/operation.

## Renderer policy

Plotly stays primary: it covers line, area, bar, histogram, box/violin, scatter/hexbin, heatmap, contour, waterfall, Sankey, parallel coordinates, treemap/sunburst, table, 3D scatter/surface/volume, animation, selection, and zoom. SVG/HTML owns chrome, direct-label overlays, event lists, table microcharts, flame/resource lanes. Add D3 only for concrete unsupported geometry; add Three.js only for a concrete GPU/camera scene.

## Applicability

- `N × 1 numeric`: line when ordered; distribution when unordered or requested.
- `N × 2 numeric`: scatter; line only when the first column is ordered/time.
- all-numeric grid: heatmap plus per-column lines/small multiples.
- `step`, `time`, `epoch`, `wall_time`: temporal families become eligible.
- `start`, `end`, `duration`, `parent`: interval, Gantt, flame, waterfall become eligible.
- table references: hierarchy/tree and inline child previews become eligible.
- rank `3+` tensor: slice grid is primary; 3D is opt-in.

These are visibility predicates, not automatic transformations. Grouping, aggregation, scale, thresholds, and comparisons remain explicit user choices.

## Interaction and QA

Essential values remain readable without hover; keyboard focus and tap expose the same detail. Shareable views persist selection, filters, range, representation, and camera in the URL or workspace. Every chart provides a table fallback, units, source, caveats, color-redundant encoding, and reduced-motion/static state. Mobile puts supporting panels below primary evidence and replaces hover-only detail with tap/focus.
