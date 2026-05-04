import { ParsedAttrs } from "./parser";

export type ClassPrefix = "ofd-block" | "ofd-cm-block";

export function applyAttrs(
  el: HTMLElement,
  primary: string,
  attrs: ParsedAttrs,
  prefix: ClassPrefix,
): void {
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
