import Link from "next/link";
import { getT } from "@/lib/i18n-server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">{t("Page not found", "ไม่พบหน้านี้")}</h1>
      <p className="mt-2 text-sm text-muted">{t("The project may have been deleted", "Project อาจถูกลบไปแล้ว")}</p>
      <Link href="/" className="btn btn-primary mt-6">{t("Back to overview", "กลับไปภาพรวม")}</Link>
    </div>
  );
}
