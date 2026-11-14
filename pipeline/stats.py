"""Vectorized trend statistics. Every function takes Y with shape (m, n):
m independent series (grid cells or regions), n time steps (years).

Methods
- Theil-Sen slope (+ Gilbert 1987 95% confidence interval)
- Mann-Kendall test, original ("naive") and Hamed & Rao (1998) autocorrelation-corrected
  (matches pymannkendall.hamed_rao_modification_test; see test_stats.py)
- Benjamini-Hochberg false discovery rate across many series
- Weatherhead et al. (1998) years-needed-to-detect estimate
- ENSO regression removal ("strip out the market factor")
- Permutation (shuffled-noise) test
"""
import numpy as np
from scipy.stats import norm, rankdata
from scipy.stats import t as tdist

Z975 = norm.ppf(0.975)


def _pairs(n):
    return np.triu_indices(n, 1)


def sen_slope(Y):
    """Theil-Sen slope per series (units per time step) and intercept, plus all pairwise slopes."""
    m, n = Y.shape
    i, j = _pairs(n)
    slopes = (Y[:, j] - Y[:, i]) / (j - i)
    slope = np.median(slopes, axis=1)
    t = np.arange(n)
    intercept = np.median(Y - slope[:, None] * t, axis=1)
    return slope, intercept, slopes


def mk_s(Y):
    i, j = _pairs(Y.shape[1])
    return np.sign(Y[:, j] - Y[:, i]).sum(axis=1)


def _var_s(Y):
    """Mann-Kendall variance of S with tie correction (same formula as pymannkendall)."""
    m, n = Y.shape
    base = n * (n - 1) * (2 * n + 5)
    out = np.empty(m)
    for r in range(m):
        _, counts = np.unique(Y[r], return_counts=True)
        tp = counts[counts > 1]
        out[r] = (base - np.sum(tp * (tp - 1) * (2 * tp + 5))) / 18.0
    return out


def _z(S, var):
    z = np.zeros_like(S, dtype=float)
    pos, neg = S > 0, S < 0
    z[pos] = (S[pos] - 1) / np.sqrt(var[pos])
    z[neg] = (S[neg] + 1) / np.sqrt(var[neg])
    return z


def _acf_rows(X, nlags):
    """Biased autocorrelation (same as pymannkendall's __acf) for each row."""
    m, n = X.shape
    Yc = X - X.mean(axis=1, keepdims=True)
    denom = (Yc ** 2).sum(axis=1)
    acf = np.ones((m, nlags + 1))
    for k in range(1, nlags + 1):
        acf[:, k] = (Yc[:, :n - k] * Yc[:, k:]).sum(axis=1) / denom
    return acf


def mann_kendall(Y, correct_autocorr=True, alpha=0.05, conservative=True):
    """Returns dict with S, z, p, slope, intercept and Sen slope 95% CI (per time step).
    conservative=True: the autocorrelation correction may only widen the variance (never
    shrink it), so chance negative autocorrelation can't make noise look significant."""
    Y = np.asarray(Y, dtype=float)
    m, n = Y.shape
    S = mk_s(Y)
    var = _var_s(Y)
    slope, intercept, slopes = sen_slope(Y)

    if correct_autocorr:
        t = np.arange(1, n + 1)
        detr = Y - t * slope[:, None]
        R = np.apply_along_axis(rankdata, 1, detr)
        acf = _acf_rows(R, n - 1)
        bound = norm.ppf(1 - alpha / 2) / np.sqrt(n)
        k = np.arange(1, n)
        w = (n - k) * (n - k - 1) * (n - k - 2)
        a = acf[:, 1:]
        sig = np.abs(a) > bound
        sni = (w * a * sig).sum(axis=1)
        n_ns = 1 + (2.0 / (n * (n - 1) * (n - 2))) * sni
        n_ns = np.maximum(n_ns, 1.0 if conservative else 1e-3)
        var = var * n_ns

    z = _z(S, var)
    p = 2 * (1 - norm.cdf(np.abs(z)))

    # Gilbert (1987) nonparametric 95% CI for the Sen slope
    N = slopes.shape[1]
    srt = np.sort(slopes, axis=1)
    C = Z975 * np.sqrt(var)
    lo_idx = np.clip(np.round((N - C) / 2).astype(int) - 1, 0, N - 1)
    hi_idx = np.clip(np.round((N + C) / 2).astype(int), 0, N - 1)
    rows = np.arange(m)
    return {
        "S": S, "z": z, "p": p,
        "slope": slope, "intercept": intercept,
        "ci_low": srt[rows, lo_idx], "ci_high": srt[rows, hi_idx],
    }


def fdr_bh(p):
    """Benjamini-Hochberg q-values. NaNs are ignored and stay NaN."""
    p = np.asarray(p, dtype=float)
    q = np.full_like(p, np.nan)
    ok = np.isfinite(p)
    pv = p[ok]
    mtests = pv.size
    if mtests == 0:
        return q
    order = np.argsort(pv)
    ranked = pv[order] * mtests / np.arange(1, mtests + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(mtests)
    out[order] = np.minimum(ranked, 1.0)
    q[ok] = out
    return q


def years_to_detect(Y, slope):
    """Weatherhead et al. (1998): years of data needed to detect a trend of this size
    (90% probability, 5% significance), given the noise level and lag-1 autocorrelation."""
    m, n = Y.shape
    t = np.arange(n)
    intercept = np.median(Y - slope[:, None] * t, axis=1)
    resid = Y - (intercept[:, None] + slope[:, None] * t)
    sigma = resid.std(axis=1, ddof=1)
    phi = _acf_rows(resid, 1)[:, 1]
    phi = np.clip(phi, -0.5, 0.9)
    with np.errstate(divide="ignore", invalid="ignore"):
        nstar = ((3.3 * sigma / np.abs(slope)) * np.sqrt((1 + phi) / (1 - phi))) ** (2.0 / 3.0)
    return nstar, sigma, phi


def remove_enso(Y, enso):
    """Fit y = a + b*t + c*ENSO for each series, then subtract c*ENSO.
    Returns adjusted series, ENSO coefficient c (units per °C of Niño 3.4), and its p-value."""
    m, n = Y.shape
    t = np.arange(n, dtype=float)
    X = np.column_stack([np.ones(n), t - t.mean(), enso])
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = (XtX_inv @ X.T @ Y.T).T          # (m, 3)
    resid = Y - beta @ X.T
    dof = n - 3
    s2 = (resid ** 2).sum(axis=1) / dof
    se_c = np.sqrt(s2 * XtX_inv[2, 2])
    with np.errstate(divide="ignore", invalid="ignore"):
        tc = beta[:, 2] / se_c
    p_c = 2 * (1 - tdist.cdf(np.abs(tc), dof))
    adjusted = Y - beta[:, 2:3] * enso[None, :]
    return adjusted, beta[:, 2], p_c


def shuffle_rows(Y, seed=42):
    """Shuffle each series' time order independently: destroys any real trend, keeps the noise."""
    rng = np.random.default_rng(seed)
    idx = np.argsort(rng.random(Y.shape), axis=1)
    return np.take_along_axis(Y, idx, axis=1)


def permutation_p(y, n_perm=2000, seed=0):
    """How often does pure shuffled noise produce a Mann-Kendall S at least this extreme?"""
    y = np.asarray(y, dtype=float)
    S_obs = abs(mk_s(y[None, :])[0])
    rng = np.random.default_rng(seed)
    perms = np.array([rng.permutation(y) for _ in range(n_perm)])
    S_perm = np.abs(mk_s(perms))
    return float((np.sum(S_perm >= S_obs) + 1) / (n_perm + 1))


WF_LABELS = ["no signal", "emerging", "confirmed", "continuing", "reversed", "faded"]


def walk_forward(Y, split):
    """Find the trend in the first part (in-sample), then check the second part (out-of-sample).
    Codes: 0 no signal, 1 emerging (only recent), 2 confirmed (both halves significant, same
    direction), 3 continuing (first significant, second same direction but not significant),
    4 reversed (both significant, opposite directions), 5 faded (first significant, second
    not significant and pointing the other way: the trend stopped, it did not reverse)."""
    a = mann_kendall(Y[:, :split])
    b = mann_kendall(Y[:, split:])
    sa, sb = a["p"] < 0.05, b["p"] < 0.05
    same = np.sign(a["slope"]) == np.sign(b["slope"])
    code = np.zeros(Y.shape[0], dtype=int)
    code[~sa & sb] = 1
    code[sa & sb & same] = 2
    code[sa & ~sb & same] = 3
    code[sa & sb & ~same] = 4
    code[sa & ~sb & ~same] = 5
    return code, a, b
