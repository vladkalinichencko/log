# log — bug findings and feature ideas
# Bugs

## Training loop and writer

1. **The step never advances unless you pass `step=` yourself.** `log.track` and `log.tick` count samples but never move `current_step`, so every `log.log` in a loop lands on step 0 and the writer keeps only the last value. `log.checkpoint(every=1000)` then fires on every call and overwrites one file. — `logger.py:29-32`, `track.py:23`, `tick.py:8`, `checkpoint.py:24-26` ⟵ **audit: LIVE** (verified in code after merge)
2. **Checkpoints and logged parameters can be torn.** `state_dict()` tensors share memory with the live model; the writer thread saves them later while training keeps mutating them. A logged parameter is changed in place by the optimizer before it is written; a hooked `Linear` output is changed by a following `ReLU(inplace=True)`. — `checkpoint.py:29-37`, `queue_writer.py:147-152,177`, `logger.py:36,45` ⟵ **audit: LIVE** (verified in code after merge)
3. **The queue is unbounded and holds GPU memory**, so a slow disk plus activation logging grows RAM without backpressure and turns into an out-of-memory error. — `logger.py:45`, `queue_writer.py` ⟵ **audit: LIVE** (verified in code after merge)
4. **Every tensor write is a new file per metric per step** (`{path}__step{9d}.npy`): a 12-layer model logging activations is thousands of inodes and tens of MB per step with no sampling policy. `_write_checkpoint` re-reads the whole epoch's `metrics.jsonl` to find the latest metric — O(steps) per save. ⟵ **audit: LIVE** (verified in code after merge)
5. **Epoch and rank are never set.** `epoch` stays 0 forever, `rank` is hard-coded to 0, `distribute` does not place the model on its device or read `LOCAL_RANK`; `meta.json` hardcodes `world_size: 1` while `distribute()` initializes NCCL — distributed training writes N unrelated directories that all claim to be rank 0; under `torchrun` each process creates its own run folder with a random suffix. `STATUS.md` calls all of these "real". The distributed story is currently decorative. ⟵ **audit: LIVE** (verified in code after merge)
6. **Checkpoint ranking reads a stale metric.** Scalars remain buffered in `WriterThread.current_step_scalars` (`queue_writer.py:104-120`) until the step changes or the writer drains; checkpoint rotation reads `metrics.jsonl` directly (`queue_writer.py:191-196`), so logging the current loss and immediately checkpointing ranks the checkpoint using an older loss or no loss. ⟵ **audit: LIVE** (verified in code after merge)
7. **Checkpoint rotation can delete the checkpoint just written.** `queue_writer.py:203-214` defines latest as greatest step, not most recently written; same-step and explicitly lower-step checkpoints break the guarantee. ⟵ **audit: CHECK** (ranking still reads `metrics.jsonl` rows; rotation semantics changed (`rotation_keep`, `is_top_k`))
8. **Default checkpoint tags omit epoch**: `checkpoint.py:45` uses only step, so equal steps in different epochs overwrite one another; checkpoint keys are `model`/`rng` not `model_state`/`rng_state` and carry no git hash; `resume_diff` records only the step, not the config, git and requirements diff. All marked done in `STATUS.md`. ⟵ **audit: PARTIAL** (checkpoint row now carries `epoch`; tag naming unverified)
9. **Schedulers without `state_dict` break checkpointing**: `checkpoint.py:32` calls the method unconditionally instead of omitting unsupported scheduler state. ⟵ **audit: PARTIAL** (only `is not None` guard, not `hasattr`)
10. **`every=0` checkpoints on every call but crashes the profiler** with a division by zero. ⟵ **audit: CHECK** (checkpoint guards `every>0`; profiler division-by-zero not found (`profile.py` moved))
11. **A Ctrl+C during training marks the run `finished`**: `run.py:122` catches only `Exception`; `KeyboardInterrupt` slips through and the `finally` stamps success. Your crashed-by-interrupt runs lie to you. ⟵ **audit: LIVE** (verified in code after merge)
12. **One global run.** `run.py` keeps `_active_run` in module state (a bare module global, not a stack or thread-local), and the `finally` block sets it to `None`. Two runs in one process (a sweep, a notebook cell, nested `@log.run`) and the first one's cleanup kills the second's logger with `NoActiveRunError`; a nested `@log.run` makes the outer run's `finally` write the inner run's stats into the outer `meta.json`. Nothing tests this. ⟵ **audit: LIVE** (verified in code after merge)
13. **A saved `Logger` accepts writes after its run ends**: `src/log/logger.py:13-16,38-45` keeps the old context; `queue_writer.py:85-91` then queues jobs with no consumer instead of raising `NoActiveRunError`. (The `Logger` class holding one field (ctx) violates their own rule 4 — flagged, but "idk, it seems fine".) ⟵ **audit: FIXED** (NoActiveRunError in `src/log/errors.py`)
14. **Tensor files can overwrite each other.** `queue_writer.py:150-162` uses only sanitized path and step: `a/b` and `a_b` map to one file name, logging one path twice in a step overwrites the `.npy` while the index gets two rows, and repeated writes at one step collide. ⟵ **audit: LIVE** (verified in code after merge)
15. **`track` treats dict batches as size 1; `watch(paths=None)` hooks containers too**, so a `Sequential`'s output is stored twice (once as the last layer, once as the container), and a malformed glob is not rejected. ⟵ **audit: CHECK** (watch/glob code not re-located)
16. **Multiple profiled blocks at one step overwrite traces**: `profile.py:28-35` distinguishes blocks internally, but `queue_writer.py:164-169` names traces only by step. — Kimi 18 ⟵ **audit: LIVE** (verified in code after merge)
17. **17 near-identical exception classes in the toolkit.** One codebase, two shapes for the same idea. ⟵ **audit: PARTIAL** (`LogError` in `errors.py` exists; class count not verified)

## Reads, tables, backend API

18. **The table engine returns 500 on empty cells**, which every metrics table has as soon as two metrics are logged at different cadences (train every step, eval every 500). Empty cells are the string `""` among floats; `agg` also tries to average string columns. ⟵ **audit: LIVE** (verified in code after merge)
19. **Out-of-order steps fragment `metrics.jsonl` rows.** ⟵ **audit: CHECK** (no explicit out-of-order handling found)
20. **One malformed JSONL line poisons the whole run.** `read_jsonl` and `read_table.py:62` do bare `json.loads(line)`, so a kill mid-write (the writer never fsyncs) turns every metrics table for that run into a 500; during a live append one request can fail the whole table on a truncated final row. Meanwhile `file_watcher.py:98` has its own `_complete_lines` that *does* tolerate partial lines — two readers, two tolerances. ⟵ **audit: LIVE** (verified in code after merge)
21. **Memory-mapped tensor reading still materializes the entire tensor**: `read_table.py:238-247` opens the array through the storage port, then flattens it and converts every value into a string-valued `Cell`; the memory map avoids one file read, not the much larger Python object allocation; `/api/series/tensor` also sends the whole tensor as a flat JSON list, which undoes the memory map. Tensor slicing needs to happen before `Cell` construction, with viewport or explicit range parameters in the request. ⟵ **audit: CHECK** (tensor→Cell materialisation unchanged (storage port still flattens))
22. **A misspelled `x` falls back to `step` silently, and every scalar request re-reads every `metrics.jsonl` file from the start.** — `series.py:13-37` ⟵ **audit: LIVE** (verified in code after merge)
23. **Trace selection is wrong across epochs**: `read_table.py:165-178` chooses the latest trace using only the basename, such as `step_000000100.json`; a smaller step in a later epoch can lose to a larger step in an earlier epoch. Sort by epoch and step. ⟵ **audit: CHECK** (trace rows carry epoch; basename ordering not verified)
24. **Phase depth uses names instead of span identity**: `read_table.py:153-162` builds one `name → parent` mapping; repeated phase names with different parents overwrite one another. Span rows need stable identifiers and parent identifiers. ⟵ **audit: CHECK** (`parent` column exists in new spans tables; name-collision depth not verified)
25. **Rolling functions are unnecessarily quadratic**: `table_engine.py:22-34` recomputes every rolling window; with window size proportional to row count, `rolling_mean` and `zscore` become quadratic; cumulative sums make both linear. ⟵ **audit: LIVE** (verified in code after merge)
26. **Join silently drops duplicate keys**: `table_engine.py:481-489` stores one right-hand row per join key; duplicate steps, ranks, or measurements disappear without warning. Either a row-expanding join or an explicit uniqueness error. ⟵ **audit: CHECK** (join duplicate keys not re-checked)
27. **Run names with a dot are silently invisible**: `log.run(name="lr1e-3.bs64")` succeeds, but the watcher skips names with a dot and `read_table` splits on dots. — `layout.py`, `file_watcher.py:34`, `read_table.py:17` ⟵ **audit: LIVE** (verified in code after merge)
28. **`Config.__getattr__` returns `None` for an unknown key** (`run.py:48-51`), so `cfg.lerning_rate` is silently `None`. Raise `AttributeError` naming the known keys. ⟵ **audit: FIXED** (`raise AttributeError(name)` in `Config.__getattr__`)
29. **Downsampling exists twice**, `api/series.py:downsample` (float bucket size, min/max per bucket) and `modules/chart/series.ts:downsampleSeries` (ceil bucket, keeps first/last): same job, different algorithms — the client and server can legitimately disagree about which extremes a user sees. ⟵ **audit: LIVE** (verified in code after merge)
30. **The live-update loop can die permanently and silently.** A failed `send_json` to a closed tab escapes `awatch`; the task was started with `create_task` and never awaited; `websocket_transport.py:18` sends with no try/except, so one dead socket raises out of the watcher task, which nobody monitors — live updates stop until server restart. — `main.py:30`, `file_watcher.py:78-80` ⟵ **audit: LIVE** (verified in code after merge)

## Security and boundaries

31. **The toolkit imports the server**: `src/log/run.py:8` and `src/log/export.py` import from `backend.domain.project_settings`, which `SPEC.md` §8 and `CLAUDE.md` §8a forbid for the training layer; installing the toolkit on a GPU box drags in the server code. ⟵ **audit: LIVE** (verified in code after merge)
32. **Path containment is missing on destructive routes.** `api/runs.py:delete_run` does `runs_root / project / run` then `shutil.rmtree`; a raw client (not the SPA, a browser normalizes `..`) can send `run = ".."` and delete the whole project tree; `rename_runs` has the same hole in `prefix/suffix`. Harmless while bound to 127.0.0.1, disqualifying the moment multi-user lands in their own roadmap. Fix is four lines: resolve and assert `run_dir.parent == runs_root / project`. ⟵ **audit: LIVE** (verified in code after merge)
33. **`PUT /api/views/<view_id>` never validates `view_id`**: `json_store.save_document` writes `directory / f"{id}.json"` — a crafted ID writes anywhere under `runs_root`; the codebase already does traversal correctly in the static route (`main.py:64`), it just wasn't applied here. Server is 127.0.0.1-only, so this is a local-browser risk. ⟵ **audit: LIVE** (verified in code after merge)
34. **No Origin check on `/ws` and no Host check**, so a web page can open the socket or reach the API through DNS rebinding. ⟵ **audit: LIVE** (verified in code after merge)
35. **`path` means two things**: *metric name* in `log(path="loss")` and *resource URI* in the backend ("proj/run.metrics"). Two different concepts, one word, opposite ends of the wire. ⟵ **audit: PARTIAL** (formula commits quote path-style names)
36. **Enums are hand-copied** between `domain/models.py` and `types/domain.ts`: adding one representation means editing two enums, a `switch`, and the switcher list, with no compiler help across the boundary — the #1 tax on adding a feature. Hand-copying is not minimalism, it is an unguarded contract — the compiler is free, use it. ⟵ **audit: PARTIAL** (`Representation` enum exists in backend; TS side restructured)

## Frontend and structure

37. **TableView.tsx does nine jobs** (~700 lines, ~15 `useState`/`useRef`): mouse/hover text, filters, sorts, widths, heights, freeze, zoom, replace, clipboard, keyboard, virtualization, two drag machines; it knows URL param names (`filter.${id}`, `width.${id}`), store action names and DOM measurement — almost every other file is 100–300 lines readable top-to-bottom, and this is the one place where their own "modules all the way down" doctrine wasn't applied. It splits mechanically: `useTableViewParams`, `useTableSelection`, `useTableKeys`, `useTableClipboard`, `useVirtualRows`. Its local stateful controls (`filterFocused`, `replaceOpen`, find/replace panel at `TableView.tsx:94-100`) bypass the project's FSM rule — either the rule is too broad or these are violations. ⟵ **audit: LIVE** (verified in code after merge)
38. **Mixed dispatch style**: `queue_writer.py` dispatches with an `isinstance` chain while the engine uses dispatch dicts (`STAGE_EVAL`); TypeScript mixes `line_series_selector`, `chart_theme` with `downsampleSeries`, `chartSpec` in the same module — against the project's own "Lego" rule. ⟵ **audit: PARTIAL** (no `isinstance` chain found; dispatch moved)
39. **Every `run_updated` event silently reverts unsaved cell edits**: `useTable.ts:31-41` refetches the table and replaces the store entry unconditionally. For a spreadsheet app, the sharpest UX defect. ⟵ **audit: PARTIAL** (`useTable.ts` moved/restructured; edit-guard unverified)
40. **Chart code depends on Plotly internals**: `modules/chart/plotly.tsx:262-269, 340-348` reads `_fullLayout`, `_offset`, and `l2p` — fragile across Plotly upgrades; keep it inside the adapter, but isolate one coordinate-conversion helper with a fallback. ⟵ **audit: LIVE** (verified in code after merge)
41. **Empty and large-series cases are brittle**: `Math.max(...series.flatMap(...))` at `plotly.tsx:66` produces `-Infinity` for no points and can exceed argument limits for very large arrays; a loop or reduction handles both. ⟵ **audit: LIVE** (verified in code after merge)

## Docs, repo, tests

42. **The documentation outweighs the code and has drifted from it**: about 400 KB of Markdown for about 5,000 lines of Python and TypeScript logic; `README.md` is 8 lines while `SPEC.md` is 163 KB and `STATUS.md` 109 KB — they stop being read and start being generated; Google's advice (keep docs close to the code, minimal) is inverted here, and it is already showing. `python -m backend.main` on a fresh clone serves a 500 from the catch-all route because `frontend/dist` doesn't exist yet; the front door undersells the repo's best asset, its thinking (`VISUALIZATION-CATALOG.md` is genuinely good). ⟵ **audit: PARTIAL** (`README.md` is now 48 lines (was 8); SPEC/STATUS still there)
43. **The tests exist, but nothing runs them**: no test for the traversal above, none for `spike` on a trending series, none for `downsample`; each test makes one call, not a loop; no `.github/` — nothing runs on push; no linter (no lint in package.json, no ruff in pyproject), no type checker, no CI — agents can say "done" without proof otherwise. A test suite nobody runs is folklore; adding one workflow is the highest-value change in the repo. Test gaps: no failure injection (corrupt files, dead sockets, interrupts), no nested/concurrent runs, no DDP, and nothing tests `App.tsx` — the riskiest async code (reconnect backoff, workspace autosave that can PUT an empty workspace over a slow load). ⟵ **audit: LIVE** (verified in code after merge)
44. Side note, an old bug left untouched: if you pick a statistic with no column selected, you then have to pick the column twice.
---

# Feature ideas

Format: **what we watch** — the question it answers — how. Duplicates merged, one item per idea; implementation plumbing lives in the task list at the end.

## A. Optimizer and update dynamics

Context from the review: Moonlight scaled Muon by matching its update RMS to AdamW's; Kimi K2's MuonClip came from watching the maximum attention logit per head grow until training broke.

1. **Update RMS per weight** — is each layer's step size what I think? Muon vs AdamW comparable? `rms(W_after − W_before)` via optimizer step hooks; low cost.
2. **Update-to-weight ratio** — which layers learn too fast or barely move? (rule of thumb near 1e-3) `‖ΔW‖ / ‖W‖` per tensor; low.
3. **Spectral norm of each 2-D weight** — are matrices growing too large? Power iteration with the vector kept between probes; low.
4. **Max attention logit per head** — will attention blow up (the QK-Clip signal)? Hook on Q and K projections, `max(QKᵀ/√d)` on the probe batch; medium.
5. **Stable rank `‖W‖²_F / σ²_max`** — is the matrix collapsing onto a few directions? Reuses #3 plus the Frobenius norm; low.
6. **Spectrum of the update** — is the orthogonalized update really flat (Muon), or spiky (Adam)? Top-k singular values of ΔW, randomized SVD; medium.
7. **Gradient norm per layer and global, before and after clipping** — how often and where does clipping bite? `clip_grad_norm_` returns the pre-clip norm; per-layer norms stacked; low. Clip fraction (share of probe steps where pre-clip > max) is free.
8. **Adam state statistics** — are second moments tiny so epsilon dominates? Quantiles of `v`, of `m/√v`, share of `√v < ε`; low. Full variant: log `exp_avg` and `exp_avg_sq`, derive `exp_avg / sqrt(exp_avg_sq)` per matrix, visualize its norm and distribution.
9. **Cosine between consecutive updates** — is the optimizer oscillating or moving steadily? Keep last ΔW direction per layer; low.
10. **Weight-decay vs gradient share of the update** — is decay or the loss driving the weights? `‖λW‖` vs `‖update − λW‖`; low.
11. **Effective learning rate per param group** — did the schedule do what I configured? Read `optimizer.param_groups`; free. DeepSeek variant: LR actually applied — read `param_group["lr"]` **after** `scheduler.step()`, otherwise scheduler misconfiguration is completely silent.
12. **Spike post-mortem** — on a loss spike, which layer moved first? Alert action dumps #1–#7 for that step and the next K; low.
13. **Norm-only hook plumbing** (the cheap general form): reduce to a norm inside the hook — no tensor crosses the queue — one scalar per layer per step at path `grads/<module_path>/norm`; skip every Nth step if needed. The pattern: most new signals are new *rules over existing windows*, not new data.
14. **Lion sign agreement / update–momentum alignment**: percentage of entries whose signs agree (cosine form = #9).
15. **Parameter sign flips**: compare consecutive weight tensors; flip fraction per matrix to detect oscillation.
16. **Maximum update concentration**: `max(abs(update)) / rms(update)` — updates caused by a few entries rather than broad learning.
17. **Muon orthogonality error**: deviation of `UᵀU` from identity for selected matrices — checks that an orthogonalized update really is orthogonal.
18. **Effective update rank**: cumulative singular-value energy and the number of components needed for a chosen threshold — is the update nearly rank-one?

## B. Activations and representations

1. **Activation stats per module** — are activations exploding, vanishing or saturating? Mean, std, max abs, share of zeros, share at ±saturation, one stack per module; low.
2. **Dead units over a window** — how many neurons never fire? Boolean "ever active" mask per layer, `|=` on device, write count every N; low. Matrix form: dead rows and columns — near-zero incoming and outgoing weight fractions find disconnected neurons.
3. **Activation histogram per layer** — how does the distribution move during training? Fixed-bin `histc`, rows `(step, path, bin, count)`; low.
4. **Residual stream norm by depth / layer signal gain** — does the hidden state grow layer by layer? Norm of each block's output; Kimi form: `output_norm / input_norm` per module; low.
5. **Attention entropy and sink share per head** — are heads collapsing onto one token or onto position 0? Entropy of attention rows; mass on first token; medium. Kimi form: head-by-head redundancy matrix (cosine or CKA between head outputs).
6. **Output logit stats** — are logits drifting large (the reason for z-loss)? Max logit, `logsumexp` mean, output entropy; low.
7. **Layer-to-layer and step-to-step CKA** — which layers have stopped changing? Which two layers are redundant? Linear CKA on probe-batch features; medium. During training: compare embeddings between checkpoints (drift).
8. **Penultimate features projected to 2-D** — do classes separate, and when? PCA on the probe batch, rows `(step, point, x, y)` — fits the existing `trajectory` view; medium. Kimi: trajectories by class or sample with metadata.
9. **Outlier feature dimensions** — will this model quantize badly? Count of hidden dimensions by activation size; low. Kimi channel form: max, kurtosis, outlier fraction per channel, channel-by-step heatmap; same stats as one number = activation kurtosis per layer.
10. **Activation effective rank** — singular-value participation ratio of selected activation matrices to detect representation collapse.
11. **Frozen-layer detection**: zero-update fraction + gradient norm + parameter displacement — intentional freezing vs accidentally disconnected.
12. **Attention coverage**: attention aggregated over source tokens vs explicit coverage thresholds (is generation attending to all relevant inputs?).

## C. Gradients and signal flow

1. **Gradient flow ratio by depth** — are early layers starved (vanishing) or flooded (exploding)? Each layer's grad norm divided by the last layer's; free after A7.
2. **Gradient–weight cosine** — has weight decay reached equilibrium with the gradient? cosine(grad, W) per tensor; low.
3. **Per-sample gradient norm distribution** — which examples dominate the gradient? Noisy labels? `torch.func.vmap(grad)` on the probe batch, histogram + top ids; high. Log per-microbatch norms and derive variance to estimate whether the measured gradient is stable.
4. **First layer to go non-finite** — where did the NaN start? Share of non-finite grads per layer; the existing `non_finite` alert triggers a dump; low. Kimi adds skipped-optimizer-step event rows with reason and scaler state.
5. **Conflict between loss terms** — do my two losses pull the shared weights in opposite directions? Cosine between per-loss gradients on shared params, probe steps only; medium.
6. **Gradient noise scale** — is my batch size too small or wastefully large? `tr(Σ)/‖G‖²` from micro-batch gradients; medium.

## D. Data and batches

1. **Per-sample loss with sample id** — which examples are hardest? Which are mislabelled? `reduction="none"` loss plus dataset indices, top and bottom k per probe; low.
2. **Forgetting events** — which examples are learned, then forgotten again? Per id, count correct → incorrect transitions on the probe set; low.
3. **Label mix per batch** — is the sampler balanced, or do some batches hold one class? Class counts per batch; free. Kimi: labels across batch, epoch, split (sampler or shard problems).
4. **Padding share and sequence length** — how much compute goes to padding tokens? Share of pad tokens, length quantiles; free.
5. **Input-bound share** — is the GPU waiting for the data loader? Data-wait span ÷ step span, from `log.phase`; free. DeepSeek: batch arrival latency and loader queue depth per batch separate input-pipeline variance from model compute.
6. **Augmentation parameters drawn** — did a strong augmentation coincide with a loss spike? Log the sampled parameters per batch as a row; free.
7. **Batch composition**: batch-level counts, lengths, label frequencies, source-shard identifiers — connect bad steps to the data that caused them.
8. **Data-pipeline health** — "is my loader silently broken?" (the #1 real bug): inside `TrackedLoader.__iter__` the batch is already there — batch size, seq-length histogram, padding fraction, 8-byte hash of the batch to detect repeats.
9. **Label/prediction distribution drift**: per epoch, a small histogram of predicted class probabilities and true labels; catches silent label leakage or class collapse; one tensor job per epoch, alert rule on Jensen-Shannon divergence from epoch 0.
10. **Sample replay**: a handful of real inputs with predictions, per epoch — eyeballing what the model sees beats any aggregate; the Player component already plays frame tensors.

## E. Features (the "replace ML with DL on tabular data" case)

These answer the questions from the note: are the input scales wildly different, how is each feature distributed, how do features relate, which features matter, and what do the gradients say per feature. Works for any model that takes a feature tensor.

1. **Per-feature scale and missing rate** — are inputs on wildly different scales? Leaked NaNs? Mean, std, min, max, NaN share per column per batch; low. Kimi: constant and near-constant features — variance, unique count, dominant-value frequency — remove inputs that cannot help.
2. **Per-feature histogram, train vs validation** — is there drift between splits or over time? Fixed bins from the first batch; low. KS distance or population stability index as derived columns.
3. **Feature correlation matrix** — which features are duplicates? `torch.corrcoef` on the probe batch; low. Over time: correlations per window aligned by step detect preprocessing changes.
4. **Input-gradient saliency per feature** — which features does the network actually use? Mean |∂loss/∂xⱼ|; low. Signed: gradient × input, mean of xⱼ·∂ŷ/∂xⱼ.
5. **Permutation importance at eval** — how much worse does the model get without feature j? Shuffle column j, Δloss; high.
6. **First-layer weight norm per input** — cheap proxy for which inputs the first layer amplifies; free.
7. **Categorical embedding norms vs frequency** — are rare categories learned or left at init? Low.
8. **Importance next to the GBDT baseline** — does the DL model use the same features as the tree model? Log the baseline's importances once, `join` on feature name; free.
9. **Loss by feature decile** — where in the input space does the model fail? Bucket validation loss by decile of feature j: feature × decile heatmap; medium.
10. **Calibration and residuals** — are predictions over- or under-confident, and for which range? Reliability bins; residual vs prediction quantiles; low.
11. **Feature-to-target association** — inputs related to the target before fitting a large model; join sample-aligned features and labels, group or correlate by feature.
12. **Input feature profile, once**: on the first N batches only — per-dimension min/max/mean/std, missing rate, cardinality, correlation with target → one `inputs.profile` Table, then any representation. Reservoir sampling or t-digest sketches (~10 KB per feature).

## F. Evaluation and interpretability

1. **Confusion matrix per evaluation** — which classes get confused, and is it changing? Rows `(step, true, predicted, count)`; low. Across checkpoints: align matrices and subtract a baseline.
2. **Per-class precision and recall over time** — which class lags? From #1 with `derive` — no extra logging; free.
3. **Calibration error over time** — does the model get overconfident as it trains? Expected calibration error from reliability bins; low.
4. **Metric against compute** — which run is better per GPU-hour or per token, not per step? Log tokens or FLOPs (≈ 6 × params × tokens) next to the metric; free.
5. **Learning order on a fixed set** — which examples are learned first? Per id, the first step its prediction becomes correct; low.
6. **Seed spread** — is a difference between configs larger than seed noise? Tag runs by config hash; `agg(mean)` and `agg(std)` over seeds; free.
7. **Per-slice metrics** — performance hidden by aggregate accuracy: group the prediction table by any logged sample attribute.
8. **Prediction disagreement between runs** — locate examples affected by a model change: join predictions on `sample_id`, filter for unequal outcomes or changed probabilities.
9. **Checkpoint regression tests** (= 8 as a gate): compare two prediction tables, keep the responsible sample identifiers; "did my change make it worse?" as one row.
10. **Error clustering**: join residuals with logged embeddings, cluster erroneous samples only — recurring failure modes.
11. **Residual analysis**: `prediction − target` against target, feature, or step — systematic bias, not just average error.
12. **Attention entropy per head, token, step** from logged attention matrices — diffuse or collapsed attention (= A/B forms above).
13. **Generation repetition**: log generated token ids, derive repeated n-gram fraction per sequence — loops, quantitatively.
14. **End-of-sequence calibration**: EOS probability and sequence length over generation steps — too early, too late, or never-ending.
15. **Layer-wise confidence**: logit-lens predictions from selected layers; margin and correct-class probability as they develop through the network.
16. **Output-distribution drift**: log probabilities for a fixed eval set; KL divergence between checkpoints, beyond prediction disagreement.
17. **Fixed probe-batch eval every N steps**: a stable eval curve interleaved with training loss on the same hero chart, without eval-set cost; client-side cadence (`tick.py`), one scalar path `probe/loss`.

## G. Systems and cost

1. **GPU memory per phase** — where is the peak: forward, backward or optimizer? `torch.cuda.max_memory_allocated` deltas inside the phase context; free.
2. **Throughput and MFU** — am I using the hardware? samples/s, tokens/s, achieved FLOP/s ÷ peak; free.
3. **Host–device sync time** — are hidden `.item()` calls stalling the GPU? CUDA events around the step versus wall time; low.
4. **Straggler skew across ranks** — which rank holds everyone back? Per-rank step time; spread across ranks per step; free.
5. **Communication vs compute** — is all-reduce overlapped with backward? NCCL op time from the existing profiler `ops` table; free when profiling.
6. **Writer health** — is logging itself slowing training? Queue length, dropped items, bytes written per second, oldest-job age — `log` observing itself; free. Kimi adds checkpoint cost: size and write duration from the writer.
7. **GPU power, clock and temperature** — is the card throttling? NVML through one adapter file; free.
8. **Process memory and open files** — is the data pipeline leaking? RSS and file-handle count per N steps; free.
9. **Phase timing as spans** — "where did the step time go?" `with log.phase("backward")` → `perf_counter` pair → the existing `spans.jsonl` + flame; reuses what exists.
10. **Step-time distribution and outliers** — stalls hidden by average throughput: derive step duration from phase spans, plot its distribution and extreme steps.
11. **Expected-duration ETA** — "is it stalled or just slow?" Median recent step time × remaining steps; the heartbeat table already knows the last log time.
12. **Cost attribution**: GPU-hours and (if priced) dollars per run, computed on read from spans by the backend; run comparison tables should sort by cost, not just loss; zero logging — pure derivation. Kimi: energy and cost per quality unit.

## H. Run identity and reproducibility

1. **Environment snapshot** — why does this run differ from last week's? torch, CUDA, cuDNN versions, GPU name, determinism flags, into `meta.json`; free.
2. **Uncommitted diff** — what code actually ran? `git diff` saved as a file, not only the commit hash; free.
3. **Data fingerprint** — did the dataset change underneath me? Hash of the index list and the first N samples; low.
4. **Seeds per worker** — can I replay a single batch? Seeds of the main process and each loader worker; free.
5. **Model structure table** — how are parameters spread across modules? Rows `(module path, type, params, dtype, device, trainable)` — a hierarchy for the treemap view; free.
6. **Checkpoint provenance as data**: `resume.py` already writes `resumed_from_run`; extend it to record the exact step and metric values at resume, so a spliced run's seam is queryable in tables; comparing "before vs after the fix" becomes a filter. Run lineage: parent run and checkpoint references rendered as a graph or indented table.
7. **Automatic config-diff table** — show exactly which settings differ before comparing curves; group run configuration by key, hide unchanged keys only through an explicit filter.
8. **Reproducibility manifest**: code hash, dependency hash, dataset version, hardware, seed, config in one table; name the **first** differing field between two runs, as one screen.
9. **Hyperparameter sensitivity**: aggregate final or best metrics by one hyperparameter while preserving the other config columns.
10. **Pareto frontiers**: find runs that improve quality without unacceptable time, memory, or cost; compute dominated rows, render the frontier as a scatter.
11. **Time-to-quality**: how quickly runs reach a target metric — first step or wall time crossing an explicit threshold.
12. **Overfitting gap**: train and validation trajectories on one aligned table; derive their difference and the best validation checkpoint.
13. **Anomaly context** — what else changed around a spike? Join alerts with metrics, phases, checkpoints, memory, and data properties in a step window.
14. **Negative-result registry**: hypothesis, config diff, outcome, and evidence links attached to completed experiments — prevent repeating failed ideas.
15. **Research-summary table**: hypothesis, baseline, best result, variance, resource cost, links to source views — evidence for a paper or report.
16. **Minimal failure bundle**: export the relevant config, sample identifiers, metric window, and checkpoint references as a table of references — reproduce a problematic example.

## I. Numerics and the loss surface

1. **Underflow share in low precision** — are small weights or grads flushing to zero in bf16 or fp16? Share of values below the format's smallest normal; AMP grad-scaler scale; low.
2. **Weight histograms per checkpoint** — how do weight distributions evolve? Fixed-bin histogram when `log.checkpoint` writes; low.
3. **Distance from initialization** — is the network in the "lazy" regime or learning features? `‖W − W₀‖ / ‖W₀‖`, with W₀ kept once on CPU; low.
4. **Sharpness** — is training at the edge of stability (top Hessian eigenvalue near 2 / lr)? Hessian–vector power iteration on the probe batch, rarely; high.
5. **Loss along the path between checkpoints** — is there a barrier between two solutions? Offline, from saved checkpoints, as an explicit analysis call, never during training; high.

## J. Plumbing — how it gets computed cheap

1. **Cadence.** Every probe takes `every=N`; an alert action can switch probes to every step for the next K steps, so you zoom in exactly when something goes wrong.
2. **One transfer per probe call.** Compute all statistics on the GPU, `torch.stack` them, call `.cpu()` once — each `.item()` is a separate device sync; ten of them per layer would serialize the GPU.
3. **Hooks only on probe steps.** Register forward and backward hooks just before a probe step's forward pass and remove them after, so ordinary steps pay nothing. For update probes use `Optimizer.register_step_pre_hook` / `register_step_post_hook` (PyTorch since 2.0): clone weights before `step()`, diff after, only on probe steps.
4. **A fixed probe batch.** Save 256 examples at run start (by index, hashed into `probes.json`); representation and attribution probes run on it under `torch.no_grad()` with the model's train/eval mode restored afterwards, so values are comparable across steps and across runs.
5. **Fixed-bin histograms.** `torch.histc` with bins fixed at the first probe (or symmetric log bins) writes `(step, path, bin, count)` rows; fixed bins are what make a step × bin heatmap or a ridgeline possible.
6. **Running state on the device.** "Has this unit ever fired in the last K batches" is a boolean mask updated with `|=` on device and written only on probe steps.
7. **Cheap linear algebra.** Spectral norms by power iteration with the vector kept between probes (one or two matrix–vector products per probe); effective rank with a randomized SVD on the small dimension.
8. **Writer-thread auto-summary** (no user code, no extra storage): inside `_write_tensor`, append 6 floats to the same pending step row — absmax, mean, std, fraction_zero, fraction_nonfinite, norm (+120 bytes/step; the writer already merges scalars per `(epoch, step, rank)`); 64-bin `np.histogram` → JSONL (1.5KB/step instead of the full array); per-token / per-position quantiles — `np.quantile` on the last axis → 5 floats per step; stable/effective rank of updates via `‖A‖_F² / ‖A‖₂²` with 2 power iterations. The model-agnostic rule: everything hooks `named_modules()` / `named_parameters()` — no model-specific code anywhere.
9. **Optimizer moment statistics** — "what is the effective learning rate?" At checkpoint time only: one pass over `optimizer.state`, mean of `exp_avg_sq`.
10. **Tokens / samples / steps accounting**: add `tokens_seen` as a `step_unit` — the honest x-axis for LLM runs, and it's already a counter.

## K. Product machinery — rules and comparisons as data

1. **Declarative alert rules evaluated by the existing expression engine** — someone published finding X, how do I add it to my tracker without writing Python? `alert("w.0", "update_ratio > 1e-3 and absmax > 10")` — parse with `table_engine.parse`, evaluate per step over the summary row. The rule set becomes a *Table*, therefore inspectable, shareable, diffable, and writable by an LLM: "a paper's finding → a feature" is one rule row. The single highest-leverage idea. A derived case: **gradient-to-noise ratio** — "grad mean < k·std for W steps" becomes one more built-in alert over the existing `alerts.py` windows.
2. **Representation becomes mark + channels.** A tile or saved view stores `{"mark": "line", "x": "step", "y": "ratio", "color": "path", "facet": null, "y_scale": "log"}` instead of only `"line"`; the enum stays as the list of marks, the URL and workspace JSON carry the channels. `applicable()` reads column roles, not only cell types: ordered axis (`step`, `epoch`, `samples_seen`, `wall_time`), category (a string column with few distinct values), measure (numeric), interval (`start` + `duration`); it returns suggested encodings ("line: x=step, y=ratio, color=path").
3. **`suggest()` for representations:** a pure function over column types and names returning a *ranked* list; the switcher sorts by it. `VISUALIZATION-CATALOG.md` already states these predicates — currently they exist only as prose.
4. **Engine stages for reshaping**: `pivot(index, columns, values)`, `unpivot`, `bin(col, n)`, `quantile(col, q, by=)`, `ewm(col, alpha)`, `resample(step, every=)`, `last(by=)`, `agg` with several functions at once, `join` on more than one key — each a pure function over `(names, rows)` in `table_engine.py`, registered in `STAGE_PARSERS` and `STAGE_EVAL` like the existing ones. Worked example for a probe table `p.r.update_ratio` (step, path, ratio): lines per layer → color=path, log y; heatmap → `pivot(index=path, columns=step, values=ratio)`; small multiples → facet=path; bars at last step → `last(by=path) | sort(ratio, desc)`; spread across layers → `quantile(ratio, 0.1 0.5 0.9, by=step)` as a line with band; two optimizers → `concat` with a `run` column; against another probe → `join(table(p.r.spectral_norm), on=step path)` as a scatter.
5. **`diff(run_a, run_b)`** — what actually changed between two runs? ~15 lines next to `_concat`: align on step, emit `delta`, `ratio`, `rel_delta` columns; then *any* representation applies. A **regression gate** is diff + one rule row: metric worse than baseline by >X% → alert.
6. **`summary()` aggregation** — the mockups' "big numbers under the plot": one call → count/min/max/mean/std/p05/p50/p95; the chart header already renders a summary line. **`corr(cols…)`** — do loss, grad-norm and lr move together? Table N×N → existing heatmap, `np.corrcoef`, no new layer.
7. **Representation switcher on every aggregated table**: any view produced by `agg` in the table engine gets the same representation set — heatmap, parallel coordinates, small multiples, bumpy chart (rank over time), scatter-matrix — instead of only "table or line chart"; backend already returns typed Tables, frontend work in `modules/chart/` behind the existing adapter, one `representation` URL param per tile.
8. **Derived-on-read statistics columns**: quantiles, trend slope, and last-value-vs-median deltas for any numeric column on request — "highlight outliers" and "sparkline in header" without the client logging summary stats; a `summarize` table-engine stage reusing `alerts.py`'s rolling logic server-side.
9. **Presets and recipes** — "automatically, for any model": `log.inspect(model, optimizer, every=200)` registers the optimizer probes (A1, A2, A3, A7, B1, B2, B3, B4) for every module that owns parameters; `log.features(x, names, every=200)` registers the input-feature probes (E1–E5). Each preset ships with a saved workspace ("Model health", "Input features") whose tiles refer to tables by relative path, so it opens on any run that used the preset and on two runs side by side. Recipes are named bundles (log calls + saved view + alert rules) installed by `@log.run(auto=["grads", "probe_eval"])`; `project_settings.py` already stores per-project alert toggles — extend it to recipe toggles.
10. **Semantic metadata** — the missing product concept to add *before* the switcher: today the UI knows a table has two numeric columns, not whether they are embedding coordinates, prediction and target, weight and update, or two unrelated measurements. Column roles (`step`, `sample_id`, `feature`, `label`, `prediction`, `group`, `weight`, `update`), tensor axis names (`sample`, `channel`, `row`, `column`, `head`, `token`), units and sampling cadence, provenance (source run, transformation, parameters, baseline) — that lets `applicable()` choose meaningful views without guessing from shape alone.
11. **Human decision log**: `log.note("changed lr because ...")` lands in the run's `notes.jsonl` and shows on the timeline as clickable flags — the same mechanism alert flags already use; the reason a run diverged from its sibling is context no metric carries.
12. **Generic reader** (the backend change made once): today `read_table` has a hand-written branch per file (`spans`, `ops`, `alerts`); replace them with one rule — any `epoch_*/<name>.jsonl` becomes the table `<project>.<run>.<name>`, columns taken from the union of row keys; after that every probe and every new statistics file appears with no backend change.

---

# Refactor tasks

One line per step. Existing code rules are NOT changed (the comments ban, Lego, FSM, PR pipeline stay as written); bugs are fixes, not rule edits. Priority: Phase 0 first — nothing deletes before CI is green. This whole section is the refactoring task set; when the tasks file exists it moves there.

#### Audit status (against origin/main, PR #3–#5, done 2026-11-01)

### Audit status, 2026-11-01, against origin/main after PR #3–#5 (49 tool commits)

2 explicitly repaired (13 NoActiveRunError, 28 Config raise). 25 confirmed still live by code signatures (step never advances; unbounded Queue; per-step .npy + O(steps) ranking; no set_epoch/LOCAL_RANK; Ctrl+C → finished; bare `_active_run`; same-step tensor collisions; bare `json.loads` in `read_table`; per-request full `metrics.jsonl` re-read; no NaN handling; no cumsum; dot-name rejection missing; two downsamples; unguarded `send_json`; `backend.*` import; `rmtree` without containment; `view_id` traversal; no Origin/Host; `TableView.tsx` still 664 lines; Plotly internals; `Math.max(...spread)`; no CI/lint). 8 partially repaired. 8 need a manual CHECK against moved code. Phase 4b items below are largely implemented by Claude's commits — statuses next to each.
## Phase 0 — snapshot and enforcement (highest priority)

1. [ ] Commit the current tree as-is (`git add -A && git commit`) before any restructuring.
2. [ ] CI: `.github/workflows/ci.yml` on push + PR → `ruff check`, `pyright`, `pytest`, `npm run vitest`, `npm run check:layout`, `eslint .`, `npm run build`.
3. [ ] Add `ruff` + `pyright` config to `pyproject.toml`.
4. [ ] ESLint config with two plugins: `eslint-plugin-react-hooks`, `@typescript-eslint/strict-boolean-expressions`.
5. [ ] Project-specific checks encoding our own rules: forbid `src/log/*` importing `backend.*`; FSM naming (`<feature>_fsm`, `<feature>_reducer`) greps; wire the existing `check-layout.mjs` token check into CI.
6. [ ] Evil-data + Playwright checks in the repo (not /tmp), auto-run per suite: NaN columns, all-NaN, ±inf, times microseconds→hours, names with `/ . spaces`, empty-string root, one-element table, fast loop, resume, several ranks, kill-mid-write truncated JSONL. Generator script committed.
7. [ ] New test grain: one 3–5 step loop per feature, assert at the registered route (FastAPI `TestClient`), read files back. First targets: step behaviour, dot-named runs, spike alert, downsample.

## Phase 1 — one file per purpose (file structure)

8. [ ] Create the tasks file (`tasks.md`, markdown `- [ ]` checkboxes): move open tasks out of `STATUS.md`, `SPEC.md`, `PRODUCT-IDEAS.md`; refactoring tasks (this section) live there.
9. [ ] Rewrite `AGENTS.md` as the single agent file, keeping every current code rule verbatim: (a) what the project is and its core value for the user and for architecture; (b) code-writing rules; (c) how to add a new feature — failing seam test first → one toolkit file emitting an existing job type (`RowJob`) → generic reader picks it up → engine stage only if a new shape is needed → prove with `pytest`, `vitest`, `npm run build`, `npm run check:layout` → record in the tasks file; (d) plain working instructions; (e) a priority map saying what is useful for the next agent and what is not. Standing rule for every future edit by any agent: a change must conform to `AGENTS.md` as it exists at edit time, or `AGENTS.md` is changed first in the same PR.
10. [ ] Delete `SPEC.md` outright — code plus its contract tests is the spec: bullets worth keeping move either into contract tests (behaviour) or `AGENTS.md` (intent). Delete `STATUS.md` outright too — no hand-written status file and no generated successor file; the same information lives nowhere else but in the contract tests and the tasks file. Described-but-never-implemented behaviour (the five STATUS "real" items) lands in the tasks file as Ships-next.
11. [ ] Design system: merge `DESIGN-SYSTEM.md` + `DESIGN-NOTES.md` into the existing design-system HTML — tokens, default values, every element labelled and explained exactly as in those files; the HTML becomes the only live source, the preview updates everywhere at once; then `git rm` both .md files.
12. [ ] Visualization catalog: move `VISUALIZATION-CATALOG.md` into the same HTML as a rendered catalog section (each chart shown, its when-it-applies predicates documented — the same predicates `suggest()` reads); then `git rm` the .md.
13. [ ] Rewrite `README.md`: what the project is, how to run it (build `frontend/dist` first — a fresh clone currently 500s), pointers to `AGENTS.md` + the design HTML.
14. [ ] After merges: grep for references to the deleted files and fix them; diff the merged content against the removed .md files to confirm nothing fell out; delete files in separate commits.

## Phase 2 — code fixes every review caught (each ≤ 4 lines, one PR)

15. [ ] Move `current_step` forward from samples in `track`/`tick` (`current_step = samples_seen`, spec §9.5/§9.10); test: 3 ticks → 3 rows.
16. [ ] Snapshot tensors/params on enqueue (`v.detach().to("cpu", copy=True)`); bounded queue + dropped-items counter written to `meta.json`.
17. [ ] Epoch in `TrackedLoader.__iter__` + `DistributedSampler.set_epoch`; read `LOCAL_RANK`; rank-0-only run-folder creation; real `world_size` in `meta.json`.
18. [ ] Empty numeric cells → NaN; `nanmean` and friends; numeric-only `agg`.
19. [ ] Catch `BaseException` for run status → `interrupted`.
20. [ ] Resolve-and-assert path containment in `delete_run`/`rename_runs` (`run_dir.parent == runs_root / project`); validate `view_id` in `PUT /api/views`; Origin/Host checks on `/ws`.
21. [ ] One JSONL tolerance: skip truncated final rows in `read_table.py`; reuse `_complete_lines` logic for both readers.
22. [ ] Loud name conflicts: reject `.` in project/run names at `log.run` (§2 already requires it); keep `/` as folder or add a counter suffix; raise `AttributeError` naming known keys on unknown `Config` attrs; validate `x=` instead of falling back to `step`.

## Phase 3 — code fixes only one review caught

23. [ ] Flush current-step scalars before checkpoint ranking reads `metrics.jsonl`.
24. [ ] Rank checkpoint rotation by write time, not greatest step.
25. [ ] Omit scheduler state when it has no `state_dict`.
26. [ ] Guard `_active_run` as a stack; raise `NoActiveRunError` when a saved logger is written to after its run ends.
27. [ ] `alerts.spike` on residuals or first differences; zero σ counts as an alertable change.
28. [ ] `every=0` guard (no division by zero); sort or reject out-of-order step rows.
29. [ ] Keep unsaved cell edits on `run_updated` refetch (`useTable.ts`).
30. [ ] Replace quadratic rolling windows with cumulative sums.
31. [ ] `join`: expand duplicate keys or raise a uniqueness error.
32. [ ] Sort trace selection by `(epoch, step)`; give spans stable ids for phase depth; name profiled traces by block, not step.
33. [ ] One coordinate-conversion helper for Plotly internals with a fallback; replace `Math.max(...spread)` with a loop/reduction.
34. [ ] Per-transport try/except around `send_json`; drop dead sockets and log it.
35. [ ] Dedupe code: one `LogError(code, message)` instead of 17 exception classes; generate TS enums from Python; one downsample implementation; a neutral schema module so `src/log` stops importing `backend`; split `TableView.tsx` into `useTableViewParams` / `useTableSelection` / `useTableKeys` / `useTableClipboard` / `useVirtualRows`; then decide whether `filterFocused`/`replaceOpen` need an FSM or the FSM rule needs a scope note.

## Phase 4 — product mechanics (after the fixes are green)

36. [ ] Generic reader rule (see K12): any `epoch_*/<name>.jsonl` → table `<project>.<run>.<name>`, columns from the union of row keys; deletes the per-file branches.
37. [ ] Declarative alert rules (K1): `alert(path, expr)` parsed by `table_engine.parse`, evaluated per step over the summary row; the rule set itself is a table.
38. [ ] Writer-thread auto-summaries (J8): 6 floats + 64-bin histogram + per-token quantiles per logged tensor.
39. [ ] Representation = mark + channels (K2) + engine stages `pivot/unpivot/bin/quantile/ewm/resample/last` (K4).
40. [ ] `suggest()` over column roles (K3) + the representation switcher (K7).
41. [ ] Presets `log.inspect(...)`, `log.features(...)` and recipes `@log.run(auto=[...])` (K9), stored via `project_settings.py`.
42. [ ] Semantic metadata: column roles + tensor axis names + units/cadence + provenance (K10), before the switcher UI.
43. [ ] Human decision log `log.note(...)` (K11).
44. [ ] Contract-test-first rule for every Phase-4 feature, per task 9c.


## Phase 4b — big pieces from the accepted build plan (Oct 25)

Restored verbatim source lines from the desktop plan (`log — next big pieces.md`) — these recommendations were not in the refactor input at all. Statuses from that doc kept.

45. [ ] Alerts data layer (status: scope agreed): raw file `epoch_N/alerts.jsonl` written by the toolkit only, one writer per rule 8: `{"step","wall_time","rank","rule","path","value","message"}`; derived table `<project>.<run>.alerts` from `read_table` adds «сердцебиение потеряно» computed by the backend at read time (a dead process cannot write about its own death); columns `step, wall_time, rule, path, value, message`, no importance column; live WebSocket event `{"type":"alert","run","row"}` — same mechanism as `run_updated`. Decisions fixed: notifications in UI and push, no priorities, one more table on the run page bottom, alert on the chart = a flag at the step.
46. [ ] Embedded alert rules (checked in the writer thread, when the value is already logged):
```python
log.alert("loss", rule="non_finite")
log.alert("loss", rule="spike", sigma=4, window=100)      # |z| > 4 от скользящего окна
log.alert("*", rule="stall", factor=10)                   # шаг дольше 10× медианы
log.alert("run", rule="heartbeat", minutes=5)             # считает бэкенд при чтении
```
47. [ ] Custom alert rule + action, same signature, action runs during training:
```python
@log.alert("val/acc", on=lambda event: log.checkpoint(model, tag="best-before-drop"))
def dropped(rows):
    return rows[-1].value < max(row.value for row in rows[-500:]) - 0.05
```
48. [ ] Alerts UI: `Notices` shows the alert with a rise «к шагу»; the `alerts` table at the bottom of the run page; vertical flags on the main chart (Plotly `shapes`), click leads to the table row. In-tab: Notification API — no servers, works while the browser is open.
49. [ ] Web Push (status: needs a decision): backend keeps the subscription and sends via `pywebpush` with VAPID keys; `localhost` is a safe origin for browsers.
```python
GET  /api/push/key          → { "public_key": "B…" }          # VAPID public key
POST /api/push/subscribe    ← PushSubscription JSON           # stored in <runs_root>/push.json
frontend/public/push-worker.js                                # showNotification(title, { data: { url } })
```
Constraint stated in the plan: push always goes through the browser vendor's service (Google/Mozilla/Apple) — needs internet, alert text passes encrypted through their servers; on iPhone only after «На экран „Домой“». Related decision already recorded («i don't care yet»): keep as Ships-after, not before Phase 0–3.
50. [ ] Overlay/splice for interrupted runs: operations are «таблица из таблиц» of the formula language, result is a normal `Table` drawn by the same `line` renderer:
```python
overlay(demo.base.metrics.loss, demo.high_lr.metrics.loss)   # join по step → step, base, high_lr
splice(demo.base.metrics, demo.base_resumed.metrics)          # concat по step + колонка segment
```
UI: under Compare in the bottom panel the button «Overlay <метрика>» opens the editor with the formula (shareable); if the run has `resume_diff` in `meta.json`, the run page offers splice itself; «+» in the editor stays «add a row and a column at the edges», operations between tables live in formulas and these buttons.
51. [ ] Hero chart by choice (status: needs a decision — choice per project or per run?): pick series by legend click («сделать главным»), store in workspace, not URL: `{ "tiles": [...], "hero": { "demo": ["loss", "val/loss"] } }`, no key → all scalars as now.
52. [ ] Training timeline + profiler (status: direction agreed): one time axis — phase bars per rank (data, forward, backward, optimizer, comm), alert flags, checkpoints, epochs; no embedded Perfetto, flame and bars drawn in our design system:
```python
with log.profile(schedule=dict(wait=50, warmup=2, active=3, repeat=0)):
    for batch in loader:
        with log.phase("data"):     x, y = batch
        with log.phase("forward"):  loss = model(x, y)
        with log.phase("backward"): loss.backward()
        with log.phase("optimizer"): opt.step()
# пишет epoch_N/traces/step_<k>.json (Chrome trace из Kineto)
```
Derived tables `start, end, duration, parent` per `VISUALIZATION-CATALOG.md` enable Gantt/flame/waterfall: `<run>.spans` = `rank, name, start, end, duration, parent`; `<run>.ops` = `name, calls, total, self`. The old PR progress bar gets phase segments; backend trace readers to evaluate: Holistic Trace Analysis (Meta) and Perfetto trace processor — as read libraries only, start with direct Chrome JSON and decide by real trace size. ( связана с задачами 32, 43)
53. [ ] Recentre performance: change only under measured load (SPEC §4.3), measured table from the plan:
- table transfer: 20 000 rows = 4,9 МБ JSON, 0,21 с → first `GZipMiddleware`, then Arrow IPC (removes per-cell JSON wrapper);
- long lines: Plotly OK at 20k → uPlot as the second renderer (166 650 points in 25 ms in the author's benchmark);
- many charts on screen: not measured → don't multiply `scattergl` (Chrome keeps ≤ 16 active WebGL contexts);
- queries across many runs: no load yet → DuckDB (Python) under formulas, SQL over Parquet/JSON;
- linked filters on millions of rows: no load yet → Mosaic + DuckDB (made for millions; DuckDB-WASM slower than server);
- pivot summaries: not built → watch Perspective (FINOS) as a model; the grid stays ours (Glide Data Grid draws on canvas, no DOM cells and no FSM per element; measured decision 2026-05-30).
Module-map notes: `notify` module gains Notification API + Web Push; `(formula` → CodeMirror 6 + Lezer-грамматика (= task 62); `transport` `Table ⇄ bytes` → Arrow IPC; `arrange`/`motion` modules (dnd-kit sortable + Motion `layout`, tokens `--motion-fast: 120ms; --motion-slow: 240ms; --motion-curve: cubic-bezier(.2,0,0,1)`, `prefers-reduced-motion`) — decision recorded in the plan: dnd-kit + Motion as dependencies (native `<ViewTransition>` alternative is 39 KB lighter but 27 lines of arrangement code vs 5; agent's call recorded: dnd-kit + Motion).
54. [ ] Open decisions from the plan needing a master answer (kept as decisions, not silent defaults): dnd-kit + Motion (agent recommendation accepted in doc as «Я бы взял» — confirm), Web Push vendor-service acceptance, hero choice per project or per run. — **audit: DONE** — 43b5df2, 0799a2a (alerts.jsonl + read-time heartbeat + socket + table)

Bug prevention program — which bug classes these found bugs come from, and which checks stop them, where:

| Класс (по найденным багам) | Баги этого класса (номера) | Проверка, которая не даст появиться вновь | Где живёт |
| --- | --- | --- | --- |
| Разъехавшиеся границы и швы (кто что отдаёт/принимает) | 1, 21, 22, 27, 28, 35, 36 | seam-тесты по реальным вызовам + строка «кто что принимает» на каждом стыке | Phase 0-7, CI task 5 |
| Молчаливые значения по умолчанию вместо ошибки | 11, 19, 22, 28, 31 | линтер `strict-boolean-expressions`; тесты, ассертящие raise, а не fallback; `Config` без `None` по умолчанию | Phase 2 task 22, CI 3-4 |
| Состояние гонки и частичное IO (убили процесс) | 2, 4, 6, 7, 20 | failure injection: kill mid-write, corrupted jsonl, dead socket, interrupt — всё в «злой» датасет | Phase 0 task 6, Phase 3 23-34 |
| Дублирование одного смысла в двух языках | 29, 36 + директивно: даунсэмплинг | кодген TS из Python + roundtrip-тест сериализации таблиц | Phase 3 task 35 |
| Непротестированные маршруты (DDP, особые имена, resume) | 5, 15, 17, 27 | multi-rank harness, генератор «злых» имён, resume-сценарий в Playwright | Phase 0 task 6, Phase 2 17, 22 |
| Фикция «сделано» в статусных доках | 8, 42, 43 | контракт-тест на каждый пункт SPEC; файла статуса нет вообще — состояние проекта = контракт-тесты + tasks.md | Phase 1 task 10 |
| Таблица как текстовый контракт, а не структура | 18, 19, 20 | schema:1 в каждом файле, типизированные dataclasses строк, тест первого append-а | Phase 3 task 35 + K12 |

## Carried over from the original task list

55. [ ] Remove most of the log-text boilerplate specs; keep a concise tasks list plus what is really needed — covered by Phase 1; close when SPEC/STATUS are deleted. — **audit: DONE** — 43b5df2 (embedded rules in writer flow)
56. [ ] Advanced tests and CI — covered by Phase 0; close when green. — **audit: DONE** — 43b5df2 (custom rule action runs in training thread)
57. [ ] Project state and the adding-code pipeline move from CLAUDE.md into `AGENTS.md` — task 9. — **audit: DONE** — 0799a2a (Notices, run-page table, hero-chart flags)
58. [ ] Add to skills the new stuff (linter rules, feature pipeline, design HTML pointers). — **audit: DONE** — 2c86258 (`src/backend/api/push.py`, `webpush.ts`, `test_push.py`)
59. [ ] Add MCP and CLI support to the new task list. — **audit: DONE** — 246747e (overlay + splice on hero chart)
60. [ ] Push contact stays as-is (`https://github.com` sender); home-screen manifest icon — explicitly not a priority yet. — **audit: DONE** — def4095 (hero stored per project: the open question got answered in code)
61. [ ] Profiler step labels: label a profiled block with the last step logged before it ended, the same rule checkpoints use — "just make it right". — **audit: DONE** — 2a064d6 (`log.profile(schedule=…)`, phase track, flame, epoch/checkpoint marks)
62. [ ] Approve and add the second adapters: CodeMirror for the formula editor, static Plotly renderer for export. — **audit: PARTIAL** — gzip 8adedd3 done; Arrow IPC, uPlot, DuckDB, Mosaic not; scattergl rule added via adapters a890f53
63. [ ] Design proposals, pick when ready (DESIGN-SYSTEM.md list, moves into the design HTML at task 11): x-axis switch (step / samples seen / wall time); trend sparkline per run in the run list; change-over-window deltas in the status strip; Ctrl+K command palette; previews in the comparison tray. — **audit: RESOLVED IN CODE** — dnd-kit+motion 65a338f, web push shipped; hero per project (def4095)
