# Trend Detective: Signal or Noise?

**NASA Space Apps Challenge 2026 · "Be An Earth System Trend Detective!"**
Live app: https://trend-detective.vercel.app · Code: https://github.com/Arush763/trend-detective

## The problem

Weather jumps around every year. If you test enough places on Earth for a trend, some will look "statistically significant" by pure luck: at the usual p < 0.05 cut-off, about 1 test in 20. Most trend maps test every grid square on its own and never correct for this, so some of the "trends" they show are false alarms.

## What we built

A website where anyone, with no statistics background, can investigate whether a place on Earth is really changing. We borrowed an idea from finance: test enough stocks and some look like winners by luck, so quants run strict checks before trusting a pattern. We apply the same checks to 46 years of NASA Earth data.

- **Landing page:** a scroll-driven story, from the problem to a world dot map that steps through the tests, then four cases (three single places and the Case 04 comparison) and the four checks.
- **Any place on Earth:** search for a country, state, island, city or coordinates. The app takes the place's outline from OpenStreetMap, averages the NASA squares inside it (about 110 km each; a place smaller than one square uses the square it sits in), and runs the same four checks in the browser. Its tests join the app's false-discovery family, so the strict test stays strict.
- **Ask a question:** one sentence, "Is ___ getting ___?", with a dropdown in each blank. The place picker lists the 21 built-in regions and searches the whole world; the second blank lists what to look at (warmer, rainier, snowier, hazier…), suggested ones first for the built-in regions. Next you see the data, then one page for each of the four checks, then a plain-language verdict with a globe zoomed to that place.
- **Same cause, opposite effects (Case 04):** rain fell over the Amazon (−0.32 mm/day per decade) and rose over the Himalaya & Tibet (+0.13), both passing the strict test, while both regions got warmer and their air holds more water vapor. Warmer air holds more water, but winds decide where it falls. Any two places can be compared side by side.
- **Use this case:** copy a link, download the numbers as CSV, or copy a citation.
- **Globe:** a 3D globe of every 2° × 2.5° square of the planet for 9 variables. Step through the simple test, the luck test (shuffled data) and the strict test. Click any square (or use "Jump to a place" from the keyboard) for its numbers and its own verdict, so the checks work anywhere on Earth, not only in the 21 regions.
- **How it works:** the method, a glossary that defines every term and number on the site, the limits, and the sources.
- **Install it as an app, use it offline:** the site is a Progressive Web App. It installs on phones and computers ("Install app" in the menu, or "Add to Home Screen" on iPhone) and opens in its own window. After one visit, every page and every region's NASA data is saved on the device, so it works in a classroom with no Wi-Fi.
- **Works for everyone:** phone layouts, keyboard navigation, screen-reader labels on charts and the globe, and reduced motion when the device asks for it.

### Verdicts

| Verdict | Meaning |
|---|---|
| **Real signal** | Survives the strict test: false-discovery rate q < 0.05 |
| **Not proven yet** | Might be luck (corrected p < 0.2). We estimate how many more years of data would give a 90% chance of detecting it |
| **No clear trend** | Corrected p ≥ 0.2: we can't tell it apart from noise |

## Data

- **NASA GMAO MERRA-2** monthly reanalysis, 1980–2025, from NASA GES DISC. Collections M2TMNXSLV, M2TMNXFLX, M2TMNXLND and M2TMNXAER v5.12.4, about 2,200 files, subset through Earthdata Cloud OPeNDAP.
- **9 variables:** air temperature, water vapor, rain and snow, evaporation, root-zone soil moisture, snow on the ground, surface runoff, aerosol (haze) and dust optical depth.
- **21 curated regions**, from the Arctic and the Sahara to Delhi and the Chesapeake Bay, plus a global grid of 12,960 squares, plus yearly values for all 51,840 squares of a 1° × 1.25° grid (averaged from MERRA-2's native 0.5° × 0.625°) so any place can be tested.
- **NOAA CPC detrended Niño 3.4 index**, used to remove El Niño.
- **NASA AERONET** Version 3 Level 2.0 sun-photometer data (Beijing 2002–2018, Beijing-CAMS 2015–2025), to check the Beijing haze case against the ground.

## Method

1. **Remove the seasonal cycle:** average each year (monthly anomalies are also shown).
2. **Trend:** Theil-Sen slope, with the Gilbert (1987) 95% confidence interval.
3. **Significance:** Mann-Kendall test with the Hamed & Rao (1998) correction for autocorrelation, applied conservatively (the correction can only widen the variance).
4. **Multiple testing:** Benjamini-Hochberg false discovery rate, across all 184 region × variable tests and across all 12,960 map squares (see Wilks 2016).
5. **Luck test:** a permutation test with 2,000 shuffles for each region, and a shuffled-data map.
6. **Remove El Niño:** regress out the detrended Niño 3.4 index.
7. **Years until we'd know:** Weatherhead et al. (1998) years-to-detect (90% chance of detection at the 5% level), for trends that aren't significant yet. The formula is written for monthly noise, so for our yearly means the noise term carries a factor of √12.
8. **Holds up over time:** find the trend in 1980–2002, then check it in 2003–2025 (confirmed, continuing, faded, reversed or emerging).

`pipeline/test_stats.py` checks our vectorized statistics against `pymannkendall` (the results match to 1e-9). It also confirms a false-positive rate of about 5% on pure noise, that essentially nothing survives FDR on pure noise, and that the walk-forward labels are correct.

## Key results (air temperature, 1980–2025)

| | Map squares |
|---|---|
| Tested | 12,960 |
| Pass the simple test (p < 0.05) | 9,588 |
| False alarms on shuffled data with no trend | 640 (about 5%, as theory predicts) |
| Survive the strict test | 8,834 |

Across the variables, the strict test removes the most for rain and snow (4,646 → 2,665) and for haze (5,704 → 2,524). Air temperature trends are overwhelmingly real.

**Sanity check (Arctic amplification).** MERRA-2 gives the Arctic warming 0.44 °C per decade against 0.16 °C per decade globally, a ratio of 2.7. Over 1980–2021 the ratio is 3.15. Rantanen et al. (2022) report about 3.8 from observations. Reanalyses disagree on Arctic trends (roughly 0.3–0.7 °C per decade), so this falls in the expected range.

### Demo cases

- **Arctic air temperature:** Real signal. +0.44 °C per decade (95% CI 0.34–0.55), about 2 °C since 1980. It passes all four checks and holds after removing El Niño.
- **Beijing haze:** Not proven yet. A simple test says haze rose (p = 0.002), but haze climbed until the mid-2000s, stayed high until about 2015, and then fell. After correcting for autocorrelation and multiple testing, q = 0.11. Since 2003 there has been a significant decline. NASA AERONET ground stations in Beijing show the same story (yearly correlation with MERRA-2: 0.62 for 2002–2018 and 0.85 for 2015–2025; peak in 2006 in both), so the trend is not just an artefact of changing satellite inputs.
- **Murray-Darling Basin surface runoff:** Not proven yet. Down about 27% since 1980 (q = 0.25). The year-to-year swings are so large that, at this size, it would take about 70 more years of data for a 90% chance of detecting it.

## Limitations

- MERRA-2 is a reanalysis (a model constrained by observations), not raw measurements.
- Aerosol and dust trends can partly reflect changes over time in which satellite data was assimilated (AVHRR, MODIS, MISR). For Beijing we checked this against AERONET ground stations, which agree; MERRA-2 also assimilates AERONET, so that check shows consistency rather than full independence.
- Trends are linear and use yearly means. Rise-then-fall patterns are better described by the walk-forward check.
- Grid squares are about 250 km across (narrower near the poles), so a city is averaged with its surroundings.

## Tech

- **Pipeline:** Python (numpy, scipy, xarray, netCDF4, pymannkendall for tests), writing static JSON. `pipeline/aeronet.py` adds the Beijing ground-station check.
- **Any place:** `pipeline/build_places.py` packs those yearly values into 648 tiles of 10° × 10° (about 66 KB each), so a place downloads only the tiles it covers. `web/src/lib/stats.ts` is a line-by-line port of `stats.py`; `web/scripts/check-stats.ts` checks it against the Python on all 184 built-in series (every statistic matches). Place search and outlines: OpenStreetMap Nominatim.
- **Web:** Next.js 16 + Tailwind CSS 4, Motion (scroll-scrubbed animation), Lenis (smooth scrolling), react-globe.gl / three.js (3D globe). Charts are hand-built in SVG and canvas. Prerendered static pages on Vercel.
- **App (PWA):** a web app manifest with standard and maskable icons and shortcuts, plus a hand-written service worker. Pages load from the network first and fall back to a saved copy (or an offline page). Build files are served from the cache, since their names change with every build. NASA data shows the saved copy at once and refreshes in the background.

## Run it

See [README.md](README.md). The processed data is committed, so to run the site you only need `cd web && npm install && npm run dev`. To rebuild the data: `pip install -r pipeline/requirements.txt`, set `EARTHDATA_TOKEN`, then run `python pipeline/download_merra2.py`, `python pipeline/build.py`, `python pipeline/build_places.py` and `python pipeline/aeronet.py`.

## References

Gelaro et al. 2017 (J. Climate), MERRA-2 · Randles et al. 2017 (J. Climate), MERRA-2 aerosols · Hamed & Rao 1998 (J. Hydrology) · Benjamini & Hochberg 1995 (JRSS-B) · Wilks 2016 (BAMS 97(12)) · Weatherhead et al. 1998 (JGR) · Rantanen et al. 2022 (Communications Earth & Environment) · Holben et al. 1998 (Remote Sensing of Environment), AERONET · NOAA CPC Niño 3.4 · Natural Earth.

## AI assistance

Built with help from Claude (Anthropic) for code, design and writing; the authorship is recorded in the commit history. The app itself uses no AI: the "Ask a question" sentence is filled from plain dropdowns, and every number comes from the NASA data and the statistics above.
