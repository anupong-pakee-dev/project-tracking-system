import { todayISO } from "@tracker/shared/dates";
import { api, ApiError } from "@/lib/api";
import { getT } from "@/lib/i18n-server";

// Proxies the API's backup so the browser can download it without talking to the API directly.
export async function GET() {
  try {
    const backup = await api<unknown>("GET", "/backup");
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="project-tracker-${todayISO()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : (await getT())("Download failed", "Download ไม่สำเร็จ");
    return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
