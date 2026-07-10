import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New, Instrument_Sans } from "next/font/google";
import "./globals.css";

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "yomu",
  description: "4枚の写真で綴る1日1回のSNS",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${zenKaku.variable} ${instrument.variable} film-grain min-h-dvh antialiased`}>
        {children}
      </body>
    </html>
  );
}
