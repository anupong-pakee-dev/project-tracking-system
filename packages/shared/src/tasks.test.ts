import { describe, expect, it } from "vitest";
import {
  categoriesIn,
  normalizeCategories,
  EMPTY_TASK_FILTER,
  isFilterActive,
  matchesTaskFilter,
  normalizeCategory,
  parseTaskLines,
} from "./tasks.ts";
import type { Task } from "./types.ts";

describe("normalizeCategory", () => {
  it("maps keys, labels and aliases to presets, ignoring case", () => {
    expect(normalizeCategory("Backend")).toBe("backend");
    expect(normalizeCategory("UX/UI")).toBe("uxui");
    expect(normalizeCategory("ux")).toBe("uxui");
    expect(normalizeCategory("QA")).toBe("testing");
    expect(normalizeCategory("แก้ Bug")).toBe("bug");
  });

  it("keeps custom text, tidied and capped at 40 characters", () => {
    expect(normalizeCategory("  Marketing   plan ")).toBe("Marketing plan");
    expect(normalizeCategory("x".repeat(50))).toHaveLength(40);
    expect(normalizeCategory("   ")).toBe("other");
  });
});

describe("normalizeCategories", () => {
  it("dedupes, caps at 5, and keeps Other only when alone", () => {
    expect(normalizeCategories(["Backend", "backend", "be"])).toEqual(["backend"]);
    expect(normalizeCategories(["other", "ux"])).toEqual(["uxui"]);
    expect(normalizeCategories([])).toEqual(["other"]);
    expect(normalizeCategories(["  ", ""])).toEqual(["other"]);
    expect(normalizeCategories(["a", "b", "c", "d", "e", "f"])).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("parseTaskLines", () => {
  it("reads title and size, defaulting to Other / COULD", () => {
    expect(parseTaskLines("ออกแบบ UI | 3\nDeploy\n\n")).toEqual([
      { title: "ออกแบบ UI", weight: 3, categories: ["other"], priority: "could" },
      { title: "Deploy", weight: 1, categories: ["other"], priority: "could" },
    ]);
  });

  it("reads tag and priority in any order, case-insensitive", () => {
    expect(parseTaskLines("Login | MUST | 2 | system\nหน้าแรก | ux | should")).toEqual([
      { title: "Login", weight: 2, categories: ["system"], priority: "must" },
      { title: "หน้าแรก", weight: 1, categories: ["uxui"], priority: "should" },
    ]);
  });

  it("takes any other text as a custom tag", () => {
    expect(parseTaskLines("Launch post | Marketing | must")).toEqual([
      { title: "Launch post", weight: 1, categories: ["Marketing"], priority: "must" },
    ]);
  });

  it("uses defaults only where a line doesn't say", () => {
    expect(parseTaskLines("A\nB | other | should", { categories: ["uxui"], priority: "must" })).toEqual([
      { title: "A", weight: 1, categories: ["uxui"], priority: "must" },
      { title: "B", weight: 1, categories: ["other"], priority: "should" },
    ]);
  });

  it("reads several tags, by comma or by more parts", () => {
    expect(parseTaskLines("A | ux, Backend | qa | must")).toEqual([
      { title: "A", weight: 1, categories: ["uxui", "backend", "testing"], priority: "must" },
    ]);
  });

  it("ignores bad sizes and lines without a title", () => {
    expect(parseTaskLines("A | 0 | -2\n| 3")).toEqual([{ title: "A", weight: 1, categories: ["other"], priority: "could" }]);
  });
});

describe("matchesTaskFilter", () => {
  const task: Task = {
    id: "t",
    projectId: "p",
    title: "ระบบ Login",
    description: "ใช้ Google OAuth",
    weight: 1,
    progress: 40,
    order: 0,
    categories: ["system", "backend"],
    priority: "must",
  };
  const f = (over: Partial<typeof EMPTY_TASK_FILTER>) => ({ ...EMPTY_TASK_FILTER, ...over });

  it("matches everything with the empty filter", () => {
    expect(matchesTaskFilter(task, EMPTY_TASK_FILTER)).toBe(true);
    expect(isFilterActive(EMPTY_TASK_FILTER)).toBe(false);
    expect(isFilterActive(f({ query: "  " }))).toBe(false);
  });

  it("searches title and description", () => {
    expect(matchesTaskFilter(task, f({ query: "Login" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ query: "oauth" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ query: "deploy" }))).toBe(false);
  });

  it("filters by tag (preset or custom), priority and status", () => {
    expect(matchesTaskFilter(task, f({ category: "system" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ category: "backend" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ category: "uxui" }))).toBe(false);
    expect(matchesTaskFilter({ ...task, categories: ["Marketing"] }, f({ category: "Marketing" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ priority: "must" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ priority: "could" }))).toBe(false);
    expect(matchesTaskFilter(task, f({ status: "open" }))).toBe(true);
    expect(matchesTaskFilter(task, f({ status: "done" }))).toBe(false);
    expect(matchesTaskFilter(task, f({ status: "done" }), 100)).toBe(true);
  });

  it("reads the single tag of an older API, and treats no priority as COULD", () => {
    const old = { ...task, categories: undefined, category: "uxui", priority: undefined } as unknown as Task;
    expect(matchesTaskFilter(old, f({ category: "uxui", priority: "could" }))).toBe(true);
  });

  it("lists tags in use: presets first, then custom A–Z", () => {
    const tasks = [["Zeta", "backend"], ["other"], ["Alpha", "backend"]].map((categories) => ({ ...task, categories }));
    expect(categoriesIn(tasks)).toEqual(["backend", "other", "Alpha", "Zeta"]);
  });
});
