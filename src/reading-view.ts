import { MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { parse, Block } from "./parser";
import { applyAttrs } from "./render";

const SHORT_OPEN_RE = /:{3,}[ \t]+([a-zA-Z][\w-]*)[ \t]*$/;
const ATTR_OPEN_RE = /:{3,}[ \t]*\{[^}]*\}[ \t]*$/;
const CLOSE_RE = /:{3,}[ \t]*$/;

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

  const isStart = info.lineStart <= b.openLine && info.lineEnd >= b.openLine;
  const isEnd = info.lineStart <= b.closeLine && info.lineEnd >= b.closeLine;
  const isMiddle = info.lineStart > b.openLine && info.lineEnd < b.closeLine;

  if (!isStart && !isEnd && !isMiddle) return;

  applyAttrs(el, b.primaryClass, b.attrs, "ofd-block");
  if (isStart && isEnd) el.classList.add("ofd-block-single");
  else if (isStart) el.classList.add("ofd-block-start");
  else if (isEnd) el.classList.add("ofd-block-end");
  else el.classList.add("ofd-block-middle");

  if (isStart) insertTitle(el, b.primaryClass);
  hideRawFenceText(el, isStart, isEnd);
}

/**
 * Add a callout-style title row at the top of the start section. CSS handles
 * the visual styling (bold, accent color, capitalization). Idempotent: a
 * second post-processor pass on the same element won't duplicate the title.
 */
function insertTitle(el: HTMLElement, primaryClass: string): void {
  if (el.querySelector(":scope > .ofd-block-title")) return;
  const title = document.createElement("div");
  title.className = "ofd-block-title";
  const inner = document.createElement("span");
  inner.className = "ofd-block-title-inner";
  inner.textContent = primaryClass;
  title.appendChild(inner);
  el.insertBefore(title, el.firstChild);
}

/**
 * Walk text nodes; replace literal `::: name` (start) and trailing `:::` (end)
 * with hidden spans so the rendered DOM doesn't show the raw fence markers.
 * Then collapse now-empty <p> wrappers (Obsidian wraps text in <p> by default).
 */
function hideRawFenceText(el: HTMLElement, isStart: boolean, isEnd: boolean): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);

  let startHandled = !isStart;
  let endHandled = !isEnd;

  for (const tn of nodes) {
    if (!startHandled) {
      const text = tn.textContent ?? "";
      const sm = SHORT_OPEN_RE.exec(text) || ATTR_OPEN_RE.exec(text);
      if (sm) {
        replaceWithHiddenSpan(tn, sm.index, sm[0].length);
        startHandled = true;
        continue;
      }
    }
    if (startHandled && !endHandled) {
      const text = tn.textContent ?? "";
      const em = CLOSE_RE.exec(text);
      if (em) {
        replaceWithHiddenSpan(tn, em.index, em[0].length);
        endHandled = true;
      }
    }
  }

  // Hide line-break siblings adjacent to .ofd-raw spans, and collapse empty <p> wrappers.
  el.querySelectorAll(".ofd-raw").forEach(span => {
    const prev = span.previousSibling;
    const next = span.nextSibling;
    if (prev && prev.nodeName === "BR") (prev as HTMLElement).style.display = "none";
    if (next && next.nodeName === "BR") (next as HTMLElement).style.display = "none";
    const p = span.parentElement;
    if (p && p.tagName === "P") {
      const onlyHidden = Array.from(p.childNodes).every(c => {
        if (c.nodeType === Node.TEXT_NODE) return (c.textContent ?? "").trim() === "";
        if (c.nodeName === "BR") return true;
        if (c instanceof HTMLElement && c.classList.contains("ofd-raw")) return true;
        return false;
      });
      if (onlyHidden) p.style.display = "none";
    }
  });
}

function replaceWithHiddenSpan(textNode: Text, index: number, length: number): void {
  const parent = textNode.parentNode;
  if (!parent) return;
  const text = textNode.textContent ?? "";
  const before = text.substring(0, index);
  const matched = text.substring(index, index + length);
  const after = text.substring(index + length);

  if (before) parent.insertBefore(document.createTextNode(before), textNode);
  const span = document.createElement("span");
  span.className = "ofd-raw";
  span.textContent = matched;
  parent.insertBefore(span, textNode);
  if (after) {
    textNode.textContent = after;
  } else {
    parent.removeChild(textNode);
  }
}
