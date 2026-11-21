import { describe, expect, it } from "vitest";
import { extractText } from "./ai";

describe("extractText", () => {
  it("reads every response shape Workers AI models use", () => {
    expect(extractText("plain")).toBe("plain");
    expect(extractText({ response: "classic" })).toBe("classic");
    expect(extractText({ output_text: "responses api" })).toBe("responses api");
    expect(extractText({ choices: [{ message: { content: "chat" } }] })).toBe("chat");
  });

  it("takes only the answer from a Responses-style reply, not the model's reasoning", () => {
    const reply = {
      output: [
        { type: "reasoning", content: [{ type: "reasoning_text", text: "thinking out loud" }] },
        { type: "message", content: [{ type: "output_text", text: "The answer is 4." }] },
      ],
    };
    expect(extractText(reply)).toBe("The answer is 4.");
  });

  it("gives an empty string for anything unexpected", () => {
    for (const value of [null, undefined, 42, {}, { output: "nope" }, { choices: [] }]) expect(extractText(value)).toBe("");
  });
});
