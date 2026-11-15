"""Prints stats.py's results for every region x variable series as JSON, so web/scripts/check-stats.ts can
check the browser port (web/src/lib/stats.ts) against it on identical inputs."""
import json

import numpy as np

import stats
from config import OUT_DIR

meta = json.loads((OUT_DIR / "meta.json").read_text(encoding="utf-8"))
enso, split = np.array(meta["enso_annual"]), meta["years"].index(meta["split_year"])
out = {}
for f in sorted((OUT_DIR / "regions").glob("*.json")):
    r = json.loads(f.read_text(encoding="utf-8"))
    for v, d in r["variables"].items():
        Y = np.array([d["annual"]], float)
        hr, nv = stats.mann_kendall(Y), stats.mann_kendall(Y, correct_autocorr=False)
        adj, c, pc = stats.remove_enso(Y, enso)
        wf, _, _ = stats.walk_forward(Y, split)
        ns, sg, ph = stats.years_to_detect(Y, hr["slope"])
        out[f"{r['id']}|{v}"] = {"annual": d["annual"], "slope": hr["slope"][0], "ci_low": hr["ci_low"][0], "ci_high": hr["ci_high"][0],
                                 "p_hr": hr["p"][0], "p_naive": nv["p"][0], "enso_coef": c[0], "enso_p": pc[0],
                                 "p_enso_hr": stats.mann_kendall(adj)["p"][0], "wf": int(wf[0]), "sigma": sg[0], "phi": ph[0], "nstar": ns[0]}
print(json.dumps({"enso": meta["enso_annual"], "split": split, "series": out}))
