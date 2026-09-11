import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { LangProvider } from "@exhibition/ui";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { getLang } from "@/lib/lang";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Basirhat Ganapati Ustab Committee · Science Exhibition",
  description: "Vote for your favourite science project",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "bn" ? "bn" : "en"}>
      <body className={`${display.variable} ${sans.variable} min-h-screen pb-8 font-sans`}>
        <LangProvider lang={lang}>
          <SiteNav />
          <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
