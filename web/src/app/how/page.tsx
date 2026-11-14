import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "How it works · Trend Detective" };

const GLOSSARY: [string, string][] = [
  ["Signal", "A real, lasting change, like the Arctic getting warmer decade after decade."],
  ["Noise", "The normal ups and downs from one year to the next, with no lasting cause."],
  ["False alarm", "Noise that happens to line up and look like a trend. Test 100 places with no real trend and about 5 will look 'significant' by luck."],
  ["Trend", "The steady rise or fall underneath the noise, shown as a straight line through the years. We give it per decade (10 years)."],
  ["Normal wobble", "How far a typical year sits above or below the trend line. Big wobble makes trends hard to see."],
  ["Trend strength", "Total change since 1980 divided by the normal wobble. 1 means the change is as big as one normal wobble; above 2 is easy to see."],
  ["p-value", "How often pure noise would make a pattern at least this strong. Small is good: under 0.05 means less than 5 times in 100."],
  ["False-alarm rate (q)", "A p-value corrected for running many tests at once (Benjamini-Hochberg). If we call every trend this strong 'real', q is the share we'd expect to be false alarms."],
  ["Year-to-year memory", "When each year looks a lot like the one before (a hot year followed by another hot year). It makes trends look surer than they are, so we correct for it (Hamed-Rao)."],
  ["El Niño", "A natural cycle in the Pacific Ocean that makes some years warmer or wetter around the world. We can remove it to see whether a trend still holds."],
  ["Holding up over time", "We find the trend in 1980–2002, then check whether it continued in 2003–2025, data the first test never saw."],
  ["Years until we'd know", "For a trend that isn't proven yet: how many years of data it would take to prove it, if it's real and keeps its current size (Weatherhead et al. 1998)."],
  ["Reanalysis", "MERRA-2 is a reanalysis: a NASA weather model that is constantly corrected with real satellite and ground observations, giving a complete record with no gaps."],
  ["Ratio (\"times as fast\")", "One trend divided by another. \"The Arctic warms 2.7 times as fast as Earth\" means its trend per decade is 2.7 times the global one."],
];

export default function How() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex max-w-[760px] flex-col gap-3">
        <h1 className="text-[36px] font-bold sm:text-[44px]">How it works</h1>
        <p className="text-lg leading-relaxed text-[var(--soft)]">
          Investors know the trap: test enough stocks and some look like winners by pure luck. Earth data has the same trap. Here is how we avoid it.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        {[
          ["1. Get the data", "NASA's MERRA-2 record, every month from 1980 to 2025, for 9 things you can measure: air temperature, water vapor, rain and snow, evaporation, soil moisture, snow on the ground, river runoff, haze and dust."],
          ["2. Remove the seasons", "Summer is always warmer than winter, so comparing July with January says nothing about change. We average each year, which cancels out the seasons."],
          ["3. Measure the trend", "We use Sen's slope: the middle of all the year-to-year slopes. One unusual year can't drag it the way it drags a normal best-fit line."],
          ["4. Test it against luck", "A Mann-Kendall test asks how often pure noise would give a pattern this strong. We correct it for year-to-year memory, and for testing 184 place-and-variable pairs (or 12,960 map squares) at once."],
          ["5. Try to break it", "We shuffle each place's years 2,000 times, remove El Niño, and check whether a trend found in 1980–2002 kept going in 2003–2025."],
          ["6. Give a plain verdict", "Real signal (survives the strict test), not proven yet (might be luck), or no clear trend. Not proven isn't the same as false: with more years, some of these will become clear."],
        ].map(([t, d]) => (
          <Card key={t} className="flex flex-col gap-2.5">
            <h2 className="font-sans text-lg font-semibold">{t}</h2>
            <p className="text-[15px] leading-relaxed text-[var(--soft)]">{d}</p>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-[28px] font-bold">Words and numbers on this site</h2>
        <dl className="m-0 grid gap-x-10 gap-y-5 md:grid-cols-2">
          {GLOSSARY.map(([t, d]) => (
            <div key={t} className="border-b border-[var(--line)] pb-4">
              <dt className="font-semibold">{t}</dt>
              <dd className="ml-0 mt-1 text-[15px] leading-relaxed text-[#a9b6d3]">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[28px] font-bold">What to keep in mind</h2>
        <ul className="m-0 flex flex-col gap-2.5 pl-5 text-[15px] leading-relaxed text-[var(--soft)]">
          <li>MERRA-2 is a model kept in line with observations, not raw measurements. Different data sets disagree most in the Arctic, so our Arctic warming is a little lower than some observation-based studies.</li>
          <li>Haze and dust trends can partly come from changes in which satellites were fed into MERRA-2 over the years, not only from the real air.</li>
          <li>Trends are straight lines through yearly averages. A place that rose and then fell (like Beijing&apos;s haze) is better described by the &quot;holding up over time&quot; check.</li>
          <li>Each map square is about 200 km wide, so small places like a single city are averaged with their surroundings.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[28px] font-bold">Sources</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5 text-sm leading-relaxed text-[#a9b6d3]">
          <li>Gelaro et al. (2017), The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2), J. Climate. Randles et al. (2017), the MERRA-2 aerosol reanalysis, J. Climate.</li>
          <li>Hamed &amp; Rao (1998), a modified Mann-Kendall trend test for autocorrelated data, J. Hydrology.</li>
          <li>Benjamini &amp; Hochberg (1995), controlling the false discovery rate, J. Royal Statistical Society B.</li>
          <li>Wilks (2016), &quot;The stippling shows statistically significant grid points&quot;, Bulletin of the American Meteorological Society 97(12).</li>
          <li>Weatherhead et al. (1998), factors affecting the detection of trends, J. Geophysical Research.</li>
          <li>Rantanen et al. (2022), the Arctic has warmed nearly four times faster than the globe since 1979, Communications Earth &amp; Environment.</li>
          <li>NOAA Climate Prediction Center, detrended Niño 3.4 index. Coastlines: Natural Earth.</li>
        </ul>
      </section>
    </div>
  );
}
