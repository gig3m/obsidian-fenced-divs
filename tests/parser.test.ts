import { describe, it, expect } from "vitest";
import { parse, parseAttrs } from "../src/parser";

describe("parse — class-only short form", () => {
  it("matches ::: name with single space", () => {
    const result = parse(["::: note", "body", ":::"].join("\n"));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "matched",
      primaryClass: "note",
      openLine: 0,
      closeLine: 2,
      bodyStart: 1,
      bodyEnd: 1,
    });
    expect(result[0].attrs.classes).toEqual(["note"]);
  });

  it("tolerates extra spaces between ::: and class name", () => {
    const result = parse(":::    scripture\nbody\n:::");
    expect(result).toHaveLength(1);
    expect(result[0].primaryClass).toBe("scripture");
  });

  it("does NOT match :::name (no space)", () => {
    expect(parse(":::note\nbody\n:::")).toEqual([]);
  });

  it("does NOT match ::: alone (no class)", () => {
    expect(parse(":::\nbody\n:::")).toEqual([]);
  });
});

describe("parse — attribute long form", () => {
  it("matches :::{.name}", () => {
    const result = parse(":::{.scripture}\nbody\n:::");
    expect(result).toHaveLength(1);
    expect(result[0].primaryClass).toBe("scripture");
    expect(result[0].attrs.classes).toEqual(["scripture"]);
  });

  it("matches ::: {.name} (leading space)", () => {
    const result = parse("::: {.scripture}\nbody\n:::");
    expect(result).toHaveLength(1);
    expect(result[0].primaryClass).toBe("scripture");
  });

  it("captures id", () => {
    const result = parse(":::{.warning #w1}\nbody\n:::");
    expect(result[0].attrs.id).toBe("w1");
  });

  it("captures data attributes (key=val and key=\"val\")", () => {
    const result = parse(':::{.note lang=en title="The Intro"}\nbody\n:::');
    expect(result[0].attrs.data).toEqual({ lang: "en", title: "The Intro" });
  });

  it("multiple classes — first is primary, all are recorded", () => {
    const result = parse(":::{.scripture .featured}\nbody\n:::");
    expect(result[0].primaryClass).toBe("scripture");
    expect(result[0].attrs.classes).toEqual(["scripture", "featured"]);
  });

  it("rejects attribute form with no class", () => {
    expect(parse(":::{#foo lang=en}\nbody\n:::")).toEqual([]);
  });
});

describe("parseAttrs", () => {
  it("returns empty for empty input", () => {
    expect(parseAttrs("")).toEqual({ classes: [], data: {} });
  });

  it("parses mixed form", () => {
    expect(parseAttrs('.a #b .c lang=en title="t"')).toEqual({
      classes: ["a", "c"],
      id: "b",
      data: { lang: "en", title: "t" },
    });
  });
});

describe("parse — body shapes", () => {
  it("empty body: bodyEnd < bodyStart", () => {
    const result = parse("::: note\n:::");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "matched",
      openLine: 0,
      closeLine: 1,
      bodyStart: 1,
      bodyEnd: 0,
    });
  });

  it("multi-line body", () => {
    const result = parse(["::: note", "line 1", "", "line 3", ":::"].join("\n"));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ openLine: 0, closeLine: 4, bodyStart: 1, bodyEnd: 3 });
  });

  it("multiple sequential blocks", () => {
    const text = [
      "::: note", "first", ":::",
      "",
      ":::{.warning}", "second", ":::",
    ].join("\n");
    const result = parse(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ primaryClass: "note", openLine: 0, closeLine: 2 });
    expect(result[1]).toMatchObject({ primaryClass: "warning", openLine: 4, closeLine: 6 });
  });
});

describe("parse — immunity", () => {
  it("ignores ::: inside ``` fenced code", () => {
    const text = ["```markdown", "::: note", "trapped", ":::", "```"].join("\n");
    expect(parse(text)).toEqual([]);
  });

  it("ignores ::: inside ~~~ fenced code", () => {
    const text = ["~~~", "::: warning", "trapped", ":::", "~~~"].join("\n");
    expect(parse(text)).toEqual([]);
  });

  it("ignores ::: inside blockquotes", () => {
    const text = ["> ::: note", "> body", "> :::"].join("\n");
    expect(parse(text)).toEqual([]);
  });

  it("matches a directive that surrounds a fenced code block", () => {
    const text = ["::: note", "before", "```", "code", "```", "after", ":::"].join("\n");
    const result = parse(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ openLine: 0, closeLine: 6 });
  });
});

describe("parse — edge cases", () => {
  it("returns kind=unmatched for unclosed fence", () => {
    const result = parse("::: note\nbody without close");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("unmatched");
    expect(result[0].primaryClass).toBe("note");
  });

  it("treats inner directive as plain text inside outer body (depth-aware)", () => {
    const text = [
      "::: note",       // 0
      "before",         // 1
      "::: warning",   // 2 — inner depth +1
      "inner body",   // 3
      ":::",          // 4 — inner closes depth
      "after",        // 5
      ":::",          // 6 — outer close
    ].join("\n");
    const result = parse(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      primaryClass: "note",
      openLine: 0,
      closeLine: 6,
      bodyStart: 1,
      bodyEnd: 5,
    });
  });

  it("handles ≥4 colons (:::: name ... ::::)", () => {
    const text = [":::: note", "body", "::::"].join("\n");
    const result = parse(text);
    expect(result).toHaveLength(1);
    expect(result[0].primaryClass).toBe("note");
  });

  it("matches arbitrary class names (no registry to gate)", () => {
    const result = parse("::: pericope-marker\nbody\n:::");
    expect(result).toHaveLength(1);
    expect(result[0].primaryClass).toBe("pericope-marker");
  });
});
