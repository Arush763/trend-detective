import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Grain, LightLeaks, WarmingStripes } from "@/components/Fancy";
import { RollText, SectionLabel } from "@/components/ui";
import { MotionPrefs } from "@/components/MotionPrefs";
import { PWA } from "@/components/PWA";
import "./globals.css";

const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400"] });

const DESCRIPTION = "Is Earth really changing, or is it just luck? 46 years of NASA MERRA-2 data, tested for real trends.";

export const metadata: Metadata = {
  metadataBase: new URL("https://trend-detective.vercel.app"),
  title: { default: "Trend Detective: Signal or Noise?", template: "%s · Trend Detective" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Trend Detective", title: "Trend Detective: Signal or Noise?", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Trend Detective: Signal or Noise?", description: DESCRIPTION },
  applicationName: "Trend Detective",
  appleWebApp: { capable: true, title: "Trend Detective", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#05070b", colorScheme: "dark" };

const LINKS = [["/#cases", "Demo cases"], ["/explore", "Explore a place"], ["/globe", "Globe"], ["/how", "How it works"], ["https://github.com/Arush763/trend-detective", "Code on GitHub"]];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${outfit.variable} antialiased`}>
      <body>
        <MotionPrefs>
          <a href="#main" className="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60]">Skip to content</a>
          <Grain />
          <PWA />
          <Nav />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-24 outline-none sm:px-8">{children}</main>
          <footer className="relative overflow-hidden border-t border-white/[0.08] text-ink">
            <LightLeaks />
            <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pb-10 pt-16 sm:px-8">
              <p className="font-display text-[clamp(48px,9vw,120px)] leading-[0.95] tracking-[-0.03em]">trend detective</p>
              <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
                {LINKS.map(([href, label]) => href.startsWith("http")
                  ? <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="hud inline-flex min-h-11 items-center text-ink-dim no-underline hover:text-ink"><RollText>{label}</RollText></a>
                  : <Link key={href} href={href} className="hud inline-flex min-h-11 items-center text-ink-dim no-underline hover:text-ink"><RollText>{label}</RollText></Link>)}
              </nav>
              <div className="grid max-w-[900px] gap-8 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <SectionLabel>Credits</SectionLabel>
                  <p className="text-[14px] leading-relaxed text-ink-dim">
                    Data: NASA GMAO MERRA-2 monthly reanalysis (1980–2025) via <a href="https://disc.gsfc.nasa.gov/datasets?project=MERRA-2" target="_blank" rel="noopener noreferrer">NASA GES DISC</a>. El Niño index: NOAA CPC Niño 3.4. Beijing ground check: NASA AERONET. Coastlines: Natural Earth. Built for NASA Space Apps 2026.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <SectionLabel>AI use</SectionLabel>
                  <p className="text-[14px] leading-relaxed text-ink-dim">
                    AI use: built with help from Claude (Anthropic) for code, design and writing. The app itself uses no AI: every number comes from NASA data and the statistics on the How it works page.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative h-[200px]">
              <WarmingStripes className="absolute inset-0 blur-[14px] [mask-image:linear-gradient(to_bottom,transparent,black_55%)] [transform:scale(1.08)]" />
              <p className="hud glass-strong absolute inset-x-4 bottom-3 mx-auto w-fit max-w-full !rounded-full px-3 py-1.5 text-center text-ink">
                Warming stripes · NASA global air temperature, 1980–2025 · blue cooler, red warmer
              </p>
            </div>
          </footer>
        </MotionPrefs>
      </body>
    </html>
  );
}
