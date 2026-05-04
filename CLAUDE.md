# Pandoc Fenced Divs — agent notes

Obsidian plugin that previews [Pandoc fenced divs](https://pandoc.org/MANUAL.html#extension-fenced_divs) (`::: name ... :::`) as styled blocks. Source files remain canonical Pandoc Markdown so external converters (Pandoc, Typst, etc.) can consume them unchanged. **Conversion tooling is out of scope and lives in a separate repo.**

## Architecture

Two rendering layers + one shared parser. **No registry, no settings, no defaults configurable in Obsidian.**

| File | Role |
|------|------|
| `src/main.ts` | Plugin lifecycle; registers post-processor + editor extension |
| `src/parser.ts` | Pure `parse(text): Block[]` — line-by-line; tracks fenced code, blockquotes, depth-aware nesting; supports both fence forms |
| `src/render.ts` | `applyAttrs(el, primary, attrs, prefix)` — shared DOM helper for both views |
| `src/reading-view.ts` | `MarkdownPostProcessor` — section-aware decoration with start/middle/end/single classes; hides raw `:::` text via DOM surgery |
| `src/live-preview.ts` | CodeMirror 6 `StateField` — block widget when cursor outside; click-to-edit |

Parser output is `Block[]` with `kind: 'matched' | 'unmatched'`. Renderers leave unmatched openings as plain text.

## Two recognized fence forms

| Form | Regex | Notes |
|------|-------|-------|
| Short | `/^[ \t]*:{3,}[ \t]+([a-zA-Z][\w-]*)[ \t]*$/` | **Whitespace required** between colons and class name (Pandoc-correct) |
| Attribute | `/^[ \t]*:{3,}[ \t]*\{([^}]*)\}[ \t]*$/` | First `.class` inside `{}` is primary; `#id`, `key=val`, `key="val"` supported |

Closing fence: `/^[ \t]*:{3,}[ \t]*$/`. Open and close colon counts don't have to match (both ≥3).

## Commands

```
npm install
npm run dev    # esbuild watch — auto-deploys to ./test-vault/.obsidian/plugins/fenced-divs/ on every rebuild
npm test       # vitest (23 parser tests)
npm run build  # production bundle + postbuild copy to test-vault
```

The dev auto-deploy is wired through an esbuild `onEnd` plugin in `esbuild.config.mjs`. Production uses `postbuild` in `package.json`.

## DOM contract

Each matched block renders to:

```html
<div class="ofd-block ofd-block-<primaryClass>" data-block="<primaryClass>"
     id="..." class="...extra-classes..." data-...="...">
  ...body Markdown...
</div>
```

Live-preview widgets use `ofd-cm-block` / `ofd-cm-block-<primaryClass>` instead. Both prefixes are styled together in `styles.css`.

## Test vault

`./test-vault/welcome.md` exercises:
- Class-only short form
- Attribute long form with id, classes, data-attrs
- An unknown class (`scripture`) to verify generic-framing fallback
- Coexistence with native `> [!note]` callouts
- Code-fence immunity
- Nested directives

Open the test vault in Obsidian after `npm run dev` to verify view-layer changes manually — view layers are not unit-tested.

The `.obsidian/app.json` and `.obsidian/community-plugins.json` files are tracked but Obsidian rewrites whitespace on launch; ignore those diffs when committing.

## Design and plan

- Design: `docs/superpowers/specs/2026-05-04-obsidian-fenced-divs-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-04-obsidian-fenced-divs.md`

Both reflect v1.0.0 as built. Anything not in the design and not in this file is out of scope.

## Edge cases (parser)

- `:::` (no class): not matched. Pandoc requires a class for fenced divs.
- `:::name` (no space): not matched in the short form. Use `:::{.name}` or `::: name`.
- Unclosed fence: emitted with `kind: 'unmatched'`; left as plain text.
- Inner directive inside outer body: stays as plain text (depth-aware). Pandoc parses recursively on conversion regardless.
- Inside fenced code (` ``` `, `~~~`): never matches.
- Inside blockquote (`> ...`): line skipped.

## Conventions

- CSS prefix: `ofd-` (e.g. `ofd-block`, `ofd-cm-block`, `ofd-raw`).
- Plugin ID: `fenced-divs`. Manifest version is the source of truth; `package.json` and `versions.json` mirror it.
- No icons in plugin chrome. Per-block visual character is purely CSS, configured in vault snippets.

## Sibling project

[obsidian-rubric](https://github.com/gig3m/obsidian-rubric) — same author's earlier registry-based plugin using remark-directive syntax. Coexists with this plugin (different IDs, prefixes, syntaxes). Not deprecated, but obsidian-fenced-divs is the recommended path for Pandoc/Typst-bound authoring.
