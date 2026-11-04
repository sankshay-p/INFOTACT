import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, List
from app.causal_engine import FEATURE_COLS


def get_customer_deep_profile(
    engine,
    df: pd.DataFrame,
    customer_id: int,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
) -> Dict[str, Any]:
    """
    Generates a full 360° causal profile card for a single customer.
    Includes: individual DAG path analysis, counterfactual waterfall,
    archetype classification with confidence, and personalized recommendation.
    """
    row = df[df["customer_id"] == customer_id]
    if row.empty:
        return {"error": f"Customer {customer_id} not found", "customer_id": customer_id}

    r = row.iloc[0]
    base_margin = product_price - unit_cost

    # Core customer attributes
    features = {feat: round(float(r[feat]), 2) for feat in FEATURE_COLS}

    # Causal scores
    baseline_prob = float(r.get("pred_baseline_prob", 0.35))
    ite_10 = float(r.get("pred_ite_10", 0.12))
    ite_20 = float(r.get("pred_ite_20", 0.22))
    pred_ml_score = float(r.get("predictive_ml_score", 0.5))
    archetype = str(r.get("uplift_archetype", "Unknown"))

    # Counterfactual waterfall
    p0 = baseline_prob
    p10 = float(np.clip(p0 + ite_10, 0.01, 0.99))
    p20 = float(np.clip(p0 + ite_20, 0.01, 0.99))

    exp_profit_0 = p0 * base_margin
    exp_profit_10 = p10 * (base_margin - 10.0)
    exp_profit_20 = p20 * (base_margin - 20.0)

    net_inc_10 = exp_profit_10 - exp_profit_0
    net_inc_20 = exp_profit_20 - exp_profit_0

    waterfall = [
        {
            "stage": "Organic Baseline ($0)",
            "conversion_prob": round(p0 * 100, 1),
            "expected_profit": round(exp_profit_0, 2),
            "incremental_gain": 0,
            "is_optimal": ite_10 <= 0 and ite_20 <= 0,
            "color": "#64748b",
        },
        {
            "stage": "$10 Discount",
            "conversion_prob": round(p10 * 100, 1),
            "expected_profit": round(exp_profit_10, 2),
            "incremental_gain": round(net_inc_10, 2),
            "causal_uplift_pct": round(ite_10 * 100, 1),
            "is_optimal": net_inc_10 > 0 and net_inc_10 >= net_inc_20,
            "color": "#38bdf8",
        },
        {
            "stage": "$20 Discount",
            "conversion_prob": round(p20 * 100, 1),
            "expected_profit": round(exp_profit_20, 2),
            "incremental_gain": round(net_inc_20, 2),
            "causal_uplift_pct": round(ite_20 * 100, 1),
            "is_optimal": net_inc_20 > 0 and net_inc_20 > net_inc_10,
            "color": "#10b981",
        },
    ]

    # Optimal discount decision
    if net_inc_20 > 0 and net_inc_20 > net_inc_10:
        optimal_discount = 20.0
    elif net_inc_10 > 0:
        optimal_discount = 10.0
    else:
        optimal_discount = 0.0

    # Archetype confidence: how far from decision boundaries
    if archetype == "Persuadable":
        confidence = min(100, round(float((ite_20 - 0.12) / 0.12) * 100 + 60, 0))
    elif archetype == "Sure Thing":
        confidence = min(100, round(float((baseline_prob - 0.60) / 0.40) * 100 + 50, 0))
    elif archetype == "Sleeping Dog":
        confidence = min(100, round(float(abs(ite_20) / 0.10) * 100, 0))
    else:
        confidence = min(100, round(float((0.12 - ite_20) / 0.12) * 100 + 30, 0))
    confidence = max(30, min(99, confidence))

    # Feature contribution analysis: which confounders most influenced this customer's ITE
    # Use the DML coefficient weights × standardized feature values
    coefs = engine.dml_model.coef_
    feature_means = df[FEATURE_COLS].mean().values
    feature_stds = df[FEATURE_COLS].std().values
    feat_values = np.array([features[f] for f in FEATURE_COLS])
    standardized = (feat_values - feature_means) / np.clip(feature_stds, 1e-8, None)
    contributions = coefs * standardized

    confounder_influence = []
    for i, feat in enumerate(FEATURE_COLS):
        confounder_influence.append({
            "feature": feat,
            "value": features[feat],
            "standardized_value": round(float(standardized[i]), 3),
            "dml_coefficient": round(float(coefs[i]), 5),
            "contribution_to_ite": round(float(contributions[i]), 5),
            "abs_contribution": round(float(abs(contributions[i])), 5),
            "direction": "Increases Uplift" if contributions[i] > 0 else "Decreases Uplift",
        })
    confounder_influence.sort(key=lambda x: x["abs_contribution"], reverse=True)

    # Recommendation narrative
    if archetype == "Persuadable":
        recommendation = (
            f"RECOMMEND: Deploy ${optimal_discount:.0f} promotional discount. "
            f"This customer exhibits strong price elasticity with +{max(ite_10, ite_20)*100:.1f}% causal uplift. "
            f"Expected net incremental profit: ${max(net_inc_10, net_inc_20):.2f} above organic baseline."
        )
        action_color = "#10b981"
    elif archetype == "Sure Thing":
        recommendation = (
            f"SUPPRESS: Withhold all promotional discounts. "
            f"Baseline conversion probability is {p0*100:.1f}% — this customer will purchase at full price. "
            f"Discounting would cannibalize ${abs(min(0, net_inc_10)):.2f} in guaranteed margin."
        )
        action_color = "#f59e0b"
    elif archetype == "Sleeping Dog":
        recommendation = (
            f"DO NOT CONTACT: Negative treatment effect detected (τ = {ite_20*100:.1f}%). "
            f"Promotional outreach triggers adverse response. Strict suppression required."
        )
        action_color = "#f43f5e"
    else:
        recommendation = (
            f"WITHHOLD: Customer is inelastic to promotional discounts (uplift = {ite_20*100:.1f}%). "
            f"Budget better allocated to high-elasticity Persuadable segments."
        )
        action_color = "#64748b"

    # Peer comparison: percentile ranks
    percentiles = {}
    for feat in FEATURE_COLS:
        rank = float((df[feat] <= features[feat]).mean() * 100)
        percentiles[feat] = round(rank, 1)
    percentiles["ite_rank"] = round(float((df["pred_ite_20"] <= ite_20).mean() * 100), 1)
    percentiles["baseline_prob_rank"] = round(float((df["pred_baseline_prob"] <= baseline_prob).mean() * 100), 1)

    return {
        "customer_id": customer_id,
        "features": features,
        "archetype": archetype,
        "archetype_confidence": confidence,
        "baseline_probability": round(p0 * 100, 1),
        "causal_uplift_10": round(ite_10 * 100, 1),
        "causal_uplift_20": round(ite_20 * 100, 1),
        "predictive_ml_score": round(pred_ml_score * 100, 1),
        "optimal_discount": optimal_discount,
        "counterfactual_waterfall": waterfall,
        "confounder_influence": confounder_influence,
        "recommendation": recommendation,
        "action_color": action_color,
        "percentile_ranks": percentiles,
    }


def search_customers(
    df: pd.DataFrame,
    query: Optional[str] = None,
    archetype_filter: Optional[str] = None,
    sort_by: str = "pred_ite_20",
    sort_desc: bool = True,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Searches and filters customers for the profiler lookup.
    """
    filtered = df.copy()

    if archetype_filter and archetype_filter != "all":
        filtered = filtered[filtered["uplift_archetype"] == archetype_filter]

    if query:
        try:
            cid = int(query)
            filtered = filtered[filtered["customer_id"] == cid]
        except ValueError:
            pass

    if sort_by in filtered.columns:
        filtered = filtered.sort_values(by=sort_by, ascending=not sort_desc)

    total = len(filtered)
    sample = filtered.head(limit)

    records = []
    for _, r in sample.iterrows():
        records.append({
            "customer_id": int(r["customer_id"]),
            "income": round(float(r["income"]), 0),
            "browsing_minutes": round(float(r["browsing_minutes"]), 1),
            "loyalty_score": round(float(r["loyalty_score"]), 2),
            "days_since_last_purchase": round(float(r["days_since_last_purchase"]), 1),
            "archetype": str(r.get("uplift_archetype", "Unknown")),
            "baseline_prob": round(float(r.get("pred_baseline_prob", 0)) * 100, 1),
            "uplift_20": round(float(r.get("pred_ite_20", 0)) * 100, 1),
            "predictive_score": round(float(r.get("predictive_ml_score", 0)) * 100, 1),
        })

    # Archetype distribution
    arch_counts = df["uplift_archetype"].value_counts().to_dict() if "uplift_archetype" in df.columns else {}

    return {
        "total_results": total,
        "results": records,
        "archetype_distribution": arch_counts,
    }
