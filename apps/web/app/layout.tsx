import type { Metadata } from "next";
import { Anuphan, Geist_Mono } from "next/font/google";
import { LangProvider } from "@/components/LangProvider";
import { getLang, getT } from "@/lib/i18n-server";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only used for a few small labels — don't let it compete with the main font on first load.
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "Project Tracker", template: "%s · Project Tracker" },
    description: t("Track progress across projects and forecast when they'll finish", "ติดตามความคืบหน้าหลาย Project พร้อมคาดการณ์วันเสร็จ"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${anuphan.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
