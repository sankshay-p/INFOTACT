import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.tree import DecisionTreeClassifier
from app.causal_engine import FEATURE_COLS
from app.optimization import solve_discount_optimization


FEATURE_LABELS = {
    "income": "Customer Income ($)",
    "browsing_minutes": "Browsing Time (mins)",
    "loyalty_score": "Loyalty Tier (1-10)",
    "days_since_last_purchase": "Days Since Last Purchase",
    "cart_value_history": "Historical Cart Value ($)",
    "seasonality_index": "Seasonality Index",
}


def build_causal_policy_tree(
    engine,
    max_depth: int = 3,
    budget: float = 5000.0,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
) -> Dict[str, Any]:
    """
    Trains an interpretable, white-box Causal Policy Tree on optimal counterfactual allocations.
    Extracts explicit decision splits and compiles human-auditable business rules in SQL, Python, and JSON.
    """
    df = engine.trained_df.copy()
    opt_res = solve_discount_optimization(df, budget=budget, product_price=product_price, unit_cost=unit_cost)
    opt_df = pd.DataFrame(opt_res["allocation_matrix"])

    # Feature matrix X and target y (optimal prescribed discount)
    X = df[FEATURE_COLS].values
    y = opt_df["optimal_discount"].values.astype(int)  # 0, 10, or 20

    # Sample weights: emphasize decisions with large economic gains
    weights = np.maximum(opt_df["expected_incremental_profit"].values, 0.5)

    clf = DecisionTreeClassifier(
        max_depth=max_depth,
        min_samples_leaf=max(15, int(len(df) * 0.015)),
        class_weight="balanced",
        random_state=42
    )
    clf.fit(X, y, sample_weight=weights)

    # Calculate policy fidelity
    tree_preds = clf.predict(X)
    policy_agreement = round(float(np.mean(tree_preds == y) * 100), 1)

    # Estimate profit captured by the tree vs optimal solver
    tree_profit = 0.0
    for i in range(len(df)):
        pred_d = tree_preds[i]
        if pred_d == 20:
            tree_profit += df["pred_ite_20"].iloc[i] * (product_price - unit_cost - 20) - 20 * df["pred_baseline_prob"].iloc[i]
        elif pred_d == 10:
            tree_profit += df["pred_ite_10"].iloc[i] * (product_price - unit_cost - 10) - 10 * df["pred_baseline_prob"].iloc[i]

    optimal_profit = opt_res["executive_roi"]["causal_incremental_profit"]
    profit_capture_pct = round(float(max(0.0, tree_profit / max(1.0, optimal_profit) * 100)), 1)

    # Recursive parser to convert sklearn tree into JSON tree structure
    tree_ = clf.tree_
    feature_names = FEATURE_COLS

    def recurse(node_id: int, current_depth: int) -> Dict[str, Any]:
        is_leaf = tree_.children_left[node_id] == tree_.children_right[node_id]
        node_samples = int(tree_.n_node_samples[node_id])
        samples_pct = round(float(node_samples / len(df) * 100), 1)

        # Class counts in node
        class_counts = tree_.value[node_id][0]
        dominant_class_idx = int(np.argmax(class_counts))
        dominant_discount = int(clf.classes_[dominant_class_idx])

        if is_leaf:
            # Mask of customers who land in this leaf
            node_mask = (clf.apply(X) == node_id)
            leaf_df = df[node_mask]
            leaf_opt = opt_df[node_mask]

            avg_uplift = round(float(leaf_df["pred_ite_binary"].mean()), 4) if len(leaf_df) > 0 else 0.0
            avg_baseline = round(float(leaf_df["pred_baseline_prob"].mean()), 4) if len(leaf_df) > 0 else 0.0
            inc_profit = round(float(leaf_opt["expected_incremental_profit"].sum()), 0) if len(leaf_opt) > 0 else 0.0
            
            # Most common archetype in this leaf
            dominant_arch = leaf_opt["archetype"].mode().iloc[0] if len(leaf_opt) > 0 else "Mixed"

            if dominant_discount == 20:
                action_text = "Target with $20 Discount"
                color = "#10b981"
                rationale = "High price elasticity (Persuadables). Deep discount generates peak incremental purchase volume."
            elif dominant_discount == 10:
                action_text = "Target with $10 Discount"
                color = "#38bdf8"
                rationale = "Moderate price elasticity. $10 discount achieves positive ROI with minimal margin dilution."
            else:
                action_text = "Suppress Discount ($0 Offer)"
                color = "#f59e0b" if dominant_arch == "Sure Thing" else "#f43f5e"
                rationale = "High organic baseline (Sure Things) or inelastic (Lost Causes). Discounts burn margin."

            return {
                "id": f"leaf_{node_id}",
                "type": "leaf",
                "depth": current_depth,
                "samples": node_samples,
                "samples_pct": samples_pct,
                "discount": dominant_discount,
                "action": action_text,
                "color": color,
                "dominant_archetype": dominant_arch,
                "avg_uplift": avg_uplift,
                "avg_baseline_prob": avg_baseline,
                "incremental_profit": inc_profit,
                "rationale": rationale,
            }
        else:
            feat_idx = tree_.feature[node_id]
            feat_name = feature_names[feat_idx]
            threshold = round(float(tree_.threshold[node_id]), 2)
            label = FEATURE_LABELS.get(feat_name, feat_name)

            left_child = recurse(tree_.children_left[node_id], current_depth + 1)
            right_child = recurse(tree_.children_right[node_id], current_depth + 1)

            return {
                "id": f"node_{node_id}",
                "type": "split",
                "depth": current_depth,
                "feature": feat_name,
                "feature_label": label,
                "threshold": threshold,
                "condition": f"{label} ≤ {threshold}",
                "samples": node_samples,
                "samples_pct": samples_pct,
                "left": left_child,   # condition is TRUE (<=)
                "right": right_child, # condition is FALSE (>)
            }

    tree_hierarchy = recurse(0, 0)

    # Collect all decision paths as flat rules
    flat_rules = []

    def extract_paths(node: Dict[str, Any], path_conditions: List[str]):
        if node["type"] == "leaf":
            flat_rules.append({
                "rule_id": node["id"],
                "conditions": list(path_conditions),
                "discount": node["discount"],
                "action": node["action"],
                "samples": node["samples"],
                "samples_pct": node["samples_pct"],
                "dominant_archetype": node["dominant_archetype"],
                "avg_uplift": node["avg_uplift"],
                "incremental_profit": node["incremental_profit"],
                "color": node["color"],
                "rationale": node["rationale"],
            })
        else:
            feat = node["feature"]
            thresh = node["threshold"]
            # Left path: <= thresh
            extract_paths(node["left"], path_conditions + [f"{feat} <= {thresh}"])
            # Right path: > thresh
            extract_paths(node["right"], path_conditions + [f"{feat} > {thresh}"])

    extract_paths(tree_hierarchy, [])

    # Compile into SQL, Python, and JSON
    sql_code = _compile_sql_rules(flat_rules)
    python_code = _compile_python_rules(flat_rules)
    json_rules = _compile_json_rules(flat_rules)

    return {
        "max_depth": max_depth,
        "policy_agreement_pct": policy_agreement,
        "profit_capture_pct": profit_capture_pct,
        "total_rules": len(flat_rules),
        "tree_hierarchy": tree_hierarchy,
        "flat_rules": flat_rules,
        "code_exports": {
            "sql": sql_code,
            "python": python_code,
            "json": json_rules,
        },
    }


def _compile_sql_rules(flat_rules: List[Dict[str, Any]]) -> str:
    """Generates standard SQL CASE statement for Snowflake, BigQuery, Postgres."""
    lines = [
        "-- =====================================================================",
        "-- EconoCausal Prescriptive Business Policy Rules",
        "-- Auto-generated from Causal Policy Tree (LinearDML Optimization)",
        "-- Compatible with Snowflake, Google BigQuery, Databricks, PostgreSQL",
        "-- =====================================================================",
        "SELECT",
        "  customer_id,",
        "  income,",
        "  browsing_minutes,",
        "  loyalty_score,",
        "  days_since_last_purchase,",
        "  cart_value_history,",
        "  -- Prescriptive Decision Logic",
        "  CASE",
    ]

    # Non-zero discounts first
    sorted_rules = sorted(flat_rules, key=lambda r: (r["discount"] == 0, -r["discount"]))

    for r in sorted_rules:
        cond_str = " AND ".join(r["conditions"]) if r["conditions"] else "1 = 1"
        lines.append(f"    WHEN {cond_str}")
        lines.append(f"      THEN {r['discount']} -- {r['dominant_archetype']}: {r['action']} ({r['samples']} users)")

    lines.append("    ELSE 0")
    lines.append("  END AS prescribed_discount,")
    lines.append("  CASE")
    for r in sorted_rules:
        cond_str = " AND ".join(r["conditions"]) if r["conditions"] else "1 = 1"
        lines.append(f"    WHEN {cond_str}")
        lines.append(f"      THEN '{r['dominant_archetype']}'")
    lines.append("    ELSE 'Unclassified'")
    lines.append("  END AS causal_archetype")
    lines.append("FROM customer_features_table;")

    return "\n".join(lines)


def _compile_python_rules(flat_rules: List[Dict[str, Any]]) -> str:
    """Generates standalone Python evaluation function."""
    lines = [
        "# =====================================================================",
        "# EconoCausal Prescriptive Business Policy Function",
        "# Standalone, zero-dependency Python rule evaluator",
        "# =====================================================================",
        "from typing import Dict, Any",
        "",
        "",
        "def evaluate_discount_policy(customer: Dict[str, Any]) -> Dict[str, Any]:",
        "    \"\"\"",
        "    Evaluates a customer record against EconoCausal white-box decision rules.",
        "    Returns prescribed discount ($0, $10, $20), causal archetype, and rationale.",
        "    \"\"\"",
        "    income = float(customer.get('income', 65000))",
        "    browsing = float(customer.get('browsing_minutes', 30))",
        "    loyalty = float(customer.get('loyalty_score', 5))",
        "    recency = float(customer.get('days_since_last_purchase', 35))",
        "    cart = float(customer.get('cart_value_history', 95))",
        "    seasonality = float(customer.get('seasonality_index', 1.0))",
        "",
    ]

    for i, r in enumerate(flat_rules):
        py_conds = []
        for c in r["conditions"]:
            py_cond = (
                c.replace("browsing_minutes", "browsing")
                .replace("loyalty_score", "loyalty")
                .replace("days_since_last_purchase", "recency")
                .replace("cart_value_history", "cart")
                .replace("seasonality_index", "seasonality")
            )
            py_conds.append(py_cond)

        if_keyword = "if" if i == 0 else "elif"
        cond_str = " and ".join(py_conds) if py_conds else "True"

        lines.append(f"    {if_keyword} {cond_str}:")
        lines.append(f"        return {{")
        lines.append(f"            'prescribed_discount': {r['discount']},")
        lines.append(f"            'causal_archetype': '{r['dominant_archetype']}',")
        lines.append(f"            'action': '{r['action']}',")
        lines.append(f"            'expected_incremental_lift': {r['avg_uplift']},")
        lines.append(f"            'rationale': '{r['rationale']}',")
        lines.append(f"        }}")

    lines.append("    else:")
    lines.append("        return {")
    lines.append("            'prescribed_discount': 0,")
    lines.append("            'causal_archetype': 'Sure Thing',")
    lines.append("            'action': 'Suppress Discount ($0 Offer)',")
    lines.append("            'expected_incremental_lift': 0.0,")
    lines.append("            'rationale': 'Default fallback: protect margins from unclassified discount bleed.',")
    lines.append("        }")

    return "\n".join(lines)


def _compile_json_rules(flat_rules: List[Dict[str, Any]]) -> str:
    """Generates standard JSONLogic rule specification."""
    import json
    rules = []
    for r in flat_rules:
        rules.append({
            "id": r["rule_id"],
            "conditions": r["conditions"],
            "prescribed_discount": r["discount"],
            "causal_archetype": r["dominant_archetype"],
            "expected_incremental_profit": r["incremental_profit"],
            "audience_share_pct": r["samples_pct"],
            "rationale": r["rationale"],
        })
    return json.dumps({"policy_name": "EconoCausal_Decision_Rules", "rules": rules}, indent=2)
