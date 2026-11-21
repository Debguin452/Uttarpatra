import { describe, expect, it } from "vitest";
import { extractYouTubeId } from "./schema";

describe("extractYouTubeId", () => {
  it("accepts a bare video id", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a watch url, with or without extra query params", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=xyz")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a youtu.be short link", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=5")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from embed, shorts and live paths", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("trims surrounding whitespace", () => {
    expect(extractYouTubeId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects an unrelated url", () => {
    expect(extractYouTubeId("https://vimeo.com/dQw4w9WgXcQ")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(extractYouTubeId("not a link")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
  });
});
