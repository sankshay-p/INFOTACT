import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from typing import Dict, Any, List

def compute_propensity_scores(df: pd.DataFrame, feature_cols: List[str]) -> Dict[str, Any]:
    """
    Computes Propensity Scores e(X) = P(T=1 | X) and calculates
    Standardized Mean Differences (SMD) before and after pseudo-matching/weighting
    to mathematically verify covariate balance.
    """
    X = df[feature_cols].copy()
    T = df['treatment_binary'].values

    # Fit propensity model
    prop_model = LogisticRegression(max_iter=1000, random_state=42)
    prop_model.fit(X, T)
    propensity_scores = prop_model.predict_proba(X)[:, 1]

    # Calculate Inverse Probability Weights (IPW) for balancing
    # Truncate extreme weights for stability
    weights = np.where(T == 1, 1.0 / np.clip(propensity_scores, 0.05, 0.95), 1.0 / np.clip(1.0 - propensity_scores, 0.05, 0.95))

    # Standardized Mean Difference (SMD) calculation before and after weighting
    smd_list = []
    for col in feature_cols:
        treat_vals = df[df['treatment_binary'] == 1][col].values
        ctrl_vals = df[df['treatment_binary'] == 0][col].values
        treat_weights = weights[df['treatment_binary'] == 1]
        ctrl_weights = weights[df['treatment_binary'] == 0]

        # Raw SMD (Unadjusted)
        mean_t = np.mean(treat_vals)
        mean_c = np.mean(ctrl_vals)
        var_t = np.var(treat_vals, ddof=1)
        var_c = np.var(ctrl_vals, ddof=1)
        pooled_std = np.sqrt((var_t + var_c) / 2.0) + 1e-8
        smd_raw = abs(mean_t - mean_c) / pooled_std

        # Weighted SMD (Adjusted / Balanced)
        weighted_mean_t = np.average(treat_vals, weights=treat_weights)
        weighted_mean_c = np.average(ctrl_vals, weights=ctrl_weights)
        weighted_var_t = np.average((treat_vals - weighted_mean_t)**2, weights=treat_weights)
        weighted_var_c = np.average((ctrl_vals - weighted_mean_c)**2, weights=ctrl_weights)
        weighted_pooled_std = np.sqrt((weighted_var_t + weighted_var_c) / 2.0) + 1e-8
        smd_weighted = abs(weighted_mean_t - weighted_mean_c) / weighted_pooled_std

        smd_list.append({
            "feature": col,
            "smd_unadjusted": round(float(smd_raw), 4),
            "smd_adjusted": round(float(smd_weighted), 4),
            "bias_reduction_pct": round(float(max(0, (smd_raw - smd_weighted) / (smd_raw + 1e-8) * 100)), 1),
            "is_balanced": bool(smd_weighted < 0.10)  # Standard statistical threshold for balance
        })

    # Propensity distribution bins for treated vs control
    bins = np.linspace(0, 1, 21)
    hist_treat, _ = np.histogram(propensity_scores[T == 1], bins=bins, density=True)
    hist_ctrl, _ = np.histogram(propensity_scores[T == 0], bins=bins, density=True)
    bin_centers = 0.5 * (bins[:-1] + bins[1:])

    return {
        "propensity_scores": propensity_scores.tolist(),
        "smd_balance": smd_list,
        "mean_propensity_treated": round(float(np.mean(propensity_scores[T == 1])), 3),
        "mean_propensity_control": round(float(np.mean(propensity_scores[T == 0])), 3),
        "distribution": {
            "bin_centers": [round(float(b), 3) for b in bin_centers],
            "treated_density": [round(float(h), 3) for h in hist_treat],
            "control_density": [round(float(h), 3) for h in hist_ctrl]
        }
    }
