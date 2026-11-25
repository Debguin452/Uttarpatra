import { normalizeAiText, parseMarkdown, type Block, type Inline } from "@coaching-app/shared/richText";

// Draws AI and teacher answers with real formatting: bold, numbered steps, lists,
// tables, readable maths. It builds elements from text, never from HTML, so
// nothing a model or a person types can inject markup.
function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) =>
        x.t === "bold" ? <strong key={i}>{x.v}</strong> : x.t === "italic" ? <em key={i}>{x.v}</em> : x.t === "code" ? <code key={i}>{x.v}</code> : x.v,
      )}
    </>
  );
}

function Item({ block }: { block: Extract<Block, { t: "ul" | "ol" }> }) {
  const List = block.t === "ol" ? "ol" : "ul";
  return (
    <List start={block.t === "ol" ? block.start : undefined}>
      {block.items.map((item, i) => (
        <li key={i} style={item.depth ? { marginLeft: `${item.depth * 16}px` } : undefined}>
          <Inlines items={item.inline} />
        </li>
      ))}
    </List>
  );
}

export function RichText({ text, class: className = "" }: { text: string; class?: string }) {
  const blocks = parseMarkdown(normalizeAiText(text));
  return (
    <div class={`rich ${className}`}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return (
              <p key={i}>
                <Inlines items={b.inline} />
              </p>
            );
          case "h":
            return (
              <p key={i} class="rich-h">
                <Inlines items={b.inline} />
              </p>
            );
          case "ul":
          case "ol":
            return <Item key={i} block={b} />;
          case "table":
            return (
              <div class="rich-table" key={i}>
                <table>
                  <thead>
                    <tr>
                      {b.header.map((cell, c) => (
                        <th key={c} style={b.align[c] ? { textAlign: b.align[c]! } : undefined}>
                          <Inlines items={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} style={b.align[c] ? { textAlign: b.align[c]! } : undefined}>
                            <Inlines items={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return <pre key={i}>{b.v}</pre>;
          case "quote":
            return (
              <blockquote key={i}>
                <Inlines items={b.inline} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} />;
        }
      })}
    </div>
  );
}
