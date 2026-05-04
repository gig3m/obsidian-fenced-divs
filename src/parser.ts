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
  /**
   * First line of the body (inclusive). For an empty matched block
   * (`::: name\n:::`), bodyStart > bodyEnd; renderers must treat this as
   * an empty range. For unmatched, bodyStart equals openLine.
   */
  bodyStart: number;
  /** Last line of the body (inclusive). See bodyStart for the empty-range contract. */
  bodyEnd: number;
}

const SHORT_OPEN_RE = /^[ \t]*:{3,}[ \t]+([a-zA-Z][\w-]*)[ \t]*$/;
const ATTR_OPEN_RE = /^[ \t]*:{3,}[ \t]*\{([^}]*)\}[ \t]*$/;
const CLOSE_RE = /^[ \t]*:{3,}[ \t]*$/;
const CODE_FENCE_RE = /^[ \t]*(```|~~~)/;
const BLOCKQUOTE_RE = /^[ \t]*>/;

export function parseAttrs(raw: string): ParsedAttrs {
  const ATTR_RE = /\.([\w-]+)|#([\w-]+)|([\w-]+)=(?:"([^"]*)"|(\S+))/g;
  const out: ParsedAttrs = { classes: [], data: {} };
  if (!raw) return out;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    if (m[1]) out.classes.push(m[1]);
    else if (m[2]) out.id = m[2];
    else if (m[3]) {
      const value = m[4] !== undefined ? m[4] : (m[5] ?? "");
      out.data[m[3]] = value;
    }
  }
  return out;
}

export function parse(text: string): Block[] {
  const lines = text.split("\n");
  const out: Block[] = [];
  type Open = { primaryClass: string; attrs: ParsedAttrs; openLine: number };
  let open: Open | null = null;
  let depth = 0;
  let inCode: false | "```" | "~~~" = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cm = CODE_FENCE_RE.exec(line);
    if (cm) {
      const fence = cm[1] as "```" | "~~~";
      if (!inCode) inCode = fence;
      else if (inCode === fence) inCode = false;
      continue;
    }
    if (inCode) continue;

    if (BLOCKQUOTE_RE.test(line)) continue;

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
      const primary = sm[1];
      open = {
        primaryClass: primary,
        attrs: { classes: [primary], data: {} },
        openLine: i,
      };
      depth = 0;
      continue;
    }

    const am = ATTR_OPEN_RE.exec(line);
    if (am) {
      const attrs = parseAttrs(am[1]);
      if (attrs.classes.length === 0) continue;
      open = {
        primaryClass: attrs.classes[0],
        attrs,
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
