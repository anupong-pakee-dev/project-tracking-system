import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ActionButton } from "@/components/ActionButton";
import { ProjectTile } from "@/components/ProjectTile";
import { Timeline } from "@/components/Timeline";
import { HEALTH_STYLE } from "@/components/ui";
import { loadSampleData } from "@/lib/actions";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { todayISO } from "@tracker/shared/dates";
import { getProjectViews } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Overview", "ภาพรวม") };
}

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  await connection();
  const t = await getT();
  const notices: Record<string, string> = {
    welcome: t("Email verified — welcome!", "ยืนยัน Email เรียบร้อย — ยินดีต้อนรับ!"),
    reset: t("Password changed. Other devices have been signed out.", "ตั้งรหัสผ่านใหม่แล้ว อุปกรณ์อื่นถูกออกจากระบบ"),
  };
  const sp = await searchParams;
  const notice = Object.keys(notices).find((k) => sp[k]);
  const today = todayISO();
  const views = await getProjectViews();

  const banner = notice && (
    <p role="status" className="soft mb-6 bg-ok-soft px-4 py-3 text-sm font-medium text-ok">{notices[notice]}</p>
  );

  if (views.length === 0) {
    return (
      <>
        {banner}
        <EmptyState t={t} />
      </>
    );
  }

  const current = views.filter((v) => v.project.status === "active");
  const archived = views.filter((v) => v.project.status !== "active");
  const count = (h: string) => current.filter((v) => v.forecast.health === h).length;
  const stale = current.filter((v) => v.forecast.isStale).length;
  const n = current.length;
  const late = count("late");
  const risk = count("at-risk");
  // Most urgent first: late → at risk → the rest, keeping the API order within each group.
  const rank: Record<string, number> = { late: 0, "at-risk": 1 };
  const ordered = [...current].sort((a, b) => (rank[a.forecast.health] ?? 2) - (rank[b.forecast.health] ?? 2));

  const headline =
    n === 0
      ? t("No active projects", "ยังไม่มี Project ที่กำลังทำ")
      : late > 0
        ? t(`${late} project${late === 1 ? "" : "s"} need${late === 1 ? "s" : ""} a push`, `${late} Project ต้องเร่ง`)
        : risk > 0
          ? t(`${risk} project${risk === 1 ? "" : "s"} at risk`, `${risk} Project เสี่ยงล่าช้า`)
          : t("Everything is on track", "ทุก Project ไปตามแผน");

  const legend = [
    { label: t("Late", "ล่าช้า"), value: late, color: HEALTH_STYLE.late.color },
    { label: t("At risk", "เสี่ยงล่าช้า"), value: risk, color: HEALTH_STYLE["at-risk"].color },
    { label: t("On track", "ตามแผน"), value: count("on-track"), color: HEALTH_STYLE["on-track"].color },
    { label: t("Needs update", "รอ Update"), value: stale, color: "var(--faint)" },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      {banner}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[13px] text-muted sm:text-sm">
            {t(
              `Today ${t.date(today)} · ${n} active project${n === 1 ? "" : "s"}`,
              `วันนี้ ${t.date(today)} · กำลังทำ ${n} Project`,
            )}
          </p>
          <h1 className="mt-0.5 text-[26px] leading-tight font-semibold tracking-tight text-pretty sm:text-[32px]">{headline}</h1>
        </div>
        <ul aria-label={t("Status summary", "สรุปสถานะ")} className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-muted sm:gap-x-[18px] sm:text-sm">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: l.color }} />
              {l.label} <span className="tabular-nums">{l.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {ordered.length > 0 && (
        // Phones: swipe through the cards. md and up: a grid.
        <section
          aria-label={t("Active projects", "Project ที่กำลังทำ")}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-0.5 pb-1.5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 xl:grid-cols-3"
        >
          {ordered.map((v) => (
            <ProjectTile key={v.project.id} view={v} today={today} t={t} />
          ))}
        </section>
      )}

      {current.length > 0 && <Timeline views={ordered} today={today} t={t} />}

      {archived.length > 0 && (
        <details className="group" open={current.length === 0}>
          <summary className="cursor-pointer select-none text-sm font-medium text-muted">
            {t("Done / paused", "เสร็จแล้ว / พักไว้")} ({archived.length})
          </summary>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 xl:grid-cols-3">
            {archived.map((v) => (
              <ProjectTile key={v.project.id} view={v} today={today} t={t} />
            ))}
          </div>
        </details>
      )}

      <HowItWorks t={t} />
    </div>
  );
}

function EmptyState({ t }: { t: T }) {
  return (
    <div className="card mx-auto mt-16 max-w-[520px] px-10 py-12 text-center">
      <h1 className="text-[22px] font-semibold">{t("Start tracking your first project", "เริ่มติดตาม Project แรก")}</h1>
      <p className="mt-2.5 text-sm leading-[1.75] text-pretty text-muted">
        {t(
          "Create a project, set a target date, break it into tasks and record progress now and then — the app forecasts the finish date and shows how far you are from the plan.",
          "สร้าง Project ตั้งวันเป้าหมาย แตกงานย่อย แล้ว Update ความคืบหน้าเป็นระยะ — ระบบจะคาดการณ์วันเสร็จและบอกว่าคลาดจากแผนแค่ไหน",
        )}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/projects/new" className="btn btn-primary">+ {t("Create project", "สร้าง Project")}</Link>
        <ActionButton action={loadSampleData}>{t("Try with sample data", "ลองด้วยข้อมูลตัวอย่าง")}</ActionButton>
      </div>
    </div>
  );
}

function HowItWorks({ t }: { t: T }) {
  const b = (s: string) => <b className="font-semibold text-text">{s}</b>;
  return (
    <details className="card px-5 py-4 text-sm">
      <summary className="cursor-pointer font-medium">{t("How is the finish date forecast?", "ระบบคาดการณ์วันเสร็จอย่างไร?")}</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-[1.7] text-muted">
        <li>
          {t(
            <>{b("Progress")} comes from the tasks, weighted by each task&apos;s &ldquo;size&rdquo; (projects without tasks use the % you enter).</>,
            <>{b("ความคืบหน้า")} คิดจากงานย่อยถ่วงน้ำหนักตาม &ldquo;ขนาด&rdquo; ของแต่ละงาน (ถ้าไม่มีงานย่อยใช้ % ที่กรอกเอง)</>,
          )}
        </li>
        <li>
          {t(
            <>{b("Pace")} = the average of the pace since the project started and the pace over the last 14 days (%/day) — if you slow down, the finish date moves out right away.</>,
            <>{b("ความเร็ว")} = ค่าเฉลี่ยของความเร็วตั้งแต่เริ่ม Project กับความเร็วช่วง 14 วันล่าสุด (%/วัน) — ถ้าช่วงนี้ช้าลง วันเสร็จจะเลื่อนออกไปทันที</>,
          )}
        </li>
        <li>
          {t(
            <>{b("Forecast finish")} = today + (% remaining ÷ pace), with a &ldquo;range&rdquo; between the fastest and slowest case.</>,
            <>{b("วันคาดว่าเสร็จ")} = วันนี้ + (% ที่เหลือ ÷ ความเร็ว) พร้อม &ldquo;ช่วง&rdquo; ระหว่างกรณีเร็วสุดและช้าสุด</>,
          )}
        </li>
        <li>
          {t(
            <>{b("Status")}: on track = finishes by the target · at risk = past the target by up to 10% of the project&apos;s length (at least 3 days) · late = more than that, or already past the target.</>,
            <>{b("สถานะ")}: ตามแผน = เสร็จทันเป้า · เสี่ยงล่าช้า = เลยเป้าไม่เกิน 10% ของระยะเวลา Project (อย่างน้อย 3 วัน) · ล่าช้า = เลยกว่านั้น หรือเลยกำหนดแล้ว</>,
          )}
        </li>
        <li>
          {t(
            <>The ring shows progress; the project page also shows where you {b("should be")} today on a straight line from the start date to the target.</>,
            <>วงแหวนแสดงความคืบหน้า และหน้า Project จะบอก % ที่ {b("ควรถึง")} วันนี้ถ้าทำเป็นเส้นตรงจากวันเริ่มถึงวันเป้าหมาย</>,
          )}
        </li>
        <li>
          {t(
            <>Projects set to {b("skip weekends")} count the plan, pace (%/workday), forecast and days ahead/behind on Mon–Fri only.</>,
            <>Project ที่เลือก {b("ไม่นับเสาร์–อาทิตย์")} จะคิดแผน ความเร็ว (%/วันทำงาน) วันคาดว่าเสร็จ และจำนวนวันที่ช้า/เร็ว จากวันจันทร์–ศุกร์เท่านั้น</>,
          )}
        </li>
        <li>
          {t(
            "The more often you update (say every 2–3 days), the better the forecast.",
            "ยิ่ง Update บ่อย (เช่น ทุก 2–3 วัน) การคาดการณ์ยิ่งแม่น",
          )}
        </li>
      </ul>
    </details>
  );
}
