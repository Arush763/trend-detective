import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Outfit } from "next/font/google";
import { Nav } from "@/components/Nav";
import { WarmingStripes } from "@/components/Fancy";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["200", "300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Trend Detective: Signal or Noise?",
  description: "Is Earth really changing here, or is it just luck? 46 years of NASA MERRA-2 data, tested for real trends.",
};

const LINKS = [["/#cases", "Demo cases"], ["/explore", "Explore a place"], ["/globe", "Globe"], ["/how", "How it works"], ["https://github.com/Arush763/trend-detective", "Code on GitHub"]];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} antialiased`}>
      <body>
        <Nav />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-8 sm:px-8">{children}</main>
        <footer className="relative overflow-hidden border-t border-white/[0.06] text-[var(--text)]">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 pb-10 pt-16 text-center sm:px-8">
            <p className="font-display text-[clamp(48px,9vw,120px)] font-extralight leading-none tracking-tight">trend detective</p>
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.14em]">
              {LINKS.map(([href, label]) => href.startsWith("http")
                ? <a key={href} href={href} className="text-[var(--soft)] hover:text-[var(--text)]">{label}</a>
                : <Link key={href} href={href} className="text-[var(--soft)] hover:text-[var(--text)]">{label}</Link>)}
            </nav>
            <p className="max-w-[720px] text-[12px] leading-relaxed text-[var(--muted)]">
              Data: NASA GMAO MERRA-2 monthly reanalysis (1980–2025) via NASA GES DISC · El Niño index: NOAA CPC · Coastlines: Natural Earth · Built for NASA Space Apps 2026.
            </p>
          </div>
          <div className="relative h-[200px]">
            <WarmingStripes className="absolute inset-0 blur-[14px] [mask-image:linear-gradient(to_bottom,transparent,black_55%)] [transform:scale(1.08)]" />
            <p className="absolute inset-x-0 bottom-3 text-center text-[11px] uppercase tracking-[0.14em] text-white/85">
              Warming stripes · NASA global air temperature, 1980 → 2025 · blue cooler, red warmer
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
