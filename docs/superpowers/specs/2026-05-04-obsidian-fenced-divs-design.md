# obsidian-fenced-divs — v1 Design

**Date:** 2026-05-04
**Status:** Approved
**Source:** Distilled from the obsidian-rubric retrospective. Rubric was scoped as a stand-alone Obsidian callout plugin and adopted remark-directive syntax. This project re-targets the same authoring surface against a Pandoc-fenced-div canonical syntax and drops the registry abstraction.

## Purpose

An Obsidian plugin that **previews** [Pandoc fenced divs](https://pandoc.org/MANUAL.html#extension-fenced_divs) (`::: name ... :::`) as styled blocks while keeping the source as **canonical Pandoc Markdown** that round-trips cleanly into PDF generation by external tooling (Pandoc → LaTeX, Typst, etc.).

The plugin's job is **render-only inside Obsidian.** It writes nothing to the vault, transforms nothing on save, and ships no conversion tooling. The companion **export pipeline lives in a separate repo** (TBD) and consumes the same `:::` source files.

This is plugin 1 of the user's authoring suite (theology workflow). Future plugins handle Bible-reference parsing, Greek/Hebrew typography, multi-column layouts. The export repo is a peer, not a child, of any of these plugins.

## Naming and licensing

- **Repo:** `obsidian-fenced-divs`
- **Manifest ID:** `fenced-divs`
- **Package name:** `obsidian-fenced-divs`
- **CSS prefix:** `ofd-`
- **Class names:** `FencedDivsPlugin`, `parseBlocks`, etc.
- **License:** MIT

The name is deliberately descriptive: any future user searching the Obsidian community store for "Pandoc fenced divs" or "fenced divs" should land here.

## Scope

### In scope (v1)

- Parse Pandoc fenced-div syntax: `::: name` and `:::{.name #id key=val}`
- Reading-view rendering via Markdown post-processor
- Live-preview rendering via CodeMirror 6 — single block widget when cursor outside (matches native Obsidian callout architecture)
- **No block registry, no settings tab, no per-block configuration in the plugin.** Any class name renders.
- Default `styles.css` with starter rules for a small set of common semantic classes (`note`, `warning`, `tip`, `quote`, `aside`) — purely cosmetic, fully overridable by vault CSS snippets.
- Coexistence with Obsidian's native `> [!note]` callouts (different syntax, both render).
- Coexistence with fenced code blocks (` ``` `, `~~~`) — directives inside code do NOT render.

### Out of scope (v1)

- Pandoc filters, LaTeX preambles, Typst show rules, Makefiles, conversion tooling of any kind. **The export pipeline is a separate repo.**
- Leaf directives (`::name`) and inline directives (`:name[content]`) — Pandoc fenced divs are container-only.
- `[Title]` syntax (remark-directive; not Pandoc; not Typst).
- Recursive directive parsing — outer parses, inner stays as plain text in body. Pandoc supports recursive divs but v1 keeps them as text for parser simplicity; downstream Pandoc parses recursively on its own when converting.
- Per-block icons in plugin chrome (CSS pseudo-elements + icon fonts can do this in user snippets if desired).
- Settings tab. There is nothing for the user to configure inside Obsidian; styling lives in CSS.
- Theology-specific default styles (`scripture`, `greek`, `hebrew`). These are user/project concerns; ship no opinions about them.
- Mobile (desktop only).
- Network dependencies, bundled fonts/icons.

## Architecture

Two rendering layers + one shared parser. No registry, no settings.

| Module | Role |
|--------|------|
| `src/parser.ts` | Pure `parse(text): Block[]` — line-by-line scan; tracks fenced code, blockquotes, depth-aware nesting |
| `src/render.ts` | Builds the callout DOM (wrapper + body container) — used by both views |
| `src/reading-view.ts` | `MarkdownPostProcessor` — finds parsed blocks in rendered DOM; wraps body |
| `src/live-preview.ts` | CodeMirror 6 `StateField` — single block widget when cursor outside; click flips to per-line raw |
| `src/main.ts` | Plugin lifecycle — registers post-processor + editor extension. **No `loadData` / `saveData`.** |

Compared to obsidian-rubric: removes `registry.ts`, `defaults.ts`, `settings.ts`, `settings-tab.ts`. Approximately 40% smaller bundle.

## Parser design

Pure function: `parse(text: string): Block[]`. Single-file, no I/O.

### Recognized opening forms

Pandoc fenced divs require **three or more colons**:

1. **Class-only short form:** `::: classname`
   - Regex: `/^[ \t]*:{3,}[ \t]+([a-zA-Z][\w-]*)[ \t]*$/`
   - One or more spaces between `:::` and `classname`.
   - Single class only in the short form. Users wanting multiple classes use the `{.a .b}` form.

2. **Attribute long form:** `:::{.name #id key=val}` or `::: {.name #id key=val}`
   - Regex: `/^[ \t]*:{3,}[ \t]*\{([^}]*)\}[ \t]*$/`
   - First `.class` inside `{}` is the primary class (used for `data-block`); additional classes are added to `class=`.
   - `#id` becomes `id=`.
   - `key=val` and `key="val"` become `data-key="val"`.

### Closing fence

`/^[ \t]*:{3,}[ \t]*$/`. At least three colons; trailing whitespace allowed.

### State machine rules

- Track fenced-code-block state (` ``` ` and `~~~`); lines inside are skipped entirely.
- Lines whose first non-whitespace char is `>` (blockquote) are skipped.
- Stack-based matching with depth counter: outer `::: scripture` is not closed by an inner fence; inner directives stay as plain text in the body. Same depth-aware logic as rubric.
- Unmatched openings emitted with `kind: 'unmatched'` so renderers can leave them as plain text.

### Output type

```ts
interface ParsedAttrs {
  classes: string[];     // first is primary; rest are extra
  id?: string;
  data: Record<string, string>;
}

interface Block {
  kind: 'matched' | 'unmatched';
  primaryClass: string;  // === classes[0]; the semantic block type
  attrs: ParsedAttrs;
  openLine: number;      // 0-indexed
  closeLine: number;     // = openLine for unmatched
  bodyStart: number;     // openLine + 1
  bodyEnd: number;       // closeLine - 1; may be < bodyStart for empty body
}
```

## Reading-view renderer

Registered via `this.registerMarkdownPostProcessor(callback)`.

**Algorithm:**

1. Get `ctx.getSectionInfo(el)` for the document's source line range.
2. Run `parse(info.text)` once per section call.
3. For each `Block` whose `[bodyStart, bodyEnd]` overlaps the current section:
   - Wrap matching DOM into `<div class="ofd-block ofd-block-<primaryClass>" data-block="<primaryClass>">`.
   - Apply `id`, extra classes, and `data-*` attributes.
   - Hide the literal `:::` fence text via a `display: none` span (DOM surgery).
4. Cleanup: remove now-empty `<p>` wrappers around hidden fence text.

## Live-preview renderer

CodeMirror 6 `StateField<DecorationSet>` — same architecture as rubric.

- Outside cursor: `Decoration.replace` with a `block: true` widget covering the full extent. Widget renders `<div class="ofd-cm-block ofd-cm-block-<primaryClass>" data-block="...">` with body re-rendered via `MarkdownRenderer.render`.
- Inside cursor (selection or caret on any block line): per-line `Decoration.line` with `class="ofd-cm-body ofd-cm-body-<primaryClass>"` plus a fence-dimming class on open/close lines.
- Click on widget → `view.dispatch({ selection: { anchor: openL.to } })` to flip to raw mode.

No widget for `kind: 'unmatched'`; raw text shown.

## Styling

Default `styles.css` ships **non-opinionated framing only**:

```css
.ofd-block,
.ofd-cm-block {
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--callout-radius, 8px);
  padding: 0.75em 1em;
  margin: 0.5em 0;
}

.ofd-cm-block-wrapper {
  /* outer wrapper for reliable vertical spacing between adjacent widgets */
  margin: 0.5em 0;
}

/* Optional named-block niceties for common classes — overridable */
.ofd-block-warning, .ofd-cm-block-warning { border-left: 3px solid #c0392b; }
.ofd-block-note,    .ofd-cm-block-note    { border-left: 3px solid #2980b9; }
.ofd-block-tip,     .ofd-cm-block-tip     { border-left: 3px solid #27ae60; }
.ofd-block-quote,   .ofd-cm-block-quote   { border-left: 3px solid var(--text-faint); font-style: italic; }
.ofd-block-aside,   .ofd-cm-block-aside   { border-left: 3px dashed var(--text-faint); }
```

Theology-specific or project-specific blocks are NOT in the default sheet. Users add them via vault snippets to keep the plugin opinion-free.

The `ofd-` prefix is short, distinct, and unlikely to clash with theme CSS.

## Edge case decisions

| Case | Decision |
|------|----------|
| `:::` (no class) | Not matched. Pandoc requires a class for fenced divs; we follow. |
| Empty body (`::: name\n:::`) | Matched. `bodyEnd < bodyStart` indicates empty. Renderer treats as empty range. |
| Unclosed fence | Emitted with `kind: 'unmatched'`. Renderers leave as plain text. |
| Nested directive | Outer matches; inner stays as body text (depth-aware). Downstream Pandoc parses recursively, so the *converted* PDF still nests correctly. |
| Inside fenced code | Skipped — never matches. |
| Inside blockquote | Skipped — line starts with `>`. |
| Multiple classes in `{.a .b}` | First class is primary (`data-block="a"`, used for class lookup); all classes added to `class`. |
| `:::: name` (4+ colons) | Matched. Pandoc allows colon counts ≥3; matched as long as open and close use ≥3. v1 simplification: any ≥3 open with any ≥3 close. |

## File layout

```
obsidian-fenced-divs/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
├── README.md
├── LICENSE
├── CHANGELOG.md
├── CLAUDE.md
├── .gitignore
├── docs/superpowers/
│   ├── specs/2026-05-04-obsidian-fenced-divs-design.md   (this file)
│   └── plans/2026-05-04-obsidian-fenced-divs.md
├── src/
│   ├── main.ts                    # plugin entry, lifecycle
│   ├── parser.ts                  # pandoc-fenced-div matcher
│   ├── render.ts                  # shared DOM construction
│   ├── reading-view.ts            # MarkdownPostProcessor
│   └── live-preview.ts            # CM6 StateField + widget
├── tests/
│   └── parser.test.ts             # vitest
├── scripts/
│   └── link-to-test-vault.mjs     # post-build copy step
└── test-vault/
    ├── .obsidian/                 # mostly gitignored
    └── welcome.md                 # tracked sample
```

No `pandoc/`, no `typst/`. Conversion tooling lives in a separate repo.

## Testing

### Unit tests (vitest)

`tests/parser.test.ts` — at minimum:

1. Class-only short form: `::: scripture` (single space)
2. Class-only short form with extra spaces: `:::    scripture`
3. Attribute long form: `:::{.scripture}`, `:::{.scripture #v1 lang=he}`
4. Attribute form with leading space: `::: {.scripture}`
5. Multiple classes: `:::{.scripture .featured}` → primary=scripture, classes=[scripture, featured]
6. Empty body: `::: note\n:::`
7. Multi-line body
8. Multiple sequential blocks
9. Nested: outer matches, inner stays as text
10. Inside fenced code (` ``` `): no match
11. Inside fenced code (`~~~`): no match
12. Inside blockquote (`> ::: name`): no match
13. Unclosed fence → `kind: 'unmatched'`
14. 4+ colons (`:::: name ... ::::`): matched
15. Unknown class name (`::: arbitrary-name`): matched (no registry to gate)

View layers are not unit-tested (matches rubric's choice). Manual checklist below covers them.

### Manual test checklist

Run before each release in `./test-vault/`:

1. `::: note` body `:::` renders in reading view. ✅/❌
2. `::: note` body `:::` renders in live preview as a widget; cursor inside flips to raw. ✅/❌
3. `:::{.warning #w1 lang=en}` renders with id, class, and `data-lang`. ✅/❌
4. `::: scripture` (an unknown class) renders with the generic `.ofd-block` framing only. ✅/❌
5. Adding a vault snippet `.ofd-block-scripture { ... }` immediately styles the block (no plugin reload). ✅/❌
6. Source file viewed outside Obsidian (`cat welcome.md`) is unchanged. ✅/❌
7. Native Obsidian callout `> [!note]` still renders alongside fenced divs. ✅/❌
8. Inside a fenced code block, `::: note ... :::` renders as code, not as a div. ✅/❌

## Compatibility

- Obsidian: 1.5.0+
- Node: 20.x (Obsidian-bundled)
- TypeScript: 5.x
- Tested platforms (v1): macOS only

No external runtime dependencies (no Pandoc, no LaTeX, no Typst). The plugin is self-contained.

## Build milestones

Ship and verify each before the next.

- **M1 — Reading view.** Plugin scaffold, manifest, build pipeline, parser with all 15 cases, reading-view post-processor, default `styles.css`. Manual verify in test vault.
- **M2 — Live preview.** CM6 StateField with widget + cursor-aware reveal/hide. Verify behavior matches native callouts.
- **M3 — Polish and release.** README, CHANGELOG, GitHub Release with assets, optional community-store submission.

## Deliverables (v1.0.0)

1. Built `main.js`, `manifest.json`, `styles.css`.
2. Functioning Obsidian plugin (BRAT-installable).
3. `README.md` with install (BRAT + manual + community store), syntax reference, and a pointer to the (forthcoming) export repo.
4. Passing test suite (`npm test`).
5. `CHANGELOG.md` v1.0.0 entry.
6. `LICENSE` (MIT).
7. `CLAUDE.md` for future agent sessions.

## Open decisions

Not blocking for v1 implementation:

- **Community store submission.** Likely *yes* given the descriptive name and clear scope. Submit after M3.
- **Multi-class short form.** Pandoc allows `::: scripture featured` (space-separated). v1 only supports single class in short form. Add later if needed; the long form already covers it.

## References

- Pandoc fenced divs: https://pandoc.org/MANUAL.html#extension-fenced_divs
- Obsidian plugin docs: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- CodeMirror 6 decorations: https://codemirror.net/examples/decoration/
- Sibling project (rubric): `/Users/kylearrington/Projects/obsidian-rubric` — same author, alternative approach (registry-based, remark-directive)
- Companion export repo: TBD, separate project. Will consume `:::` source files produced by the plugin.
