"""Turn downloaded MERRA-2 monthly files into the JSON the website reads.

Run after download_merra2.py has finished:
    python build.py

Outputs (data/processed/):
    meta.json             variables, regions, years, sanity check
    regions/<id>.json     per-region time series + full statistics for every variable
    grid/<VAR>.json       2° x 2.5° global map of trends for each variable
"""
import json
import math
import time
import warnings

import numpy as np
import requests
import xarray as xr

import stats
from config import COLLECTIONS, END_YEAR, OUT_DIR, RAW_DIR, ROOT, START_YEAR, VARIABLES
from regions import REGIONS, SUGGESTIONS

YEARS = list(range(START_YEAR, END_YEAR + 1))
NY = len(YEARS)
NM = NY * 12
SPLIT_YEAR = 2003                       # walk-forward: 1980-2002 in-sample, 2003-2025 out-of-sample
SPLIT = YEARS.index(SPLIT_YEAR)
TARGET_DLAT, TARGET_DLON = 2.0, 2.5     # map grid
ENSO_URL = "https://www.cpc.ncep.noaa.gov/data/indices/detrend.nino34.ascii.txt"
ENSO_CACHE = ROOT / "data" / "nino34_detrended.txt"

warnings.filterwarnings("ignore", category=RuntimeWarning)


def rnd(x, sig=4):
    if x is None:
        return None
    x = float(x)
    if not math.isfinite(x):
        return None
    return float(f"{x:.{sig}g}")


def rlist(a, sig=4):
    return [rnd(v, sig) for v in np.asarray(a).ravel()]


# ---------------------------------------------------------------- ENSO
def load_enso():
    """Annual Niño 3.4 index (detrended, NOAA CPC). For calendar year Y we average
    Sep(Y-1)..Aug(Y), because El Niño's effect on the rest of the world lags by a few months."""
    if not ENSO_CACHE.exists():
        print("Downloading Niño 3.4 index from NOAA CPC...")
        r = requests.get(ENSO_URL, timeout=60)
        r.raise_for_status()
        ENSO_CACHE.parent.mkdir(parents=True, exist_ok=True)
        ENSO_CACHE.write_text(r.text)
    monthly = {}
    for line in ENSO_CACHE.read_text().splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 5:
            monthly[(int(parts[0]), int(parts[1]))] = float(parts[-1])
    annual = []
    for y in YEARS:
        months = [(y - 1, m) for m in range(9, 13)] + [(y, m) for m in range(1, 9)]
        annual.append(np.mean([monthly[k] for k in months]))
    return np.array(annual)


# ---------------------------------------------------------------- reading
def expected_files(coll):
    return [RAW_DIR / coll / f"{y}{m:02d}.nc4" for y in YEARS for m in range(1, 13)]


def setup_grid(lat, lon):
    dlat = abs(float(lat[1] - lat[0]))
    dlon = abs(float(lon[1] - lon[0]))
    fy = max(1, round(TARGET_DLAT / dlat))
    fx = max(1, round(TARGET_DLON / dlon))
    ny_keep = (len(lat) - 1) // fy * fy   # drop the -90 pole row, then trim to a multiple
    nx_keep = len(lon) // fx * fx
    lat_c = lat[1:1 + ny_keep].reshape(-1, fy).mean(axis=1)
    lon_c = lon[:nx_keep].reshape(-1, fx).mean(axis=1)

    def coarsen(a):
        b = a[1:1 + ny_keep, :nx_keep]
        return np.nanmean(b.reshape(ny_keep // fy, fy, nx_keep // fx, fx), axis=(1, 3))

    LAT, LON = np.meshgrid(lat, lon, indexing="ij")
    W = np.cos(np.deg2rad(LAT))
    masks = []
    for r in REGIONS:
        a, b, c, d = r["box"]
        masks.append((LAT >= a) & (LAT <= b) & (LON >= c) & (LON <= d))

    def region_means(a):
        out = np.full(len(masks), np.nan)
        for i, m in enumerate(masks):
            v, w = a[m], W[m]
            ok = np.isfinite(v)
            if ok.sum() >= max(4, 0.2 * m.sum()):  # land-only vars: average over the land part
                out[i] = np.sum(v[ok] * w[ok]) / np.sum(w[ok])
        return out

    return lat_c, lon_c, coarsen, region_means


def read_collection(coll):
    files = expected_files(coll)
    missing = [f.name for f in files if not f.exists()]
    if missing:
        raise SystemExit(f"{coll}: {len(missing)} months missing (e.g. {missing[:3]}). "
                         f"Re-run download_merra2.py first.")
    with xr.open_dataset(files[0]) as ds0:
        lat, lon = ds0["lat"].values, ds0["lon"].values
    lat_c, lon_c, coarsen, region_means = setup_grid(lat, lon)
    vars_ = COLLECTIONS[coll]["vars"]
    grid = {v: np.empty((NM, len(lat_c), len(lon_c)), dtype=np.float32) for v in vars_}
    reg = {v: np.empty((NM, len(REGIONS))) for v in vars_}
    t0 = time.time()
    for k, f in enumerate(files):
        with xr.open_dataset(f) as ds:
            for v in vars_:
                a = VARIABLES[v]["convert"](ds[v].values.squeeze().astype(np.float64))
                grid[v][k] = coarsen(a)
                reg[v][k] = region_means(a)
        if (k + 1) % 120 == 0:
            print(f"    {coll}: {k + 1}/{NM} months read ({time.time() - t0:.0f}s)")
    return lat_c, lon_c, grid, reg


# ---------------------------------------------------------------- analysis
def annual(monthly):
    return monthly.reshape(NY, 12, *monthly.shape[1:]).mean(axis=1)


def valid_rows(Y):
    """Usable series: no gaps, not constant, not mostly identical values (e.g. snow = 0 every year)."""
    ok = np.all(np.isfinite(Y), axis=1) & (np.nanstd(Y, axis=1) > 0)
    distinct = np.array([len(np.unique(r)) if o else 0 for r, o in zip(Y, ok)])
    return ok & (distinct >= 0.5 * Y.shape[1])


def analyze(Y, enso):
    """Full battery of tests on rows of Y (m, NY). Returns dict of arrays."""
    hr = stats.mann_kendall(Y, correct_autocorr=True)
    naive = stats.mann_kendall(Y, correct_autocorr=False)
    noise = stats.mann_kendall(stats.shuffle_rows(Y), correct_autocorr=False)
    adj, enso_coef, enso_p = stats.remove_enso(Y, enso)
    hr_e = stats.mann_kendall(adj, correct_autocorr=True)
    wf, first, second = stats.walk_forward(Y, SPLIT)
    nstar, sigma, phi = stats.years_to_detect(Y, hr["slope"])
    return dict(hr=hr, naive=naive, noise=noise, hr_e=hr_e, enso_coef=enso_coef, enso_p=enso_p,
                wf=wf, first=first, second=second, nstar=nstar, sigma=sigma, phi=phi,
                mean=Y.mean(axis=1))


def build_grid(var, lat_c, lon_c, monthly, enso):
    A = annual(monthly)                               # (NY, nlat, nlon)
    Y = A.reshape(NY, -1).T                           # (cells, NY)
    ok = valid_rows(Y)
    m = Y.shape[0]
    res = analyze(Y[ok], enso)

    def full(x):
        out = np.full(m, np.nan)
        out[ok] = x
        return out

    q = full(stats.fdr_bh(res["hr"]["p"]))
    q_e = full(stats.fdr_bh(res["hr_e"]["p"]))
    out = {
        "var": var,
        "shape": [len(lat_c), len(lon_c)],
        "slope_decade": rlist(full(res["hr"]["slope"] * 10)),
        "p_naive": rlist(full(res["naive"]["p"]), 3),
        "p_noise": rlist(full(res["noise"]["p"]), 3),
        "p_hr": rlist(full(res["hr"]["p"]), 3),
        "q": rlist(q, 3),
        "slope_enso_decade": rlist(full(res["hr_e"]["slope"] * 10)),
        "q_enso": rlist(q_e, 3),
        "wf": [None if not math.isfinite(v) else int(v) for v in full(res["wf"])],
        "mean": rlist(full(res["mean"])),
    }
    n_valid = int(ok.sum())
    summary = {
        "cells": n_valid,
        "naive_sig": int(np.sum(res["naive"]["p"] < 0.05)),
        "noise_sig": int(np.sum(res["noise"]["p"] < 0.05)),
        "real_sig": int(np.nansum(q < 0.05)),
        "enso_real_sig": int(np.nansum(q_e < 0.05)),
    }
    out["summary"] = summary
    return out


def verdict(q, p):
    """Significant only if it survives FDR across every test the app shows; 'possible' = a hint."""
    if q < 0.05:
        return "significant"
    if p < 0.2:
        return "possible"
    return "none"


def region_payloads(reg_monthly, enso):
    """reg_monthly: {var: (NM, nregions)}. Returns per-region dicts and the sanity check."""
    payload = {r["id"]: {**{k: r[k] for k in ("id", "name", "type", "blurb")},
                         "box": list(r["box"]), "variables": {}} for r in REGIONS}
    all_p, all_keys = [], []
    for var, M in reg_monthly.items():
        A = annual(M).T                                # (nregions, NY)
        ok = valid_rows(A)
        if not ok.any():
            continue
        res = analyze(A[ok], enso)
        idx = np.where(ok)[0]
        clim = np.nanmean(M.reshape(NY, 12, -1), axis=0)          # (12, nregions)
        anom = (M.reshape(NY, 12, -1) - clim[None]).reshape(NM, -1)
        for j, ri in enumerate(idx):
            rid = REGIONS[ri]["id"]
            y = A[ri]
            slope = res["hr"]["slope"][j]
            total = slope * (NY - 1)
            mean = res["mean"][j]
            nstar = res["nstar"][j]
            p_hr = res["hr"]["p"][j]
            d = {
                "annual": rlist(y, 5),
                "monthly_anom": rlist(anom[:, ri], 4),
                "mean": rnd(mean),
                "slope_decade": rnd(slope * 10),
                "ci_decade": [rnd(res["hr"]["ci_low"][j] * 10), rnd(res["hr"]["ci_high"][j] * 10)],
                "intercept": rnd(res["hr"]["intercept"][j], 6),
                "total_change": rnd(total),
                "pct_change": rnd(100 * total / mean) if (mean and mean > 0 and VARIABLES[var].get("pct", True)) else None,
                "p_naive": rnd(res["naive"]["p"][j], 3),
                "p_hr": rnd(p_hr, 3),
                "p_perm": rnd(stats.permutation_p(y), 3),
                "noise_level": rnd(res["sigma"][j]),
                "autocorr": rnd(res["phi"][j], 3),
                "snr": rnd(abs(total) / res["sigma"][j]) if res["sigma"][j] > 0 else None,
                "years_needed": rnd(nstar, 3) if math.isfinite(nstar) else None,
                "years_more": (max(0, math.ceil(nstar) - NY) if math.isfinite(nstar) else None),
                "enso_coef": rnd(res["enso_coef"][j]),
                "enso_p": rnd(res["enso_p"][j], 3),
                "slope_enso_decade": rnd(res["hr_e"]["slope"][j] * 10),
                "p_enso_hr": rnd(res["hr_e"]["p"][j], 3),
                "walk_forward": {
                    "code": int(res["wf"][j]), "label": stats.WF_LABELS[int(res["wf"][j])],
                    "first": {"years": [YEARS[0], YEARS[SPLIT - 1]],
                              "slope_decade": rnd(res["first"]["slope"][j] * 10),
                              "p": rnd(res["first"]["p"][j], 3)},
                    "second": {"years": [YEARS[SPLIT], YEARS[-1]],
                               "slope_decade": rnd(res["second"]["slope"][j] * 10),
                               "p": rnd(res["second"]["p"][j], 3)},
                },
            }
            payload[rid]["variables"][var] = d
            all_p.append(p_hr)
            all_keys.append((rid, var))
    # FDR across every region x variable test shown in the app
    q = stats.fdr_bh(np.array(all_p))
    for (rid, var), qv in zip(all_keys, q):
        d = payload[rid]["variables"][var]
        d["q"] = rnd(qv, 3)
        d["verdict"] = verdict(qv, d["p_hr"])
    for rid, pdata in payload.items():
        pdata["screener"] = sorted(
            pdata["variables"].keys(),
            key=lambda v: -(pdata["variables"][v]["snr"] or 0))
    g = payload["global"]["variables"].get("T2M", {})
    a = payload["arctic"]["variables"].get("T2M", {})
    sanity = None
    if g and a:
        # same period as the published study, so the comparison is fair
        m = YEARS.index(2021) + 1
        gm, am = (stats.sen_slope(np.array([x["annual"][:m]]))[0][0] * 10 for x in (g, a))
        sanity = {"global_T2M_decade": g["slope_decade"], "arctic_T2M_decade": a["slope_decade"],
                  "ratio": rnd(a["slope_decade"] / g["slope_decade"], 3) if g["slope_decade"] else None,
                  "matched": {"years": [YEARS[0], 2021], "global_T2M_decade": rnd(gm), "arctic_T2M_decade": rnd(am),
                              "ratio": rnd(am / gm, 3) if gm else None},
                  "reference": "Rantanen et al. 2022 (observations, 1979-2021): Arctic 0.73 vs global 0.19 °C/decade, ratio about 3.8",
                  "note": "Reanalyses disagree on Arctic trends (roughly 0.3 to 0.7 °C/decade over 1980-2013), "
                          "so a MERRA-2 ratio a little below the observed one is expected."}
    return payload, sanity


# ---------------------------------------------------------------- main
def main():
    t0 = time.time()
    enso = load_enso()
    (OUT_DIR / "grid").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "regions").mkdir(parents=True, exist_ok=True)

    reg_monthly = {}
    grid_axes = None
    grid_summaries = {}
    for coll in COLLECTIONS:
        print(f"Reading {coll}...")
        lat_c, lon_c, grid, reg = read_collection(coll)
        grid_axes = grid_axes or {"lat": rlist(lat_c, 6), "lon": rlist(lon_c, 6)}
        for var in grid:
            print(f"  Analyzing map for {var}...")
            g = build_grid(var, lat_c, lon_c, grid[var], enso)
            grid_summaries[var] = g["summary"]
            (OUT_DIR / "grid" / f"{var}.json").write_text(json.dumps(g, separators=(",", ":")))
            reg_monthly[var] = reg[var]
        del grid

    print("Analyzing regions...")
    payload, sanity = region_payloads(reg_monthly, enso)
    for rid, d in payload.items():
        (OUT_DIR / "regions" / f"{rid}.json").write_text(json.dumps(d, separators=(",", ":")))

    meta = {
        "years": YEARS,
        "split_year": SPLIT_YEAR,
        "grid": grid_axes,
        "enso_annual": rlist(enso, 4),
        "variables": {v: {k: VARIABLES[v][k] for k in ("name", "units", "definition", "collection", "caveat")
                          if k in VARIABLES[v]}
                      for v in reg_monthly},
        "regions": [{**{k: r[k] for k in ("id", "name", "type", "blurb")}, "box": list(r["box"]),
                     "suggested": [v for v in SUGGESTIONS[r["type"]] if v in reg_monthly]}
                    for r in REGIONS],
        "grid_summary": grid_summaries,
        "sanity": sanity,
        "sources": {
            "data": "NASA GMAO MERRA-2 monthly reanalysis (M2TMNXSLV, M2TMNXFLX, M2TMNXLND, M2TMNXAER v5.12.4), via NASA GES DISC",
            "enso": "NOAA CPC detrended Niño 3.4 index",
        },
    }
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False))
    print(f"\nDone in {time.time() - t0:.0f}s. Output: {OUT_DIR}")
    if sanity:
        print(f"Sanity check: global {sanity['global_T2M_decade']} °C/decade, "
              f"Arctic {sanity['arctic_T2M_decade']} °C/decade, ratio {sanity['ratio']} (published ~3.8)")
    for v, s in grid_summaries.items():
        print(f"  {v:12s} cells={s['cells']:6d}  naive={s['naive_sig']:5d}  noise={s['noise_sig']:5d}  real(FDR)={s['real_sig']:5d}")


if __name__ == "__main__":
    main()
