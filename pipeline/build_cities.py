"""World cities for the globe's "Check your hometown" search.

Source: Natural Earth 1:50m populated places (public domain), ne_50m_populated_places_simple.geojson from
https://github.com/nvkelso/natural-earth-vector . Download it, then:
    python build_cities.py path/to/ne_50m_populated_places_simple.geojson

Output: data/processed/cities.json, [[name, country, lat, lon], ...] sorted by population (largest first),
so the autocomplete offers the bigger city first when names repeat.
"""
import json
import sys

from config import OUT_DIR


def main():
    fc = json.load(open(sys.argv[1], encoding="utf-8"))
    rows = []
    for f in fc["features"]:
        p = f["properties"]
        name, country, lat, lon = p.get("name"), p.get("adm0name"), p.get("latitude"), p.get("longitude")
        if not (isinstance(name, str) and name and isinstance(country, str) and isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        rows.append((p.get("pop_max") or 0, [name, country, round(lat, 3), round(lon, 3)]))
    rows.sort(key=lambda r: -r[0])
    out = [r for _, r in rows]
    (OUT_DIR / "cities.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} cities, {(OUT_DIR / 'cities.json').stat().st_size / 1e3:.0f} KB; first: {out[:3]}")


if __name__ == "__main__":
    main()
