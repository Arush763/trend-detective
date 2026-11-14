"""Check our vectorized statistics against pymannkendall on random and trending series.
Run: python test_stats.py"""
import numpy as np
import pymannkendall as mk

import stats

rng = np.random.default_rng(1)
n = 46
cases = []
for k in range(300):
    trend = rng.choice([0, 0.02, -0.05, 0.1])
    ar = rng.choice([0, 0.4, 0.7])
    e = np.zeros(n)
    for i in range(n):
        e[i] = (ar * e[i - 1] if i else 0) + rng.normal()
    cases.append(trend * np.arange(n) + e)
Y = np.array(cases)

ours_hr = stats.mann_kendall(Y, correct_autocorr=True, conservative=False)
ours_or = stats.mann_kendall(Y, correct_autocorr=False)
ref_hr = [mk.hamed_rao_modification_test(y) for y in Y]
ref_or = [mk.original_test(y) for y in Y]

d_slope = np.max(np.abs(ours_hr["slope"] - [r.slope for r in ref_hr]))
ref_p_hr = np.array([r.p for r in ref_hr])
ok = np.isfinite(ref_p_hr)  # pymannkendall returns NaN when the corrected variance goes negative; we guard that case
print(f"cases where pymannkendall H&R returns NaN (we guard these): {np.sum(~ok)}")
d_p_hr = np.max(np.abs(ours_hr["p"][ok] - ref_p_hr[ok]))
d_p_or = np.max(np.abs(ours_or["p"] - [r.p for r in ref_or]))
print(f"max |slope diff|   = {d_slope:.2e}")
print(f"max |p diff| H&R   = {d_p_hr:.2e}")
print(f"max |p diff| orig  = {d_p_or:.2e}")
assert d_slope < 1e-9 and d_p_or < 1e-9 and d_p_hr < 1e-6, "mismatch vs pymannkendall"

# Noise test sanity: shuffled data should be 'significant' about 5% of the time
noise = stats.shuffle_rows(rng.normal(size=(5000, n)))
frac = np.mean(stats.mann_kendall(noise, correct_autocorr=False)["p"] < 0.05)
print(f"false-positive rate on pure noise = {frac:.3f} (expect ~0.05)")

# FDR: with pure noise, almost nothing should survive
q = stats.fdr_bh(stats.mann_kendall(noise, correct_autocorr=False)["p"])
print(f"survive FDR on pure noise = {np.mean(q < 0.05):.4f} (expect ~0)")

# Conservative mode (what the app uses) should give p-values >= the uncorrected-shrink version
cons = stats.mann_kendall(Y, correct_autocorr=True)
assert np.all(cons["p"] >= ours_hr["p"] - 1e-12)
fp = np.mean(stats.fdr_bh(stats.mann_kendall(noise)["p"]) < 0.05)
print(f"conservative H&R + FDR on pure noise = {fp:.4f} (expect ~0)")

# Walk-forward: a trend that stops is "faded", only a significant opposite trend is "reversed"
i = np.arange(23)
wn = np.random.default_rng(7).normal(0, 1, (6, 23))   # noise so no half is a perfect line
up = 0.5 * i
wf, _, _ = stats.walk_forward(np.array([
    np.r_[up + wn[0], up[-1] + up + wn[1]],          # keeps going -> confirmed (2)
    np.r_[up + wn[2], up[-1] - up + wn[3]],          # turns around -> reversed (4)
    np.r_[up + wn[4], up[-1] - 0.05 * i + wn[5]],    # goes flat -> faded (5)
]), 23)
assert list(wf) == [2, 4, 5], wf
print("walk-forward codes ok")
print("All checks passed.")
