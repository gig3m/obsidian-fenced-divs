# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-04

Initial release.

### Added
- Pandoc fenced-div parser supporting both fence forms: `::: name` (short, whitespace required) and `:::{.name #id key=val}` (attribute long form). Closing fence accepts ≥3 colons.
- Reading-view rendering via `MarkdownPostProcessor`. Section-aware decoration with `ofd-block-start` / `middle` / `end` / `single` classes for continuous framing across blank-line section boundaries. Raw fence text hidden via DOM surgery.
- Live-preview rendering via CodeMirror 6 `StateField`. Single block widget when cursor is outside the directive; click-to-edit transitions to per-line raw rendering.
- 23 unit tests covering both fence forms, attribute parsing, code-fence and blockquote immunity, depth-aware nesting, unclosed openings, ≥4-colon fences, and arbitrary class names.
- Default `styles.css` ships generic framing plus starter rules for `note`, `warning`, `tip`, `quote`, `aside`. All cosmetics overridable via vault CSS snippets.
- `data-block` attribute on every rendered wrapper exposing the primary class for CSS targeting.
- Coexistence with Obsidian's native `> [!name]` callouts and with fenced code blocks.

### Architecture
- No block registry, no settings tab, no per-block configuration in Obsidian. Any class name renders. Per-block visual character lives entirely in CSS.
- No conversion tooling. Source files remain canonical Pandoc Markdown for an external export pipeline.
