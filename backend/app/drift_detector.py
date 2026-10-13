import numpy as np
import pandas as pd
from typing import Dict, Any, List
from scipy.stats import ks_2samp

def calculate_psi(baseline: np.ndarray, target: np.ndarray, num_buckets: int = 10) -> float:
    """
    Calculates Population Stability Index (PSI) between baseline and target distributions.
    PSI < 0.10: Stable (No shift)
    0.10 <= PSI < 0.25: Moderate shift (Monitor)
    PSI >= 0.25: Significant drift (Recalibration required)
    """
    percentiles = np.linspace(0, 100, num_buckets + 1)
    bucket_edges = np.percentile(baseline, percentiles)
    bucket_edges[0] -= 1e-5
    bucket_edges[-1] += 1e-5
    
    # Avoid duplicate edges due to discrete values
    bucket_edges = np.unique(bucket_edges)
    if len(bucket_edges) < 2:
        return 0.0

    baseline_counts, _ = np.histogram(baseline, bins=bucket_edges)
    target_counts, _ = np.histogram(target, bins=bucket_edges)

    # Convert to fractions with Laplace smoothing
    base_pct = (baseline_counts + 1e-4) / (len(baseline) + 1e-4 * len(baseline_counts))
    target_pct = (target_counts + 1e-4) / (len(target) + 1e-4 * len(target_counts))

    psi = np.sum((target_pct - base_pct) * np.log(target_pct / base_pct))
    return float(max(0.0, psi))

def analyze_covariate_drift(
    baseline_df: pd.DataFrame,
    current_df: pd.DataFrame,
    feature_cols: List[str]
) -> Dict[str, Any]:
    """
    Performs Kolmogorov-Smirnov test and Population Stability Index (PSI)
    across all causal confounders to detect customer behavior shifts.
    """
    drift_metrics = []
    max_psi = 0.0
    drift_detected = False

    for col in feature_cols:
        base_vals = baseline_df[col].dropna().values
        curr_vals = current_df[col].dropna().values

        # Kolmogorov-Smirnov 2-sample test
        ks_stat, p_val = ks_2samp(base_vals, curr_vals)
        psi = calculate_psi(base_vals, curr_vals)

        if psi > max_psi:
            max_psi = psi

        # Determine drift status
        if psi >= 0.25 or p_val < 0.01:
            status = "CRITICAL DRIFT"
            drift_detected = True
        elif psi >= 0.10 or p_val < 0.05:
            status = "MODERATE SHIFT"
        else:
            status = "STABLE"

        drift_metrics.append({
            "feature": col,
            "ks_statistic": round(float(ks_stat), 4),
            "p_value": round(float(p_val), 5),
            "psi_score": round(float(psi), 4),
            "status": status,
            "baseline_mean": round(float(np.mean(base_vals)), 2),
            "current_mean": round(float(np.mean(curr_vals)), 2),
            "mean_shift_pct": round(float(((np.mean(curr_vals) - np.mean(base_vals)) / (np.mean(base_vals) + 1e-8)) * 100), 2)
        })

    # Overall system status
    if max_psi >= 0.25:
        overall_status = "CRITICAL_DRIFT"
        recommendation = "High data drift detected in customer behavior. Recalibrate Double ML estimators immediately."
    elif max_psi >= 0.10:
        overall_status = "MODERATE_SHIFT"
        recommendation = "Moderate shift detected in user engagement. Schedule routine model retraining."
    else:
        overall_status = "STABLE"
        recommendation = "Covariate distributions remain stable. Causal ITE predictions are statistically valid."

    return {
        "overall_status": overall_status,
        "max_psi": round(float(max_psi), 4),
        "drift_detected": drift_detected,
        "recommendation": recommendation,
        "feature_metrics": drift_metrics
    }
