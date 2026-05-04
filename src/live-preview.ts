import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { EditorState, Range, StateField } from "@codemirror/state";
import { App, Component, MarkdownRenderer } from "obsidian";
import { parse, Block, ParsedAttrs } from "./parser";
import { applyAttrs } from "./render";

class FencedDivWidget extends WidgetType {
  constructor(
    private readonly app: App,
    private readonly component: Component,
    private readonly primaryClass: string,
    private readonly attrs: ParsedAttrs,
    private readonly bodyMarkdown: string,
    private readonly sourcePath: string,
    private readonly cursorLandingPos: number,
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const outer = document.createElement("div");
    outer.className = "ofd-cm-callout-wrapper";

    const wrap = document.createElement("div");
    applyAttrs(wrap, this.primaryClass, this.attrs, "ofd-cm-block");

    if (this.bodyMarkdown.length > 0) {
      const body = document.createElement("div");
      body.className = `ofd-cm-body ofd-cm-body-${this.primaryClass}`;
      void MarkdownRenderer.render(
        this.app,
        this.bodyMarkdown,
        body,
        this.sourcePath,
        this.component,
      );
      wrap.appendChild(body);
    }

    wrap.addEventListener("click", e => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea")) return;
      e.preventDefault();
      view.dispatch({
        selection: { anchor: this.cursorLandingPos },
        scrollIntoView: false,
      });
      view.focus();
    });

    outer.appendChild(wrap);
    return outer;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "click";
  }

  eq(other: FencedDivWidget): boolean {
    return (
      other.primaryClass === this.primaryClass &&
      other.bodyMarkdown === this.bodyMarkdown &&
      other.cursorLandingPos === this.cursorLandingPos &&
      sameAttrs(other.attrs, this.attrs)
    );
  }
}

function sameAttrs(a: ParsedAttrs, b: ParsedAttrs): boolean {
  if (a.id !== b.id) return false;
  if (a.classes.length !== b.classes.length) return false;
  for (let i = 0; i < a.classes.length; i++) {
    if (a.classes[i] !== b.classes[i]) return false;
  }
  const ak = Object.keys(a.data), bk = Object.keys(b.data);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a.data[k] !== b.data[k]) return false;
  return true;
}

export function makeLivePreviewExtension(opts: {
  app: App;
  component: Component;
  getSourcePath: () => string;
}) {
  const { app, component, getSourcePath } = opts;
  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, app, component, getSourcePath());
    },
    update(_value, tr) {
      return buildDecorations(tr.state, app, component, getSourcePath());
    },
    provide: f => EditorView.decorations.from(f),
  });
}

function buildDecorations(
  state: EditorState,
  app: App,
  component: Component,
  sourcePath: string,
): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const blocks = parse(state.doc.toString());
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const selRanges = state.selection.ranges;

  for (const b of blocks) {
    if (b.kind !== "matched") continue;

    // Parser uses 0-indexed lines; CodeMirror uses 1-indexed.
    const openLineNo = b.openLine + 1;
    const closeLineNo = b.closeLine + 1;
    if (openLineNo < 1 || closeLineNo > state.doc.lines) continue;

    const openL = state.doc.line(openLineNo);
    const closeL = state.doc.line(closeLineNo);

    const inside = isCursorInside(openLineNo, closeLineNo, cursorLine, selRanges, state);

    if (!inside) {
      let bodyMarkdown = "";
      if (openLineNo + 1 <= closeLineNo - 1) {
        const startOffset = state.doc.line(openLineNo + 1).from;
        const endOffset = state.doc.line(closeLineNo - 1).to;
        bodyMarkdown = state.doc.sliceString(startOffset, endOffset);
      }
      const cursorLandingPos = openL.to;
      const widget = new FencedDivWidget(
        app,
        component,
        b.primaryClass,
        b.attrs,
        bodyMarkdown,
        sourcePath,
        cursorLandingPos,
      );
      const fromOffset = openL.from;
      const toOffset = closeL.number === state.doc.lines ? closeL.to : closeL.to + 1;
      ranges.push(Decoration.replace({ widget, block: true }).range(fromOffset, toOffset));
    } else {
      const bodyClass = `ofd-cm-body ofd-cm-body-${b.primaryClass}`;
      for (let n = openLineNo + 1; n <= closeLineNo - 1; n++) {
        if (n < 1 || n > state.doc.lines) continue;
        const line = state.doc.line(n);
        ranges.push(Decoration.line({ class: bodyClass }).range(line.from));
      }
      ranges.push(Decoration.line({ class: "ofd-cm-fence" }).range(openL.from));
      ranges.push(Decoration.line({ class: "ofd-cm-fence" }).range(closeL.from));
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  return Decoration.set(ranges, true);
}

function isCursorInside(
  openLineNo: number,
  closeLineNo: number,
  cursorLine: number,
  selRanges: readonly { from: number; to: number }[],
  state: EditorState,
): boolean {
  if (cursorLine >= openLineNo && cursorLine <= closeLineNo) return true;
  for (const r of selRanges) {
    const fromLine = state.doc.lineAt(r.from).number;
    const toLine = state.doc.lineAt(r.to).number;
    if (toLine >= openLineNo && fromLine <= closeLineNo) return true;
  }
  return false;
}
