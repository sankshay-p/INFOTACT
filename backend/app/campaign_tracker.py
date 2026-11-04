import time
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime


# In-memory campaign event log
_campaign_log: List[Dict[str, Any]] = []


def record_campaign_event(
    event_type: str,
    description: str,
    before_metrics: Optional[Dict[str, Any]] = None,
    after_metrics: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Records a campaign event to the in-memory log with before/after metrics.
    """
    event = {
        "event_id": str(uuid.uuid4())[:8],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "epoch": time.time(),
        "event_type": event_type,
        "description": description,
        "before_metrics": before_metrics or {},
        "after_metrics": after_metrics or {},
        "metadata": metadata or {},
    }

    # Calculate deltas
    if before_metrics and after_metrics:
        deltas = {}
        for key in after_metrics:
            if key in before_metrics and isinstance(after_metrics[key], (int, float)) and isinstance(before_metrics[key], (int, float)):
                deltas[key] = round(float(after_metrics[key] - before_metrics[key]), 2)
        event["deltas"] = deltas
    else:
        event["deltas"] = {}

    _campaign_log.append(event)
    return event


def get_campaign_history(limit: int = 100) -> Dict[str, Any]:
    """
    Returns the campaign event log in reverse chronological order.
    """
    events = sorted(_campaign_log, key=lambda x: x["epoch"], reverse=True)[:limit]

    # Summary statistics
    total_events = len(_campaign_log)
    event_types = {}
    for e in _campaign_log:
        et = e["event_type"]
        event_types[et] = event_types.get(et, 0) + 1

    # Cumulative profit timeline
    profit_timeline = []
    running_profit = 0
    for e in sorted(_campaign_log, key=lambda x: x["epoch"]):
        if "incremental_profit" in e.get("after_metrics", {}):
            running_profit = e["after_metrics"]["incremental_profit"]
        profit_timeline.append({
            "timestamp": e["timestamp"],
            "event_type": e["event_type"],
            "profit": running_profit,
        })

    return {
        "events": events,
        "total_events": total_events,
        "event_type_counts": event_types,
        "profit_timeline": profit_timeline,
    }


def clear_campaign_history() -> Dict[str, Any]:
    """Clears all campaign events."""
    global _campaign_log
    count = len(_campaign_log)
    _campaign_log = []
    return {"cleared": count, "message": f"Cleared {count} campaign events."}


def run_ab_test(
    engine,
    df,
    split_ratio: float = 0.5,
    budget: float = 5000.0,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
) -> Dict[str, Any]:
    """
    Simulates an A/B test comparing Causal DML targeting vs Predictive ML targeting
    on a randomly split population.
    """
    import numpy as np
    from app.optimization import solve_discount_optimization

    n = len(df)
    rng = np.random.RandomState(42)
    indices = rng.permutation(n)

    split_point = int(n * split_ratio)
    group_a_idx = indices[:split_point]  # Causal DML allocation
    group_b_idx = indices[split_point:]  # Predictive ML allocation

    group_a_df = df.iloc[group_a_idx].reset_index(drop=True)
    group_b_df = df.iloc[group_b_idx].reset_index(drop=True)

    budget_a = budget * split_ratio
    budget_b = budget * (1 - split_ratio)

    # Run optimization for both groups
    opt_a = solve_discount_optimization(group_a_df, budget=budget_a, product_price=product_price, unit_cost=unit_cost)
    opt_b = solve_discount_optimization(group_b_df, budget=budget_b, product_price=product_price, unit_cost=unit_cost)

    causal_a = next((s for s in opt_a["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})
    pred_a = next((s for s in opt_a["strategy_comparison"] if "Predictive ML" in s["strategy"]), {})
    causal_b = next((s for s in opt_b["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})
    pred_b = next((s for s in opt_b["strategy_comparison"] if "Predictive ML" in s["strategy"]), {})

    # Group A uses causal strategy, Group B uses predictive strategy
    group_a_profit = causal_a.get("incremental_profit", 0)
    group_b_profit = pred_b.get("incremental_profit", 0)

    group_a_wasted = causal_a.get("wasted_budget", 0)
    group_b_wasted = pred_b.get("wasted_budget", 0)

    group_a_roi = causal_a.get("roi_percentage", 0)
    group_b_roi = pred_b.get("roi_percentage", 0)

    # Lift and significance
    profit_lift = group_a_profit - group_b_profit
    roi_lift = group_a_roi - group_b_roi

    # Statistical significance estimate (z-test approximation)
    n_a = len(group_a_df)
    n_b = len(group_b_df)
    # Use per-customer profit as proxy
    per_cust_a = group_a_profit / max(1, n_a)
    per_cust_b = group_b_profit / max(1, n_b)
    pooled_var = (per_cust_a ** 2 + per_cust_b ** 2) / 2
    se = float(np.sqrt(pooled_var * (1/max(1,n_a) + 1/max(1,n_b)))) if pooled_var > 0 else 1e-6
    z_stat = float((per_cust_a - per_cust_b) / max(se, 1e-6))
    p_value = float(2 * (1 - min(0.9999, 0.5 * (1 + np.math.erf(abs(z_stat) / np.sqrt(2))))))
    is_significant = p_value < 0.05

    # Record AB test event
    record_campaign_event(
        event_type="ab_test",
        description=f"A/B Test: Causal DML vs Predictive ML ({split_ratio*100:.0f}/{(1-split_ratio)*100:.0f} split)",
        before_metrics={
            "budget": budget,
            "split_ratio": split_ratio,
        },
        after_metrics={
            "causal_profit": group_a_profit,
            "predictive_profit": group_b_profit,
            "profit_lift": round(profit_lift, 0),
            "p_value": round(p_value, 4),
            "significant": is_significant,
        },
        metadata={"split_ratio": split_ratio},
    )

    return {
        "group_a": {
            "name": "Causal DML (Treatment)",
            "strategy": "EconoCausal Prescriptive",
            "sample_size": n_a,
            "budget_allocated": round(budget_a, 0),
            "incremental_profit": group_a_profit,
            "wasted_budget": group_a_wasted,
            "roi_percentage": group_a_roi,
            "archetype_targeted": causal_a.get("archetype_targeted", {}),
        },
        "group_b": {
            "name": "Predictive ML (Control)",
            "strategy": "Predictive ML Targeting",
            "sample_size": n_b,
            "budget_allocated": round(budget_b, 0),
            "incremental_profit": group_b_profit,
            "wasted_budget": group_b_wasted,
            "roi_percentage": group_b_roi,
            "archetype_targeted": pred_b.get("archetype_targeted", {}),
        },
        "test_results": {
            "profit_lift": round(profit_lift, 0),
            "profit_lift_pct": round(float((profit_lift / max(1, group_b_profit)) * 100), 1),
            "roi_lift": round(roi_lift, 1),
            "waste_reduction": round(float(group_b_wasted - group_a_wasted), 0),
            "z_statistic": round(z_stat, 3),
            "p_value": round(p_value, 4),
            "is_significant": is_significant,
            "significance_level": "p < 0.01" if p_value < 0.01 else ("p < 0.05" if p_value < 0.05 else "Not significant"),
            "winner": "Causal DML" if group_a_profit > group_b_profit else "Predictive ML",
        },
        "split_ratio": split_ratio,
        "total_budget": budget,
    }
