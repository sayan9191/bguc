import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { AdminChrome } from "@/components/AdminNav";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Basirhat Ganapati Ustab Committee",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} min-h-screen overflow-x-hidden font-sans`}>
        <AdminChrome>{children}</AdminChrome>
      </body>
    </html>
  );
}
