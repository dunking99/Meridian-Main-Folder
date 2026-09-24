import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/shell/Sidebar";

export const metadata: Metadata = {
  title: "Meridian — Private Markets",
  description: "A personal markets and investing terminal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="bg-fx" aria-hidden />
        <Sidebar />
        <div className="lg:pl-60 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
