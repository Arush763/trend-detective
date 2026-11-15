"""Yearly values for every 1° x 1.25° square on Earth, so the website can build a case for ANY place.

Run after build.py (it reads the region results for the false-discovery family):
    python build_places.py

Outputs (data/processed/places/):
    index.json        grid geometry, tile layout, variable order, years, and the p-values of every
                      region x variable test (the website adds a custom place's tests to that family)
    t_<r>_<c>.bin     one 10° x 10° tile: for each variable a float32 [mid, step] header, then int16
                      values laid out [variable][row][col][year]; value = mid + step * int16,
                      -32768 = no data (e.g. ocean for land-only variables)

The browser downloads only the tiles a place touches, averages the squares inside the place's
outline (weighted by area), and runs the same statistics as stats.py on that series.
"""
import json
import time

import numpy as np
import xarray as xr

from build import NM, NY, YEARS, annual, expected_files
from config import COLLECTIONS, OUT_DIR, VARIABLES

DLAT, DLON = 1.0, 1.25          # 2 x 2 MERRA-2 cells (native 0.5° x 0.625°)
TILE_R, TILE_C = 10, 8           # 10° x 10° tiles
NODATA = -32768
VARS = [v for c in COLLECTIONS.values() for v in c["vars"]]


def coarsen_factory(lat, lon):
    fy, fx = round(DLAT / abs(lat[1] - lat[0])), round(DLON / abs(lon[1] - lon[0]))
    ny = (len(lat) - 1) // fy * fy           # drop the -90 pole row, as build.py does
    nx = len(lon) // fx * fx
    lat_c = lat[1:1 + ny].reshape(-1, fy).mean(axis=1)
    lon_c = lon[:nx].reshape(-1, fx).mean(axis=1)

    def coarsen(a):
        b = a[1:1 + ny, :nx]
        return np.nanmean(b.reshape(ny // fy, fy, nx // fx, fx), axis=(1, 3))
    return lat_c, lon_c, coarsen


def read_annual():
    out, lat_c, lon_c = {}, None, None
    for coll, spec in COLLECTIONS.items():
        files = expected_files(coll)
        missing = [f for f in files if not f.exists()]
        if missing:
            raise SystemExit(f"{coll}: {len(missing)} months missing. Run download_merra2.py first.")
        with xr.open_dataset(files[0]) as ds0:
            lat_c, lon_c, coarsen = coarsen_factory(ds0["lat"].values, ds0["lon"].values)
        monthly = {v: np.empty((NM, len(lat_c), len(lon_c)), dtype=np.float32) for v in spec["vars"]}
        t0 = time.time()
        for k, f in enumerate(files):
            with xr.open_dataset(f) as ds:
                for v in spec["vars"]:
                    monthly[v][k] = coarsen(VARIABLES[v]["convert"](ds[v].values.squeeze().astype(np.float64)))
            if (k + 1) % 120 == 0:
                print(f"    {coll}: {k + 1}/{NM} months ({time.time() - t0:.0f}s)")
        for v in spec["vars"]:
            out[v] = annual(monthly[v])           # (NY, nlat, nlon); NaN where a square has no data
    return lat_c, lon_c, out


def quantize(block):
    """block: any shape, float. Returns (mid, step, int16 array) with NaN -> NODATA."""
    ok = np.isfinite(block)
    if not ok.any():
        return 0.0, 1.0, np.full(block.shape, NODATA, dtype="<i2")
    lo, hi = float(block[ok].min()), float(block[ok].max())
    mid, step = (lo + hi) / 2, (hi - lo) / 65534 or 1.0
    q = np.full(block.shape, NODATA, dtype="<i2")
    q[ok] = np.clip(np.round((block[ok] - mid) / step), -32767, 32767).astype("<i2")
    return mid, step, q


def family_p():
    """Hamed-Rao p of every region x variable test the app shows (the FDR family build.py used)."""
    ps = []
    for f in sorted((OUT_DIR / "regions").glob("*.json")):
        for d in json.loads(f.read_text(encoding="utf-8"))["variables"].values():
            if d.get("p_hr") is not None:
                ps.append(d["p_hr"])
    return ps


def main():
    t0 = time.time()
    lat_c, lon_c, A = read_annual()
    nlat, nlon = len(lat_c), len(lon_c)
    out = OUT_DIR / "places"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("t_*.bin"):
        f.unlink()
    n_tiles, worst = 0, 0.0
    for tr in range(0, nlat, TILE_R):
        for tc in range(0, nlon, TILE_C):
            head, body = [], []
            for v in VARS:
                block = np.moveaxis(A[v][:, tr:tr + TILE_R, tc:tc + TILE_C], 0, -1)  # (rows, cols, NY)
                mid, step, q = quantize(block)
                ok = q != NODATA
                if ok.any():
                    worst = max(worst, float(np.abs(mid + step * q[ok].astype(float) - block[ok]).max() / (np.nanstd(block) or 1)))
                head += [mid, step]
                body.append(q.ravel())
            (out / f"t_{tr // TILE_R}_{tc // TILE_C}.bin").write_bytes(
                np.array(head, dtype="<f4").tobytes() + np.concatenate(body).tobytes())
            n_tiles += 1
    fam = family_p()
    index = {
        "years": YEARS, "vars": VARS,
        "lat0": round(float(lat_c[0]), 6), "lon0": round(float(lon_c[0]), 6), "dlat": DLAT, "dlon": DLON,
        "nlat": nlat, "nlon": nlon, "tile": [TILE_R, TILE_C], "nodata": NODATA,
        "family_p": fam,
        "source": "NASA GMAO MERRA-2 monthly (M2TMNXSLV/FLX/LND/AER v5.12.4) via NASA GES DISC; yearly means, "
                  "averaged from the native 0.5° x 0.625° grid to 1° x 1.25°.",
    }
    (out / "index.json").write_text(json.dumps(index), encoding="utf-8")
    size = sum(f.stat().st_size for f in out.glob("t_*.bin"))
    print(f"{n_tiles} tiles, {size / 1e6:.1f} MB, {nlat}x{nlon} squares, {len(fam)} family tests, "
          f"worst rounding error {worst:.2e} of a tile's spread, {time.time() - t0:.0f}s")
    assert NY == len(YEARS) and n_tiles == -(-nlat // TILE_R) * -(-nlon // TILE_C)


if __name__ == "__main__":
    main()
