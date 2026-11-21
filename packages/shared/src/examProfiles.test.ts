import { describe, expect, it } from "vitest";
import { defaultProfile, EXAM_PROFILE_KEYS, EXAM_PROFILES, isProfileKey, profilePrompt } from "./examProfiles";

describe("exam profiles", () => {
  it("has a complete profile for every key", () => {
    for (const key of EXAM_PROFILE_KEYS) {
      const p = EXAM_PROFILES[key];
      expect(p.key).toBe(key);
      expect(p.rules.length).toBeGreaterThan(2);
      expect(p.label_bn.length).toBeGreaterThan(0);
    }
  });
  it("only offers question generation for multiple-choice patterns", () => {
    expect(EXAM_PROFILES.wbchse_sem4.mcq).toBe(false);
    expect(EXAM_PROFILES.wbchse_sem3.mcq).toBe(true);
  });
  it("encodes the checked patterns", () => {
    expect(EXAM_PROFILES.neet.marksPerMcq).toBe(4);
    expect(profilePrompt("neet")).toMatch(/180 compulsory/);
    expect(profilePrompt("neet")).toMatch(/NCERT/);
    expect(profilePrompt("wbchse_sem3")).toMatch(/no negative marking/i);
    expect(profilePrompt("jee_main")).toMatch(/20 multiple-choice/);
  });
  it("does not claim NVQ negative marking for JEE Main, where reports differ", () => {
    expect(profilePrompt("jee_main")).toMatch(/official NTA bulletin/);
  });
  it("validates keys", () => {
    expect(isProfileKey("neet")).toBe(true);
    expect(isProfileKey("cbse_magic")).toBe(false);
    expect(isProfileKey(undefined)).toBe(false);
  });
});

describe("defaultProfile", () => {
  it("follows the student's stated goal first", () => {
    expect(defaultProfile({ goal: "neet", board: "WBCHSE", studentClass: "12" })).toBe("neet");
    expect(defaultProfile({ goal: "jee" })).toBe("jee_main");
  });
  it("uses the written Semester 4 style for WBCHSE Class 12 from November to March, MCQ Semester 3 style otherwise", () => {
    expect(defaultProfile({ board: "WBCHSE", studentClass: "12", month: 11 })).toBe("wbchse_sem4");
    expect(defaultProfile({ board: "WBCHSE", studentClass: "12", month: 2 })).toBe("wbchse_sem4");
    expect(defaultProfile({ board: "WBCHSE", studentClass: "12", month: 7 })).toBe("wbchse_sem3");
  });
  it("falls back to the general board profile when unsure", () => {
    expect(defaultProfile({ board: "CBSE", studentClass: "9" })).toBe("board_general");
    expect(defaultProfile({})).toBe("board_general");
  });
});
