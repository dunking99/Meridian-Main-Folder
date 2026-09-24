import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { MobileNav, Rail } from "@/components/client";

export const metadata: Metadata = {
  title: { default: "Meridian", template: "%s · Meridian" },
  description: "Meridian — a personal markets & investing cockpit.",
};

const PRIVACY_BOOT = `try{if(localStorage.getItem('meridian-privacy')==='on')document.documentElement.dataset.privacy='on'}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="privacy-boot" strategy="beforeInteractive">
          {PRIVACY_BOOT}
        </Script>
      </head>
      <body className="min-h-screen">
        <div className="gridpaper pointer-events-none fixed inset-0" />
        <div className="relative flex min-h-screen">
          <Rail />
          <div className="min-w-0 flex-1">
            <MobileNav />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}