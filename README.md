# Pandoc Fenced Divs for Obsidian

Render [Pandoc fenced divs](https://pandoc.org/MANUAL.html#extension-fenced_divs) (`::: name ... :::`) as styled blocks in Obsidian. Source files stay as canonical Pandoc Markdown — any external converter (Pandoc, Typst, etc.) reads them unchanged.

This plugin is the **Obsidian preview surface only**. PDF generation lives in a separate repo.

## Syntax

Two opening forms; both use a closing fence of three or more colons.

````markdown
::: note
A note block. Body is rendered as Markdown, including **bold** and `code`.
:::

::: warning
Mandatory whitespace between the colons and the class name.
:::

:::{.tip #helpful lang=en}
Attribute long form: first `.class` is the primary class.
`#id` and `key=value` are forwarded as `id` and `data-*` attributes.
:::

:::{.aside .featured}
Multiple classes — first is primary, others ride along on the wrapper.
:::
````

## What renders

Any class name renders. There is no registry, no settings tab, and nothing to configure inside Obsidian.

Each block becomes:

```html
<div class="ofd-block ofd-block-<name>" data-block="<name>">
  ...body rendered as Markdown...
</div>
```

Live-preview blocks are wrapped in `.ofd-cm-block` / `.ofd-cm-block-<name>` instead.

## Styling

A small set of starter classes ship with default styles in `styles.css`:

| Class | Default treatment |
|-------|------------------|
| `note` | left border, blue accent |
| `warning` | left border, red accent |
| `tip` | left border, green accent |
| `quote` | left border, italic |
| `aside` | left dashed border |

To style other classes (e.g. `scripture`, `greek`, `pericope`), add a CSS snippet to your vault:

```css
/* <vault>/.obsidian/snippets/scripture.css */
.ofd-block-scripture,
.ofd-cm-block-scripture {
  font-family: 'EB Garamond', serif;
  border-left: 3px solid maroon;
  font-style: italic;
}
```

Enable the snippet under Settings → Appearance → CSS snippets.

## Reading vs Live Preview

- **Reading view** — directives render as styled blocks via Markdown post-processor. Multi-section blocks (those crossing blank lines) get continuous framing via `start` / `middle` / `end` modifier classes.
- **Live preview** — when the cursor is outside, the directive renders as a single block widget (matching Obsidian's native callout architecture). Click the widget to land the cursor inside, which flips it to raw editing mode.
- **Source mode** — always shows raw `:::` syntax.

## Coexistence with native callouts

Pandoc fenced divs (`::: name`) coexist with Obsidian's built-in `> [!name]` callouts. They use different syntaxes; both work side by side. Lines starting with `>` are skipped by the parser to avoid ambiguity.

## Edge cases

- Directives inside fenced code blocks (` ``` `, `~~~`) do NOT render.
- Unclosed directives stay as plain text (parser flags them as `kind: 'unmatched'`; renderers leave them alone).
- Nested directives are depth-aware: outer matches; inner `::: name` and matching `:::` close lines stay as plain text inside the outer's body. (When the source is later converted to PDF, Pandoc parses recursively on its own.)
- `::::` and longer fences are accepted; the open and close don't have to use the same colon count, only ≥3.

## Installation

### Via BRAT (recommended for now — auto-updates)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs plugins from a GitHub repo and updates them when new releases ship.

1. Install **Obsidian42 - BRAT** from Settings → Community plugins.
2. BRAT settings → "Add Beta Plugin".
3. Paste `gig3m/obsidian-fenced-divs` and confirm.
4. Enable **Pandoc Fenced Divs** in Settings → Community plugins.

### From source

1. Clone this repo.
2. `npm install && npm run build`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into `<your-vault>/.obsidian/plugins/fenced-divs/`.
4. Enable in Settings → Community plugins.

### Community plugin store

Not yet submitted.

## Development

```
npm install
npm run dev    # esbuild watch + auto-deploy to ./test-vault/.obsidian/plugins/fenced-divs/
npm test       # vitest (23 parser tests)
npm run build  # production bundle
```

`./test-vault/welcome.md` exercises every directive feature for manual verification.

## Sibling project

[obsidian-rubric](https://github.com/gig3m/obsidian-rubric) is the same author's earlier registry-based plugin using remark-directive syntax (`:::name[Title]`). The two plugins coexist (different IDs, different CSS prefixes, different fence syntax) — useful for A/B testing — but obsidian-fenced-divs is the recommended path for authoring against a Pandoc/Typst PDF pipeline.

## License

MIT
