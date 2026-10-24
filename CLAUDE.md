# How code in `log` must be written

Read before writing or reviewing any code in this repo. `SPEC.md` says WHAT to build; this file says HOW it must read. Both are enforced by the auditor. This exists so every agent — architect, implementer, auditor — carries the project owner's standing preferences even though it starts with no memory of past conversations.

## Non-negotiables

1. **Lego uniformity.** The same kind of thing is written the same way every time: identical argument order, identical error shape, identical FSM shape, identical naming. Two functions of one kind differ only by their parameters — line-for-line identical otherwise. Per-feature names are mechanical and predictable: `<feature>_reducer`, `<feature>_state`, `<feature>_selector`, `<element>_fsm`. The goal is that a human can scan the code, see the structure repeat, and verify correctness by eye.

2. **Reads effortlessly.** Names say what a thing is AND why it exists, in the fewest words that still distinguish it. No comments — names carry the meaning. Parallel names for parallel roles. Someone unfamiliar must understand a function by reading it, with no external context.

3. **Minimum code.** The fewest concepts, layers, dependencies, and **function parameters** that satisfy `SPEC.md`. Never add defensively, never pad, never keep something merely because it is conventional. Anything that looks like extra (an error class, a layer, an abstraction, a dependency, an extra parameter) must justify its existence in one concrete sentence or be removed. A "fancy" touch that seems useful but was not requested — an extra option, a configurability knob, a clever generalization — is **forbidden until you name it to the owner and they accept it**; do not add it silently. Expect every line to be challenged — answer with the concrete reason or cut it.

4. **Functions over classes.** A class exists only when it holds data/state fields with operations on them. No state fields → plain functions, never an object for its own sake.

5. **Every stateful UI element is an explicit FSM**, derived from the one base factory (`makeFsm`), never re-invented per element — including a plain button and every loading state.

6. **Build only what was asked — and name what you left out.** Add nothing the request and `SPEC.md` don't call for: not a CSS rule, not a DOM node, not a function, not a parameter, not a layer, not a dependency. This is not a ban on CSS or on features — it is a ban on *unrequested* ones. Asked for a grid? Build exactly that grid, nothing around it. When you notice something that plausibly should exist but was not asked for (a style, an edge case, a helper, a guard), do not add it silently and do not drop it silently — **mention it in chat at implementation time** so the owner decides. The one thing you may add unprompted is `cursor: pointer` on a clickable element.

7. **Design-system uniformity — one visual vocabulary, even if none was specified.** The look obeys the same minimum-vocabulary rule as the code: a small fixed set of **tokens** — one spacing scale, one corner radius, a few gray steps, one or two accents, one shadow — defined once and referenced everywhere (CSS custom properties like `--space-2` / `--radius` / `--gray-700`; in SwiftUI/AppKit one `Spacing` / `Color` enum), never a stray `padding: 13px` or a fresh hex per component. The binding rule: **elements in the same hierarchy share one set of paddings, radii, sizes, and shadows; different hierarchies differ on purpose.** Two tiles at the same level are pixel-identical in chrome and vary only by content; a toolbar and a cell may differ because they are different levels. Keep the count of distinct classes, modifiers, gray shades, and colors small — maximize reuse and nesting, exactly as in the architecture.

## Where bugs hide — three seams to close (any language)

A unified data flow governs one layer only; real defects live at the **seams** where data leaves it. These caught every real bug in this project, so they are non-negotiable too:

8. **One source of truth — no shadow copies.** Domain data lives in exactly one place; everything else reads it, never keeps its own copy. Local/ephemeral state is for UI only (is-open, is-hovered), never domain data. *React:* never `useState(fetchedTable)` — read from the store via a selector (a shadow copy is why an edit "doesn't show"). *SwiftUI:* never copy an `@ObservedObject` value into `@State`; bind to the source. *Files:* an in-memory cache of a file is not a free snapshot — sync it on every write or make it a replayable change-log, never an at-open copy written back at close; a file written from >1 place has **one** writer, and updates are read-modify-write.

9. **Don't wrap or duplicate — use the framework's own seam.** *FastAPI:* `param = Depends(provider)`, not a middleware + re-declared route (the wrapper drops params the inner function later gains). *SwiftUI/AppKit:* `@EnvironmentObject` / one delegate / one target-action, not a copy passed down and written back, not two handlers on one control.

10. **Test at the seam, not the inner unit.** Assert at the wired surface: the *registered route* (does `?status=x` actually filter?), not the inner function; the *rendered component* (click → store changed), not the reducer alone; the *effect's result* (run the write, read the file back), not the in-memory call.

## Before you call anything done — misses that reviews actually found

Each rule below exists because an agent in this project broke it and a reviewer caught it afterward. They are the same seam rules seen from the "am I finished?" side.

11. **A claim about a class covers the whole class.** When you make something follow a rule ("every API error has shape S", "derived folders are not runs"), first list every source of that something, then test each one through the wired surface. For HTTP errors the sources are your own errors, framework validation (422), routing (404/405, catch-all routes), and unexpected crashes (500). Fixing the one case you happened to look at and reporting the class as fixed is the defect. Search for the old literal (`grep`) before you fix a rule, because the same rule usually exists in a second place.
12. **Data moved into the store needs an owner of freshness.** Lifting fetched data out of component state (rule 8) loses the free refresh that remounting gave. In the same change, name who reloads it (mount, `liveTick`, a write) and who clamps anything that indexes into it (a slider position, a selection) when it shrinks.
13. **A form must change behavior.** An FSM whose state does not reach the rendered output (`data-state`, a class, a branch) is decoration, not a machine. Two copies that differ by one string are not "Lego"; they are one function or component with a parameter.
14. **Read the decision record before deleting.** Before removing something that looks unused, search `SPEC.md` and `STATUS.md` for its name; an ADR may keep it on purpose.
15. **Reproduce, fix, prove.** Reproduce the bug first, then fix it, then show that the new test fails without the fix. Run the production build and open the changed flow in a browser; dev mode hides build-only failures.
16. **Report only what was checked.** Every "works" or "real" in a report or in `STATUS.md` names the test or live check behind it. Anything else is written as unverified.

## How to communicate

Explain in concrete mechanics: name the actual file, extension, function, and roughly what the call looks like; prefer one concrete example over a sentence of theory; the first time a concept appears, say what it IS mechanically and why it is here. Do not guess on behavior or cost — calculate it or say you don't know.

**Human framing before any list, table, flow, or error set.** Every section that holds a list (errors, data flows, features, endpoints) opens with a 1–2 sentence plain-language "in one breath" line that says what the whole group IS, what scope it covers, and names the repeated Lego shape — so a reader grasps it without reading every row. Group long lists into a few labeled kinds rather than one flat enumeration. The owner will not read sixteen rows to discover what they have in common; state the common thing first. This applies to `SPEC.md` as much as to code.

## When the spec doesn't answer something

Stop and ask. Do not invent structure, do not add a dependency not in `SPEC.md` §4, do not create a file not in §5.
