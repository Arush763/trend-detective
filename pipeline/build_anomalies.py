"""Yearly air-temperature anomalies for every square of the website's 2° x 2.5° map, for the globe's year scrubber.

Run after download_merra2.py:
    python build_anomalies.py

Outputs (data/processed/grid/):
    T2M_anom.bin    int8, [year][square] in the same row-major square order as grid/T2M.json; value = int8 * step °C,
                    -128 = no data. Anomaly = that year's mean minus the square's own 1980-2025 mean. Real yearly
                    means only: nothing is smoothed, filled in or extrapolated.
    T2M_anom.json   years, step, baseline, shape, and how many values had to be clipped to fit int8
"""
import json

import numpy as np
import xarray as xr

from build import NM, NY, YEARS, annual, expected_files, setup_grid
from config import OUT_DIR, VARIABLES

STEP = 0.05  # °C per int8 unit: ±6.35 °C fits


def main():
    files = expected_files("M2TMNXSLV")
    missing = [f for f in files if not f.exists()]
    if missing:
        raise SystemExit(f"{len(missing)} months missing. Run download_merra2.py first.")
    with xr.open_dataset(files[0]) as ds0:
        lat_c, lon_c, coarsen, _ = setup_grid(ds0["lat"].values, ds0["lon"].values)
    monthly = np.empty((NM, len(lat_c), len(lon_c)), dtype=np.float32)
    for k, f in enumerate(files):
        with xr.open_dataset(f) as ds:
            monthly[k] = coarsen(VARIABLES["T2M"]["convert"](ds["T2M"].values.squeeze().astype(np.float64)))
        if (k + 1) % 120 == 0:
            print(f"    {k + 1}/{NM} months")
    A = annual(monthly).reshape(NY, -1)                 # (years, squares)
    anom = A - np.nanmean(A, axis=0, keepdims=True)
    ok = np.isfinite(anom)
    q = np.full(anom.shape, -128, dtype=np.int8)
    raw = np.round(anom[ok] / STEP)
    clipped = int(np.sum(np.abs(raw) > 127))
    q[ok] = np.clip(raw, -127, 127).astype(np.int8)
    out = OUT_DIR / "grid"
    (out / "T2M_anom.bin").write_bytes(q.tobytes())
    # The squares must line up with grid/T2M.json, which build.py wrote from the same coarsening.
    shape = json.loads((out / "T2M.json").read_text(encoding="utf-8"))["shape"]
    assert shape == [len(lat_c), len(lon_c)], (shape, len(lat_c), len(lon_c))
    info = {"var": "T2M", "years": YEARS, "step": STEP, "units": "°C", "shape": shape, "nodata": -128,
            "baseline": f"each square's own {YEARS[0]}-{YEARS[-1]} mean", "clipped": clipped,
            "range": [round(float(np.nanmin(anom)), 2), round(float(np.nanmax(anom)), 2)]}
    (out / "T2M_anom.json").write_text(json.dumps(info), encoding="utf-8")
    print(f"{q.nbytes / 1e3:.0f} KB, anomalies {info['range'][0]} to {info['range'][1]} °C, {clipped} values clipped to ±6.35 °C")


if __name__ == "__main__":
    main()
