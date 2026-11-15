# Trend Detective: Signal or Noise?

**NASA Space Apps Challenge 2026 · "Be An Earth System Trend Detective!"**
Live app: https://trend-detective.vercel.app · Code: https://github.com/Arush763/trend-detective

## The problem

Weather jumps around every year. If you test enough places on Earth for a trend, some will look "statistically significant" by pure luck: at the usual p < 0.05 cut-off, about 1 test in 20. Most trend maps test every grid square on its own and never correct for this, so some of the "trends" they show are false alarms.

## What we built

A website where anyone, with no statistics background, can investigate whether a place on Earth is really changing. We borrowed an idea from finance: test enough stocks and some look like winners by luck, so quants run strict checks before trusting a pattern. We apply the same checks to 46 years of NASA Earth data.

- **Landing page:** a scroll-driven story, from the problem to a world dot map that steps through the tests, then three demo cases and the four checks.
- **Explore a place (step by step):** choose a kind of place (desert, rainforest, big city, polar…), then a place, then what to look at. The app suggests variables for each kind of place. Next you see the data, then one page for each of the four checks, then a plain-language verdict with a globe zoomed to that place.
- **Globe:** a 3D globe of every 2° × 2.5° square of the planet for 9 variables. Step through the simple test, the luck test (shuffled data) and the strict test, and click any spot to see its numbers.
- **How it works:** the method, a glossary that defines every term and number on the site, the limits, and the sources.

### Verdicts

| Verdict | Meaning |
|---|---|
| **Real signal** | Survives the strict test: false-discovery rate q < 0.05 |
| **Not proven yet** | Might be luck (corrected p < 0.2). We estimate how many more years of data would give a 90% chance of detecting it |
| **No clear trend** | Corrected p ≥ 0.2: we can't tell it apart from noise |

## Data

- **NASA GMAO MERRA-2** monthly reanalysis, 1980–2025, from NASA GES DISC. Collections M2TMNXSLV, M2TMNXFLX, M2TMNXLND and M2TMNXAER v5.12.4, about 2,200 files, subset through Earthdata Cloud OPeNDAP.
- **9 variables:** air temperature, water vapor, rain and snow, evaporation, root-zone soil moisture, snow on the ground, surface runoff, aerosol (haze) and dust optical depth.
- **21 curated regions**, from the Arctic and the Sahara to Delhi and the Chesapeake Bay, plus a global grid of 12,960 squares.
- **NOAA CPC detrended Niño 3.4 index**, used to remove El Niño.

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
- **Beijing haze:** Not proven yet. A simple test says haze rose (p = 0.002), but haze climbed until the mid-2000s, stayed high until about 2015, and then fell. After correcting for autocorrelation and multiple testing, q = 0.11. Since 2003 there has been a significant decline.
- **Murray-Darling Basin surface runoff:** Not proven yet. Down about 27% since 1980 (q = 0.25). The year-to-year swings are so large that, at this size, it would take about 70 more years of data for a 90% chance of detecting it.

## Limitations

- MERRA-2 is a reanalysis (a model constrained by observations), not raw measurements.
- Aerosol and dust trends can partly reflect changes over time in which satellite data was assimilated (AVHRR, MODIS, MISR).
- Trends are linear and use yearly means. Rise-then-fall patterns are better described by the walk-forward check.
- Grid squares are about 200 km across, so a city is averaged with its surroundings.

## Tech

- **Pipeline:** Python (numpy, scipy, xarray, netCDF4, pymannkendall for tests), writing static JSON.
- **Web:** Next.js 16 + Tailwind CSS 4, Motion (scroll-scrubbed animation), Lenis (smooth scrolling), react-globe.gl / three.js (3D globe). Charts are hand-built in SVG and canvas. Prerendered static pages on Vercel.

## Run it

See [README.md](README.md). In short: `pip install -r pipeline/requirements.txt`, set `EARTHDATA_TOKEN`, run `python pipeline/download_merra2.py` and then `python pipeline/build.py`, and finally `cd web && npm install && npm run dev`.

## References

Gelaro et al. 2017 (J. Climate), MERRA-2 · Randles et al. 2017 (J. Climate), MERRA-2 aerosols · Hamed & Rao 1998 (J. Hydrology) · Benjamini & Hochberg 1995 (JRSS-B) · Wilks 2016 (BAMS 97(12)) · Weatherhead et al. 1998 (JGR) · Rantanen et al. 2022 (Communications Earth & Environment) · NOAA CPC Niño 3.4 · Natural Earth.

## AI assistance

Built with help from Claude (Anthropic) for code, design and writing; the authorship is recorded in the commit history.
