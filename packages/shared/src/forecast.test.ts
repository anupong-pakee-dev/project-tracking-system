import { describe, expect, it } from "vitest";
import { addDays, addWorkdays, daysBetween, todayISO, workdaysBetween } from "./dates.ts";
import { buildSeries, computeProgress, forecastProject, progressAt } from "./forecast.ts";
import type { ProgressLog, Project, Task } from "./types.ts";

const TODAY = "2026-10-02";

function project(over: Partial<Project> = {}): Project {
  return {
    id: "p",
    name: "Test",
    description: "",
    color: "#000",
    startDate: addDays(TODAY, -20),
    targetDate: addDays(TODAY, 20),
    status: "active",
    skipWeekends: false,
    manualProgress: 0,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function task(progress: number, weight = 1, id = String(Math.random())): Task {
  return { id, projectId: "p", title: id, description: "", weight, progress, order: 0, categories: ["other"], priority: "could" };
}

function log(daysAgo: number, progress: number, i = 0): ProgressLog {
  return {
    id: `l${daysAgo}-${i}`,
    projectId: "p",
    date: addDays(TODAY, -daysAgo),
    progress,
    note: "",
    kind: "update",
    createdAt: new Date(Date.parse(`${addDays(TODAY, -daysAgo)}T12:00:00Z`) + i).toISOString(),
  };
}

describe("computeProgress", () => {
  it("weights task progress by effort", () => {
    expect(computeProgress(project(), [task(100, 3), task(0, 1)])).toBe(75);
  });
  it("falls back to manual progress without tasks", () => {
    expect(computeProgress(project({ manualProgress: 42 }), [])).toBe(42);
  });
  it("treats all-zero weights as equal weights", () => {
    expect(computeProgress(project(), [task(100, 0), task(0, 0)])).toBe(50);
  });
});

describe("buildSeries / progressAt", () => {
  it("anchors at 0% on the start date and ends at today", () => {
    const p = project();
    const s = buildSeries(p, [log(10, 30)], 50, TODAY);
    expect(s).toEqual([
      { date: p.startDate, progress: 0 },
      { date: addDays(TODAY, -10), progress: 30 },
      { date: TODAY, progress: 50 },
    ]);
  });
  it("keeps the latest log when several share a date", () => {
    const s = buildSeries(project(), [log(5, 10, 0), log(5, 20, 1)], 20, TODAY);
    expect(s.find((x) => x.date === addDays(TODAY, -5))?.progress).toBe(20);
  });
  it("interpolates linearly", () => {
    const s = [{ date: "2026-01-01", progress: 0 }, { date: "2026-01-11", progress: 50 }];
    expect(progressAt(s, "2026-01-06")).toBe(25);
  });
});

describe("forecastProject", () => {
  it("is on track when steady pace finishes before the target", () => {
    // 20 days elapsed, 60% done → 3%/day → 14 more days; target is in 20 days.
    const p = project({ manualProgress: 60 });
    const logs = [5, 10, 15, 20].map((ago) => log(ago, 60 - ago * 3));
    const f = forecastProject(p, [], logs, TODAY);
    expect(f.rate).toBeCloseTo(3, 5);
    expect(f.eta).toBe(addDays(TODAY, 14));
    expect(f.slipDays).toBe(-6);
    expect(f.health).toBe("on-track");
    expect(f.plannedProgress).toBe(50);
    expect(f.scheduleVariance).toBe(10);
  });

  it("flags late projects and computes the required pace", () => {
    // 20% after 20 days → 1%/day → 80 days left; target in 20 days.
    const p = project({ manualProgress: 20 });
    const f = forecastProject(p, [], [log(10, 10), log(0, 20)], TODAY);
    expect(f.health).toBe("late");
    expect(f.slipDays).toBe(60);
    expect(f.requiredRate).toBe(4);
  });

  it("reacts to a recent slowdown", () => {
    // 50% in the first 6 days, nothing in the last 14.
    const p = project({ manualProgress: 50 });
    const f = forecastProject(p, [], [log(14, 50)], TODAY);
    expect(f.recentRate).toBe(0);
    expect(f.overallRate).toBe(2.5);
    expect(f.rate).toBe(1.25);
    expect(f.etaPessimistic).toBeNull(); // slow end of the range never finishes
    expect(f.isStale).toBe(true);
  });

  it("is at risk when slipping within tolerance", () => {
    // 40 day project → tolerance 4 days. 45% after 20 days → 2.25%/day → 25 days → slip 5.
    // Use 47% → 53/2.35 = 22.55 → 23 days → slip 3.
    const p = project({ manualProgress: 47 });
    const f = forecastProject(p, [], [log(0, 47)], TODAY);
    expect(f.toleranceDays).toBe(4);
    expect(f.slipDays).toBe(3);
    expect(f.health).toBe("at-risk");
  });

  it("needs data before forecasting", () => {
    const f = forecastProject(project(), [], [], TODAY);
    expect(f.health).toBe("no-data");
    expect(f.eta).toBeNull();
  });

  it("is late once the target date has passed", () => {
    const p = project({ startDate: addDays(TODAY, -40), targetDate: addDays(TODAY, -1) });
    expect(forecastProject(p, [], [], TODAY).health).toBe("late");
  });

  it("handles done, paused and not-started projects", () => {
    expect(forecastProject(project(), [task(100)], [], TODAY).health).toBe("done");
    expect(forecastProject(project({ status: "paused", manualProgress: 10 }), [], [], TODAY).health).toBe("paused");
    const future = project({ startDate: addDays(TODAY, 3), targetDate: addDays(TODAY, 30) });
    expect(forecastProject(future, [], [], TODAY).health).toBe("not-started");
  });

  it("orders the range: optimistic ≤ eta ≤ pessimistic", () => {
    const p = project({ manualProgress: 55 });
    const logs = [log(18, 5), log(12, 15), log(6, 35), log(2, 50)];
    const f = forecastProject(p, [], logs, TODAY);
    expect(f.etaOptimistic! <= f.eta!).toBe(true);
    expect(f.eta! <= f.etaPessimistic!).toBe(true);
    expect(daysBetween(TODAY, f.eta!)).toBeGreaterThan(0);
  });
});

describe("todayISO", () => {
  // 2026-10-01 20:30 UTC is already 2 Oct in Bangkok (UTC+7).
  const instant = new Date("2026-10-01T20:30:00Z");
  it("uses the app time zone, not the server clock", () => {
    expect(todayISO(instant, "Asia/Bangkok")).toBe("2026-10-02");
    expect(todayISO(instant, "UTC")).toBe("2026-10-01");
  });
  it("defaults to Asia/Bangkok", () => {
    expect(todayISO(instant)).toBe("2026-10-02");
  });
});

describe("working days", () => {
  // 2026-10-02 is a Friday.
  it("counts Mon–Fri in (a, b]", () => {
    expect(workdaysBetween("2026-10-02", "2026-10-05")).toBe(1); // Fri → Mon
    expect(workdaysBetween("2026-10-02", "2026-10-09")).toBe(5); // one week
    expect(workdaysBetween("2026-10-03", "2026-10-04")).toBe(0); // Sat → Sun
    expect(workdaysBetween("2026-10-09", "2026-10-02")).toBe(-5);
  });
  it("adds working days, skipping weekends", () => {
    expect(addWorkdays("2026-10-02", 1)).toBe("2026-10-05");
    expect(addWorkdays("2026-10-02", 5)).toBe("2026-10-09");
    expect(addWorkdays("2026-10-02", 6)).toBe("2026-10-12");
    expect(addWorkdays("2026-10-03", 1)).toBe("2026-10-05"); // from Saturday
  });
  it("round-trips for many offsets", () => {
    for (let n = 1; n < 60; n++) expect(workdaysBetween(TODAY, addWorkdays(TODAY, n))).toBe(n);
  });

  it("forecasts in working days when weekends are skipped", () => {
    // Start Fri 2026-09-18, 10 working days elapsed, 50% done → 5%/working day.
    // 10 more working days from Fri 2026-10-02 → Fri 2026-10-16.
    const p = project({ startDate: "2026-09-18", targetDate: "2026-10-23", skipWeekends: true, manualProgress: 50 });
    const f = forecastProject(p, [], [log(0, 50)], TODAY);
    expect(f.unit).toBe("workday");
    expect(f.overallRate).toBe(5);
    expect(f.eta).toBe("2026-10-16");
    expect(f.slipDays).toBe(-5); // a week early = 5 working days
    expect(f.daysLeft).toBe(15);
    expect(f.health).toBe("on-track");
  });

  it("gives a later ETA than calendar-day counting for the same history", () => {
    const base = { startDate: "2026-09-18", targetDate: "2026-10-23", manualProgress: 50 };
    const cal = forecastProject(project(base), [], [log(0, 50)], TODAY);
    const work = forecastProject(project({ ...base, skipWeekends: true }), [], [log(0, 50)], TODAY);
    expect(cal.eta).toBe("2026-10-16"); // 14 calendar days at 50/14 %/day
    expect(work.eta! >= cal.eta!).toBe(true);
  });
});
