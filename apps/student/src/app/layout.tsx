import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { LangProvider } from "@exhibition/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { RouteLoader } from "@/components/RouteLoader";
import { getLang } from "@/lib/lang";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student portal · Basirhat Ganapati Ustab Committee",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "bn" ? "bn" : "en"}>
      <body className={`${display.variable} ${sans.variable} min-h-screen font-sans`}>
        <LangProvider lang={lang}>
          <SiteHeader />
          <RouteLoader />
          <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
