import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Public_Sans, Fraunces } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

// Two families only. Fraunces sets every display line; Public Sans carries the
// interface (its --font-mono alias keeps numerals tabular without a third family).
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "V-Unite Coach",
  description: "AI business coach for aesthetic clinic owners — evidence-first, warm, precise.",
};

/** Applies the persisted theme before first paint to avoid a light-mode flash. */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("v-unite-theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${publicSans.variable} ${fraunces.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
