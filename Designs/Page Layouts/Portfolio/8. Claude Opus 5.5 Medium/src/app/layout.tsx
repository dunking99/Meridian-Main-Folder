import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CurrencyProvider } from "@/components/money";
import { Shell } from "@/components/shell";
import { getPortfolio } from "@/lib/engine";
import { DISPLAY_CCYS } from "@/lib/format";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-num" });

export const metadata: Metadata = {
  title: "Meridian — Portfolio",
  description: "Personal markets & investing cockpit.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const raw = jar.get("ccy")?.value ?? "USD";
  const ccy = DISPLAY_CCYS.includes(raw) ? raw : "USD";
  const p = await getPortfolio();
  const rate = 1 / (p.fx[ccy] ?? 1);
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <CurrencyProvider ccy={ccy} rate={rate}>
          <Shell asOf={p.asOf}>{children}</Shell>
        </CurrencyProvider>
      </body>
    </html>
  );
}
