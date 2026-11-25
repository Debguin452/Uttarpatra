// Makes AI (and teacher) text readable on a phone. Language models answer in
// Markdown and LaTeX; the app shows plain text, so "**bold**", "\frac{a}{b}" and
// "|tables|" used to appear as raw symbols. Two pure steps fix that:
//   latexToUnicode: x^{2}, \frac{a}{b}, \sqrt{x}, \Delta, H_2SO_4  ->  x², a/b, √x, Δ, H₂SO₄
//   parseMarkdown:  headings, lists, bold, tables, code -> blocks the app draws safely
// Nothing here produces HTML: the app only ever draws text.

const SYMBOLS: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", sim: "∼", infty: "∞", rightarrow: "→", to: "→", leftarrow: "←", Rightarrow: "⇒",
  Leftarrow: "⇐", leftrightarrow: "↔", Leftrightarrow: "⇔", rightleftharpoons: "⇌", propto: "∝", degree: "°",
  circ: "°", ldots: "…", dots: "…", cdots: "⋯", int: "∫", oint: "∮", sum: "∑", prod: "∏", partial: "∂",
  nabla: "∇", angle: "∠", perp: "⊥", parallel: "∥", therefore: "∴", because: "∵", in: "∈", subset: "⊂",
  cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", uparrow: "↑", downarrow: "↓", hbar: "ħ",
  ell: "ℓ", prime: "′", lt: "<", gt: ">", ast: "∗", bullet: "•", mid: "|", langle: "⟨", rangle: "⟩",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ",
  e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ",
  u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ",
  l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

function script(text: string, map: Record<string, string>, mark: "^" | "_"): string {
  const t = text.trim();
  if (t && [...t].every((ch) => map[ch] !== undefined)) return [...t].map((ch) => map[ch]).join("");
  return `${mark}(${t})`;
}

// Only a plain number or a single symbol can stand without brackets: "2a" or "ab"
// beside a slash would read as "divide by 2, then times a".
const isSimple = (s: string) => /^(\d+(\.\d+)?|\p{L}[\u00B2\u00B3\u00B9\u2070-\u209F]*)$/u.test(s.trim());
const group = (s: string) => (isSimple(s) ? s.trim() : `(${s.trim()})`);

/** Converts the maths inside one span (no delimiters) to plain Unicode text. */
function mathToText(input: string): string {
  let s = input;

  // text-like wrappers keep their contents
  s = s.replace(/\\(?:text|textbf|textit|mathrm|mathbf|mathit|mathsf|operatorname|boldsymbol)\s*\{([^{}]*)\}/g, "$1");

  // chemistry: \ce{H2SO4 -> ...}: digits after an element or bracket become subscripts
  s = s.replace(/\\ce\s*\{([^{}]*)\}/g, (_, body: string) =>
    body
      .replace(/<=>/g, "⇌")
      .replace(/<->/g, "↔")
      .replace(/->/g, "→")
      .replace(/(?<=[A-Za-z)\]])(\d+)/g, (d: string) => [...d].map((x) => SUB[x]!).join("")),
  );

  // innermost-first so nesting works
  for (let guard = 0; guard < 12; guard++) {
    const before = s;
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => `${group(a)}/${group(b)}`);
    s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_, n: string, x: string) => `${script(n, SUP, "^")}√${group(x)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, x: string) => `√${group(x)}`);
    s = s.replace(/\\vec\s*\{([^{}]*)\}/g, "$1\u20D7");
    s = s.replace(/\\hat\s*\{([^{}]*)\}/g, "$1\u0302");
    s = s.replace(/\\(?:bar|overline)\s*\{([^{}]*)\}/g, "$1\u0304");
    s = s.replace(/\^\s*\{([^{}]*)\}/g, (_, x: string) => script(x, SUP, "^"));
    s = s.replace(/_\s*\{([^{}]*)\}/g, (_, x: string) => script(x, SUB, "_"));
    if (s === before) break;
  }
  s = s.replace(/\^\s*(\\circ|°)/g, "°");
  s = s.replace(/\^\s*([0-9n+\-−])/g, (_, x: string) => SUP[x] ?? `^${x}`);
  s = s.replace(/(?<=[A-Za-z0-9)\]])_\s*([0-9])/g, (_, x: string) => SUB[x] ?? `_${x}`);

  s = s
    .replace(/\\(?:left|right)(?![A-Za-z])\s*/g, "")
    .replace(/\\[,;:! ]|\\quad|\\qquad/g, " ")
    .replace(/\\([%&_#${}])/g, "$1")
    .replace(/\\\\/g, " ")
    .replace(/\\([A-Za-z]+)/g, (whole, name: string) => SYMBOLS[name] ?? whole);
  return s.replace(/[{}]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** Turns LaTeX in AI text into readable Unicode. Text outside maths is left alone. */
export function latexToUnicode(text: string): string {
  let s = text;
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `\n${mathToText(m)}\n`);
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n${mathToText(m)}\n`);
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => mathToText(m));
  // $...$ only when it clearly holds maths, so prices like "$5 and $6" survive
  s = s.replace(/\$([^$\n]+?)\$/g, (whole, m: string) => (/[\\^_{}]/.test(m) ? mathToText(m) : whole));
  // maths the model forgot to wrap
  if (/\\[A-Za-z]+/.test(s) || /\^\{|_\{/.test(s)) s = mathToText(s);
  return s;
}

/** Cleans a raw model reply: no reasoning tags, no LaTeX, tidy spacing. */
export function normalizeAiText(raw: string): string {
  return latexToUnicode(
    raw
      .replace(/\r\n?/g, "\n")
      .replace(/<(think|thinking|analysis|reasoning)>[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/?(think|thinking|analysis|reasoning|final|answer)>/gi, ""),
  )
    .replace(/^[ \t]*[•◦▪]\s+/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Markdown ---------------------------------------------------------------

export type Inline = { t: "text" | "bold" | "italic" | "code"; v: string };
type Item = { depth: number; inline: Inline[] };
export type Block =
  | { t: "p"; inline: Inline[] }
  | { t: "h"; level: number; inline: Inline[] }
  | { t: "ul"; items: Item[] }
  | { t: "ol"; start: number; items: Item[] }
  | { t: "table"; header: Inline[][]; rows: Inline[][][]; align: Array<"left" | "center" | "right" | null> }
  | { t: "code"; v: string }
  | { t: "quote"; inline: Inline[] }
  | { t: "hr" };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]*\)/g, "$1");
  const rule = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|(?<![\p{L}\p{N}*])\*([^*\s][^*]*?)\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}_])_([^_\s][^_]*?)_(?![\p{L}\p{N}_]))/u;
  while (rest) {
    const m = rule.exec(rest);
    if (!m) break;
    if (m.index > 0) out.push({ t: "text", v: rest.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ t: "bold", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "bold", v: m[3] });
    else if (m[4] !== undefined) out.push({ t: "code", v: m[4] });
    else out.push({ t: "italic", v: (m[5] ?? m[6])! });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ t: "text", v: rest });
  return out.length ? out : [{ t: "text", v: "" }];
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i++]!);
      i++;
      blocks.push({ t: "code", v: body.join("\n") });
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ t: "h", level: Math.min(h[1]!.length, 4), inline: parseInline(h[2]!.replace(/\s+#+\s*$/, "")) });
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1]!)) {
      const header = splitRow(line).map(parseInline);
      const align = splitRow(lines[i + 1]!).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : null));
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim()) rows.push(splitRow(lines[i++]!).map(parseInline));
      blocks.push({ t: "table", header, rows, align });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", inline: parseInline(body.join("\n")) });
      continue;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/;
    const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const start = ordered ? Number(numbered.exec(line)![2]) : 1;
      const items: Item[] = [];
      while (i < lines.length) {
        const b = bullet.exec(lines[i]!);
        const n = numbered.exec(lines[i]!);
        const hit = ordered ? (n ? { indent: n[1]!, text: n[3]! } : null) : b ? { indent: b[1]!, text: b[2]! } : null;
        const nested = ordered ? (b ? { indent: b[1]!, text: b[2]! } : null) : n ? { indent: n[1]!, text: n[3]! } : null;
        const chosen = hit ?? (nested && nested.indent.length > 0 ? nested : null);
        if (!chosen) {
          // a wrapped line belonging to the previous item
          if (items.length && /^\s{2,}\S/.test(lines[i]!) && lines[i]!.trim()) {
            items[items.length - 1]!.inline.push({ t: "text", v: ` ${lines[i]!.trim()}` });
            i++;
            continue;
          }
          break;
        }
        items.push({ depth: Math.min(Math.floor(chosen.indent.length / 2), 2), inline: parseInline(chosen.text) });
        i++;
      }
      blocks.push(ordered ? { t: "ol", start, items } : { t: "ul", items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|\s*```|\s*>|\s*[-*+]\s+|\s*\d+[.)]\s+)/.test(lines[i]!) &&
      !(lines[i]!.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1]!))
    ) {
      para.push(lines[i++]!);
    }
    if (para.length === 0) {
      para.push(lines[i++]!);
    }
    blocks.push({ t: "p", inline: parseInline(para.join("\n")) });
  }
  return blocks;
}

/** Plain text with the Markdown marks removed, for places that cannot draw formatting (push previews, short lists). */
export function toPlainText(source: string): string {
  const flat = (inline: Inline[]) => inline.map((x) => x.v).join("");
  return parseMarkdown(normalizeAiText(source))
    .map((b) => {
      switch (b.t) {
        case "p":
        case "quote":
        case "h":
          return flat(b.inline);
        case "ul":
        case "ol":
          return b.items.map((it, n) => `${b.t === "ol" ? `${(b.start ?? 1) + n}.` : "-"} ${flat(it.inline)}`).join("\n");
        case "table":
          return [b.header, ...b.rows].map((row) => row.map(flat).join(" | ")).join("\n");
        case "code":
          return b.v;
        case "hr":
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
