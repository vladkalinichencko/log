# log — Design Notes (Working Document)

**Status**: Pre-spec. Architect interview in progress. Do NOT treat as authoritative — this captures decisions made so far and open questions.

When all questions are resolved, the architect agent will produce `SPEC.md`. Until then, this file is the source of truth for what's been decided.

---

## What this is

A toolkit for ML training that combines:
1. **Observability** — local-first, file-based, tile-rendered "window into training"
2. **Standard infrastructure as one-line API** — checkpointing (with rotation, top-K, async, atomic), distributed setup (DDP/FSDP), LR schedules, dataset mixing, resume, RNG management

The user writes the training loop. `log` provides building blocks for everything around it. User code shrinks from "hundreds of boilerplate lines" to "model + training step + a handful of log calls".

The product is positioned against ClearML / MLflow / W&B (logging) AND HuggingFace Trainer / Lightning (training framework) — but with a key distinction:

**`log` is a toolkit, not a framework.** Functions you call from your loop. Never owns the loop. Never inverts control. Each function works independently and has sensible defaults.

Distinctions vs other logging tools:
1. **Human-readable file storage** — no opaque database, structured folders you can `cat`, `grep`, `git diff`
2. **Tensor + tree as universal abstraction** — every view (scalar dashboard, timeline, cluster overview, architecture viz) is a different rendering of the same underlying tensor tree
3. **Designed for understanding complex training systems** — bottleneck profiling, dataset mixture inspection, cross-metric correlation, cluster health visualization

Distinctions vs training frameworks (Trainer/Lightning):
1. **No inversion of control** — user writes `for batch in loader: ...` always
2. **Independent functions** — use `log.checkpoint()` without `log.distribute()`, mix and match freely
3. **No god config object** — each function takes its own parameters with defaults

## Who uses it

A single researcher (the user). Not designed for team collaboration in v1.

## Decisions made

### Philosophy
- **No on-demand recomputation.** If you want to inspect something, you log it explicitly. Memory cost = your responsibility. No magic.
- **Functional core, imperative shell.** Python toolkit writes files. Backend reads files, returns JSON. Frontend renders. Each layer has zero knowledge of the others.
- **User owns the loop. `log` owns the infrastructure.** User writes `for batch in loader: forward, backward, step`. `log` provides one-call functions for checkpointing, distributed setup, LR schedules, resume, dataset mixing.
- **Toolkit, not framework.** No inversion of control. No callbacks. No required base classes. Just functions you call.
- **Sensible defaults everywhere.** `log.checkpoint(model)` works without parameters — top-5 last, every 1000 steps, async, atomic. Override parameters when needed.
- **Independent functions.** Use one without the others. No "all or nothing".
- **Live and replay are the same code path.** Live = read files as they're written. Replay = read finished files. No two-system architecture.
- **Flat user-facing API; conventional Python internals.** Single-file-modeling philosophy applies to API surface (simple function calls). Internals are normal Python with OOP and abstractions where they help — they're infrastructure code, not hackable models.

### Scope tiers

**v1 — toolkit + tables in files + tiles in UI**

*Toolkit (Python API):*
- `@log.run` decorator + `log.logger()` for logging
- `log.watch(model)` for auto-instrumentation via hooks
- `log.track(loader)` for samples_seen + auto distributed sampler
- `log.distribute(model)` for DDP/FSDP wrap
- `log.checkpoint(...)` with rotation, top-K, async, atomic — all defaults
- `log.resume_state(...)` for one-call resume
- `log.warmup_cosine/linear/constant(...)` for standard LR schedules
- `log.tick(...)` combined log + cadence trigger

*Observability:*
- File format + backend + frontend
- Universal tile/card UI: any logged data becomes a tile
- **Table view** (Excel-like): renders any tensor or scalar series as a table with derived columns, filters, sorts, annotations. **Editing creates derived columns; never mutates source files.**
- **Chart views**: line (scalar over step), heatmap (matrix over step), histogram (distribution at step)

**v2 — connected tiles + control channel + advanced data + advanced toolkit**

*Toolkit additions:*
- `log.mix(datasets, weights=...)` — dataset mixing
- `log.combine_losses(...)` — weighted multi-loss
- `log.eval_loop(...)` — standard evaluation pattern
- `log.batch_safe()` context manager — OOM/NaN recovery
- `@log.metric` — custom metric decorator
- `log.poll_commands()` — explicit opt-in for UI commands

*UI additions:*
- Tiles connect via the computation tree (node-graph relationships between paths)
- UI → code control channel via `runs/<run>/_commands/`
- Hot-swap hyperparameters mid-training (uses control channel)
- On-demand checkpoint from UI (uses control channel)
- **Dataset viewer**: explicit sampling via `log.sample_dataset(loader, n=512)` — saves representative batches for inspection
- **Dataset coverage tracking**: which sample indices were seen at which step
- On-the-fly transforms in viewer (PCA / UMAP / SAE)
- torch.profiler trace import (read existing trace files, render flamegraph)

**v3 — scale, structure, environment, cluster ops**

*Toolkit additions:*
- Auto-FSDP detection for large models in `log.distribute`
- Multi-rank coordination helpers
- Heartbeat / hang detection helpers

*UI additions:*
- **Cluster overview tile**: per-rank colored cards (health, throughput, GPU util) — the rectangle grid you described
- **Per-rank timeline tile**: divergence detection (curves should overlap)
- **NCCL ops timeline**: gap detection for hangs
- **Memory per-rank tile**: leak detection
- **Hang detection alerts**: heartbeat-based
- **Checkpoint save progress**: real-time % indicator
- Hierarchical architecture visualization (grid layout of tensor blocks, not 3D)
- Remote SSH viewer (backend on server, frontend on local)
- Distributed profiling sync (single-machine multi-GPU first; multi-node much later)
- **Memory / resource profiler** (background sampler for GPU/CPU memory, util, bandwidth)
- **Console capture** (stdout/stderr → `logs/console.txt`)
- **Environment / dependency snapshot** (requirements, conda env, system packages, CUDA version)

### Deployment
- **v1**: local-first. Training runs on user's Mac OR directly on the Nvidia server (no remote viewing across machines yet).
- **Design constraint**: file format and protocols must be compatible with future remote SSH and cluster scenarios. No decisions in v1 that block scaling.
- **v2+**: remote SSH viewing, then cluster

### Storage layout (preliminary)
```
runs/<run-name>/
  config.json               # snapshot of hyperparams at run start
  meta.json                 # git hash, requirements hash, start time, samples_seen
  epoch_<N>/
    metrics.jsonl           # scalars (one row per log call, includes step + samples_seen + rank)
    tensors/<path>.npy      # logged tensors (paths mirror tree)
  checkpoints/
    ep<N>_loss<X>.pt        # whatever user passed to log.checkpoint
  views/                    # v1: derived columns, filters, annotations created in UI table view
    <view-id>.json          # references source paths + transformations; never mutates source
```

**v2 additions:**
```
  _commands/                # UI writes commands; user code polls via log.poll_commands()
  dataset_sample.pt         # representative batches captured via log.sample_dataset()
  dataset_coverage.jsonl    # which sample indices were seen at which step
```

**v3 additions:**
```
  logs/
    console.txt             # captured stdout + stderr with timestamps
    system.jsonl            # background-sampled GPU/CPU memory + utilization
  env/
    requirements.txt
    conda-list.txt
    system-packages.txt
    cuda-info.json
  rank_<N>/                 # per-rank subdirectory for multi-GPU runs (default: no subdir)
```

Every entry in any `.jsonl` includes: `step`, `samples_seen`, `wall_time`, `rank` (default 0). This is the v1 design constraint that keeps v3 multi-GPU compatible.

### Sampling policy
**No magic.** What the user calls `log.log("x", value)` is what gets logged — exactly the value, exactly that step. If they want aggregates, they compute and log them.

### API surface

Python package is **literally `import log`**. Accepted risk: collides with `log` as a variable name in user code. Documented in user-facing docs as a known consideration.

Different mechanisms for different use cases. One recommended way per use case.

| Use case | Mechanism | Tier |
|---|---|---|
| Register a run | `@log.run(project="...", tags=[...])` decorator on `main()` or `train()` | v1 |
| Custom scalars (loss, lr, accuracy) | `logger.log("loss", value)` | v1 |
| Anything by explicit path | `logger.log("encoder.layer1.attn", tensor)` — dot-separated | v1 |
| All activations / gradients of a model | `log.watch(model)` — registers forward hooks; paths auto-derived from `model.named_modules()` | v1 |
| **Automatic step counting + DataLoader** | `loader = log.track(loader)` — wraps DataLoader, increments `samples_seen`, auto `set_epoch`, uses `DistributedSampler` if multi-rank | v1 |
| Custom step counting (no DataLoader) | `log.tick(samples=N)` — escape hatch | v1 |
| **Distributed setup (DDP/FSDP)** | `model = log.distribute(model)` — inits process group if needed, wraps DDP for small or FSDP for large (auto-detect or explicit), sets device from `LOCAL_RANK` | v1 |
| **Checkpointing with rotation, async, atomic** | `log.checkpoint(model, optimizer, scheduler=..., keep_top_k=5, every=1000, metric="loss")` — all parameters have defaults | v1 |
| **Resume + state restoration** | `log.resume_state(model, optimizer, scheduler)` — no-op if no checkpoint, restores all state otherwise. Returns the step to resume from. | v1 |
| **Standard LR schedules** | `log.warmup_cosine(optimizer, warmup, total)`, `log.warmup_linear(...)`, `log.warmup_constant(...)` | v1 |
| **Combined log + checkpoint trigger** | `log.tick(loss=loss)` — one call, increments samples, logs scalars, triggers checkpoint cadence | v1 |
| Sample dataset for viewer | `log.sample_dataset(loader, n=512)` | v2 |
| **Dataset mixing** | `log.mix(datasets, weights=[0.7, 0.3])` — standard pattern, returns one dataset | v2 |
| **Multi-loss combining** | `log.combine_losses({"task1": loss1, "task2": loss2}, weights=...)` | v2 |
| **Eval loop** | `log.eval_loop(model, eval_loader, metrics=[...])` — standard pattern | v2 |
| **Batch-safe context** | `with log.batch_safe(): ...` — catches OOM/NaN, skips bad batches, logs incident | v2 |
| Complex custom metrics (e.g. polar drift) | `@log.metric` decorator | v2 |
| Poll for UI commands (hot-swap, etc.) | `log.poll_commands()` — explicit opt-in | v2 |

**Tree path syntax**: dot-separated strings (`encoder.layer1.attn`). Hooks auto-fill paths from PyTorch module hierarchy. No context manager — explicit paths only, less magic.

**Hooks design constraint**: must add ~zero per-step overhead. Implementation: hooks enqueue tensor *references* (not copies) to a background writer thread; main thread sees a `queue.put()` and that's it. The background thread decides what to copy, downsample, or drop based on configured sampling. **All log writes are async** — main training thread never blocks on disk I/O.

**When to use hooks vs explicit log.log:**
- **Hooks** (via `log.watch(model)`): when you want all activations/gradients of a model, especially someone else's model where you can't edit `forward`. Filter via `paths=["encoder.*"]`. One line, comprehensive, non-invasive.
- **Explicit `logger.log(path, value)`**: for non-Module values (scalars, custom computations, attention weights computed manually, layer-internal intermediates).
- Both are first-class. Use what fits the value being logged. The user never writes `register_forward_hook` directly.

**Hooks limitations (documented in user docs)**:
- Works for any `nn.Module`. Doesn't capture pure functional ops (`F.relu`, `F.softmax` called directly outside a module).
- Tied weights / shared modules will fire hooks multiple times — paths get suffixed.
- Dynamic models (modules created mid-training) require re-registration.
- For unsupported edge cases: use explicit `logger.log("name", tensor)`.

### Example: user code shrinks dramatically

This is what a typical training script looks like with the full toolkit (v1):

```python
import log
import torch
from torch.utils.data import DataLoader

@log.run(project="my-experiment", config={"lr": 1e-4, "batch_size": 32})
def main(cfg):
    model = MyTransformer(cfg)
    model = log.distribute(model)                           # DDP/FSDP under the hood
    optimizer = torch.optim.AdamW(model.parameters(), lr=cfg.lr)
    scheduler = log.warmup_cosine(optimizer, warmup=1000, total=100000)
    loader = log.track(DataLoader(dataset, batch_size=cfg.batch_size))
    logger = log.logger()
    
    start_step = log.resume_state(model, optimizer, scheduler)  # 0 if no checkpoint
    
    for batch in loader:
        loss = model(batch).loss
        loss.backward()
        optimizer.step()
        scheduler.step()
        optimizer.zero_grad()
        
        log.tick(loss=loss)  # logs scalar + samples_seen + checkpoint cadence in one call

if __name__ == "__main__":
    main()
```

~15 lines of user code. Compare to a typical W&B + Lightning + Hydra setup that's 100+ lines for equivalent functionality. The model and the training step are visible; everything else is sensible defaults.

### Resume mechanics
`log` does not control resume — user code does. But `log` provides:

- **State capture** at `log.checkpoint()`: model/optimizer/scheduler state (whatever user passed) + RNG state (torch, numpy, random, CUDA) + step + epoch + config snapshot + git hash + requirements hash
- **Identity tracking (passive)**: at run start, log captures config + git hash + requirements hash snapshot. On resume, the diff is **stored in run metadata** and surfaced as a UI badge ("resumed with changes"). **No interactive warning, no block.** User is free to proceed. The diff is there if needed for debugging.
- **NOT controlled by log**: dataset iteration position (varies wildly by dataset impl), CUDA non-determinism (out of anyone's reach)

### Universal abstraction: tensor + tree

Every logged thing has:
- A **path** in the tree: `run_name :: epoch_N :: encoder.layer1 :: attn_matrix`
- A **value**: tensor (any shape) or scalar
- A **timestamp + step + samples_seen + rank**

### UI: tiles on a canvas

The user-facing UI in v1 is a canvas of **tiles** (cards). Each tile is a view onto the tensor tree. Tile types:

- **Table tile** (Excel-like): render any series of scalars or tensors as rows/columns. Supports derived columns (formulas referencing other paths), filters, sorts, annotations. All edits are stored in `views/<view-id>.json` as expressions — source files are immutable.
- **Line chart tile**: scalar series over `samples_seen` (default x-axis), toggle to step or wall_time
- **Heatmap tile**: matrix or 2D tensor over step
- **Histogram tile**: distribution at a fixed step
- **Tree tile**: navigable view of the full tensor tree, used to drag tensors onto the canvas

In v2: tiles can be **connected** via tree paths — a node-graph editor where selecting nodes drives what other tiles show.
In v3: tiles arranged hierarchically to render the model architecture (tile = layer, position = nesting).

The canvas layout is per-user and saved as a workspace file. Multiple workspaces per run are supported.

### Boundary: code ↔ log ↔ UI

Explicit and one-directional in v1:

```
USER CODE  →  log API  →  files  →  log backend  →  UI
   (writes everything)              (read-only)
```

- **User code** owns: training loop, model, optimizer creation, checkpoint loading at resume, dataset iteration, dataset source format choice.
- **log package** owns: writing files (scalars, tensors, checkpoints), tracking step/samples_seen via wrappers (`log.track(loader)`), capturing RNG/config snapshots.
- **UI** owns: read-only rendering and analysis via tiles. In v1, **never** writes anything that affects training.

`log` is never an IDE, never a Trainer, never owns the training loop. The contrast with HuggingFace Trainer is intentional: Trainer wraps the loop and hides it, which is convenient until you need to customize anything. `log` stays outside the loop entirely — you call into it from your loop, never the other way around.

### Boundary: dataset source ↔ log

**In v1**: `log` does not parse or understand dataset source formats. It observes only what comes through the PyTorch `DataLoader`: batch shape, sample indices (if returned), timing per batch. Format-agnostic.

**In v2**: `log.dataset` toolkit is added with thin wrappers and explicit compute helpers. The boundary becomes:

| Concern | Where it lives |
|---|---|
| Download manager | HuggingFace `datasets` (not log) |
| Raw Parquet reading | `pyarrow` (not log) |
| Filesystem abstraction | `fsspec` (not log) |
| Large-scale dedup | `datatrove` (not log) |
| Deep exploration UI | `Lilac`, `Nomic Atlas` (not log) |
| Mixing wrapping with logging | `log.dataset.mix(...)` |
| Streaming with disk-bounded cache | `log.dataset.stream(...)` |
| Explicit compute helpers (embeddings, perplexity, length stats) | `log.dataset.compute_*(...)` |
| Embedding-based filtering | `log.dataset.exclude_similar_to(...)` |
| Visualization of dataset stats | log UI tiles (length dist, embedding 2D, etc.) |

**Three compute categories** (the "no magic" principle refined):

| Tier | When | Magic OK? | Examples |
|---|---|---|---|
| **Training-time** | Inside training loop, in hooks | **Never** auto-compute | `logger.log()`, `log.checkpoint()`, `log.watch()` — only what user said |
| **Toolkit-time** | When user explicitly called a function | Heavy work OK on demand | `ld.compute_embedding_view()`, `ld.exclude_similar_to()` — user knows they started it |
| **Visualization-time** | When user opens a tile in UI | **OK auto-compute** with progress indicator | Open "embedding UMAP tile" → backend lazy-computes UMAP, caches, shows progress bar |

Principles:
- **Training is sacrosanct** — never auto-compute during training. Performance critical.
- **Toolkit functions are explicit** — user runs them, user accepts the cost.
- **Visualization can compute on demand** — user opened the tile, sees progress, expects to wait if heavy.

**Viz-compute caching**: backend stores results in `runs/<run>/_viz_cache/<viz-id>.json`. Reopening = instant. Underlying data changed = invalidate, recompute.

**Viz-compute progress through state**: tile dispatches "compute requested" action. State becomes `{ vizState: "computing", progress: 0.4 }`. UI renders progress bar. Done → `{ vizState: "ready", data: ... }`. Same FSM pattern as everywhere else.

For dataset inspection in v2 viewer, user explicitly captures via `log.sample_dataset(loader, n=512)` or `log.dataset.compute_*` helpers. log does NOT try to introspect entire datasets — intractable for streaming or large data.

The v2 control channel (UI → code via `_commands/` directory) is an **explicit opt-in** by user code: the user calls `log.poll_commands()` at points where they're willing to accept external changes (typically start of each step). If they never call it, the UI commands silently queue and have no effect.

---

## Open questions

### Delegated to architect (resolve in SPEC.md)
The user has explicitly delegated these tech-stack decisions to the architect agent when SPEC.md is authored:
- Backend framework: FastAPI / Aiohttp / pure file watcher + static server
- Live update mechanism: WebSocket / SSE / polling
- Frontend framework: React variant (Next.js / Vite / Remix)
- Visualization library: D3+Visx / Plotly / Recharts
- Index/metadata storage: SQLite for fast queries over runs vs. pure file scan
- Tensor file format: `.npy` per tensor / batched `.npz` / HDF5
- Concurrent write strategy (training writer + UI reader): file locking / atomic writes / append-only
- `log.watch(model)` reference semantics: weakref vs. hold

These should be answered with a specific choice + 1-2 sentence rationale (and ADR in spec) — not left vague.

### Out of scope (explicit)
- Distributed multi-GPU profiling sync — out of v1 (v3)
- torch.profiler integration — out of v1 (v2: import existing traces; never our own profiler)
- Crash debugging (NaN/shape mismatch viz) — out of v1
- Streaming datasets (IterableDataset, S3, parquet) — out of v1
- On-demand activation recomputation — out of product entirely (philosophy)
- Team collaboration / sharing runs between users — out of v1
- Auth, multi-tenancy — out of v1
- Architecture visualization via torch.fx — v3 (hierarchical grid, not 3D)
- **Trainer-style API** (`log.fit(model, data)`) — never, ever (philosophy: `log` never owns the loop)
- **Auto-instrumentation of arbitrary frameworks** (Lightning, Accelerate, HF Trainer auto-detect) — explicit registration only

### Domain entities

The core nouns of `log`:

- **Project** — a logical grouping of runs (e.g., "transformer-experiments")
- **Run** — one execution of a training script. Has config snapshot, metadata, and any number of logged tensors.
- **Tensor** — a single logged value (scalar or n-dimensional array) at a specific step. Has a path.
- **Path** — location in the tensor tree, like `run-1 :: encoder.layer1 :: attn_matrix`
- **Table** — derived view of any subset of tensors as rows and columns. **Everything in the UI is a table or composition of tables.**
- **Tile** — UI rendering of a table. Same table can have multiple tile types (table view, line chart, heatmap).
- **Workspace** — saved layout of tiles on a canvas. Per-run or template.
- **View definition** — saved table query / transformation (filter, sort, derived columns). Reusable.
- **Checkpoint** — saved training state at a step. Belongs to a Run.
- **Annotation** — user note attached to any of the above.

These entities exist on both backend (in files) and frontend (in state store). Backend has authoritative copy; frontend has subscription/cache.

### Ports and Adapters (hexagonal architecture)

`log` follows hexagonal architecture: business logic is decoupled from infrastructure via **ports** (interfaces) implemented by **adapters** (concrete realizations).

Examples:
- **Storage port**: defines `read(path) → bytes`, `write(path, bytes)`, `watch(path) → events`. Adapters: `LocalFileStorage`, `S3Storage` (v3), `RemoteHTTPStorage` (v2).
- **Index port**: `query(filter) → list of runs`. Adapters: `FileSystemScan` (v1), `SQLiteIndex` (v1+ if needed for performance).
- **Transport port**: how UI talks to backend. Adapters: `WebSocketLocal`, `WebSocketRemote`, `HTTPPolling`.
- **Training-side port**: `log.checkpoint`, `log.distribute`, etc. — these are ports that user calls. Their implementations are adapters that may differ in test vs production.

This makes the system testable: swap real adapters for fakes in tests. It also makes scaling to cloud a matter of writing new adapters, not modifying business logic.

### Local-first, cloud-compatible without rewrite

`log` v1 is local-only: training writes files, UI reads files, no network involved. But the architecture is designed so that going to remote/cloud is a swap of one layer, not a rewrite:

- **File watcher** → swap to HTTP polling / WebSocket
- **File writer** → swap to HTTP POST to backend
- **State store** → unchanged
- **Selectors** → unchanged
- **Components** → unchanged

This works because the contract between layers is "messages with explicit shape", not "shared memory or direct file access". Even in local mode, frontend talks to backend via WebSocket/HTTP — not by reading files directly.

For cloud + multi-user (far future), add: auth middleware, per-user state slices, ID-based references in state shape, optional CRDTs if collaborative editing is needed. These additions don't change v1 architecture, only add layers.

**Design constraint for v1**: any new state field, any new API endpoint, any new file format detail must be answerable in terms of "would this work the same way if the file was on a remote server?" If no — reconsider.

### Universal architecture pattern (applies to every feature)

The entire app — backend and frontend — follows **unidirectional data flow with derived state**. Every feature, from a blue-dot notification to arrow-key tile navigation, follows the same five-step pattern. There is no "should this be a class or a function" question to answer per feature.

**The pattern:**

```
DATA SOURCE  →  STATE STORE  →  VIEW
(files,           (single,         (renders
 websocket,        canonical        slice of
 user input)       tree)            state)
                       ↑               ↓
                       │               │
                       └──── ACTIONS ──┘
                       (pure functions
                        that update state)
```

**Four rules that make it work:**

1. **Single source of truth.** All app state in one tree. No duplicates.
2. **Unidirectional flow.** View reads state. View dispatches actions. Actions mutate state via pure reducers. View never mutates state directly.
3. **Derived state, not stored state.** If you can compute it from existing data, compute it via a selector. Don't store it as a separate field that you have to keep in sync. This eliminates entire classes of bugs.
4. **Components subscribe to slices.** Each component reads the minimum state it needs. When that slice changes, only it re-renders.

**Five steps to add any new feature:**

1. What's the state? (Add to tree, or derive from existing.)
2. Is it primary or derived? (Primary = stored. Derived = selector.)
3. What actions change it? (User action → reducer. External event → middleware dispatches action.)
4. What components show it? (Subscribe to selector, render UI.)
5. Test it. (Selectors and reducers are pure — trivial to test.)

**Example: "blue dot" indicating unread run in a folder tree.**

The dot must appear on the run item, OR on the collapsed parent folder, OR on grandparent if both are collapsed. Naive approach: workers that propagate "has unread" up the tree. Correct approach: a recursive selector `isFolderUnread(state, folderId)` that walks children. Folder component subscribes; React rerenders automatically when underlying `lastViewed` field changes anywhere in the tree. Zero workers. Zero manual propagation.

**Example: arrow-key navigation between tiles.**

`state.workspace.focusedTileId` holds the current focused tile. Global keyboard handler dispatches `focusNextTile()` / `focusPrevTile()`. Tile component subscribes to "am I focused", uses that to adjust rendering and prefetch priority. No special "navigation manager" module needed.

**Where the pattern doesn't fit (escape hatches, ~10% of cases):**

- Heavy real-time data (>100 updates/sec): add throttling, memoization, virtual lists
- Custom canvas/WebGL rendering: imperative code lives inside one component
- Complex animations: imperative inside component, triggered by state changes
- Native browser APIs (drag-drop, file upload, history): middleware bridges imperative APIs to actions

These are localized escape hatches. Core architecture stays the same.

### Finite State Machines (FSM) for stateful features

Anything with multiple discrete states (loading/loaded/error, video player, drag interactions, multi-step forms) is modeled as an explicit FSM. States enumerated, transitions enumerated as `(state, event) → newState` table. Invalid transitions silently ignored.

FSM lives inside the reducer as just another piece of state. For simple cases (3-5 states) — handwritten enum + switch. For complex cases (10+ states, hierarchical, parallel) — [XState](https://stately.ai/docs).

**FSM + animations**: each state has a visual representation. Transitions between states drive animations. Reversible/interactive animations (drag with snap-back, scrubbing) work naturally because the FSM has states for in-between conditions (dragging, settling, settled). Animation libraries like Framer Motion interpolate visual properties as the FSM walks through states.

### UI ↔ async source state synchronization

Common bug class: UI shows "playing" because user clicked play, but server hasn't confirmed yet. UI lies.

**Solution**: state separates user intent from confirmed reality:

```
state.player = {
    userIntent: "playing",
    serverState: "loading",
    confirmedState: null
}
```

UI renders based on `serverState` / `confirmedState`, not `userIntent`. While `loading` — shows spinner. On confirmation — switches to play/pause icon. On failure — error + retry.

**Optimistic updates** (advanced): show intent immediately with visual hint (opacity, "saving..."), revert if server rejects. Handled the same way: explicit states for pending/confirmed/failed.

This applies anywhere async operations modify visible state: checkpoint save from UI, hot-swap of hyperparameters, run deletion. All must have intent → pending → confirmed/failed states.

**Technology stack that supports this:**

- State: Zustand or Redux Toolkit (final choice deferred to architect)
- Selectors: reselect or native memoized hooks
- Data fetching: TanStack Query / SWR (handles loading/error states uniformly, prefetch, stale-while-revalidate)
- Components: React function components + hooks (no class components)
- Animation: CSS for simple transitions, Framer Motion for layout/physics (use `layoutId` for shared-element transitions like sliding focus indicators), Canvas/WebGL for complex viz
- Finite State Machines: hand-rolled enum + reducer for simple cases, XState for complex
- Real-time: WebSocket → middleware → dispatch actions
- Routing: React Router (URL is state too)

The backend follows the same shape:
- State = files + (optional) SQLite index
- Actions = HTTP endpoints / WebSocket messages
- Selectors = file queries / SQL views
- Views = JSON responses

This symmetry means the mental model is the same whether you're working on backend or frontend.

### OOP usage policy

OOP is a tool, not architecture. Used where it helps, ignored where it doesn't.

- **Use classes when**: they hold state + methods that operate on it. Examples: `FileWatcher`, `TensorWriter`, `WebSocketServer`. Group of related state with operations on it = class.
- **Don't use classes when**: just a namespace for functions. If a class has no state and all methods are static — make them module-level functions.
- **Frontend**: function components + hooks. Classes deprecated by React.
- **Selectors, reducers**: pure functions. No OOP.

Architecture decisions (unidirectional flow, derived state, single source of truth) are orthogonal to OOP vs functional. Use whichever pieces fit each subsystem.

### Performance is orthogonal to architecture

Performance techniques applied **where bottlenecks exist**, not as separate architecture:

- **Throttle/debounce**: between events and actions (in middleware)
- **Memoization**: in selectors (reselect) and components (`React.memo`)
- **Virtual lists**: inside list component, only render visible items
- **Web Workers**: for heavy compute (e.g., PCA on large tensors). Communicate via messages — looks like actions to the rest of the system.
- **React Suspense + data fetching**: loading states handled by TanStack Query/SWR layer

These don't change the universal pattern. They're decorations on existing layers.

### Distinction: toolkit functions vs framework

`log` provides convenience functions like `log.distribute(model)` or `log.checkpoint(...)`. This might look like a framework but it isn't, because:

- **You call them, they don't call you.** No callbacks, no override methods, no class to inherit.
- **They're independent.** Use `log.checkpoint()` without `log.distribute()`. Or just `logger.log()` alone. No "all or nothing".
- **They have sensible defaults.** Zero-config use is the happy path. Parameters when you want to override.
- **You can always replace them with your own code.** `log.checkpoint(...)` is one call; if you need different behavior, write your own `torch.save(...)` instead. Nothing else in `log` breaks.

The contrast with `Trainer`: `trainer.train()` is **the** training. You can't use part of it. You can't easily inspect what happens. `log.distribute(model)` is a function that does one thing — you can read its source, use it or not, replace it. This is what "toolkit not framework" means concretely.

### Paradigm-agnostic by design

`log` does **not** assume the standard "forward → loss → backward → optimizer.step" training paradigm. It works with any iterative learning approach:

- **Standard supervised / SSL / RL** (gradients via PyTorch autograd) — primary use case
- **Spiking Neural Networks** (snnTorch, Norse, SpikingJelly) — works via hooks on spiking modules, surrogate gradients via standard autograd
- **Evolutionary algorithms** (EvoTorch, CMA-ES, PyGAD) — works with custom step unit (`@log.run(step_unit="generation")`)
- **Forward-Forward** (Hinton 2022) — no backprop, per-layer goodness scores logged explicitly
- **Hebbian / local rules** — no backward needed, log observes weight changes via hooks
- **Energy-based models, predictive coding, DFA, equilibrium propagation** — same logic

What `log` assumes:
- Some iterative loop exists
- Some measurable scalar values (loss, fitness, energy, accuracy, ...)
- Some state that can be checkpointed (weights, population, etc.)

What `log` does NOT assume:
- That `loss.backward()` is called
- That an `optimizer` exists
- That one "step" equals one batch
- That training uses DDP/FSDP (population-parallel is fine — log just won't help with that part)

**Step unit configurability**: `@log.run(step_unit="generation" | "episode" | "batch" | "sample")` — UI uses this as the default x-axis label. Default = "samples_seen" for backward-compat. Single parameter, no other changes needed.

### Opinionated bundling philosophy

`log` is an opinionated toolkit, not a "support every option" framework. For each technical choice (which embedder, which flamegraph lib, which dataset wrapper) we pick **one default** and document the choice via an ADR in SPEC.md.

Standard in ML toolkits — established pattern:
- **scikit-learn** unifies `fit/predict` over many algorithms with opinionated defaults
- **fastai** picks PyTorch + OneCycle + mixed precision as defaults, all documented by Jeremy Howard
- **MosaicML Composer** bundles efficiency methods (gradient clipping, EMA, ALiBi), each with paper reference
- **HuggingFace Transformers** picks PyTorch-first, Rust tokenizers backend, specific generation API
- **Keras** picks defaults for layer init, optimizer, etc.
- **PyTorch Lightning** picks specific Strategy implementations for DDP/FSDP

ADR format for each external library choice:
```
ADR-XXX: Use <library> for <purpose>
Decision: <what was decided>
Why: <reason — usability, ecosystem, performance, maturity>
Alternatives considered: <list with brief comparison>
Consequences: <what this binds us to, what it enables>
```

This makes choices honest and reviewable, not arbitrary. Users who disagree with a choice can use the underlying library directly — `log` does not replace the libraries it wraps, only standardizes their interface.

### Influences and non-goals

What we are NOT trying to be:
- **HuggingFace Trainer/Accelerate**: convenience wrapper around the loop. We do the opposite — stay outside, observe, provide independent toolkit functions.
- **MLflow**: experiment registry for teams with structured metadata, model registry, serving. We are single-user, local-first.
- **W&B**: cloud-first SaaS with collaboration. We are local files, no cloud dependency.
- **TensorBoard**: framework-coupled (originally TF). We are framework-agnostic with PyTorch as primary integration.
- **Aim**: closest philosophical match (file-based, fast, open). Worth studying their design choices. Difference: we add training toolkit (distribute, checkpoint, schedules, dataset helpers) and the tile-based "Excel for ML" UI.
- **Lilac**: data curation tool. We don't replace it — we observe training, they prep data.
- **datatrove**: large-scale data pipelines. We don't replace it — light wrappers only.
- **CleanLab, Argilla, Label Studio, FiftyOne**: specialized data tools. Out of our scope.
- **DVC, Pachyderm**: data versioning. Out of our scope.

What we ARE taking from each:
- W&B's clean Python API surface
- MLflow's file-based approach (but radically simplified)
- TensorBoard's "watch the training" feel
- Aim's local-first, no-cloud philosophy
- HuggingFace's lesson on what NOT to wrap (Trainer trap)
- fastai's commitment to opinionated defaults with documented rationale

### Data toolkits — what exists, what we use

A "unified scikit-learn-like data toolkit covering all modalities" does **not** exist — nobody has built it, because preprocessing operations across modalities (image augmentation, text tokenization, audio MFCC) are fundamentally different. The best attempts are within-modality or use a common abstraction at the loading layer only.

Major data toolkits worth knowing:

| Toolkit | Scope | Pattern |
|---|---|---|
| **scikit-learn** | Tabular + classical text | `fit/transform/predict`, composable Pipelines |
| **fastai DataBlock** | Vision/text/tabular/segmentation | Unified DataBlock pattern with opinionated defaults |
| **spaCy** | NLP | Composable pipeline (`nlp` object with components) |
| **HF Transformers Pipeline** | Inference across many tasks | One-line `pipeline(task)` API |
| **torchvision/torchaudio/torchtext** | Within-modality transforms | `Compose([...])` chains |
| **albumentations** | Image augmentation | Fast unified API |
| **NVIDIA RAPIDS** | GPU-accelerated tabular + ML | pandas/sklearn-compatible APIs |
| **NeMo, ESPnet** | Speech/NLP bundled | Unified models + data within domain |
| **Kornia** | Differentiable CV on PyTorch | Replaces OpenCV for DL workflows |
| **PyCaret, AutoGluon** | Low-code AutoML | One-call train pipelines |
| **NLTK, gensim, librosa, Lhotse, PyG/DGL** | Domain-specific | Each is a toolkit within its niche |

**Lesson for log**: don't try to be a data toolkit. The closest we get is `log.dataset` in v2 with thin wrappers — but transformations are user's job, using best-in-class libraries for their modality. log observes, doesn't transform.

**Design patterns we borrow from these toolkits**:
- scikit-learn's `fit/transform` consistency → our toolkit functions have consistent shapes
- fastai's opinionated defaults with documented rationale → our ADRs
- spaCy's composable pipeline components → our composable tile system
- HF Pipeline's one-line happy path → our `log.tick(loss=loss)`
- albumentations' speed-focused implementation → our async writer thread design

---

## What changes for v2/v3 deployment

When we move to remote SSH (v2):
- Backend needs to be runnable on remote server, frontend connects from local
- File format must already support: incremental sync, partial reads
- → **v1 design constraint**: jsonl is append-only and partially readable. ✅

When we move to cluster (v3):
- Multiple processes write to same run dir → need either single coordinator or per-rank subdir
- Timestamps need to be sync'd or rank-tagged
- → **v1 design constraint**: every log entry must include rank field (default 0 for single-process)

---

## Features mentioned in early discussion, slotted by tier

These came up in the initial brain-dump and have implicit scope assignments. Listed here so nothing is forgotten.

**Reclassification driven by "everything is a table" principle**: many features turned out to be just new ways to *create tables from existing tables*, so they collapse into v1 once we have the table substrate and a hierarchical merge language.

**v1:**
- Run list with filtering by all parameters
- Tile-based canvas with table/chart tiles
- Excel-like editing (derived columns, filters, annotations)
- **Workspace persistence and templates** (reusable tile layouts)
- **Smart batch rename via patterns** (`{arch}-{lr}-{date}`)
- **Hierarchical merge language** for creating new tables from existing ones (run comparison, splicing, joining across runs are all expressions in this language)
- **Comparison view** (just a table created via the merge language: two runs joined on step)
- **Splice interrupted runs** (a table created by concatenating segments, with a computed "continuity" column)
- **Custom statistical metrics** auto-computed for any table — including loss spike detection (>3σ from rolling mean is just one of many auto-stats)
- **Publication export** — works with the plotly / matplotlib / proplot conventions (let user pick the renderer; `log.export.figure(path, renderer="proplot")` or by conference style `renderer="nature"`)

**v2:**
- Gifs/videos of charts over time (`log.export.animate(...)`)
- **Live profiler integration**: `@log.profile(schedule=...)` wraps torch.profiler with a sampling schedule, streams traces to disk, frontend renders flamegraph + tables in real time during training. **Implementation**: custom UI using `d3-flame-graph` (or similar) for flamegraph rendering + our existing table tiles. Design consistency takes priority over feature-parity with Perfetto — we do not embed Perfetto UI. Substantial v2 work but visually cohesive.
- Project organization: folders, tags, sorting (basic exists in v1, advanced in v2)
- Dataset viewer with on-the-fly transforms
- Dataset coverage tracking
- **Dataset toolkit** (`log.dataset` module):
  - `mix(datasets, proportional=True)` — thin wrapper over HF `interleave_datasets`, logs proportions
  - `stream(uri, cache_shards=N, auto_delete=True)` — streaming wrapper with disk-bounded shard cache (solves the "10TB dataset on 100GB disk" problem)
  - `compute_length_stats / compute_embedding_view / compute_perplexity_scores` — explicit toolkit helpers, only run when called
  - `exclude_similar_to(ds, seed_examples, embedder=..., threshold=...)` — embedding-based filtering
  - **Principle**: log computes only when explicitly called via toolkit. No background heavy compute. Wraps existing libraries (HF datasets, sentence-transformers, fsspec), does not replace them.
- Custom metrics via `@log.metric` decorator (for metrics needing python; trivial ones live in v1 stats language)
- Control channel (UI → code)
- All v2 training toolkit additions (combine_losses, eval_loop, batch_safe)

**v3:**
- Live playback rate control (timeline scrubbing like a video editor — for visualizations with temporal dynamics like t-SNE trajectory animation). Mechanic of a specific visualization tile type, not a system-wide feature.
- RL-specific tiles: env grid, reward distribution across envs, per-env trajectory, action distribution
- Reward function change tracking (already covered by identity tracking)
- Cluster overview tile (rank grid, color-coded health)
- All deferred environment / hardware / console / dependency features

### "Everything is a table" — strengthened

The principle is now stricter than before. Every piece of data in `log` lives as a table:
- Scalars over time → tables (one row per step)
- Tensor activations → tables (one row per step, columns are tensor dimensions or summary stats)
- Run comparison → table joining two runs on step
- Splicing → table concatenating segments with computed continuity column
- System diagnostics (memory, gpu util) → tables
- Cluster health → tables (one row per rank)
- Custom statistics (loss spike z-score, rolling mean, etc.) → derived columns on existing tables
- Dataset coverage → tables (one row per sample index)

This means there is **one core data structure** (the table) and **one core operation** (creating tables from tables via the merge language). Every UI tile renders a table somehow. Every export takes a table. Every statistical metric is a derived column.

This is the "Excel for ML" idea, strictly applied.

### Hierarchical merge language (v1, design TBD in SPEC.md)

Tables in `log` live in a hierarchy: `project :: run :: epoch :: model.encoder.layer1 :: attn_matrix`. We need a language to express tables created from operations on existing tables across this hierarchy. Examples:

- "Concat run-A and run-B on step axis" → splicing
- "Join run-A and run-B side-by-side on step" → comparison
- "Take encoder.* across all runs, compute mean per step" → cross-run aggregate
- "From this attention matrix, take row 0 in run-A and row 1 in run-B, concatenate" → custom inspection

Open question for SPEC.md: what's the syntax? Path expressions with wildcards? SQL-like? Domain-specific UI builder? Decision deferred but noted as v1 scope.

## REVISION 2026-05-29 — Table-root code model, v0, code minimalism, UI interview reopened

The earlier "everything is a table" was stated as a *concept*. This revision makes it the literal code model and corrects the rest. These override anything above that conflicts.

### Table is the literal root type (not separate classes)

- There is **one base type in code: `Table`.** Everything is a `Table` or composed of `Table`s — Project, Run, Epoch, a logged tensor, a view, a comparison, system diagnostics, cluster health. Not "modeled like a table" — literally the same type.
- A `Table` has: optional column names, optional row names, and values. It can be a single scalar, a single row, a single column, a 2-D grid (Excel), or n-dimensional (n-D is a scaling concern → v3, not now).
- A folder on disk is a `Table` that contains `Table`s. So the on-disk tree IS the table tree.
- **Project is NOT privileged.** It is just a top-level `Table` that happens to contain other `Table`s. We may keep the first folder level as "project" for convenience, but a single table spanning many projects is allowed later (v3). Flat hierarchy; tables reference each other by links (the `::` path / merge language already defined above).
- Whatever the interface calls a thing is what it is — naming lives in the UI, not in privileged classes. Inheritance is used only where it removes code; otherwise composition.

### Code minimalism & standardization (architectural requirement)

- **Minimum code is a goal of the architecture itself**, not just the implementation. Fewest concepts, fewest layers, fewest dependencies.
- **Functions, not classes**, unless the thing holds data/state fields. No data fields → functions. Stateful infra (e.g. the writer, a watcher) → class.
- **Standardized like Lego**: the same kind of thing is written the same way every time (same argument order, same error shape, same FSM shape). If one is changed, all of its kind change together.
- **No comments.** Names carry meaning. Each name = fewest *words* that say what it is AND distinguish it from everything else AND say why it exists (a flag is named for what it controls). Parallel names for parallel roles.
- **No unrequested visuals.** Not one line of CSS, no padding/color/border/spacing, no extra DOM beyond what is explicitly requested. "Grid of divs" = grid of divs, ~20 tokens, nothing more. The planner, implementer, AND auditor must flag any visual/layout/styling not explicitly requested. Adding any of it requires asking the user first.

### FSM everywhere, inherited/abstracted

- Every stateful UI element is an explicit finite state machine — including the simplest button and every loading state (so a button visibly changes state while its action is pending). The FSM must be visible in the code.
- FSMs are defined once and reused/derived hierarchically (a base button-FSM, specialized variants), to cut code and bugs. Not re-invented per element.

### "Without bugs" — what it actually means here

The goal is not a magical bug-free guarantee. It is: every function is small, single-purpose, stateless where possible, with explicit input/output, so each is independently traceable and testable, and bugs are localized and easy to find. The mechanisms are: per-function unit tests, per-endpoint/operation integration tests, one end-to-end smoke test, the acceptance criteria, and the auditor. PyTorch-coupled pieces (resume, checkpoint) stay as single self-contained files (Transformers single-file ideology); everything else is plain functions.

### The spec must include a CODE MODEL

Separate from the data model, the SPEC must contain a UML-style code diagram: which things are classes (and their fields) vs plain functions, inheritance/composition, what calls what, and where each FSM/state hooks into the interface. For every function: input, output, one-line purpose. The reader must see *how the code is distributed across functions* and the data flow at that level — e.g. "when we add SQLite later, exactly this function gains this call." Implementation bodies are out of the spec; signatures + I/O + purpose are in.

### Feature tiers get explicit tags v0/v1/v2/v3

Features are grouped (semantically or by OOP where it helps — not forced OOP) and each tagged with its tier. **v0 is added:**

- **v0 (walking skeleton):** the `Table` class exists; one real `Table` is visible in the UI; the system runs end-to-end (file → backend → frontend) with logic stubbed. The visible table can be edited in basic Excel-like ways — resize cells, zoom, add/remove rows/columns/cells, aggregate, merge tables — wired through the state/reducer/FSM pattern. How exactly this looks in the UI is OPEN (see below).
- v1/v2/v3 as already listed, now to be tagged per feature when the spec is written.

### UI interaction — RESOLVED 2026-05-30 (interview complete)

The UI interview is now complete. This subsection is authoritative for the UI and supersedes the earlier "OPEN" note and anything above that conflicts.

**App shell: single-page application (SPA).** One HTML page; React swaps screens client-side via the router; the backend is a local read-only JSON + WebSocket server. Reason: single-user, local-first, no SEO and no multi-page server rendering needed — SPA is the simplest fit.

**Core realization — every screen is one `Table` rendered in a chosen representation.** "All projects", "the runs of a project", "the tables/tiles of a run", and "a single metric" are all `Table`s. They differ only in which *representation* renders them: a grid-of-cells, a list, a dashboard-of-tiles, a line chart, a heatmap. A "list of all experiments" and a "chart" are the same `Table` rendered two ways — switching representation turns one into the other. This sameness is the product's main modularity payoff.

**Navigation = drilling into a `Table`.** It behaves like a normal experiment tracker (W&B / MLflow style): a top nav bar with back/forward arrows + a breadcrumb of the current drill-path. You go projects → a project → its runs → a run's tables, and you drill back out. A cell may hold a **reference** to a child `Table`; clicking it navigates into that table. There is **no** free path-typing navigation between arbitrary tables — the `.`-path is used only inside the formula language's autocomplete. "As the screens go, so the folders are built": where a new table is created determines where it sits in the on-disk folder hierarchy, so the folder tree mirrors the screen drill-path and the system stays predictable.

**v0 layout is deliberately dumb.** No grid, no canvas, no positioning, no styling. Elements render left-aligned, stacked in document order — a `Table` is a grid of plain divs; the operation controls are plain buttons stacked in a column. v0 answers only "which screens exist and which elements live on each", end to end (file → backend → frontend), with the logic stubbed. Positioning/layout/styling is explicitly out of v0.

#### Element inventory (what exists on a screen — not how it is laid out)

A `Table` rendered as a grid carries:
- **Table name** — plain text at the top of the table block (inside whatever container holds it: a tile, a panel, a view). Editable by double-click.
- **Table size** — small plain-text label (e.g. `128×128`) next to the name. Decision: show it, as plain text near the name, NOT in the middle of the table; it is metadata. (May be dropped later; for now it exists so the element is present.)
- **Column-name header row** — rendered only if the table has column names. Each name editable by double-click.
- **Row-name header column** — rendered only if the table has row names. Each name editable by double-click.
- **Value cells** — a grid of divs; each shows its value. Numbers are **rounded to fit**; on hover the full value appears as an **overlay above the cell** (never by widening the cell — widening would clip against the fixed cell or shift the whole table). Double-click → the cell becomes a text input; Enter commits and deselects; Esc cancels and deselects.
- **Scalar table** = just the table name, no grid, until the user presses **＋** to grow it. No "1×1 frame".
- **＋ controls** — one on the right edge (add column) and one on the bottom edge (add row), Excel-like.
- **Corner dot-menu (⋯)** on a row/column header — opens a tiny menu with "delete". First click on "delete" relabels it to "confirm?"; second click deletes. Guards against accidental clicks. Ctrl+Z restores.
- **Table-reference cell** — a table icon + the referenced table's name; click drills into that table. (v1+: such a referenced table may also render *in place* as a mini chart/grid inside the cell — exactly how trackers show many experiments at once. v0: just the clickable reference.)
- **Representation switcher** — top-right of the rendered table: table-grid / line-chart / list / heatmap. Same data, render function chosen by a `representation` enum.
- **Toolbar** — a thin bar with table-wide actions: new table, merge/formula, aggregate, search. Exists; minimal.
- **Search box** — in the top bar. Searches table names and `.`-paths (cell-value search later). A result focuses + scrolls-to + highlights the matching table/cell.
- **Top nav bar** — back/forward arrows + breadcrumb of the current drill-path. This is the only cross-screen navigation.

Every stateful element above is an explicit FSM (button, cell-edit, delete-confirm, search, loading), named `<element>_fsm`, derived from a base button/loading FSM. Buttons get `cursor: pointer` on hover; no other animation in v0/v1 unless asked.

#### Opening a child table — surface deliberately left swappable

The exact surface when a table-reference cell is clicked (new browser tab / in-viewer panel / a second offset modal in z-space) is **not decided and does not need to be for the spec** — it is one function that can be swapped with a trivial edit, recorded in the change history. The spec records only: "clicking a table-reference cell opens that `Table`." **v0 default: open in the same viewer (replace the current view); no modal.** Modals are flagged as possibly harmful (extra disclosure step, focus traps); avoid them unless a concrete need appears. The progressive-disclosure question (edit inline from the tile vs. expand-then-edit) is deferred for the same reason — it does not change the data model or the operation set.

#### Exhaustive table operations (v0/v1)

For a `Table` these are essentially all operations that exist. Carry into the spec verbatim:

1. Edit cell value (double-click → input; Enter = commit + deselect; Esc = cancel + deselect)
2. Edit column name / row name (double-click)
3. Add row (＋ bottom edge) / add column (＋ right edge)
4. Remove row / remove column (dot-menu → delete → confirm-on-second-click)
5. Resize column width / row height (drag the border) — Excel-like
6. Zoom — Excel-like
7. Select a cell / drag-select a range / select a whole row / a whole column
8. Copy / cut / paste cells, rows, columns (Excel-compatible TSV)
9. Aggregate a column / row / range → sum / mean / min / max / count — Excel-like; appears as a derived row/column
10. Merge / combine tables via the **formula language** (hierarchical `.`-addressing; see below). Merging several tables is allowed.
11. Undo (Ctrl+Z); redo deferred to v1
12. Change representation (table-grid / line-chart / list / heatmap)
13. Drill into a table-reference cell (click → navigate)

All edits create **derived state / derived columns**; source files are never mutated (consistent with the existing `views/<view-id>.json` decision). Every edit is recorded in a change history.

**No "copy whole table" button.** Decision (asked in chat + recorded here): not needed for v0/v1. Copying a table = select-all (Ctrl+A) + copy, OR reference it by path in the formula language (`=projectA.run3.loss`), which already "pastes the table into the editor" by reference. A separate duplicate-table action is redundant because edits never mutate the source. Revisit a real "duplicate table" action in v2 only if a concrete need appears (an independent editable scratch copy).

**Cell value types — `CellType` enum, present in code now.** v0 stores every value as a string; the enum still exists: `CellType = { empty, string, number, bool, tensor_ref, table_ref }`. Later the UI may show type via tooltip-on-hover or color — out of scope now, but the enum is present so the structure is correct from the start.

#### Path / merge language — separator changed `::` → `.`

Supersedes the earlier `::`. Use a **single `.`** as the one hierarchical separator everywhere: `projectA.run3.encoder.layer1.attn`. Each segment is a child `Table`; the same dot that already separates module paths (`encoder.layer1`) also separates hierarchy levels — one uniform rule, since "a folder is a `Table` containing `Table`s." **Table/segment names may not contain `.`** (validated/escaped on write). Rationale: simplicity and fewer tokens — one separator instead of two. The formula language is minimal: hierarchical `.`-addressing + the small operation set above, with autocomplete showing a scrolling list of tables (each entry = `.`-path + name). A dedicated merge UI is deferred; for v0/v1, merging is done by typing in the formula language.

#### In-code naming convention (v1 — so modularity is verifiable by eye)

Strict per-feature modularity. Each feature is a small set of same-shaped functions, named by convention so the structure is visible and the auditor can check it mechanically:
- `<feature>_reducer` — pure state-update function
- `<feature>_state` — initial state / state shape
- `<feature>_selector` — derived-state function(s)
- `<element>_fsm` — the finite state machine for a UI element or animation

Same kind of thing written the same way every time (Lego). The same `Table` is rendered by different representation components, but internally everything is systematized: external appearance differs, internal structure is identical and copy-pasteable.

#### Where each UI function lives (layer mapping onto the unidirectional-flow diagram)

Using the `DATA SOURCE → STATE STORE → VIEW` diagram above (data = files/backend; store = the Zustand JS object in browser memory; actions = reducers; derived = selectors; view = components):

- **Search box.** Typed text = UI state `state.search.query` (a string in the store). Typing dispatches action `search_setQuery` → `search_reducer`. Matching is a **selector** `search_selector(state)` (pure, memoized) that reads the query + the loaded table tree and returns matching `.`-paths — derived, never stored. A results component subscribes to that selector slice. v0 searches the already-loaded tree client-side; if tables get huge, search becomes a backend endpoint later (a new adapter), the store/selectors/components unchanged.
- **"Go to element → highlight → scroll to it."** Focus target = UI state `state.focus.path`. A click/keypress dispatches `focus_setTarget` → `focus_reducer`. The target component subscribes via selector `isFocused(state, path)`; when true it adds a highlight class and calls `element.scrollIntoView()` inside a `useEffect`. The scroll itself is an imperative browser API — the documented escape hatch — triggered by the state change. It is interface state + a localized effect; it is NOT business logic, NOT data.
- **Screen navigation (drill in/out).** Current location = `state.route.path`, kept in sync with the URL by the router (URL is state too). Clicking a table-reference cell dispatches `route_navigate(path)`. Which `Table` to render = a selector reading `state.route.path` from the loaded tree, or a fetch (`GET /table?path=...`) via the data-fetching layer. Back/forward = browser history + reducer.
- **Representation switch.** Per tile: `state.tiles[tileId].representation` (enum). The switcher dispatches `tile_setRepresentation` → reducer. The tile component subscribes and picks a render function by a `switch` over the enum (`TableView` / `LineChartView` / `ListView` / `HeatmapView`), all fed the same `Table` data.
- **Toolbar buttons.** Each is a `button_fsm` (idle → hover → pressed → [pending → done/error] for async). Click dispatches an action → reducer (and a backend endpoint when persistence is involved).

#### Table-editor / dependency decision (research 2026-05-30)

Searched for a free, embeddable, no-watermark, no-cloud table/spreadsheet editor (sources logged in the chat message that produced this decision):
- **Handsontable** — dropped open source in 2019; non-commercial/evaluation license only; no free commercial path. Rejected.
- **AG Grid** — Community is MIT and production-usable, but advanced spreadsheet editing (range copy-paste, pivot) is Enterprise ($999+); large; imposes its own data model + theme. Rejected (gate + weight + owns the data model).
- **Glide Data Grid** — MIT, canvas-based, millions of rows at 60 fps. Rejected for us: canvas = no DOM cells, no CSS selectors, no per-cell div/FSM — conflicts with "grid of divs", inspect-by-CSS, and FSM-per-element.
- **react-data-grid (adazzle)** — MIT, DOM/div-based, built-in inline editing + Excel-compatible copy-paste in the free tier, one dependency (clsx), virtualized. The closest batteries-included free div-grid, but still imposes its own row/column model + styles.
- **Univer / Luckysheet / Fortune-sheet / jspreadsheet CE** — full spreadsheet frameworks; each owns its data model, state, and CSS; jspreadsheet CE (MIT) has no free formula engine. Rejected (own everything — the opposite of "everything is our `Table`").
- **HyperFormula** (formula engine) — GPLv3 or paid proprietary, NOT MIT; ~400 functions. Rejected: GPLv3 copyleft would force the whole app open-source or a paid key, and it is far more than our minimal formula language needs.

**Decision:** build our own `Table` render as a **grid of plain divs**; we own the cell, the editing FSM, and the (minimal, hand-written) formula language. No third-party spreadsheet component. This is the only choice consistent with "everything is our `Table`", minimum dependencies, FSM-per-element, grid-of-divs, no imposed styles, and copy-our-own-code-for-new-features. When real performance pressure appears on big tables (v1+), add only tiny MIT primitives: `@tanstack/react-virtual` for windowing and optionally `@tanstack/react-table` (headless — we still render our own divs) for column/sort logic. **v0 uses neither — plain divs.**

## Ready for SPEC.md?

Foundational decisions: ✅ all made
- Product vision, philosophy, scope tiers, deployment, naming, paths
- API surface (one mechanism per use case)
- Data model (tensor + tree, with samples_seen + rank fields)
- Storage layout (file-based, multi-rank ready)
- Sampling policy (no magic)
- Resume mechanics (passive identity tracking)
- v1 feature set (observer + memory profiler + console capture + step counter + dataset coverage)
- v2 feature set (control channel + custom metrics + dataset viewer + dependency snapshot)
- v3 feature set (architecture viz + multi-GPU + remote SSH)
- Code/log/UI boundary (one-directional in v1, opt-in upstream in v2)
- Explicit non-goals (no Trainer-style API, ever)

UI (RESOLVED 2026-05-30): ✅ SPA; every screen is a `Table` representation; drill-navigation; full element inventory + exhaustive operation set; `.` separator (was `::`); `CellType` enum; naming convention; layer mapping; own-the-grid (no third-party spreadsheet). See "UI interaction — RESOLVED 2026-05-30".

Remaining (delegated to architect, resolved during SPEC.md authoring):
- Tech stack choices (backend/frontend/viz lib) — now constrained: minimal deps, no third-party spreadsheet, drop framer-motion (CSS), reconsider orjson/watchfiles/SQLite/reselect/TanStack Query; no pinned versions in spec (names + lockfile)
- File format details (.npy/.npz/HDF5 for tensors)
- Concurrency strategy (training writer vs UI reader)
- `log.watch(model)` reference semantics
- `log.tick` auto-checkpoint behavior — RESOLVED 2026-05-30: tick does NOT auto-checkpoint. It only advances `samples_seen` and logs scalars. Checkpointing is only ever via explicit `log.checkpoint(...)`. ("no magic".)
- Cross-screen navigation — RESOLVED 2026-05-30: a top nav bar (back/forward arrows + breadcrumb of the drill-path), URL = state via the router. No left sidebar tree.

**Interview is complete (including UI).** SPEC.md was REWRITTEN DIRECTLY (2026-05-30, not via the architect agent — user said "Перепиши спек сам") to reflect all of: Table as the literal root type (ADR-011), a CODE MODEL §7 (UML + per-function I/O/purpose, classes-only-where-state, FSM hooks), v0 walking-skeleton tier + v0/v1/v2/v3 tags throughout §3/§11/§14, FSM everywhere from one `makeFsm` base (ADR-015, §7.3), minimal dependencies (ADR-013: dropped TanStack Query→`load_fsm`, reselect→memo helper, Visx→hand-drawn SVG ADR-006, framer-motion→none, orjson→stdlib json), no pinned versions (ADR-014: names + lockfile), the resolved UI §11 (SPA, screen=Table representation, drill nav, full element inventory + 13 operations, own-the-grid ADR-012), and the single `.` separator (ADR-010). Toolkit signatures, error table, and sequence diagrams preserved from the prior spec. SPEC.md is now the source of truth; this doc is superseded for everything it covers.

---

## REVISION 2026-05-30b — post-spec feedback round (tile model, code-philosophy capture, open discussions)

User reviewed the rewritten SPEC.md and raised a batch of points. Resolved ones are applied to SPEC.md; open ones are recorded here for the next round.

### Code-philosophy capture (the user's #1 concern)
The user's core value — **code must look identical and be built identically (Lego), read effortlessly, stay minimal, and concepts must be explained to him** — is now written into durable places so cold-start agents carry it:
- `~/.claude/projects/.../memory/feedback_code_uniformity.md` (+ linked in MEMORY.md).
- `log/CLAUDE.md` (NEW) — standing "how code here must read" contract, loaded by every agent working in this repo (architect/implementer/auditor). SPEC.md = WHAT; CLAUDE.md = HOW.

### Agent vs skill (user asked which is more effective)
Decision/recommendation: **keep the agent pipeline.** The isolation (each agent reads only SPEC.md, not the dialog) is the POINT — it forces SPEC.md to carry everything; if the implementer needs dialog context, the spec is incomplete. His cross-cutting *style* preferences (which are not spec content) now live in the agent .md files + `log/CLAUDE.md`, so agents carry them without the conversation. So: agents for the pipeline discipline, CLAUDE.md/memory for standing preferences. Not either/or.

### UI tile model — RESOLVED (revises the earlier "modals are evil" stance)
Applied to SPEC §11.2a, §11.3, §6.3:
- Every rendered `Table` lives in a **tile** with a **mode toggle**: **table mode** (representations grid/list) vs **visualization mode** (a nested chart-type dropdown — line/heatmap/histogram/…; nested because many charts possible).
- Every tile (table OR chart) has an **expand** button → **fullscreen route-backed modal**: covers screen minus a thin margin, looks like a modal, **changes the URL** so it's addressable/shareable and Back closes it. This is why it sidesteps the earlier modal objections (not a focus-trap popup; it's a URL route). `Tile` gains a `mode` field; `representation` extends with `histogram`.
- **Auto-statistics** = derived rows/columns on the `Table` via the formula language, then shown/charted in whichever mode — NOT a separate chart feature (keeps "everything is a table"). User leaned this way ("наверное вот так"); flagged as the chosen default, revisit if he wants in-chart-only stats.

### In-cell mini render — RESOLVED → v0 (was v1+)
User: "не, давай в v0". Applied: a `table_ref` cell renders its referenced `Table` in place as a small grid of plain divs (W&B-style preview), clickable to drill, **from v0**. In-cell mini *chart* (line/heatmap inside the cell) stays v2. (SPEC §3.1, §3.3, §11.3.)

### Scientific export libs — RESOLVED → core deps (was optional)
User: matplotlib/proplot/all scientific-figure libs "пусть будут, мы через них будем экспортировать." Applied: matplotlib + proplot are now core dependencies (SPEC §4.1); `log.export.figure` works out of the box; `"nature"` preset via proplot. (SPEC §9.11.)

### RESOLVED — error handling: keep all 16, but make them human-scannable (2026-05-30b)
User's real objection was NOT the count — it was legibility. He couldn't tell from the spec that §12 only governs **training-side toolkit calls** (not backend, not UI), and he refused to read 16 rows to find out. Decision: **keep all 16 exceptions** (the toolkit's public failure contract; callers' `except` clauses depend on the precise names) but reframe §12 into a 2-sentence human intro + **two scannable groups**: Group A "you passed an argument the function doesn't accept" (fix the call, never `try/except`) and Group B "something outside your arguments failed — environment/IO/state/call order" (you may legitimately catch some). DONE in SPEC §12. The trim-to-6 idea is dropped.
- Standing instruction this established: **every** error section, data flow, and feature in the spec must carry a 1–2 sentence human "in one breath" framing that names the repeated Lego shape, so the user is reassured his modular view is respected without reading every item. Applied to §10 (all six flows now have an "in one breath" line) and §12. Future spec edits must keep this.

### RESOLVED — performance: §8 Performance constraints + ADR-016 added (2026-05-30b)
User chose "Add, plus an ADR." DONE: SPEC §8 now ends with a *Performance constraints* table and ADR-016 is added. Three **structural** techniques (change an interface → build the seam when the feature first ships real-scale data = v1, never retrofit): memory-mapped `.npy` reads in `read_table`; server-side series downsampling to ~2000 min/max-bucketed points in `GET /api/series`; hand-rolled row windowing in the grid renderer (`@tanstack/react-virtual` in §4.3 is only the escape hatch if hand-rolled drops frames). One **pure optimization** deferred: hover prefetch (v1+ later). Governing rule: "never load more than the screen shows." v0 walking skeleton needs none of them. §4.3 reworded so the library reads as escape-hatch, not a contradiction.

### RESOLVED — "are the lists optimal / accents where I care?" (2026-05-30b)
Assessment given: spec is complete + tier-tagged and the v0/v1/v2/v3 split matches his priorities. The one accent shift acted on was legibility (human framings above). Renderer-prominence — RESOLVED 2026-05-30b: user said "put the renderer where it belongs in a separate section, like combined." DONE: SPEC §7.4 "The renderer — one `Table` × one `Representation` → one component" pulls `render(table, representation)` into one named Lego (pure dispatch map `Representation`→component; every view component has identical `(props:{table})=>JSX` signature; four call sites — main screen, tile, in-cell preview, fullscreen modal — differ only by which table+representation they pass). Added `components/render.tsx` to §5; §7.3 tiles row now routes through `render`. Also: performance seams moved explicitly to **v1** (was ambiguously "v0" in the first draft of §8) — §3.2 v1 now lists them; §8 + ADR-016 say v1; v0 skeleton needs none.

---

*Last updated: 2026-05-30 (round b: error framing kept-16-but-grouped, §8 Performance + ADR-016 added, human "in one breath" framings now a standing spec requirement). Pre-spec interview phase is over; SPEC.md is authoritative. This doc now only tracks post-spec feedback rounds and open questions.*
