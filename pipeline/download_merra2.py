"""Download monthly MERRA-2 variable subsets from NASA GES DISC (Earthdata Cloud OPeNDAP).

Auth: set ONE of these in your terminal before running (never commit them):
    EARTHDATA_TOKEN                      (Earthdata Login bearer token), or
    EARTHDATA_USERNAME + EARTHDATA_PASSWORD

Usage:
    python download_merra2.py --test     # grab Jan 1980 only and print what came back
    python download_merra2.py            # full download (resumable; re-run to continue)
"""
import argparse
import concurrent.futures as cf
import os
import re
import sys
import time
from urllib.parse import quote

import requests

from config import COLLECTIONS, END_YEAR, RAW_DIR, START_YEAR, VERSION

CMR = "https://cmr.earthdata.nasa.gov/search"
OPENDAP = "https://opendap.earthdata.nasa.gov/collections"
URS = "urs.earthdata.nasa.gov"
HDF5_MAGIC = b"\x89HDF\r\n\x1a\n"
# GES DISC retired its on-prem OPeNDAP (goldsmr4) in 2026; data now lives in
# Earthdata Cloud and is subset through Cloud OPeNDAP (Hyrax, DAP4).


class EDLSession(requests.Session):
    """Keeps credentials across the Earthdata Login redirect (NASA's documented pattern)."""

    def rebuild_auth(self, prepared_request, response):
        headers = prepared_request.headers
        if "Authorization" in headers:
            orig = requests.utils.urlparse(response.request.url).hostname
            new = requests.utils.urlparse(prepared_request.url).hostname
            if orig != new and new != URS and orig != URS:
                del headers["Authorization"]


def make_session():
    s = EDLSession()
    token = os.environ.get("EARTHDATA_TOKEN")
    user, pw = os.environ.get("EARTHDATA_USERNAME"), os.environ.get("EARTHDATA_PASSWORD")
    if token:
        s.headers["Authorization"] = f"Bearer {token.strip()}"
    elif user and pw:
        s.auth = (user, pw)
    else:
        sys.exit("Set EARTHDATA_TOKEN (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD) first.")
    return s


_GRANULES = {}


def granule_index(coll):
    """Map YYYYMM -> (collection concept id, granule UR) from NASA CMR.
    CMR knows the real file names, so stream ids (100/200/300/400/401) are handled for us."""
    if coll in _GRANULES:
        return _GRANULES[coll]
    r = requests.get(f"{CMR}/collections.json",
                     params={"short_name": coll, "version": VERSION}, timeout=60)
    r.raise_for_status()
    concept = r.json()["feed"]["entry"][0]["id"]
    idx, page = {}, 1
    while True:
        r = requests.get(f"{CMR}/granules.json",
                         params={"collection_concept_id": concept, "page_size": 2000, "page_num": page},
                         timeout=120)
        r.raise_for_status()
        entries = r.json()["feed"]["entry"]
        for e in entries:
            m = re.search(r"\.(\d{6})\.nc4$", e["title"])
            if m:
                idx[m.group(1)] = (concept, e["title"])
        if len(entries) < 2000:
            break
        page += 1
    _GRANULES[coll] = idx
    return idx


def url_for(coll, year, month):
    concept, ur = granule_index(coll)[f"{year}{month:02d}"]
    ce = ";".join("/" + v for v in COLLECTIONS[coll]["vars"] + ["lat", "lon", "time"])
    return f"{OPENDAP}/{concept}/granules/{quote(ur, safe='')}.dap.nc4?dap4.ce={quote(ce, safe='/;')}"


def fetch(session, coll, year, month, retries=4):
    out = RAW_DIR / coll / f"{year}{month:02d}.nc4"
    if out.exists() and out.stat().st_size > 1000:
        return "skip", out
    out.parent.mkdir(parents=True, exist_ok=True)
    last_err = None
    try:
        url = url_for(coll, year, month)
    except KeyError:
        return "fail", f"{coll} {year}-{month:02d}: no granule in CMR"
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=180)
            if r.status_code in (401, 403):
                raise SystemExit(
                    f"Auth failed ({r.status_code}). Check your token, and that you've approved "
                    f"'NASA GESDISC DATA ARCHIVE' in your Earthdata profile.\n{r.text[:400]}\nURL: {url}")
            r.raise_for_status()
            if not r.content.startswith(HDF5_MAGIC):
                snippet = r.content[:300].decode("utf-8", "replace")
                raise RuntimeError(f"Not a netCDF file (probably a login or error page): {snippet}")
            tmp = out.with_suffix(".part")
            tmp.write_bytes(r.content)
            tmp.replace(out)
            return "ok", out
        except SystemExit:
            raise
        except Exception as e:  # network hiccup: back off and retry
            last_err = str(e)
            time.sleep(2 ** attempt)
    return "fail", f"{coll} {year}-{month:02d}: {last_err}"


def smoke_test(session):
    import xarray as xr
    print("Smoke test: downloading January 1980 for each collection...\n")
    for coll, c in COLLECTIONS.items():
        status, res = fetch(session, coll, 1980, 1)
        if status == "fail":
            print(f"  FAIL {res}")
            continue
        ds = xr.open_dataset(res)
        print(f"  {coll}: {res.stat().st_size/1e6:.1f} MB")
        for v in c["vars"]:
            if v not in ds:
                print(f"    MISSING variable {v}")
                continue
            a = ds[v]
            print(f"    {v:12s} shape={tuple(a.shape)}  min={float(a.min()):.4g}  max={float(a.max()):.4g}  units={a.attrs.get('units','?')}")
        ds.close()
    print("\nIf every variable printed with sensible numbers, run without --test.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="download only Jan 1980 and inspect it")
    ap.add_argument("--workers", type=int, default=4, help="parallel downloads (keep it polite: 4-6)")
    args = ap.parse_args()

    session = make_session()
    if args.test:
        smoke_test(session)
        return

    jobs = [(c, y, m) for c in COLLECTIONS for y in range(START_YEAR, END_YEAR + 1) for m in range(1, 13)]
    print(f"{len(jobs)} files to check/download into {RAW_DIR}")
    done = fails = 0
    failures = []
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(fetch, session, *j) for j in jobs]
        for f in cf.as_completed(futs):
            status, res = f.result()
            done += 1
            if status == "fail":
                fails += 1
                failures.append(res)
            if done % 50 == 0 or done == len(jobs):
                rate = done / max(time.time() - t0, 1)
                eta = (len(jobs) - done) / max(rate, 1e-6) / 60
                print(f"  {done}/{len(jobs)} done, {fails} failed, ~{eta:.0f} min left")
    if failures:
        print("\nFailed (re-run the script to retry these):")
        for x in failures[:30]:
            print("  ", x)
    else:
        print("\nAll files downloaded.")


if __name__ == "__main__":
    main()
