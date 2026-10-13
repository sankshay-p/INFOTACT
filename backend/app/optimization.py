import numpy as np
import pandas as pd
from typing import Dict, Any, List
from scipy.optimize import linprog

def solve_discount_optimization(
    df: pd.DataFrame,
    budget: float = 5000.0,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
    discount_tiers: List[float] = [0.0, 10.0, 20.0]
) -> Dict[str, Any]:
    """
    Prescriptive Optimization Solver:
    Solves budget-constrained optimal discount assignment to maximize total incremental profit:
      max sum_i Delta_Profit_i(d_i)
      subject to sum_i d_i <= Budget
    Compares EconoCausal Prescriptive Optimization against:
      - Traditional Predictive ML Targeting
      - Blanket Promotion
      - Random Allocation
    """
    n = len(df)
    base_margin = product_price - unit_cost  # e.g., $100 - $40 = $60

    # Ensure required columns exist
    p0 = df["pred_baseline_prob"].values
    tau_10 = df["pred_ite_10"].values
    tau_20 = df["pred_ite_20"].values
    pred_score = df["predictive_ml_score"].values
    archetypes = df["uplift_archetype"].values

    # Net incremental profit for each tier:
    # d = 0: Delta_Profit = 0, Cost = 0
    # d = 10: p(10) * (Price - 10 - Cost) - p(0) * (Price - Cost)
    #        = (p0 + tau_10) * (base_margin - 10) - p0 * base_margin
    #        = tau_10 * (base_margin - 10) - 10 * p0
    # d = 20: tau_20 * (base_margin - 20) - 20 * p0
    delta_profit_0 = np.zeros(n)
    delta_profit_10 = tau_10 * (base_margin - 10.0) - (10.0 * p0)
    delta_profit_20 = tau_20 * (base_margin - 20.0) - (20.0 * p0)

    delta_rev_10 = tau_10 * product_price
    delta_rev_20 = tau_20 * product_price

    # -------------------------------------------------------------
    # 1. CAUSAL PRESCRIPTIVE OPTIMIZATION (Knapsack Marginal Efficiency)
    # -------------------------------------------------------------
    # Options for each customer:
    # Step A: Upgrade 0 -> 10: cost = 10, return = delta_profit_10
    # Step B: Upgrade 10 -> 20: cost = 10, return = delta_profit_20 - delta_profit_10
    # Step C: Jump 0 -> 20: cost = 20, return = delta_profit_20
    
    # We solve via integer knapsack / greedy marginal efficiency:
    # Evaluate net gain per dollar spent:
    eff_10 = np.where(delta_profit_10 > 0, delta_profit_10 / 10.0, -999.0)
    eff_20_from_10 = np.where(
        (delta_profit_20 - delta_profit_10) > 0,
        (delta_profit_20 - delta_profit_10) / 10.0,
        -999.0
    )
    eff_20_direct = np.where(delta_profit_20 > 0, delta_profit_20 / 20.0, -999.0)

    # Initialize assignment
    causal_assigned_discount = np.zeros(n)
    remaining_budget = budget

    # Priority pool: candidate actions
    # Action tuples: (efficiency, customer_idx, target_tier, additional_cost, delta_profit)
    candidate_actions = []
    for i in range(n):
        # Only consider positive profit gains
        if delta_profit_10[i] > 0 and delta_profit_10[i] >= delta_profit_20[i]:
            candidate_actions.append((eff_10[i], i, 10.0, 10.0, delta_profit_10[i]))
        elif delta_profit_20[i] > 0:
            if eff_20_from_10[i] > eff_10[i] and eff_10[i] > 0:
                candidate_actions.append((eff_20_direct[i], i, 20.0, 20.0, delta_profit_20[i]))
            else:
                candidate_actions.append((eff_20_direct[i], i, 20.0, 20.0, delta_profit_20[i]))

    candidate_actions.sort(key=lambda x: x[0], reverse=True)

    causal_spent = 0.0
    for eff, i, tier, cost, gain in candidate_actions:
        if causal_spent + cost <= budget:
            causal_assigned_discount[i] = tier
            causal_spent += cost

    # Calculate Causal metrics
    causal_inc_profit = 0.0
    causal_inc_rev = 0.0
    causal_wasted_spend = 0.0
    causal_archetype_targeted = {"Persuadable": 0, "Sure Thing": 0, "Lost Cause": 0, "Sleeping Dog": 0}

    for i in range(n):
        d = causal_assigned_discount[i]
        if d == 10.0:
            causal_inc_profit += delta_profit_10[i]
            causal_inc_rev += delta_rev_10[i]
            causal_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                causal_wasted_spend += 10.0
        elif d == 20.0:
            causal_inc_profit += delta_profit_20[i]
            causal_inc_rev += delta_rev_20[i]
            causal_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                causal_wasted_spend += 20.0

    # -------------------------------------------------------------
    # 2. PREDICTIVE ML BENCHMARK (Target highest predicted probability / churn score)
    # Traditional predictive ML targets customers who have the highest propensity to buy
    # (which ironically are Sure Things!)
    # -------------------------------------------------------------
    pred_idx_ranked = np.argsort(pred_score)[::-1]
    pred_assigned_discount = np.zeros(n)
    pred_spent = 0.0
    for idx in pred_idx_ranked:
        tier = 20.0 if pred_spent + 20.0 <= budget else (10.0 if pred_spent + 10.0 <= budget else 0.0)
        if tier > 0:
            pred_assigned_discount[idx] = tier
            pred_spent += tier
        if pred_spent >= budget:
            break

    pred_inc_profit = 0.0
    pred_inc_rev = 0.0
    pred_wasted_spend = 0.0
    pred_archetype_targeted = {"Persuadable": 0, "Sure Thing": 0, "Lost Cause": 0, "Sleeping Dog": 0}

    for i in range(n):
        d = pred_assigned_discount[i]
        if d == 10.0:
            pred_inc_profit += delta_profit_10[i]
            pred_inc_rev += delta_rev_10[i]
            pred_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                pred_wasted_spend += 10.0
        elif d == 20.0:
            pred_inc_profit += delta_profit_20[i]
            pred_inc_rev += delta_rev_20[i]
            pred_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                pred_wasted_spend += 20.0

    # -------------------------------------------------------------
    # 3. BLANKET BENCHMARK (Uniform $10 discount across first N customers)
    # -------------------------------------------------------------
    blanket_assigned_discount = np.zeros(n)
    blanket_spent = 0.0
    for i in range(n):
        if blanket_spent + 10.0 <= budget:
            blanket_assigned_discount[i] = 10.0
            blanket_spent += 10.0
        else:
            break

    blanket_inc_profit = 0.0
    blanket_inc_rev = 0.0
    blanket_wasted_spend = 0.0
    blanket_archetype_targeted = {"Persuadable": 0, "Sure Thing": 0, "Lost Cause": 0, "Sleeping Dog": 0}

    for i in range(n):
        d = blanket_assigned_discount[i]
        if d == 10.0:
            blanket_inc_profit += delta_profit_10[i]
            blanket_inc_rev += delta_rev_10[i]
            blanket_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                blanket_wasted_spend += 10.0

    # -------------------------------------------------------------
    # 4. RANDOM ROLLOUT BENCHMARK
    # -------------------------------------------------------------
    rng = np.random.RandomState(42)
    rand_perm = rng.permutation(n)
    rand_assigned_discount = np.zeros(n)
    rand_spent = 0.0
    for idx in rand_perm:
        tier = 10.0
        if rand_spent + tier <= budget:
            rand_assigned_discount[idx] = tier
            rand_spent += tier
        else:
            break

    rand_inc_profit = 0.0
    rand_inc_rev = 0.0
    rand_wasted_spend = 0.0
    rand_archetype_targeted = {"Persuadable": 0, "Sure Thing": 0, "Lost Cause": 0, "Sleeping Dog": 0}

    for i in range(n):
        d = rand_assigned_discount[i]
        if d == 10.0:
            rand_inc_profit += delta_profit_10[i]
            rand_inc_rev += delta_rev_10[i]
            rand_archetype_targeted[archetypes[i]] += 1
            if archetypes[i] in ["Sure Thing", "Lost Cause", "Sleeping Dog"]:
                rand_wasted_spend += 10.0

    # Format strategy comparison summary
    def make_strat_card(name, budget_spent, inc_rev, inc_prof, wasted, arch_dict):
        roi = round(float((inc_prof / max(1.0, budget_spent)) * 100), 1)
        return {
            "strategy": name,
            "budget_spent": round(float(budget_spent), 0),
            "incremental_revenue": round(float(inc_rev), 0),
            "incremental_profit": round(float(inc_prof), 0),
            "wasted_budget": round(float(wasted), 0),
            "wasted_pct": round(float((wasted / max(1.0, budget_spent)) * 100), 1),
            "roi_percentage": roi,
            "targeted_customers": sum(arch_dict.values()),
            "archetype_targeted": arch_dict
        }

    comparison = [
        make_strat_card("EconoCausal Prescriptive", causal_spent, causal_inc_rev, causal_inc_profit, causal_wasted_spend, causal_archetype_targeted),
        make_strat_card("Predictive ML Targeting", pred_spent, pred_inc_rev, pred_inc_profit, pred_wasted_spend, pred_archetype_targeted),
        make_strat_card("Blanket Promotion ($10 Uniform)", blanket_spent, blanket_inc_rev, blanket_inc_profit, blanket_wasted_spend, blanket_archetype_targeted),
        make_strat_card("Random Rollout", rand_spent, rand_inc_rev, rand_inc_profit, rand_wasted_spend, rand_archetype_targeted)
    ]

    # Dollars saved vs Predictive ML and Blanket
    savings_vs_predictive = max(0.0, pred_wasted_spend - causal_wasted_spend)
    profit_lift_vs_predictive = max(0.0, causal_inc_profit - pred_inc_profit)
    profit_lift_vs_blanket = max(0.0, causal_inc_profit - blanket_inc_profit)

    # Customer-level allocation table records (top 150 records for fast UI rendering)
    allocation_matrix = []
    for i in range(n):
        opt_d = causal_assigned_discount[i]
        exp_gain = delta_profit_20[i] if opt_d == 20.0 else (delta_profit_10[i] if opt_d == 10.0 else 0.0)
        allocation_matrix.append({
            "customer_id": int(df["customer_id"].iloc[i]),
            "income": float(df["income"].iloc[i]),
            "browsing_minutes": float(df["browsing_minutes"].iloc[i]),
            "loyalty_score": float(df["loyalty_score"].iloc[i]),
            "days_since_last_purchase": float(df["days_since_last_purchase"].iloc[i]),
            "baseline_prob": float(df["pred_baseline_prob"].iloc[i]),
            "uplift_ite_10": float(df["pred_ite_10"].iloc[i]),
            "uplift_ite_20": float(df["pred_ite_20"].iloc[i]),
            "archetype": archetypes[i],
            "optimal_discount": float(opt_d),
            "predictive_ml_discount": float(pred_assigned_discount[i]),
            "expected_incremental_profit": round(float(exp_gain), 2),
            "recommendation_rationale": (
                "PERSUADABLE: High price sensitivity. Discount generates net positive uplift." if opt_d > 0
                else ("SURE THING: High baseline probability. Discount would cannibalize existing margin." if archetypes[i] == "Sure Thing"
                else ("LOST CAUSE: Inelastic customer. Discount fails to trigger purchase." if archetypes[i] == "Lost Cause"
                else "SLEEPING DOG: Promotional contact may produce negative brand response."))
            )
        })

    return {
        "budget_limit": budget,
        "product_price": product_price,
        "unit_cost": unit_cost,
        "strategy_comparison": comparison,
        "executive_roi": {
            "causal_incremental_profit": round(float(causal_inc_profit), 0),
            "causal_incremental_revenue": round(float(causal_inc_rev), 0),
            "savings_vs_predictive": round(float(savings_vs_predictive), 0),
            "profit_lift_vs_predictive": round(float(profit_lift_vs_predictive), 0),
            "profit_lift_vs_blanket": round(float(profit_lift_vs_blanket), 0),
            "wasted_dollars_prevented": round(float(pred_wasted_spend - causal_wasted_spend), 0),
            "persuadables_targeted_pct": round(float((causal_archetype_targeted["Persuadable"] / max(1, sum(causal_archetype_targeted.values()))) * 100), 1)
        },
        "allocation_matrix": allocation_matrix
    }
