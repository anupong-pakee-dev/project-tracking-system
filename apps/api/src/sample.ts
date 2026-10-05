import { addDays } from "@tracker/shared/dates";
import { computeProgress } from "@tracker/shared/forecast";
import { pick, type Lang } from "@tracker/shared/i18n";
import type { Database, ISODate, ProgressLog, Project, Task, TaskCategory, TaskPriority } from "@tracker/shared/types";

/** [English, Thai] */
type Text = [string, string];

interface SampleSpec {
  name: Text;
  description: Text;
  color: string;
  skipWeekends: boolean;
  startOffset: number;
  targetOffset: number;
  tasks: [title: Text, weight: number, progress: number, categories: TaskCategory[], priority: TaskPriority][];
  /** [days ago, share of final progress reached] */
  checkpoints: [number, number][];
  notes: Text[];
}

const SPECS: SampleSpec[] = [
  {
    name: ["Personal portfolio site", "Web Portfolio ส่วนตัว"],
    description: ["Next.js + MDX blog and work showcase", "Next.js + MDX Blog และหน้าแสดงผลงาน"],
    color: "#4f46e5",
    skipWeekends: false,
    startOffset: -30,
    targetOffset: 20,
    tasks: [
      [["Design the UI in Figma", "ออกแบบ UI ใน Figma"], 3, 100, ["uxui"], "must"],
      [["Project setup and CI", "ตั้งค่า Project และ CI"], 1, 100, ["system"], "must"],
      [["Home and about pages", "หน้าแรกและหน้าเกี่ยวกับฉัน"], 3, 100, ["uxui"], "must"],
      [["MDX blog", "ระบบ Blog MDX"], 4, 60, ["system"], "should"],
      [["Work showcase page", "หน้าแสดงผลงาน"], 3, 30, ["uxui"], "should"],
      [["SEO and deploy", "SEO และ deploy"], 2, 0, ["frontend", "devops"], "could"],
    ],
    checkpoints: [[27, 0.1], [23, 0.22], [19, 0.35], [15, 0.48], [11, 0.6], [7, 0.75], [3, 0.88], [1, 1]],
    notes: [
      ["Design half done", "ออกแบบเสร็จครึ่งหนึ่ง"],
      ["UI done", "UI เสร็จแล้ว"],
      ["CI set up", "ตั้ง CI เรียบร้อย"],
      ["Home page nearly done", "หน้าแรกใกล้เสร็จ"],
      ["Started the blog", "เริ่มทำ Blog"],
      ["Home page done", "หน้าแรกเสร็จ"],
      ["MDX renders now", "MDX render ได้แล้ว"],
      ["Started the showcase page", "เริ่มหน้าผลงาน"],
    ],
  },
  {
    name: ["Shop inventory app", "App จัดการ Stock ร้านค้า"],
    description: ["Freelance job — React Native + Supabase", "งาน Freelance — React Native + Supabase"],
    color: "#d97706",
    skipWeekends: true,
    startOffset: -45,
    targetOffset: 12,
    tasks: [
      [["Gather requirements with the client", "เก็บ requirement กับลูกค้า"], 2, 100, ["other"], "must"],
      [["Database design", "ออกแบบฐานข้อมูล"], 2, 100, ["system"], "must"],
      [["Login", "ระบบ Login"], 2, 100, ["system", "security"], "must"],
      [["Product management (CRUD)", "จัดการสินค้า (CRUD)"], 5, 70, ["backend", "database"], "must"],
      [["Barcode scanning", "Scan Barcode"], 4, 20, ["system"], "should"],
      [["Sales reports", "รายงานยอดขาย"], 4, 0, ["uxui"], "could"],
      [["Testing with the client", "ทดสอบกับลูกค้า"], 3, 0, ["other"], "should"],
    ],
    checkpoints: [[42, 0.12], [36, 0.3], [30, 0.45], [24, 0.62], [17, 0.75], [12, 0.85], [5, 0.95], [2, 1]],
    notes: [
      ["First client meeting", "คุยลูกค้ารอบแรก"],
      ["Requirements agreed", "สรุป requirement"],
      ["DB design done", "ออกแบบ DB เสร็จ"],
      ["Login works", "Login ใช้ได้"],
      ["Started product CRUD", "เริ่ม CRUD สินค้า"],
      ["Client asked for form changes", "ลูกค้าขอแก้ Form"],
      ["Stuck on the camera library", "ติดปัญหา library กล้อง"],
      ["Scanning works on some phones", "Scan ได้บางรุ่น"],
    ],
  },
  {
    name: ["TypeScript online course", "Course Online TypeScript"],
    description: ["Record 12 lessons with exercises", "อัด Video 12 บท พร้อมแบบฝึกหัด"],
    color: "#059669",
    skipWeekends: false,
    startOffset: -12,
    targetOffset: 48,
    tasks: [],
    checkpoints: [[9, 0.3], [5, 0.65], [2, 1]],
    notes: [
      ["Outlined the course", "เขียนโครง Course"],
      ["Recorded lesson 1", "อัดบทที่ 1"],
      ["Edited lessons 1–2", "ตัดต่อบทที่ 1–2"],
    ],
  },
];

const MANUAL_PROGRESS = 19;

export function buildSampleData(today: ISODate, lang: Lang = "th"): Database {
  const db: Database = { version: 1, projects: [], tasks: [], logs: [] };
  const createdAt = new Date().toISOString();
  const say = ([en, th]: Text) => pick(lang, en, th);

  for (const spec of SPECS) {
    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: say(spec.name),
      description: say(spec.description),
      color: spec.color,
      startDate: addDays(today, spec.startOffset),
      targetDate: addDays(today, spec.targetOffset),
      status: "active",
      skipWeekends: spec.skipWeekends,
      manualProgress: spec.tasks.length ? 0 : MANUAL_PROGRESS,
      completedAt: null,
      createdAt,
    };
    const tasks: Task[] = spec.tasks.map(([title, weight, progress, categories, priority], order) => ({
      id: crypto.randomUUID(),
      projectId,
      title: say(title),
      description: "",
      weight,
      progress,
      order,
      categories,
      priority,
    }));
    const final = computeProgress(project, tasks);
    const logs: ProgressLog[] = spec.checkpoints.map(([ago, share], i) => ({
      id: crypto.randomUUID(),
      projectId,
      date: addDays(today, -ago),
      progress: Math.round(final * share * 10) / 10,
      note: spec.notes[i] ? say(spec.notes[i]) : "",
      kind: "update",
      createdAt: new Date(Date.now() - ago * 86_400_000).toISOString(),
    }));
    db.projects.push(project);
    db.tasks.push(...tasks);
    db.logs.push(...logs);
  }
  return db;
}
