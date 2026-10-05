"use client";

import { useState } from "react";
import type { FormState } from "@/lib/actions";
import { addDays, daysBetween, workdaysBetween } from "@tracker/shared/dates";
import type { Project } from "@tracker/shared/types";
import { FormMessage } from "./ActionButton";
import { ColorPicker } from "./ColorPicker";
import { useT } from "./LangProvider";
import { useFormAction } from "./useFormAction";

/**
 * Step-by-step project form: 1) name & colour · 2) dates · 3) tasks (new projects only).
 * All steps stay mounted (just hidden) so one submit sends every field.
 */
export function ProjectForm({
  action,
  project,
  defaults,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  project?: Project;
  defaults: { startDate: string; targetDate: string };
}) {
  const t = useT();
  const { state, onSubmit, pending } = useFormAction(action);
  const isNew = !project;
  const [step, setStep] = useState(1);
  const [name, setName] = useState(project?.name ?? "");
  const [nameError, setNameError] = useState(false);
  const [start, setStart] = useState(project?.startDate ?? defaults.startDate);
  const [target, setTarget] = useState(project?.targetDate ?? defaults.targetDate);
  const [skip, setSkip] = useState(project?.skipWeekends ?? false);
  const [tasks, setTasks] = useState("");

  const steps = [t("Name & colour", "ชื่อและสี"), t("Schedule", "กำหนดเวลา"), ...(isNew ? [t("Tasks", "งานย่อย")] : [])];
  const last = steps.length;
  const datesOk = start && target && target > start;
  const days = datesOk ? daysBetween(start, target) : 0;
  const workdays = datesOk ? workdaysBetween(start, target) : 0;
  const presets = [
    { label: t("2 weeks", "2 สัปดาห์"), days: 14 },
    { label: t("1 month", "1 เดือน"), days: 30 },
    { label: t("2 months", "2 เดือน"), days: 60 },
    { label: t("3 months", "3 เดือน"), days: 90 },
  ];
  const optional = <span className="font-normal text-muted">({t("optional", "ไม่บังคับ")})</span>;

  function go(n: number) {
    if (n > 1 && !name.trim()) {
      setNameError(true);
      setStep(1);
      return;
    }
    setStep(n);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        if (!name.trim()) {
          e.preventDefault();
          setNameError(true);
          setStep(1);
          return;
        }
        if (!datesOk) {
          e.preventDefault();
          setStep(2);
          return;
        }
        // Enter in an earlier step of a new project moves on instead of creating it early.
        if (isNew && step < last) {
          e.preventDefault();
          go(step + 1);
          return;
        }
        onSubmit(e);
      }}
      className="card space-y-5 rounded-[18px]! p-5 sm:p-7"
    >
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${last}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => (
          <li key={label}>
            <button type="button" onClick={() => go(i + 1)} className="w-full text-left" aria-current={step === i + 1 ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${i + 1 <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 block text-xs font-semibold sm:text-[13px] ${i + 1 === step ? "text-text" : "text-muted"}`}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* 1 — name & colour */}
      <div hidden={step !== 1} className="space-y-5">
        <h2 className="text-2xl leading-snug font-semibold sm:text-[26px]">{t("What's this project called?", "Project นี้ชื่ออะไร")}</h2>
        <div>
          <label htmlFor="name" className="label">{t("Project name", "ชื่อ Project")}</label>
          <input
            id="name"
            name="name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(false);
            }}
            className="input h-12 text-base sm:text-[17px]"
            placeholder={t("e.g. Portfolio website", "เช่น Web Portfolio")}
            aria-invalid={nameError}
          />
          {nameError && <p className="mt-1.5 text-xs text-bad">{t("Give the project a name first", "ใส่ชื่อ Project ก่อน")}</p>}
        </div>
        <div>
          <label htmlFor="description" className="label">{t("Description", "รายละเอียด")} {optional}</label>
          <textarea id="description" name="description" rows={2} maxLength={1000} defaultValue={project?.description} className="input resize-none" />
        </div>
        <ColorPicker name="color" defaultValue={project?.color} />
      </div>

      {/* 2 — schedule */}
      <div hidden={step !== 2} className="space-y-4">
        <h2 className="text-2xl leading-snug font-semibold sm:text-[26px]">{t("When does it start and finish?", "เริ่มเมื่อไหร่ เสร็จเมื่อไหร่")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className="label">{t("Start date", "วันเริ่ม")}</label>
            <input id="startDate" name="startDate" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="targetDate" className="label">{t("Target date (deadline)", "วันเป้าหมาย (deadline)")}</label>
            <input id="targetDate" name="targetDate" type="date" required value={target} onChange={(e) => setTarget(e.target.value)} className="input" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.days} type="button" className="btn h-9 rounded-full! px-3.5 text-[13px]" onClick={() => start && setTarget(addDays(start, p.days))}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3.5 hover:bg-surface-2">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("Skip weekends", "ไม่นับวันเสาร์–อาทิตย์")}</span>
            <span className="block text-xs leading-relaxed text-muted">
              {t(
                "Plan, pace and forecast use Mon–Fri only — good for work done on working days. Unchecked, every day counts.",
                "คิดแผน ความเร็ว และวันคาดว่าเสร็จจากวันจันทร์–ศุกร์เท่านั้น เหมาะกับงานที่ทำเฉพาะวันทำงาน · ถ้าไม่เลือก จะนับทุกวัน",
              )}
            </span>
          </span>
          <input type="checkbox" name="skipWeekends" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="peer sr-only" />
          <span aria-hidden className="relative h-[26px] w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-[22px] after:rounded-full after:bg-white after:shadow after:transition-[left] peer-checked:after:left-5" />
        </label>
        {datesOk ? (
          <p className="soft bg-accent-soft px-4 py-3 text-accent-ink">
            <span className="text-[22px] font-semibold">{skip ? t(`${workdays} workdays`, `${workdays} วันทำงาน`) : t(`${days} days`, `${days} วัน`)}</span>
            <span className="ml-2.5 text-[13px]">
              {t.date(start)} – {t.date(target)}
              {skip && t(` · ${days} calendar days`, ` · ${days} วันตามปฏิทิน`)}
            </span>
          </p>
        ) : (
          <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{t("The target date must be after the start date", "วันเป้าหมายต้องอยู่หลังวันเริ่ม")}</p>
        )}
      </div>

      {/* 3 — tasks (new projects only) */}
      {isNew && (
        <div hidden={step !== 3} className="space-y-4">
          <h2 className="text-2xl leading-snug font-semibold sm:text-[26px]">{t("Break it into tasks", "แตกงานย่อย")}</h2>
          <p className="-mt-2 text-sm text-muted">{t("Recommended — makes the forecast more accurate", "แนะนำ — ทำให้คาดการณ์แม่นขึ้น")}</p>
          <div>
            <textarea
              id="tasks"
              name="tasks"
              rows={5}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              aria-label={t("Tasks", "งานย่อย")}
              className="input font-mono text-[13px]"
              placeholder={
                t.lang === "th"
                  ? "ออกแบบ UI | 3 | ux | must\nทำระบบ Login | 2 | system | must\nDeploy | 1 | other | should"
                  : "Design the UI | 3 | ux | must\nLogin | 2 | system | must\nDeploy | 1 | other | should"
              }
            />
            <p className="hint">
              {t(
                <>
                  One task per line. Add <code>| number</code> for its size (e.g. days) — 1 if left out. You can also add a tag such as{" "}
                  <code>ux</code> / <code>backend</code> / <code>testing</code> or your own word (several: <code>ux, backend</code>), and a priority <code>must</code> (required for the MVP) /{" "}
                  <code>should</code> (important) / <code>could</code> (if time allows — the default). You can add more later.
                </>,
                <>
                  บรรทัดละ 1 งาน ใส่ <code>| ตัวเลข</code> ต่อท้ายเพื่อบอกขนาดงาน (เช่น จำนวนวัน) ถ้าไม่ใส่จะนับเป็น 1 · ใส่หมวด เช่น{" "}
                  <code>ux</code> / <code>backend</code> / <code>testing</code> หรือพิมพ์ชื่อหมวดเอง (หลายหมวด: <code>ux, backend</code>) และความสำคัญ <code>must</code> (ต้องมีใน MVP) /{" "}
                  <code>should</code> (ควรมี) / <code>could</code> (มีได้ถ้ามีเวลา — ค่าเริ่มต้น) ได้ (ไม่บังคับ) · เพิ่มทีหลังได้
                </>,
              )}
            </p>
          </div>
          {tasks.trim() === "" && (
            <div>
              <label htmlFor="manualProgress" className="label">{t("Progress so far (%)", "ความคืบหน้าตอนนี้ (%)")}</label>
              <input id="manualProgress" name="manualProgress" type="number" min={0} max={100} step={1} defaultValue={0} className="input max-w-32" />
              <p className="hint">{t("If you started before adding it here", "ถ้าเริ่มทำไปแล้วก่อนเพิ่มเข้าระบบ")}</p>
            </div>
          )}
        </div>
      )}

      <FormMessage error={state.error} />
      <div className="flex gap-2 border-t border-line-soft pt-4 sm:justify-end">
        {step > 1 && (
          <button type="button" className="btn h-12 px-5 sm:h-10" onClick={() => setStep(step - 1)}>{t("Back", "ย้อนกลับ")}</button>
        )}
        {!isNew && step < last && (
          <button type="submit" className="btn h-12 px-5 sm:h-10" disabled={pending}>{t("Save", "บันทึก")}</button>
        )}
        {/* Distinct keys: if React reused one <button> and flipped it to type="submit" mid-click,
            the click on "Next" would submit the form straight from step 2. */}
        {step < last ? (
          <button key="next" type="button" className="btn btn-primary h-12 flex-1 text-base sm:h-10 sm:flex-none sm:px-6 sm:text-sm" onClick={() => go(step + 1)}>
            {t("Next", "ต่อไป")}
          </button>
        ) : (
          <button key="submit" type="submit" className="btn btn-primary h-12 flex-1 text-base sm:h-10 sm:flex-none sm:px-6 sm:text-sm" disabled={pending}>
            {isNew ? t("Create project", "สร้าง Project") : t("Save", "บันทึก")}
          </button>
        )}
      </div>
    </form>
  );
}
