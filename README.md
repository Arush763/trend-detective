# Trend Detective: Signal or Noise?

NASA Space Apps 2026, challenge "Be An Earth System Trend Detective!"

**Live app: https://trend-detective.vercel.app**

Test 13,000 places for a trend and about 650 will look "significant" by pure luck.
Trend Detective tests 46 years of NASA MERRA-2 data region by region and cell by cell,
then shows which trends survive the checks that luck can't pass.

## What it does

1. **Open a case.** Pick a kind of place (desert, rainforest, city, polar...) and a region. The app suggests the variables that matter for that kind of place.
2. **Earth Screener.** The region's 9 variables ranked by signal-to-noise, each with a plain-English definition.
3. **Case File.** Yearly values with the seasonal cycle removed, the Sen's slope trend with a 95% confidence interval, Mann-Kendall p-values (naive, autocorrelation-corrected, shuffle test), a false-discovery-rate q-value, and a verdict.
   - **Remove El Niño:** regresses out the detrended Niño 3.4 index, so a few big El Niño years can't fake a trend.
   - **Years until we'd know:** for trends that aren't significant yet, how many years of data it would take (Weatherhead et al. 1998).
   - **Walk-forward:** finds the trend in 1980–2002, then checks if it holds in 2003–2025 (confirmed / continuing / faded / reversed / emerging).
4. **Map with a 3-way toggle.** Every 2° × 2.5° grid cell: naive p < 0.05, then the same test on shuffled data (pure noise still "finds" trends in ~5% of cells), then the real signal after Hamed-Rao and Benjamini-Hochberg corrections.

## Data

- **NASA GMAO MERRA-2** monthly reanalysis, 1980–2025 (M2TMNXSLV, M2TMNXFLX, M2TMNXLND, M2TMNXAER v5.12.4), from NASA GES DISC through Earthdata Cloud OPeNDAP: air temperature, water vapor, precipitation, evaporation, root-zone soil moisture, snow, runoff, aerosol and dust optical depth.
- **NOAA CPC** detrended Niño 3.4 index.
- Coastlines: Natural Earth (public domain).

## Run it

```
pip install -r pipeline/requirements.txt
$env:EARTHDATA_TOKEN = "<your Earthdata Login token>"   # never commit it
python pipeline/download_merra2.py --test   # check one month
python pipeline/download_merra2.py          # ~2,200 files, ~2.3 GB, resumable
python pipeline/build.py                    # writes data/processed (~10 min)
python pipeline/test_stats.py               # checks our statistics against pymannkendall
cd web && npm install && npm run dev
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
