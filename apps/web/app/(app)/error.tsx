"use client";

import { useEffect } from "react";
import { useT } from "@/components/LangProvider";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Production builds hide server error messages; dev shows them.
  const detail = error.digest ? null : error.message;

  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-xl font-semibold">{t("Couldn't load data", "Load ข้อมูลไม่สำเร็จ")}</h1>
      <p className="mt-2 text-sm text-muted">
        {detail ??
          t(
            "The backend (API) or database may not be running, or can't be reached",
            "ระบบหลังบ้าน (API) หรือฐานข้อมูลอาจยังไม่ได้ Run หรือเชื่อมต่อไม่ได้",
          )}
      </p>
      <ul className="mt-4 space-y-1 text-left text-xs text-muted">
        <li>
          •{" "}
          {t(
            <>Run <code>npm run dev</code> in the project&apos;s root folder (starts both web and api)</>,
            <>Run <code>npm run dev</code> ที่ Folder หลักของ Project (เปิดทั้ง web และ api)</>,
          )}
        </li>
        <li>
          • {t("Check", "ตรวจ")} <code>DATABASE_URL</code> {t("in", "ใน")} <code>apps/api/.env</code>
        </li>
        <li>• {t("Open http://127.0.0.1:4000/health to check the API", "เปิด http://127.0.0.1:4000/health เพื่อตรวจสถานะ API")}</li>
      </ul>
      <button type="button" onClick={() => retry()} className="btn btn-primary mt-6">
        {t("Try again", "ลองใหม่")}
      </button>
    </div>
  );
}
