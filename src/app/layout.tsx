import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CycloneOS Dashboard",
  description: "AI Workstation",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className="dark">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐉</text></svg>" />
      </head>
      <body
        className={`${notoSansTC.variable} ${jetbrainsMono.variable} font-sans bg-cy-bg text-cy-text antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
