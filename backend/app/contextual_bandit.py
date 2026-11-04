import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from app.causal_engine import FEATURE_COLS


class LinUCBArm:
    """Represents an arm in Contextual Linear Upper Confidence Bound (LinUCB)."""
    def __init__(self, arm_id: int, discount: float, d_features: int, alpha: float = 1.0):
        self.arm_id = arm_id
        self.discount = discount
        self.d = d_features
        self.alpha = alpha
        self.A = np.identity(d_features)  # d x d
        self.b = np.zeros(d_features)     # d x 1
        self.pull_count = 0

    def get_ucb_score(self, x: np.ndarray) -> float:
        A_inv = np.linalg.inv(self.A)
        theta = A_inv @ self.b
        expected_reward = float(x @ theta)
        exploration_bonus = float(self.alpha * np.sqrt(x @ A_inv @ x))
        return expected_reward + exploration_bonus

    def update(self, x: np.ndarray, reward: float):
        self.A += np.outer(x, x)
        self.b += reward * x
        self.pull_count += 1


def run_bandit_pricing_simulation(
    engine,
    algorithm: str = "linucb",
    n_steps: int = 500,
    alpha: float = 1.0,
    product_price: float = 100.0,
    unit_cost: float = 40.0,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Simulates sequential online dynamic pricing via Contextual Multi-Armed Bandits.
    Arms:
      Arm 0: $0 Discount
      Arm 1: $10 Discount
      Arm 2: $20 Discount
    Compares LinUCB / Thompson Sampling against Causal Oracle, Static Predictive ML, and Random exploration.
    """
    rng = np.random.RandomState(seed)
    df = engine.trained_df.copy()
    n_total = len(df)
    
    # Feature matrix normalized for stable ridge regression
    X_raw = df[FEATURE_COLS].values
    X = (X_raw - np.mean(X_raw, axis=0)) / (np.std(X_raw, axis=0) + 1e-6)
    d_features = X.shape[1]

    p0 = df["pred_baseline_prob"].values
    tau_10 = df["pred_ite_10"].values
    tau_20 = df["pred_ite_20"].values
    pred_ml = df["predictive_ml_score"].values
    base_margin = product_price - unit_cost  # $60

    # Ground truth conversion probabilities for each arm
    prob_0 = np.clip(p0, 0.02, 0.98)
    prob_10 = np.clip(p0 + tau_10, 0.02, 0.98)
    prob_20 = np.clip(p0 + tau_20, 0.02, 0.98)

    # Ground truth expected net profits for each arm
    profit_0 = prob_0 * base_margin
    profit_10 = prob_10 * (base_margin - 10.0)
    profit_20 = prob_20 * (base_margin - 20.0)

    # Initialize bandit arms
    arms = [
        LinUCBArm(arm_id=0, discount=0.0, d_features=d_features, alpha=alpha),
        LinUCBArm(arm_id=1, discount=10.0, d_features=d_features, alpha=alpha),
        LinUCBArm(arm_id=2, discount=20.0, d_features=d_features, alpha=alpha),
    ]

    # Pre-sample customer sequence
    cust_indices = rng.choice(n_total, size=min(n_steps, n_total * 2), replace=True)

    bandit_cumulative_profit = []
    oracle_cumulative_profit = []
    pred_cumulative_profit = []
    random_cumulative_profit = []
    cumulative_regret = []
    arm_pull_history = []

    b_profit_acc = 0.0
    o_profit_acc = 0.0
    p_profit_acc = 0.0
    r_profit_acc = 0.0
    regret_acc = 0.0

    arm_counts = {0: 0, 1: 0, 2: 0}

    # Step-by-step sequential dynamic pricing
    for t, idx in enumerate(cust_indices):
        x_t = X[idx]

        # 1. Oracle optimal decision (ground truth max profit)
        exp_profits = [profit_0[idx], profit_10[idx], profit_20[idx]]
        oracle_arm = int(np.argmax(exp_profits))
        oracle_reward = exp_profits[oracle_arm]

        # 2. Predictive ML decision (scores conversion without margin penalty)
        if pred_ml[idx] > 0.65:
            pred_arm = 2  # Give $20 to high conversion probability (margin cannibalization!)
        elif pred_ml[idx] > 0.40:
            pred_arm = 1
        else:
            pred_arm = 0
        pred_reward = exp_profits[pred_arm]

        # 3. Random baseline
        rand_arm = rng.choice([0, 1, 2])
        rand_reward = exp_profits[rand_arm]

        # 4. Bandit decision
        if algorithm == "thompson":
            sampled_rewards = []
            for a in arms:
                A_inv = np.linalg.inv(a.A)
                mu_hat = A_inv @ a.b
                sigma = a.alpha * A_inv
                sample = rng.multivariate_normal(mu_hat, sigma)
                sampled_rewards.append(float(x_t @ sample))
            chosen_arm_idx = int(np.argmax(sampled_rewards))
        elif algorithm == "epsilon_greedy":
            if rng.uniform(0, 1) < max(0.05, 0.3 * (0.995 ** t)):
                chosen_arm_idx = rng.choice([0, 1, 2])
            else:
                scores = [float(x_t @ (np.linalg.inv(a.A) @ a.b)) for a in arms]
                chosen_arm_idx = int(np.argmax(scores))
        else:  # LinUCB (default)
            scores = [a.get_ucb_score(x_t) for a in arms]
            chosen_arm_idx = int(np.argmax(scores))

        chosen_arm = arms[chosen_arm_idx]
        chosen_reward = exp_profits[chosen_arm_idx]

        # Update bandit with observation
        chosen_arm.update(x_t, chosen_reward)
        arm_counts[chosen_arm_idx] += 1

        # Accumulate metrics
        b_profit_acc += chosen_reward
        o_profit_acc += oracle_reward
        p_profit_acc += pred_reward
        r_profit_acc += rand_reward

        step_regret = oracle_reward - chosen_reward
        regret_acc += step_regret

        # Record every few steps for smooth charting
        if t % 5 == 0 or t == len(cust_indices) - 1:
            step_num = t + 1
            bandit_cumulative_profit.append(round(b_profit_acc, 0))
            oracle_cumulative_profit.append(round(o_profit_acc, 0))
            pred_cumulative_profit.append(round(p_profit_acc, 0))
            random_cumulative_profit.append(round(r_profit_acc, 0))
            cumulative_regret.append(round(regret_acc, 0))
            arm_pull_history.append({
                "step": step_num,
                "arm_0_pct": round(arm_counts[0] / step_num * 100, 1),
                "arm_10_pct": round(arm_counts[1] / step_num * 100, 1),
                "arm_20_pct": round(arm_counts[2] / step_num * 100, 1),
            })

    total_steps = len(cust_indices)
    regret_pct = round(float(regret_acc / max(1.0, o_profit_acc) * 100), 1)

    return {
        "algorithm": algorithm,
        "n_steps": total_steps,
        "alpha": alpha,
        "summary": {
            "bandit_total_profit": round(b_profit_acc, 0),
            "oracle_total_profit": round(o_profit_acc, 0),
            "predictive_ml_profit": round(p_profit_acc, 0),
            "random_profit": round(r_profit_acc, 0),
            "profit_lift_vs_predictive": round(b_profit_acc - p_profit_acc, 0),
            "total_regret": round(regret_acc, 0),
            "regret_percentage": regret_pct,
            "arm_distribution": {
                "$0 (Suppress)": arm_counts[0],
                "$10 Discount": arm_counts[1],
                "$20 Discount": arm_counts[2],
            },
        },
        "curves": {
            "steps": [h["step"] for h in arm_pull_history],
            "bandit_profit": bandit_cumulative_profit,
            "oracle_profit": oracle_cumulative_profit,
            "predictive_profit": pred_cumulative_profit,
            "random_profit": random_cumulative_profit,
            "cumulative_regret": cumulative_regret,
            "arm_history": arm_pull_history,
        },
    }
