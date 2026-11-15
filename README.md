# Trend Detective: Signal or Noise?

NASA Space Apps 2026, challenge "Be An Earth System Trend Detective!"

**Live app: https://trend-detective.vercel.app**

Test 12,960 places for a trend and about 650 will look "significant" by pure luck.
Trend Detective tests 46 years of NASA MERRA-2 data region by region and cell by cell,
then shows which trends survive the checks that luck rarely passes.

## What it does

1. **Open a case anywhere on Earth.** Search for any country, state, island, city or coordinates (place outlines from OpenStreetMap). The app averages the NASA squares inside the outline and runs every check on that place. Or pick a kind of place (desert, rainforest, city, polar...) and one of 21 built-in regions, with suggested variables for each kind.
2. **What to look at.** The region's variables ranked by signal-to-noise, suggested ones first, each with a plain-English definition.
3. **The data, four checks, a verdict.** Yearly values with the seasonal cycle removed, the Sen's slope trend with a 95% confidence interval, Mann-Kendall p-values (naive, autocorrelation-corrected, shuffle test), a false-discovery-rate q-value, and a verdict.
   - **Remove El Niño:** regresses out the detrended Niño 3.4 index, so a few big El Niño years can't fake a trend.
   - **Years until we'd know:** for trends that aren't significant yet, how many years of data it would take (Weatherhead et al. 1998).
   - **Walk-forward:** finds the trend in 1980–2002, then checks if it holds in 2003–2025 (confirmed / continuing / faded / reversed / emerging).
4. **Ask a question.** Type "Is New Jersey getting wetter?" and jump straight to that case (plain keyword matching, no AI).
5. **Same cause, opposite effects (`/compare`).** The Amazon got less rain and the Himalaya & Tibet more, while both got warmer and moister; compare any two places side by side.
6. **Checked against the ground.** The Beijing haze trend is overlaid with NASA AERONET sun-photometer observations (`pipeline/aeronet.py`).
7. **Use this case.** Copy a link, download the numbers as CSV, or copy a citation.
8. **Map with a 3-way toggle.** Every 2° × 2.5° grid cell: naive p < 0.05, then the same test on shuffled data (pure noise still "finds" trends in ~5% of cells), then the real signal after Hamed-Rao and Benjamini-Hochberg corrections.

## Data

- **NASA GMAO MERRA-2** monthly reanalysis, 1980–2025 (M2TMNXSLV, M2TMNXFLX, M2TMNXLND, M2TMNXAER v5.12.4), from NASA GES DISC through Earthdata Cloud OPeNDAP: air temperature, water vapor, precipitation, evaporation, root-zone soil moisture, snow, runoff, aerosol and dust optical depth.
- **NOAA CPC** detrended Niño 3.4 index.
- Coastlines: Natural Earth (public domain).

## Run it

The processed data (`data/processed`) is committed, so to run the site you only need Node:

```
cd web && npm install && npm run dev
```

To rebuild the data from NASA (Python 3.11+, a free Earthdata Login token):

```
pip install -r pipeline/requirements.txt
$env:EARTHDATA_TOKEN = "<your Earthdata Login token>"   # PowerShell; bash: export EARTHDATA_TOKEN=...  Never commit it.
python pipeline/download_merra2.py --test   # check one month
python pipeline/download_merra2.py          # ~2,200 files, ~2.3 GB, resumable
python pipeline/build.py                    # writes data/processed (~10 min)
python pipeline/build_places.py             # yearly values for every 1° x 1.25° square, for "any place" (~12 min)
python pipeline/aeronet.py                  # Beijing ground-station check (no login needed)
python pipeline/test_stats.py               # checks our statistics against pymannkendall
cd web && node scripts/check-stats.ts       # checks the browser port of the statistics against stats.py
```

## Methods and references

- Mann-Kendall trend test with the Hamed & Rao (1998) autocorrelation correction (J. Hydrology), applied conservatively: the correction can only widen the variance.
- Theil-Sen slope with the Gilbert (1987) confidence interval.
- Benjamini & Hochberg (1995) false discovery rate (JRSS-B); see Wilks (2016), "The Stippling Shows Statistically Significant Grid Points" (BAMS 97(12), 2263–2273) on why climate maps need it.
- Weatherhead et al. (1998), years needed to detect a trend (JGR).
- MERRA-2: Gelaro et al. (2017), J. Climate. Aerosols: Randles et al. (2017), J. Climate.
- Sanity check against Rantanen et al. (2022), Communications Earth & Environment (Arctic amplification).

## Known limits

- MERRA-2 is a reanalysis (a model constrained by observations), not raw measurements. Reanalyses disagree on Arctic trends, so our Arctic/global warming ratio comes out a little below the observed one.
- Aerosol and dust trends can partly reflect changes in which satellites were fed into MERRA-2 over time.
- Trends are linear, on yearly means.
