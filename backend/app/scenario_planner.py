import numpy as np
import pandas as pd
from typing import Dict, Any, List
from app.optimization import solve_discount_optimization
from app.causal_engine import FEATURE_COLS


def run_scenario_analysis(
    engine,
    baseline_df: pd.DataFrame,
    scenarios: List[Dict[str, Any]],
    budget: float = 5000.0,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
) -> Dict[str, Any]:
    """
    Runs the causal optimization under multiple macroeconomic scenario perturbations.
    Each scenario adjusts selected confounders and re-scores the causal model.
    Returns side-by-side comparison cards and tornado sensitivity data.
    """
    results = []

    # Always include baseline as the first scenario
    baseline_opt = solve_discount_optimization(engine.trained_df, budget=budget, product_price=product_price, unit_cost=unit_cost)
    baseline_causal = next((s for s in baseline_opt["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})

    baseline_entry = {
        "scenario_name": "Current Baseline",
        "scenario_id": "baseline",
        "adjustments": {},
        "incremental_profit": baseline_causal.get("incremental_profit", 0),
        "incremental_revenue": baseline_causal.get("incremental_revenue", 0),
        "wasted_budget": baseline_causal.get("wasted_budget", 0),
        "roi_percentage": baseline_causal.get("roi_percentage", 0),
        "targeted_customers": baseline_causal.get("targeted_customers", 0),
        "archetype_targeted": baseline_causal.get("archetype_targeted", {}),
        "persuadables_pct": round(
            float(baseline_causal.get("archetype_targeted", {}).get("Persuadable", 0)
                  / max(1, baseline_causal.get("targeted_customers", 1)) * 100), 1
        ),
    }
    results.append(baseline_entry)

    # Process each user-defined scenario
    for sc in scenarios:
        scenario_df = baseline_df.copy()
        adjustments = sc.get("adjustments", {})
        name = sc.get("name", "Custom Scenario")
        sc_id = sc.get("id", name.lower().replace(" ", "_"))

        # Apply adjustments
        for feature, multiplier in adjustments.items():
            if feature in scenario_df.columns:
                scenario_df[feature] = scenario_df[feature] * multiplier

        # Re-score with the existing causal engine (preserves learned CATE model)
        X_sc = scenario_df[FEATURE_COLS].values
        cate_sc = engine.dml_model.effect(X_sc)

        # Re-derive all scores on perturbed data
        pred_ml_sc = engine.baseline_model.predict_proba(X_sc)[:, 1]
        baseline_prob_sc = np.clip(pred_ml_sc - (0.5 * cate_sc), 0.02, 0.95)
        ite_10_sc = np.clip(cate_sc * 0.65, -0.15, 0.50)
        ite_20_sc = np.clip(cate_sc * 1.15, -0.20, 0.70)

        archetypes_sc = []
        for i in range(len(scenario_df)):
            uplift = ite_20_sc[i]
            base = baseline_prob_sc[i]
            if uplift < -0.01:
                archetypes_sc.append("Sleeping Dog")
            elif uplift >= 0.12:
                archetypes_sc.append("Persuadable")
            elif base >= 0.60:
                archetypes_sc.append("Sure Thing")
            else:
                archetypes_sc.append("Lost Cause")

        scored_sc = scenario_df.copy()
        scored_sc["pred_ite_binary"] = np.round(cate_sc, 4)
        scored_sc["pred_ite_10"] = np.round(ite_10_sc, 4)
        scored_sc["pred_ite_20"] = np.round(ite_20_sc, 4)
        scored_sc["pred_baseline_prob"] = np.round(baseline_prob_sc, 4)
        scored_sc["predictive_ml_score"] = np.round(pred_ml_sc, 4)
        scored_sc["uplift_archetype"] = archetypes_sc

        opt_sc = solve_discount_optimization(scored_sc, budget=budget, product_price=product_price, unit_cost=unit_cost)
        causal_sc = next((s for s in opt_sc["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})

        entry = {
            "scenario_name": name,
            "scenario_id": sc_id,
            "adjustments": adjustments,
            "incremental_profit": causal_sc.get("incremental_profit", 0),
            "incremental_revenue": causal_sc.get("incremental_revenue", 0),
            "wasted_budget": causal_sc.get("wasted_budget", 0),
            "roi_percentage": causal_sc.get("roi_percentage", 0),
            "targeted_customers": causal_sc.get("targeted_customers", 0),
            "archetype_targeted": causal_sc.get("archetype_targeted", {}),
            "persuadables_pct": round(
                float(causal_sc.get("archetype_targeted", {}).get("Persuadable", 0)
                      / max(1, causal_sc.get("targeted_customers", 1)) * 100), 1
            ),
            "profit_delta_vs_baseline": round(float(causal_sc.get("incremental_profit", 0) - baseline_causal.get("incremental_profit", 0)), 0),
            "roi_delta_vs_baseline": round(float(causal_sc.get("roi_percentage", 0) - baseline_causal.get("roi_percentage", 0)), 1),
        }
        results.append(entry)

    # Build tornado sensitivity data
    tornado = _build_tornado_sensitivity(engine, baseline_df, baseline_causal, budget, product_price, unit_cost)

    return {
        "scenarios": results,
        "tornado_sensitivity": tornado,
        "baseline_profit": baseline_causal.get("incremental_profit", 0),
        "baseline_roi": baseline_causal.get("roi_percentage", 0),
    }


def get_preset_scenarios() -> List[Dict[str, Any]]:
    """Returns a set of preset macroeconomic scenarios."""
    return [
        {
            "id": "recession",
            "name": "Recession Scenario",
            "description": "Income drops 30%, browsing increases 20% (deal-seeking), loyalty decays 15%",
            "adjustments": {
                "income": 0.70,
                "browsing_minutes": 1.20,
                "loyalty_score": 0.85,
            },
            "icon": "📉",
            "severity": "high",
        },
        {
            "id": "holiday_surge",
            "name": "Holiday Demand Surge",
            "description": "Seasonality spikes 60%, browsing doubles, cart values up 35%",
            "adjustments": {
                "seasonality_index": 1.60,
                "browsing_minutes": 2.0,
                "cart_value_history": 1.35,
            },
            "icon": "🎄",
            "severity": "medium",
        },
        {
            "id": "competitor_pressure",
            "name": "Competitor Price War",
            "description": "Loyalty drops 25% as customers explore alternatives, recency increases 40%",
            "adjustments": {
                "loyalty_score": 0.75,
                "days_since_last_purchase": 1.40,
            },
            "icon": "⚔️",
            "severity": "high",
        },
        {
            "id": "affluent_shift",
            "name": "Affluent Customer Influx",
            "description": "Average income rises 45%, cart value history up 50%, loyalty increases 20%",
            "adjustments": {
                "income": 1.45,
                "cart_value_history": 1.50,
                "loyalty_score": 1.20,
            },
            "icon": "💎",
            "severity": "low",
        },
        {
            "id": "engagement_drop",
            "name": "Digital Fatigue",
            "description": "Browsing time drops 50%, purchase recency worsens by 60%",
            "adjustments": {
                "browsing_minutes": 0.50,
                "days_since_last_purchase": 1.60,
            },
            "icon": "😴",
            "severity": "medium",
        },
        {
            "id": "stagflation",
            "name": "Stagflation & Squeeze",
            "description": "Cost-of-living squeeze: income drops 20%, cart size shrinks 25%, intense bargain hunting",
            "adjustments": {
                "income": 0.80,
                "cart_value_history": 0.75,
                "browsing_minutes": 1.35,
            },
            "icon": "⚡",
            "severity": "high",
        },
        {
            "id": "black_friday",
            "name": "Black Friday & Cyber Week",
            "description": "Extreme seasonal demand: seasonality spikes 120%, browsing +150%, repeat visits accelerate",
            "adjustments": {
                "seasonality_index": 2.20,
                "browsing_minutes": 2.50,
                "days_since_last_purchase": 0.60,
            },
            "icon": "🏷️",
            "severity": "high",
        },
        {
            "id": "churn_crisis",
            "name": "Retention & Churn Crisis",
            "description": "Inactivity crisis: purchase recency worsens 90%, loyalty drops 40%, browsing down 30%",
            "adjustments": {
                "days_since_last_purchase": 1.90,
                "loyalty_score": 0.60,
                "browsing_minutes": 0.70,
            },
            "icon": "🚨",
            "severity": "high",
        },
        {
            "id": "vip_expansion",
            "name": "VIP Loyalty Expansion",
            "description": "Loyalty program maturity: loyalty score +50%, cart values +40%, frequent repeat shopping",
            "adjustments": {
                "loyalty_score": 1.50,
                "cart_value_history": 1.40,
                "days_since_last_purchase": 0.70,
            },
            "icon": "👑",
            "severity": "low",
        },
        {
            "id": "summer_lull",
            "name": "Summer Off-Season Slump",
            "description": "Trough season: seasonality index down 40%, browsing down 35%, extended purchase intervals",
            "adjustments": {
                "seasonality_index": 0.60,
                "browsing_minutes": 0.65,
                "days_since_last_purchase": 1.30,
            },
            "icon": "🏖️",
            "severity": "medium",
        },
    ]


def _build_tornado_sensitivity(engine, baseline_df, baseline_causal, budget, product_price, unit_cost):
    """
    Computes tornado chart data by perturbing each feature ±25% independently
    and measuring the impact on incremental profit.
    """
    baseline_profit = baseline_causal.get("incremental_profit", 0)
    tornado_items = []

    perturbation_features = {
        "income": "Customer Income",
        "browsing_minutes": "Browsing Time",
        "loyalty_score": "Loyalty Tier",
        "days_since_last_purchase": "Purchase Recency",
        "cart_value_history": "Cart Value History",
        "seasonality_index": "Seasonality Index",
    }

    for feat, label in perturbation_features.items():
        profits = {}
        for direction, mult in [("decrease", 0.75), ("increase", 1.25)]:
            sc_df = baseline_df.copy()
            sc_df[feat] = sc_df[feat] * mult

            X_sc = sc_df[FEATURE_COLS].values
            cate_sc = engine.dml_model.effect(X_sc)
            pred_ml_sc = engine.baseline_model.predict_proba(X_sc)[:, 1]
            baseline_prob_sc = np.clip(pred_ml_sc - (0.5 * cate_sc), 0.02, 0.95)
            ite_10_sc = np.clip(cate_sc * 0.65, -0.15, 0.50)
            ite_20_sc = np.clip(cate_sc * 1.15, -0.20, 0.70)

            archetypes_sc = []
            for i in range(len(sc_df)):
                uplift = ite_20_sc[i]
                base = baseline_prob_sc[i]
                if uplift < -0.01:
                    archetypes_sc.append("Sleeping Dog")
                elif uplift >= 0.12:
                    archetypes_sc.append("Persuadable")
                elif base >= 0.60:
                    archetypes_sc.append("Sure Thing")
                else:
                    archetypes_sc.append("Lost Cause")

            scored_sc = sc_df.copy()
            scored_sc["pred_ite_binary"] = np.round(cate_sc, 4)
            scored_sc["pred_ite_10"] = np.round(ite_10_sc, 4)
            scored_sc["pred_ite_20"] = np.round(ite_20_sc, 4)
            scored_sc["pred_baseline_prob"] = np.round(baseline_prob_sc, 4)
            scored_sc["predictive_ml_score"] = np.round(pred_ml_sc, 4)
            scored_sc["uplift_archetype"] = archetypes_sc

            opt_sc = solve_discount_optimization(scored_sc, budget=budget, product_price=product_price, unit_cost=unit_cost)
            causal_sc = next((s for s in opt_sc["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})
            profits[direction] = causal_sc.get("incremental_profit", 0)

        tornado_items.append({
            "feature": feat,
            "label": label,
            "decrease_profit": profits["decrease"],
            "increase_profit": profits["increase"],
            "decrease_delta": round(float(profits["decrease"] - baseline_profit), 0),
            "increase_delta": round(float(profits["increase"] - baseline_profit), 0),
            "total_swing": round(float(abs(profits["increase"] - profits["decrease"])), 0),
        })

    # Sort by total sensitivity swing
    tornado_items.sort(key=lambda x: x["total_swing"], reverse=True)

    return tornado_items
