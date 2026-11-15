"""Independent check of the Beijing haze case against NASA AERONET ground observations.

MERRA-2's aerosol trends can partly come from changes in which satellites were fed into the model.
AERONET's Beijing sun photometer is one consistent ground instrument from 2001 on, so if it shows the
same rise and fall, the trend isn't an artefact of those changes.

Downloads Version 3, Level 2.0 (cloud-screened, quality-assured) daily averages for two Beijing sites
("Beijing", 2001-2019, and "Beijing-CAMS", 2012-2025; kept as separate series, never spliced), converts AOD at
440 nm (measured by every Cimel photometer) to 550 nm with the 440-870 nm Angstrom exponent (MERRA-2's TOTEXTTAU
is at 550 nm), and writes yearly means next to MERRA-2's Beijing-region yearly values:

    python pipeline/aeronet.py            # writes data/processed/validation/beijing_aeronet.json

No login needed. The raw download is cached in data/raw/aeronet/ (git-ignored).
"""
import csv
import io
import json
import math
from collections import defaultdict

import numpy as np
import requests

from config import OUT_DIR, RAW_DIR

SITES = ["Beijing", "Beijing-CAMS"]
URL = ("https://aeronet.gsfc.nasa.gov/cgi-bin/print_web_data_v3?site={site}&year=2001&month=1&day=1"
       "&year2=2025&month2=12&day2=31&AOD20=1&AVG=20&if_no_html=1")
MIN_DAYS_PER_MONTH = 5     # a month counts only with at least this many measured days
MIN_MONTHS_PER_YEAR = 9    # a year counts only with at least this many valid months (limits seasonal bias)


def download(site):
    path = RAW_DIR / "aeronet" / f"{site}_daily_lev20.csv"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(URL.format(site=site), timeout=300)
        r.raise_for_status()
        path.write_text(r.text, encoding="utf-8")
    return path.read_text(encoding="utf-8")


def yearly_aod550(text):
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("AERONET_Site,"))
    rows = csv.DictReader(io.StringIO("\n".join(lines[start:])))
    monthly = defaultdict(list)
    for row in rows:
        try:
            aod440 = float(row["AOD_440nm"])
            alpha = float(row["440-870_Angstrom_Exponent"])
        except (KeyError, ValueError):
            continue
        if aod440 < 0 or alpha < -10:  # -999 = missing
            continue
        d, m, y = (int(x) for x in row["Date(dd:mm:yyyy)"].split(":"))
        monthly[(y, m)].append(aod440 * (550 / 440) ** (-alpha))
    month_mean = {k: float(np.mean(v)) for k, v in monthly.items() if len(v) >= MIN_DAYS_PER_MONTH}
    years = defaultdict(list)
    for (y, m), v in month_mean.items():
        years[y].append(v)
    return {y: (float(np.mean(v)), len(v)) for y, v in sorted(years.items())}


def main():
    region = json.loads((OUT_DIR / "regions" / "beijing.json").read_text(encoding="utf-8"))
    meta = json.loads((OUT_DIR / "meta.json").read_text(encoding="utf-8"))
    years = meta["years"]
    merra = dict(zip(years, region["variables"]["TOTEXTTAU"]["annual"]))
    sites = []
    for site in SITES:
        obs = yearly_aod550(download(site))
        good = [y for y, (_, n) in obs.items() if n >= MIN_MONTHS_PER_YEAR and y in merra]
        a = np.array([obs[y][0] for y in good]); b = np.array([merra[y] for y in good])
        r = float(np.corrcoef(a, b)[0, 1])
        sites.append({
            "site": site,
            "years": good,
            "aod550": [round(float(x), 4) for x in a],
            "months_used": [obs[y][1] for y in good],
            "correlation": round(r, 2),
            "peak_year": good[int(np.argmax(a))],
            "mean_ratio_to_merra2": round(float(np.mean(a) / np.mean(b)), 2),
        })
        print(f"{site}: {len(good)} years ({good[0]}-{good[-1]}), r = {r:.2f} with MERRA-2, peak {good[int(np.argmax(a))]}, "
              f"mean AERONET/MERRA-2 = {np.mean(a) / np.mean(b):.2f}")
        print("   ", " ".join(f"{y}:{v:.2f}/{merra[y]:.2f}" for y, v in zip(good, a)))
    # The two sites where they overlap: do two instruments a few km apart agree?
    s1, s2 = ({y: v for y, v in zip(x["years"], x["aod550"])} for x in sites)
    both = sorted(set(s1) & set(s2))
    overlap_r = round(float(np.corrcoef([s1[y] for y in both], [s2[y] for y in both])[0, 1]), 2) if len(both) >= 3 else None
    print(f"overlap {both[:1]}..{both[-1:]}: r = {overlap_r}")

    out = {
        "source": "NASA AERONET Version 3, Level 2.0 (cloud-screened, quality-assured) daily averages",
        "url": "https://aeronet.gsfc.nasa.gov/",
        "method": f"AOD at 550 nm from AOD at 440 nm and the 440-870 nm Angstrom exponent; a month needs {MIN_DAYS_PER_MONTH}+ measured days, "
                  f"a year needs {MIN_MONTHS_PER_YEAR}+ valid months. The two sites are separate series, never joined.",
        "merra2_peak_year": years[int(np.argmax(region["variables"]["TOTEXTTAU"]["annual"]))],
        "sites": sites,
        "overlap": {"years": both, "correlation": overlap_r},
        "caveat": "Point stations against a 3° × 4° region average, and MERRA-2 assimilates AERONET and MODIS data, "
                  "so this checks consistency rather than being fully independent.",
    }
    path = OUT_DIR / "validation" / "beijing_aeronet.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
