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

    # -------------------------------------------------------------
    # 5. BUDGET SENSITIVITY FRONTIER & SATURATION ANALYSIS
    # -------------------------------------------------------------
    test_budgets = [1000.0, 2500.0, 5000.0, 7500.0, 10000.0, 12500.0, 15000.0, 20000.0]
    frontier = []
    prev_profit = 0.0
    optimal_sat_budget = 5000.0
    found_saturation = False

    for b in test_budgets:
        # Causal greedy sum
        c_spent = 0.0
        c_prof = 0.0
        c_persuadables = 0
        for eff, idx, tier, cost, gain in candidate_actions:
            if c_spent + cost <= b:
                c_spent += cost
                c_prof += gain
                if archetypes[idx] == "Persuadable":
                    c_persuadables += 1

        # Predictive ML greedy sum
        p_spent = 0.0
        p_prof = 0.0
        for idx in pred_idx_ranked:
            if p_spent + 10.0 <= b:
                p_spent += 10.0
                p_prof += delta_profit_10[idx]
            else:
                break

        # Blanket $10 sum
        blk_spent = min(b, n * 10.0)
        blk_count = int(blk_spent / 10.0)
        blk_prof = float(np.sum(delta_profit_10[:blk_count]))

        marginal_roi = round(float((c_prof - prev_profit) / max(1.0, (b - (frontier[-1]["budget"] if frontier else 0.0))) * 100), 1) if frontier else round(float((c_prof / b) * 100), 1)

        if not found_saturation and frontier and marginal_roi < 15.0:
            optimal_sat_budget = frontier[-1]["budget"]
            found_saturation = True

        frontier.append({
            "budget": b,
            "causal_profit": round(float(c_prof), 0),
            "predictive_profit": round(float(p_prof), 0),
            "blanket_profit": round(float(blk_prof), 0),
            "roi_percentage": round(float((c_prof / b) * 100), 1),
            "persuadables_targeted": c_persuadables,
            "marginal_roi": marginal_roi
        })
        prev_profit = c_prof

    if not found_saturation:
        optimal_sat_budget = 7500.0

    return {
        "budget_limit": budget,
        "product_price": product_price,
        "unit_cost": unit_cost,
        "optimal_saturation_budget": optimal_sat_budget,
        "budget_frontier": frontier,
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

def simulate_customer_counterfactual(
    customer_info: Dict[str, Any],
    product_price: float = 100.0,
    unit_cost: float = 40.0
) -> Dict[str, Any]:
    """
    Computes counterfactual outcomes across all promotional tiers ($0, $10, $20)
    for a specific customer profile to answer:
    'Would this user have bought IF AND ONLY IF we gave them the discount?'
    """
    base_margin = product_price - unit_cost  # $60
    
    p0 = float(np.clip(customer_info.get("baseline_prob", customer_info.get("pred_baseline_prob", 0.35)), 0.01, 0.99))
    tau_10 = float(customer_info.get("uplift_ite_10", customer_info.get("pred_ite_10", 0.12)))
    tau_20 = float(customer_info.get("uplift_ite_20", customer_info.get("pred_ite_20", 0.22)))

    # Counterfactual probabilities
    p10 = float(np.clip(p0 + tau_10, 0.01, 0.99))
    p20 = float(np.clip(p0 + tau_20, 0.01, 0.99))

    # Margin per purchase
    margin_0 = base_margin               # $60
    margin_10 = base_margin - 10.0       # $50
    margin_20 = base_margin - 20.0       # $40

    # Expected dollar profit per user
    expected_profit_0 = p0 * margin_0
    expected_profit_10 = p10 * margin_10
    expected_profit_20 = p20 * margin_20

    # Net incremental profit over organic baseline
    net_inc_profit_0 = 0.0
    net_inc_profit_10 = expected_profit_10 - expected_profit_0
    net_inc_profit_20 = expected_profit_20 - expected_profit_0

    # Classify archetype
    archetype = "Persuadable"
    if p0 >= 0.60:
        archetype = "Sure Thing"
    elif tau_20 < 0.06:
        archetype = "Lost Cause"
    elif tau_10 < 0 or tau_20 < 0:
        archetype = "Sleeping Dog"

    # Optimal Prescriptive decision
    max_net = max(net_inc_profit_0, net_inc_profit_10, net_inc_profit_20)
    if max_net <= 0 or archetype != "Persuadable":
        optimal_discount = 0.0
    elif net_inc_profit_20 >= net_inc_profit_10:
        optimal_discount = 20.0
    else:
        optimal_discount = 10.0

    # Predictive ML comparison flaw
    predictive_score = p0 * 0.8 + 0.1
    predictive_discount = 20.0 if predictive_score > 0.6 else (10.0 if predictive_score > 0.4 else 0.0)

    # Narrative explanation
    if archetype == "Sure Thing":
        rationale = f"Sure Thing: Customer has a high organic conversion probability ({p0*100:.1f}%). Granting a discount would cannibalize ${optimal_discount if optimal_discount>0 else 10:.0f} in guaranteed margin without generating new incremental purchases."
    elif archetype == "Persuadable":
        rationale = f"Persuadable: High price elasticity (+{max(tau_10, tau_20)*100:.1f}% causal uplift). The ${optimal_discount:.0f} discount generates +${max_net:.2f} in net incremental profit, well exceeding the promotional cost."
    elif archetype == "Lost Cause":
        rationale = f"Lost Cause: Low purchase propensity and unresponsive to discounts (only +{tau_20*100:.1f}% uplift). Promotional dollars spent here fail to overcome the purchase threshold."
    else:
        rationale = "Sleeping Dog: Promotional contact creates adverse friction or negative utility. Discounts must be strictly withheld."

    return {
        "customer_id": customer_info.get("customer_id", 1),
        "archetype": archetype,
        "optimal_prescriptive_discount": optimal_discount,
        "predictive_ml_discount": predictive_discount,
        "cannibalization_risk": "HIGH" if archetype == "Sure Thing" else ("LOW" if archetype == "Persuadable" else "NONE"),
        "economic_rationale": rationale,
        "counterfactual_branches": [
            {
                "tier": "$0 Baseline",
                "discount": 0.0,
                "conversion_prob": round(p0 * 100, 1),
                "expected_gross_revenue": round(p0 * product_price, 2),
                "expected_margin": round(expected_profit_0, 2),
                "net_incremental_profit": 0.0,
                "is_optimal": optimal_discount == 0.0
            },
            {
                "tier": "$10 Promotion",
                "discount": 10.0,
                "conversion_prob": round(p10 * 100, 1),
                "causal_uplift": round(tau_10 * 100, 1),
                "expected_gross_revenue": round(p10 * (product_price - 10.0), 2),
                "expected_margin": round(expected_profit_10, 2),
                "net_incremental_profit": round(net_inc_profit_10, 2),
                "is_optimal": optimal_discount == 10.0
            },
            {
                "tier": "$20 Max Promotion",
                "discount": 20.0,
                "conversion_prob": round(p20 * 100, 1),
                "causal_uplift": round(tau_20 * 100, 1),
                "expected_gross_revenue": round(p20 * (product_price - 20.0), 2),
                "expected_margin": round(expected_profit_20, 2),
                "net_incremental_profit": round(net_inc_profit_20, 2),
                "is_optimal": optimal_discount == 20.0
            }
        ]
    }

