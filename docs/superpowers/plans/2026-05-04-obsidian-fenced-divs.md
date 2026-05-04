# obsidian-fenced-divs Implementation Plan

**Date:** 2026-05-04
**Spec:** `docs/superpowers/specs/2026-05-04-obsidian-fenced-divs-design.md`
**Sibling reference:** `/Users/kylearrington/Projects/obsidian-rubric` — many scaffolding choices can be ported directly.

This plan is phased. Each phase ends with a green `npm test` and (where applicable) a manual verification step in the test vault. Commits go on `main` directly; the project is small enough not to warrant a feature branch.

The plugin is **render-only**. Conversion tooling (Pandoc, Typst, etc.) lives in a separate repo and is **out of scope** for every phase below.

---

## Phase 0 — Repo scaffold

Goal: working build pipeline producing `main.js` from a stub `src/main.ts`, with the test vault wired up.

### Task 0.1 — Project metadata

**Files to create:**
- `LICENSE` — MIT, current year, owner Kyle Arrington
- `.gitignore` — copy from `obsidian-rubric/.gitignore` verbatim
- `CHANGELOG.md` — `## [Unreleased]` placeholder
- `README.md` — minimal stub; full content in Phase 5
- `package.json`:
  ```json
  {
    "name": "obsidian-fenced-divs",
    "version": "0.1.0",
    "description": "Render Pandoc fenced divs (::: name ... :::) as styled blocks in Obsidian.",
    "main": "main.js",
    "scripts": {
      "dev": "node esbuild.config.mjs",
      "build": "tsc --noEmit --skipLibCheck && node esbuild.config.mjs production",
      "test": "vitest run",
      "test:watch": "vitest",
      "postbuild": "node -e \"if(require('fs').existsSync('scripts/link-to-test-vault.mjs'))require('child_process').execSync('node scripts/link-to-test-vault.mjs',{stdio:'inherit'})\""
    },
    "keywords": ["obsidian", "obsidian-plugin", "pandoc", "fenced-divs"],
    "author": "Kyle Arrington",
    "license": "MIT",
    "devDependencies": {
      "@types/node": "^20.11.0",
      "builtin-modules": "^3.3.0",
      "esbuild": "^0.20.0",
      "obsidian": "^1.5.0",
      "tslib": "^2.6.0",
      "typescript": "^5.4.0",
      "vitest": "^1.4.0"
    }
  }
  ```
- `manifest.json`:
  ```json
  {
    "id": "fenced-divs",
    "name": "Pandoc Fenced Divs",
    "version": "0.1.0",
    "minAppVersion": "1.5.0",
    "description": "Render Pandoc fenced divs (::: name ... :::) as styled blocks.",
    "author": "Kyle Arrington",
    "authorUrl": "https://github.com/gig3m",
    "fundingUrl": "",
    "isDesktopOnly": true
  }
  ```
- `versions.json`: `{ "0.1.0": "1.5.0" }`
- `tsconfig.json` — copy from rubric verbatim
- `esbuild.config.mjs` — copy from rubric verbatim (includes the `linkToTestVault` plugin for watch auto-deploy; update the target path inside the link script in Task 0.2)
- `vitest.config.ts`:
  ```ts
  import { defineConfig } from 'vitest/config';
  export default defineConfig({ test: { environment: 'node' } });
  ```

**Commands:**
```bash
git init
npm install
npx tsc --noEmit --skipLibCheck   # should succeed with no src yet
npx vitest run                     # should report no tests, exit 0
git add -A && git commit -m "chore: initial scaffold (manifest, build, tsconfig, vitest)"
```

### Task 0.2 — Test vault and link script

**Files:**
- `test-vault/.obsidian/community-plugins.json` → `["fenced-divs"]`
- `test-vault/.obsidian/app.json` → `{}`
- `test-vault/welcome.md` — sample exercising syntax (kept short; expand as needed):
  ```markdown
  # Fenced Divs Test Vault

  ## Class-only short form

  ::: note
  A note block. The class name is the semantic identity.
  :::

  ## Attribute long form

  :::{.warning #w1 lang=en}
  Warning with id and data-lang.
  :::

  ## Unknown class (renders with generic framing only)

  ::: scripture
  Add a vault CSS snippet to style this block.
  :::
  ```
- `scripts/link-to-test-vault.mjs` — copy from rubric, adjust target path:
  ```js
  const target = "test-vault/.obsidian/plugins/fenced-divs";
  ```

**Commit:**
```bash
git add scripts/ test-vault/.obsidian/community-plugins.json test-vault/.obsidian/app.json test-vault/welcome.md
git commit -m "chore: add test vault and link-to-test-vault script"
```

### Task 0.3 — Stub main.ts and styles.css

**`src/main.ts`:**
```ts
import { Plugin } from "obsidian";

export default class FencedDivsPlugin extends Plugin {
  async onload() {
    console.log("[fenced-divs] loaded");
  }
  onunload() {
    console.log("[fenced-divs] unloaded");
  }
}
```

**`styles.css`:** empty placeholder (full content in Phase 3).

**Verify:**
```bash
npm run build
ls -la main.js test-vault/.obsidian/plugins/fenced-divs/main.js
```

Both should exist; the latter is the post-build copy.

**Commit:**
```bash
git add src/main.ts styles.css
git commit -m "feat(main): plugin entry stub"
```

**Phase 0 acceptance:** `npm run build` succeeds; the test vault's plugin folder contains `main.js`, `manifest.json`, `styles.css`.

---

## Phase 1 — Parser

Goal: pure parser passing all 15 cases from the spec's testing section.

### Task 1.1 — Parser scaffolding + first test

**`tests/parser.test.ts`** (start with one passing case):
```ts
import { describe, it, expect } from "vitest";
import { parse } from "../src/parser";

describe("parse", () => {
  it("matches class-only short form", () => {
    const text = ["::: note", "body", ":::"].join("\n");
    const result = parse(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "matched",
      primaryClass: "note",
      openLine: 0,
      closeLine: 2,
      bodyStart: 1,
      bodyEnd: 1,
    });
  });
});
```

**`src/parser.ts`** — minimal implementation to pass:
```ts
export interface ParsedAttrs {
  classes: string[];
  id?: string;
  data: Record<string, string>;
}

export interface Block {
  kind: "matched" | "unmatched";
  primaryClass: string;
  attrs: ParsedAttrs;
  openLine: number;
  closeLine: number;
  bodyStart: number;
  bodyEnd: number;
}

const SHORT_OPEN_RE = /^[ \t]*:{3,}[ \t]+([a-zA-Z][\w-]*)[ \t]*$/;
const ATTR_OPEN_RE  = /^[ \t]*:{3,}[ \t]*\{([^}]*)\}[ \t]*$/;
const CLOSE_RE      = /^[ \t]*:{3,}[ \t]*$/;

export function parse(text: string): Block[] {
  const lines = text.split("\n");
  const out: Block[] = [];
  type Open = { primaryClass: string; attrs: ParsedAttrs; openLine: number };
  let open: Open | null = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (open) {
      if (CLOSE_RE.test(line)) {
        if (depth === 0) {
          out.push({
            kind: "matched",
            primaryClass: open.primaryClass,
            attrs: open.attrs,
            openLine: open.openLine,
            closeLine: i,
            bodyStart: open.openLine + 1,
            bodyEnd: i - 1,
          });
          open = null;
        } else {
          depth--;
        }
        continue;
      }
      if (SHORT_OPEN_RE.test(line) || ATTR_OPEN_RE.test(line)) {
        depth++;
      }
      continue;
    }

    const sm = SHORT_OPEN_RE.exec(line);
    if (sm) {
      open = {
        primaryClass: sm[1],
        attrs: { classes: [sm[1]], data: {} },
        openLine: i,
      };
      depth = 0;
      continue;
    }
  }

  if (open) {
    out.push({
      kind: "unmatched",
      primaryClass: open.primaryClass,
      attrs: open.attrs,
      openLine: open.openLine,
      closeLine: open.openLine,
      bodyStart: open.openLine,
      bodyEnd: open.openLine,
    });
  }

  return out;
}
```

Run `npm test` — should pass. Commit.

### Task 1.2 — Attribute long form

Add tests for cases 3, 4, 5 from the spec checklist (`:::{.scripture}`, `::: {.scripture}`, `:::{.scripture .featured}`, `:::{.scripture #v1 lang=he}`).

Implement `parseAttrs(raw: string): ParsedAttrs` (port from rubric's `parser.ts`; attribute regex is identical: `/\.([\w-]+)|#([\w-]+)|([\w-]+)=(?:"([^"]*)"|(\S+))/g`).

Add a branch to `parse` that handles `ATTR_OPEN_RE`:
```ts
const am = ATTR_OPEN_RE.exec(line);
if (am) {
  const attrs = parseAttrs(am[1]);
  if (attrs.classes.length === 0) continue;  // no class → not a div
  open = {
    primaryClass: attrs.classes[0],
    attrs,
    openLine: i,
  };
  depth = 0;
  continue;
}
```

Run tests, commit.

### Task 1.3 — Code-fence and blockquote immunity

Add fenced-code tracking (port from rubric):
```ts
const CODE_FENCE_RE = /^[ \t]*(```|~~~)/;
const BLOCKQUOTE_RE = /^[ \t]*>/;

let inCode: false | "```" | "~~~" = false;
// ...
const cm = CODE_FENCE_RE.exec(line);
if (cm) {
  const fence = cm[1] as "```" | "~~~";
  if (!inCode) inCode = fence;
  else if (inCode === fence) inCode = false;
  continue;
}
if (inCode) continue;
if (BLOCKQUOTE_RE.test(line)) continue;
```

Add tests 10, 11, 12. Run, commit.

### Task 1.4 — Unmatched, nested, multi-block, empty body, ≥4 colons, unknown class

One commit per case (cases 6–9, 13, 14, 15 from spec). Each adds one test, then minimum implementation to pass.

For ≥4 colons: the regexes already use `:{3,}`. Add a sanity test that `:::: note ... ::::` matches.

For unknown class name: confirm test 15 passes without changes (no registry to gate).

**Phase 1 acceptance:** all 15 parser tests pass.

```bash
npm test  # should report "Tests  15 passed"
git log --oneline | head -10  # should show one commit per case
```

---

## Phase 2 — Shared render helper

Goal: a single function that constructs the callout DOM, used by both views.

### Task 2.1 — `src/render.ts`

```ts
import { ParsedAttrs } from "./parser";

export function applyAttrs(
  el: HTMLElement,
  primary: string,
  attrs: ParsedAttrs,
  prefix: "ofd-block" | "ofd-cm-block",
) {
  el.classList.add(prefix);
  el.classList.add(`${prefix}-${primary}`);
  for (const c of attrs.classes.slice(1)) {
    el.classList.add(c);
  }
  if (attrs.id) el.id = attrs.id;
  el.dataset.block = primary;
  for (const [k, v] of Object.entries(attrs.data)) {
    el.dataset[k] = v;
  }
}
```

No header/icon construction (intentionally — see spec). Body container construction is left to each view since the body source differs (DOM walk vs. Markdown string).

No tests for this — covered indirectly by view-layer manual checks.

**Commit.**

---

## Phase 3 — Reading view (M1)

### Task 3.1 — Post-processor scaffolding

**`src/reading-view.ts`:**
```ts
import { MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { parse, Block } from "./parser";
import { applyAttrs } from "./render";

export function makeReadingViewProcessor(): MarkdownPostProcessor {
  return (el, ctx) => {
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const blocks = parse(info.text);
    if (blocks.length === 0) return;

    for (const b of blocks) {
      if (b.kind !== "matched") continue;
      decorateIfInRange(el, b, info);
    }
  };
}

function decorateIfInRange(
  el: HTMLElement,
  b: Block,
  info: { lineStart: number; lineEnd: number },
): void {
  if (info.lineEnd < b.openLine || info.lineStart > b.closeLine) return;

  const isStart  = info.lineStart <= b.openLine && info.lineEnd >= b.openLine;
  const isEnd    = info.lineStart <= b.closeLine && info.lineEnd >= b.closeLine;
  const isMiddle = info.lineStart > b.openLine && info.lineEnd < b.closeLine;

  if (!isStart && !isEnd && !isMiddle) return;

  applyAttrs(el, b.primaryClass, b.attrs, "ofd-block");
  if (isStart && isEnd) el.classList.add("ofd-block-single");
  else if (isStart)     el.classList.add("ofd-block-start");
  else if (isEnd)       el.classList.add("ofd-block-end");
  else                  el.classList.add("ofd-block-middle");

  hideRawFenceText(el, b.primaryClass, isStart, isEnd);
}

function hideRawFenceText(el: HTMLElement, primaryClass: string, isStart: boolean, isEnd: boolean): void {
  // Walk text nodes; replace ::: name (start) and ::: (end) with hidden spans.
  // See Task 3.2.
}
```

### Task 3.2 — Implement `hideRawFenceText`

Walk `TreeWalker(NodeFilter.SHOW_TEXT)`. For start sections, find the literal `:::` followed by whitespace + class name (or `:::{...}` form), replace with `<span class="ofd-raw">…</span>`. For end sections, find the trailing `:::` and replace.

Then sweep `.ofd-raw` spans: hide adjacent `<br>` and collapse empty parent `<p>` elements (`display: none`).

Reference: rybla/obsidian-pandoc-fenced-divs `hideRawTextSafely` is a workable starting algorithm; adapt for both fence forms (short and attribute).

### Task 3.3 — Wire into the plugin

**`src/main.ts`:**
```ts
import { Plugin } from "obsidian";
import { makeReadingViewProcessor } from "./reading-view";

export default class FencedDivsPlugin extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor(makeReadingViewProcessor());
  }
}
```

### Task 3.4 — Default `styles.css`

Write the CSS from the spec's "Styling" section. Include both reading-view (`.ofd-block-*`) and live-preview (`.ofd-cm-block-*`) selectors so Phase 4 has nothing additional to author.

### Task 3.5 — Manual verification

1. `npm run dev` (auto-deploys).
2. Open Obsidian on `./test-vault/`.
3. Open `welcome.md`. Verify all sample blocks render in reading view.
4. Add a vault snippet `.ofd-block-scripture { font-style: italic; color: maroon; }` — confirm it applies.
5. Add a native `> [!note]` callout to welcome.md as a regression check.

**Phase 3 (M1) acceptance:** manual checklist items 1, 4, 5, 6, 7, 8 from the spec pass. Commit.

---

## Phase 4 — Live preview (M2)

### Task 4.1 — `src/live-preview.ts`

Port from `obsidian-rubric/src/live-preview.ts`. Changes:
- Drop registry parameter; the scanner uses `parse()` directly.
- Class generation: `ofd-cm-block`, `ofd-cm-block-<primaryClass>`, `ofd-cm-body-<primaryClass>`.
- No icon, no title — widget contains only `<div class="ofd-cm-block ofd-cm-block-<primary>">` wrapping the rendered body.
- `data-block` attribute set via `applyAttrs(wrap, primaryClass, attrs, "ofd-cm-block")`.

### Task 4.2 — Wire into `main.ts`

```ts
this.registerEditorExtension(makeLivePreviewExtension({
  app: this.app,
  component: this,
  getSourcePath: () => this.app.workspace.getActiveFile()?.path ?? "",
}));
```

### Task 4.3 — Manual verification

1. Open `welcome.md` in live preview.
2. Each block renders as a widget when cursor is outside.
3. Click any widget → cursor lands inside, raw `:::` lines reveal.
4. Move cursor out → widget reappears.
5. Verify both fence forms (short + attribute) work.

**Phase 4 (M2) acceptance:** manual checklist items 2 and 3 from the spec pass.

---

## Phase 5 — Polish, README, release (M3)

### Task 5.1 — README

Sections:
- One-paragraph elevator pitch (Pandoc-fenced-div preview for Obsidian).
- Syntax (both fence forms with examples).
- Install (BRAT, manual, community store TBD).
- Default classes shipped + how to add custom classes via vault snippets.
- Pointer to the (forthcoming) export repo for PDF generation.
- Development scripts.
- License.

### Task 5.2 — CLAUDE.md

Same shape as obsidian-rubric/CLAUDE.md but updated for the registry-less architecture.

### Task 5.3 — CHANGELOG and version bump

Add `## [1.0.0] - <date>` entry; bump `manifest.json`, `package.json`, `versions.json`.

### Task 5.4 — GitHub release

```bash
git tag 1.0.0
gh repo create gig3m/obsidian-fenced-divs --public --source . --push
gh release create 1.0.0 main.js manifest.json styles.css \
  --title "1.0.0" \
  --notes-file release-notes.md
```

### Task 5.5 — Optional: community-store submission

Open a PR to `obsidianmd/obsidian-releases` adding the plugin entry. Wait for review.

**Phase 5 (M3) acceptance:** plugin is installable via BRAT; community-store submission is queued.

---

## Verification summary

After all phases:

- `npm test` passes (15 parser tests).
- `npm run build` produces `main.js` under 50KB (smaller than rubric since registry/settings are gone).
- All 8 manual checklist items pass in `./test-vault/`.
- `README.md`, `CHANGELOG.md`, `LICENSE`, `CLAUDE.md` complete.
- GitHub Release v1.0.0 with `main.js`, `manifest.json`, `styles.css` attached.

The plugin coexists peacefully with `obsidian-rubric` in the same vault (different plugin IDs, different CSS prefixes, different fence syntaxes), so users can A/B test before committing to one.

---

## Risk and known unknowns

- **Section-info edge cases in reading view.** Obsidian splits Markdown into "sections" at blank lines; a fenced div spanning blank lines triggers the start/middle/end class machinery. This is the trickiest part of M1; expect 1–2 manual fixes during Task 3.2.
- **Click-to-edit cursor positioning.** Inherited from rubric; should work identically. If not, debug with `console.log(state.selection.main.head)` in the widget click handler.
- **Pandoc fenced-div nesting.** Pandoc parses recursively; we don't. Live preview will show the inner block as plain text inside the outer widget. Document this as "by design for v1." (When the source is converted to PDF by external tooling, Pandoc re-parses recursively on its own.)
- **`isDesktopOnly: true`.** Match rubric's stance until we have a reason to flip.
