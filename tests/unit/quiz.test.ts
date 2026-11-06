import { describe, expect, it } from "vitest";
import { questionFromForm, quizSettingsSchema } from "@/modules/courses/quiz";

const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.set(k, v); return fd; };

describe("question form", () => {
  it("keeps filled answers and the chosen correct one", () => {
    const r = questionFromForm(form({ prompt: "What is a verb?", option_1: "Ism", option_2: "Fi'l", option_4: "Harf", correct: "2" }));
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.options.map((o) => o.label)).toEqual(["Ism", "Fi'l", "Harf"]); expect(r.data.correct).toBe(2); }
  });
  it("needs two answers", () => {
    expect(questionFromForm(form({ prompt: "Only one?", option_1: "Yes", correct: "1" })).success).toBe(false);
  });
  it("rejects a correct answer that was left blank", () => {
    expect(questionFromForm(form({ prompt: "Blank key?", option_1: "A", option_2: "B", correct: "3" })).success).toBe(false);
  });
  it("rejects a missing question", () => {
    expect(questionFromForm(form({ prompt: " ", option_1: "A", option_2: "B", correct: "1" })).success).toBe(false);
  });
});

describe("quiz settings", () => {
  it("accepts a pass mark from 1 to 100 only", () => {
    expect(quizSettingsSchema.safeParse({ title: "Check", pass_percent: "70" }).success).toBe(true);
    expect(quizSettingsSchema.safeParse({ title: "Check", pass_percent: "0" }).success).toBe(false);
    expect(quizSettingsSchema.safeParse({ title: "Check", pass_percent: "101" }).success).toBe(false);
    expect(quizSettingsSchema.safeParse({ title: "Check", pass_percent: "abc" }).success).toBe(false);
  });
});
