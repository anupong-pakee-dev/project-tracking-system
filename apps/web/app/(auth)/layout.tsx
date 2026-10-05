import { LangSwitcher } from "@/components/LangSwitcher";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";

// Phones: brand panel on top, form in a sheet below. lg and up: side by side, with a product preview.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  return (
    <main className="flex flex-1 flex-col lg:grid lg:grid-cols-2">
      <div
        className="relative flex flex-col overflow-hidden bg-accent-soft px-7 pt-14 pb-12 text-accent-ink lg:min-h-dvh lg:px-16 lg:py-14 xl:px-20"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--accent) 22%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-12 place-items-center rounded-[14px] bg-accent text-accent-fg lg:size-11 lg:rounded-xl">
            <svg viewBox="0 0 16 16" className="size-6 lg:size-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="hidden text-lg font-semibold lg:inline">Project Tracker</span>
        </div>

        <div className="lg:my-auto lg:max-w-[520px] lg:py-10">
          <p className="mt-4 text-[26px] leading-tight font-semibold tracking-tight lg:hidden">Project Tracker</p>
          <h1 className="hidden text-[40px] leading-[1.2] font-semibold tracking-tight text-pretty text-text lg:block xl:text-[44px]">
            {t("Know when it will really finish", "รู้ว่าจะเสร็จวันไหน")}
            <span className="block text-accent-ink">{t("and how far off plan you are", "และคลาดจากแผนแค่ไหน")}</span>
          </h1>
          <p className="mt-1.5 max-w-[420px] text-[15px] leading-normal text-pretty lg:mt-4 lg:text-lg lg:text-muted">
            {t(
              "Track several projects at once — know when each will really finish and how far off plan it is",
              "ติดตามหลายโปรเจคพร้อมกัน — รู้ว่าจะเสร็จวันไหน และคลาดจากแผนแค่ไหน",
            )}
          </p>

          <Preview t={t} />

          <ul className="mt-10 hidden gap-3 text-[15px] text-text lg:grid">
            {[
              t("Forecast from your real pace, with a best–worst range", "คาดการณ์วันเสร็จจากความเร็วจริง พร้อมช่วงเร็วสุด–ช้าสุด"),
              t("Compare against the plan every day", "เทียบกับแผนได้ทุกวัน ว่านำหรือตามหลังกี่วัน"),
              t("Skip weekends for work done Mon–Fri", "เลือกไม่นับเสาร์–อาทิตย์ได้ สำหรับงานที่ทำเฉพาะวันทำงาน"),
            ].map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span aria-hidden className="mt-[3px] grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="-mt-6 flex flex-1 flex-col items-center rounded-t-3xl bg-surface px-5 pt-7 pb-10 shadow-[0_-4px_20px_rgb(0_0_0/0.06)] lg:mt-0 lg:justify-center lg:rounded-none lg:bg-bg lg:px-12 lg:shadow-none">
        <div className="w-full max-w-[400px]">{children}</div>
        <LangSwitcher className="mt-6" />
      </div>
    </main>
  );
}

/** Static sample of a project card — shows what the app does before signing in. */
function Preview({ t }: { t: T }) {
  const color = "#4f46e5";
  const tint = `color-mix(in srgb, ${color} 10%, var(--surface))`;
  return (
    <div aria-hidden className="relative mt-10 hidden lg:block">
      <div className="absolute inset-x-6 -top-3 h-full rotate-[-2.5deg] rounded-[20px] border border-line bg-surface/70" />
      <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface text-text shadow-[0_12px_40px_rgb(0_0_0/0.12)]">
        <div className="flex items-center gap-4 px-5 pt-5 pb-4" style={{ background: tint }}>
          <div
            className="grid size-[68px] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(${color} 0 64%, var(--surface-2) 64% 100%)` }}
          >
            <span className="grid size-[54px] place-items-center rounded-full text-base font-semibold tabular-nums" style={{ background: tint }}>64%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{t("Portfolio website", "เว็บพอร์ตโฟลิโอส่วนตัว")}</p>
            <p className="text-sm font-semibold text-ok">{t("3 days ahead of target", "เร็วกว่าเป้า 3 วัน")}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-current" />
            {t("On track", "ตามแผน")}
          </span>
        </div>
        <div className="px-5 pt-3 pb-4">
          <svg viewBox="0 0 400 120" className="block h-auto w-full">
            {[20, 55, 90].map((y) => (
              <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="var(--line-soft)" />
            ))}
            <line x1="10" y1="100" x2="340" y2="14" stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="2 4" />
            <polygon points="215,40 316,14 352,14" fill={color} opacity="0.12" />
            <line x1="215" y1="40" x2="330" y2="14" stroke={color} strokeWidth="2" strokeDasharray="5 4" />
            <polyline
              points="10,100 40,93 70,86 100,78 130,70 160,60 190,50 215,40"
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <line x1="340" x2="340" y1="8" y2="104" stroke="var(--text)" opacity="0.6" />
            <line x1="215" x2="215" y1="8" y2="104" stroke="var(--muted)" strokeDasharray="3 3" opacity="0.6" />
            <circle cx="330" cy="14" r="4.5" fill={color} />
            <text x="215" y="118" textAnchor="middle" fontSize="11" fill="var(--muted)">{t("Today", "วันนี้")}</text>
            <text x="340" y="118" textAnchor="middle" fontSize="11" fill="var(--text)">{t("Target", "เป้าหมาย")}</text>
          </svg>
          <div className="mt-2 grid grid-cols-2 border-t border-line-soft pt-3 text-sm">
            <div>
              <p className="text-xs text-muted">{t("Forecast finish", "คาดว่าเสร็จ")}</p>
              <p className="font-semibold text-ok">{t("19 Oct 26", "19 ต.ค. 69")}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("Target", "เป้าหมาย")}</p>
              <p className="font-semibold">{t("22 Oct 26", "22 ต.ค. 69")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
