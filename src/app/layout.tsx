import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Public_Sans, Spline_Sans_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spline-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "V-Unite Coach",
  description: "AI business coach for aesthetic clinic owners — chart-style, evidence-first.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${splineMono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
