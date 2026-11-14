import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Trend Detective: Signal or Noise?",
  description: "Is Earth really changing here, or is it just luck? 46 years of NASA MERRA-2 data, tested for real trends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} antialiased`}>
      <body>
        <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col gap-10 px-4 pb-12 sm:px-8">
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="flex flex-wrap justify-between gap-4 border-t border-[var(--line)] pt-8 text-[13px] text-[var(--muted)]">
            <p className="m-0 max-w-[760px] leading-relaxed">
              Data: NASA GMAO MERRA-2 monthly reanalysis (1980–2025) via NASA GES DISC · El Niño index: NOAA CPC · Coastlines: Natural Earth.
              Built for NASA Space Apps 2026.
            </p>
            <a href="https://github.com/Arush763/trend-detective">Code on GitHub</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
