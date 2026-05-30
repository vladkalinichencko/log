# How code in `log` must be written

Read before writing or reviewing any code in this repo. `SPEC.md` says WHAT to build; this file says HOW it must read. Both are enforced by the auditor. This exists so every agent — architect, implementer, auditor — carries the project owner's standing preferences even though it starts with no memory of past conversations.

## Non-negotiables

1. **Lego uniformity.** The same kind of thing is written the same way every time: identical argument order, identical error shape, identical FSM shape, identical naming. Two functions of one kind differ only by their parameters — line-for-line identical otherwise. Per-feature names are mechanical and predictable: `<feature>_reducer`, `<feature>_state`, `<feature>_selector`, `<element>_fsm`. The goal is that a human can scan the code, see the structure repeat, and verify correctness by eye.

2. **Reads effortlessly.** Names say what a thing is AND why it exists, in the fewest words that still distinguish it. No comments — names carry the meaning. Parallel names for parallel roles. Someone unfamiliar must understand a function by reading it, with no external context.

3. **Minimum code.** The fewest concepts, layers, and dependencies that satisfy `SPEC.md`. Never add defensively, never pad, never keep something merely because it is conventional. Anything that looks like extra (an error class, a layer, an abstraction, a dependency) must justify its existence in one concrete sentence or be removed. Expect this to be challenged — answer with the concrete reason or cut it.

4. **Functions over classes.** A class exists only when it holds data/state fields with operations on them. No state fields → plain functions, never an object for its own sake.

5. **Every stateful UI element is an explicit FSM**, derived from the one base factory (`makeFsm`), never re-invented per element — including a plain button and every loading state.

6. **Build only what was asked — and name what you left out.** Add nothing the request and `SPEC.md` don't call for: not a CSS rule, not a DOM node, not a function, not a parameter, not a layer, not a dependency. This is not a ban on CSS or on features — it is a ban on *unrequested* ones. Asked for a grid? Build exactly that grid, nothing around it. When you notice something that plausibly should exist but was not asked for (a style, an edge case, a helper, a guard), do not add it silently and do not drop it silently — **mention it in chat at implementation time** so the owner decides. The one thing you may add unprompted is `cursor: pointer` on a clickable element.

## How to communicate

Explain in concrete mechanics: name the actual file, extension, function, and roughly what the call looks like; prefer one concrete example over a sentence of theory; the first time a concept appears, say what it IS mechanically and why it is here. Do not guess on behavior or cost — calculate it or say you don't know.

**Human framing before any list, table, flow, or error set.** Every section that holds a list (errors, data flows, features, endpoints) opens with a 1–2 sentence plain-language "in one breath" line that says what the whole group IS, what scope it covers, and names the repeated Lego shape — so a reader grasps it without reading every row. Group long lists into a few labeled kinds rather than one flat enumeration. The owner will not read sixteen rows to discover what they have in common; state the common thing first. This applies to `SPEC.md` as much as to code.

## When the spec doesn't answer something

Stop and ask. Do not invent structure, do not add a dependency not in `SPEC.md` §4, do not create a file not in §5.
