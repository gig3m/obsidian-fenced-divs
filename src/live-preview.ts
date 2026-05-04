import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { EditorState, Range, StateField } from "@codemirror/state";
import { parse } from "./parser";

/**
 * Whole-block fallback model:
 *
 * - Cursor (or any selection) overlaps the block: no decorations at all.
 *   The block reverts to raw markdown — `:::name`, body, and `:::` are all
 *   plain text, fully editable. This is the "edit mode" view.
 * - Cursor outside the block: full styling. Open fence is replaced by a
 *   FenceTitleWidget showing the class name; close fence is collapsed to
 *   zero height; body lines get a tinted background. This is the "preview"
 *   view.
 *
 * The earlier per-line model (only the active fence line revealing raw
 * source) made the close fence unreachable: it was collapsed to height 0,
 * so the user couldn't click or arrow-navigate to it without skipping
 * past. Whole-block fallback fixes that — moving the cursor into the
 * block surfaces every line for editing in one motion.
 */

class FenceTitleWidget extends WidgetType {
  constructor(private readonly primaryClass: string) {
    super();
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "ofd-cm-fence-title";
    const inner = document.createElement("span");
    inner.className = "ofd-cm-fence-title-inner";
    inner.textContent = this.primaryClass;
    wrap.appendChild(inner);
    return wrap;
  }

  eq(other: FenceTitleWidget): boolean {
    return other.primaryClass === this.primaryClass;
  }

  ignoreEvent(): boolean {
    // Let clicks fall through to CodeMirror so the cursor lands on the
    // fence line, which flips fence-active true and reveals the source.
    return false;
  }
}

export function makeLivePreviewExtension() {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state);
    },
    update(_value, tr) {
      return buildDecorations(tr.state);
    },
    provide: f => EditorView.decorations.from(f),
  });
}

function buildDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const blocks = parse(state.doc.toString());

  for (const b of blocks) {
    if (b.kind !== "matched") continue;

    // Parser is 0-indexed; CodeMirror is 1-indexed.
    const openLineNo = b.openLine + 1;
    const closeLineNo = b.closeLine + 1;
    if (openLineNo < 1 || closeLineNo > state.doc.lines) continue;

    if (cursorOrSelectionOverlapsBlock(state, openLineNo, closeLineNo)) {
      // Edit mode: leave the block entirely undecorated so every line —
      // including the closing `:::` — is visible and editable as raw
      // markdown.
      continue;
    }

    const primary = b.primaryClass;
    const baseClass = `ofd-cm-line ofd-cm-line-${primary}`;
    const bodyFirst = openLineNo + 1;
    const bodyLast = closeLineNo - 1;
    const hasBody = bodyFirst <= bodyLast;

    const openL = state.doc.line(openLineNo);
    const closeL = closeLineNo > openLineNo ? state.doc.line(closeLineNo) : null;

    // ----- Open fence line: replaced by title widget -----
    ranges.push(
      Decoration.line({
        class: `${baseClass} ofd-cm-line-open ofd-cm-line-fence`,
      }).range(openL.from),
    );
    if (openL.from < openL.to) {
      ranges.push(
        Decoration.replace({ widget: new FenceTitleWidget(primary) })
          .range(openL.from, openL.to),
      );
    }

    // ----- Body lines -----
    if (hasBody) {
      for (let n = bodyFirst; n <= bodyLast; n++) {
        if (n < 1 || n > state.doc.lines) continue;
        const line = state.doc.line(n);
        let cls = `${baseClass} ofd-cm-line-body`;
        // The last body line provides the bottom radius since the close
        // fence is always collapsed in this branch (cursor is outside).
        if (n === bodyLast) cls += " ofd-cm-line-body-bottom";
        ranges.push(Decoration.line({ class: cls }).range(line.from));
      }
    }

    // ----- Close fence line: collapsed to zero height -----
    if (closeL) {
      ranges.push(
        Decoration.line({
          class: `${baseClass} ofd-cm-line-close ofd-cm-line-fence`,
        }).range(closeL.from),
      );
      if (closeL.from < closeL.to) {
        ranges.push(Decoration.replace({}).range(closeL.from, closeL.to));
      }
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  return Decoration.set(ranges, true);
}

/**
 * True if the main cursor or any selection range touches any line from
 * openLineNo through closeLineNo (inclusive).
 */
function cursorOrSelectionOverlapsBlock(
  state: EditorState,
  openLineNo: number,
  closeLineNo: number,
): boolean {
  for (const r of state.selection.ranges) {
    const fromLine = state.doc.lineAt(r.from).number;
    const toLine = state.doc.lineAt(r.to).number;
    if (fromLine <= closeLineNo && toLine >= openLineNo) return true;
  }
  return false;
}
