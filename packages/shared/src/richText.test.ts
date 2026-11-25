import { describe, expect, it } from "vitest";
import { latexToUnicode, normalizeAiText, parseInline, parseMarkdown, toPlainText } from "./richText";

describe("latexToUnicode", () => {
  const cases: Array<[string, string]> = [
    ["The force is \\(F = m \\times a\\).", "The force is F = m × a."],
    ["$v^{2} = u^{2} + 2as$", "v² = u² + 2as"],
    ["\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]", "\nx = (-b ± √(b² - 4ac))/(2a)\n"],
    ["\\(\\Delta H = -286\\ \\text{kJ/mol}\\)", "Δ H = -286 kJ/mol"],
    ["\\( \\frac{1}{2} m v^2 \\)", "1/2 m v²"],
    ["\\( \\alpha + \\beta \\rightarrow \\gamma \\)", "α + β → γ"],
    ["\\(x_{1} + x_{2}\\)", "x₁ + x₂"],
    ["\\(10^{-3}\\)", "10⁻³"],
    ["\\(\\ce{H2SO4}\\)", "H₂SO₄"],
    ["\\(\\ce{2H2 + O2 -> 2H2O}\\)", "2H₂ + O₂ → 2H₂O"],
    ["\\(90^\\circ\\)", "90°"],
    ["\\(\\vec{F}\\)", "F\u20D7"],
    ["\\(\\sqrt{2}\\)", "√2"],
    ["\\(\\sqrt[3]{x}\\)", "³√x"],
    ["\\(a \\leq b \\neq c\\)", "a ≤ b ≠ c"],
  ];
  it.each(cases)("%s", (input, expected) => {
    expect(latexToUnicode(input)).toBe(expected);
  });

  it("leaves ordinary text, prices and Bengali alone", () => {
    expect(latexToUnicode("It costs $5 and $6 today.")).toBe("It costs $5 and $6 today.");
    expect(latexToUnicode("জলের pH = 7 এবং Δx → 0")).toBe("জলের pH = 7 এবং Δx → 0");
    expect(latexToUnicode("Class 12 Chemistry")).toBe("Class 12 Chemistry");
  });
  it("falls back to a readable form when a script has no Unicode symbol", () => {
    expect(latexToUnicode("\\(x^{q}\\)")).toContain("x^(q)");
  });
  it("handles maths the model forgot to wrap", () => {
    expect(latexToUnicode("so \\frac{a}{b} is half")).toBe("so a/b is half");
  });
});

describe("normalizeAiText", () => {
  it("removes reasoning tags and tidies spacing and bullets", () => {
    const raw = "<think>hmm</think>\r\nStep one   \r\n\r\n\r\n\r\n• Next\r\n";
    expect(normalizeAiText(raw)).toBe("Step one\n\n- Next");
  });
});

describe("parseInline", () => {
  it("finds bold, italic and code, and keeps plain text", () => {
    expect(parseInline("a **b** c *d* `e`")).toEqual([
      { t: "text", v: "a " }, { t: "bold", v: "b" }, { t: "text", v: " c " }, { t: "italic", v: "d" }, { t: "text", v: " " }, { t: "code", v: "e" },
    ]);
  });
  it("does not mistake snake_case, subscripts or multiplication for emphasis", () => {
    expect(parseInline("use my_var_name here")).toEqual([{ t: "text", v: "use my_var_name here" }]);
    expect(parseInline("2 * 3 * 4")).toEqual([{ t: "text", v: "2 * 3 * 4" }]);
  });
  it("shows a link's words and drops the address", () => {
    expect(parseInline("[the book](https://x.y/z)")).toEqual([{ t: "text", v: "the book" }]);
  });
});

describe("parseMarkdown", () => {
  it("reads headings, paragraphs, lists and rules", () => {
    const blocks = parseMarkdown("## Steps\n\n1. First\n2. Second\n\n- a\n- b\n\n---\n\nDone.");
    expect(blocks.map((b) => b.t)).toEqual(["h", "ol", "ul", "hr", "p"]);
    expect(blocks[1]).toMatchObject({ t: "ol", start: 1 });
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
  });
  it("reads a table with alignment", () => {
    const [t] = parseMarkdown("| Name | Value |\n|:--|--:|\n| g | 9.8 |\n| c | 3e8 |");
    expect(t).toMatchObject({ t: "table", align: ["left", "right"] });
    expect((t as { rows: unknown[] }).rows).toHaveLength(2);
  });
  it("reads code fences without touching what is inside", () => {
    expect(parseMarkdown("```\nx = **1**\n```")).toEqual([{ t: "code", v: "x = **1**" }]);
  });
  it("keeps a numbered list that continues across wrapped lines", () => {
    const [ol] = parseMarkdown("1. Write the formula\n   then substitute\n2. Solve");
    expect((ol as { items: unknown[] }).items).toHaveLength(2);
  });
  it("starts a numbered list at its own number", () => {
    expect(parseMarkdown("3. third\n4. fourth")[0]).toMatchObject({ t: "ol", start: 3 });
  });
  it("never throws on odd input", () => {
    for (const s of ["", "   ", "|", "```", "#", "> ", "- ", "1.", "| a |\n|---|", "**", "_ _"]) expect(() => parseMarkdown(s)).not.toThrow();
  });
});

describe("toPlainText", () => {
  it("strips the marks for places that cannot show formatting", () => {
    expect(toPlainText("**Answer:** \\(x^2\\)\n\n- one\n- two")).toBe("Answer: x²\n\n- one\n- two");
  });
});

describe("a realistic model reply", () => {
  const reply = [
    "### Solution",
    "",
    "We use the equation of motion \\(v^{2} = u^{2} + 2as\\).",
    "",
    "1. Given: \\(u = 0\\ \\text{m/s}\\), \\(a = 2\\ \\text{m/s}^2\\), \\(s = 25\\ \\text{m}\\).",
    "2. Substitute: \\(v^{2} = 0 + 2 \\times 2 \\times 25 = 100\\).",
    "3. So \\(v = \\sqrt{100} = 10\\ \\text{m/s}\\).",
    "",
    "| Quantity | Value |",
    "|---|---|",
    "| Initial speed | 0 m/s |",
    "| Final speed | **10 m/s** |",
    "",
    "**Answer:** the final speed is \\(10\\ \\text{m/s}\\).",
  ].join("\n");

  it("comes out as readable text with no LaTeX left", () => {
    const clean = normalizeAiText(reply);
    expect(clean).not.toMatch(/\\|\$/);
    expect(clean).toContain("v² = u² + 2as");
    expect(clean).toContain("a = 2 m/s²");
    expect(clean).toContain("v = √100 = 10 m/s");
  });

  it("is drawn as a heading, numbered steps, a table and a final answer", () => {
    const blocks = parseMarkdown(normalizeAiText(reply));
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "ol", "table", "p"]);
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(3);
    expect((blocks[3] as { rows: unknown[] }).rows).toHaveLength(2);
  });

  it("handles a Bengali reply with a chemical equation", () => {
    const bn = "**উত্তর:** জল তৈরি হয়।\n\n1. বিক্রিয়া: \\(\\ce{2H2 + O2 -> 2H2O}\\)\n2. তাপ: \\(\\Delta H = -286\\ \\text{kJ/mol}\\)";
    const clean = normalizeAiText(bn);
    expect(clean).toContain("2H₂ + O₂ → 2H₂O");
    expect(clean).toContain("Δ H = -286 kJ/mol");
    expect(parseMarkdown(clean).map((b) => b.t)).toEqual(["p", "ol"]);
  });
});
