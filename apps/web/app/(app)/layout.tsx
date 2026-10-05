import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/Logo";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NavLink } from "@/components/NavLink";
import { UserMenu } from "@/components/UserMenu";
import { getT } from "@/lib/i18n-server";
import { getCurrentUser } from "@/lib/queries";

// Signed-in area. getCurrentUser() redirects to /login when the session is missing or expired.
// Phones: slim header (logo + account) with navigation in a bottom tab bar. sm and up: the original top nav.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line-soft bg-nav/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="mr-5">
            <Logo />
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <NavLink href="/">{t("Overview", "ภาพรวม")}</NavLink>
            <NavLink href="/data">{t("Data", "ข้อมูล")}</NavLink>
          </div>
          <Link href="/projects/new" className="btn btn-primary ml-auto hidden sm:inline-flex">+ {t("New project", "Project ใหม่")}</Link>
          <div className="ml-auto sm:ml-0">
            <UserMenu email={user.email} />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 sm:px-6 sm:py-9">{children}</main>
      <MobileTabBar
        labels={{
          overview: t("Overview", "ภาพรวม"),
          data: t("Data", "ข้อมูล"),
          newProject: t("New project", "Project ใหม่"),
        }}
      />
    </>
  );
}
