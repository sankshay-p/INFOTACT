import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any

def generate_retail_dataset(n_samples: int = 2500, seed: int = 42, confounding_strength: float = 0.75) -> pd.DataFrame:
    """
    Generates a realistic observational retail dataset with realistic confounding
    and heterogeneous treatment effects (CATE / ITE) across customer archetypes:
    - Persuadables (High uplift)
    - Sure Things (High baseline, low uplift)
    - Lost Causes (Low baseline, low uplift)
    - Sleeping Dogs (Negative or near-zero uplift)
    """
    rng = np.random.RandomState(seed)

    # 1. Customer Confounders (W)
    customer_id = np.arange(1001, 1001 + n_samples)
    income = rng.normal(loc=65000, scale=25000, size=n_samples).clip(25000, 180000)
    browsing_minutes = rng.gamma(shape=2.5, scale=12.0, size=n_samples).clip(2, 150)
    loyalty_score = rng.beta(a=3, b=3, size=n_samples) * 9 + 1  # 1 to 10 scale
    days_since_last_purchase = rng.exponential(scale=35, size=n_samples).clip(1, 180)
    cart_value_history = rng.normal(loc=95, scale=35, size=n_samples).clip(20, 300)
    seasonality_index = rng.uniform(0.85, 1.35, size=n_samples)

    # Standardized features for latent calculations
    std_income = (income - 65000) / 25000
    std_browsing = (browsing_minutes - 30) / 25
    std_loyalty = (loyalty_score - 5.5) / 2.5
    std_recency = (days_since_last_purchase - 35) / 35
    std_cart = (cart_value_history - 95) / 35

    # 2. Confounded Treatment Assignment (T: Discount Offered: 0, 10, or 20)
    # Marketing teams historically gave discounts to hesitant high-browsers with older recency,
    # but withheld from wealthy loyal buyers.
    propensity_logits = (
        0.5 * std_browsing
        + 0.4 * std_recency
        - 0.6 * std_income * confounding_strength
        - 0.3 * std_loyalty * confounding_strength
        + 0.2 * std_cart
        + rng.normal(0, 0.4, size=n_samples)
    )
    prob_t1 = 1 / (1 + np.exp(-propensity_logits))  # Probability of receiving any discount

    # Categorize historical observational treatment:
    # 0 = No discount, 10 = $10 discount, 20 = $20 discount
    # Let's create treatment as continuous discount amount or tiers:
    treatment_draw = rng.uniform(0, 1, size=n_samples)
    discount_offered = np.zeros(n_samples)
    for i in range(n_samples):
        if treatment_draw[i] < (1 - prob_t1[i]):
            discount_offered[i] = 0.0
        elif treatment_draw[i] < (1 - prob_t1[i] * 0.4):
            discount_offered[i] = 10.0
        else:
            discount_offered[i] = 20.0

    # Binary treatment indicator (T > 0 vs T == 0) for DML binary treatment benchmarks
    treatment_binary = (discount_offered > 0).astype(int)

    # 3. Ground Truth Archetypes & Heterogeneous Treatment Effects (ITE)
    # Ground Truth Baseline Conversion without discount P(Y_0)
    baseline_logits = (
        -1.2
        + 0.9 * std_income
        + 0.8 * std_loyalty
        - 0.7 * std_recency
        + 0.4 * std_cart
        + 0.3 * (seasonality_index - 1.0)
    )
    p_baseline = 1 / (1 + np.exp(-baseline_logits))

    # True Causal Uplift tau(X):
    # Persuadables: High browsing, moderate income, moderate loyalty -> highly sensitive to price!
    price_sensitivity = np.maximum(0.0, 0.55 - 0.25 * std_income + 0.30 * std_browsing - 0.15 * std_loyalty)
    
    # Sleeping Dog tendency: very high loyalty + high income might react negatively to coupon spam
    sleeping_dog_penalty = np.where((std_loyalty > 1.4) & (std_income > 1.2), -0.06, 0.0)

    # Uplift for $10 and $20 discounts
    true_tau_10 = (price_sensitivity * 0.22 + sleeping_dog_penalty).clip(-0.10, 0.45)
    true_tau_20 = (price_sensitivity * 0.38 + sleeping_dog_penalty * 1.5).clip(-0.15, 0.65)

    # Categorize true archetype
    archetype = []
    for i in range(n_samples):
        if true_tau_20[i] < -0.01:
            archetype.append("Sleeping Dog")
        elif true_tau_20[i] >= 0.18:
            archetype.append("Persuadable")
        elif p_baseline[i] >= 0.60:
            archetype.append("Sure Thing")
        else:
            archetype.append("Lost Cause")

    # Observed conversion probability given actual historical treatment
    p_conversion = p_baseline.copy()
    mask_10 = (discount_offered == 10.0)
    mask_20 = (discount_offered == 20.0)
    p_conversion[mask_10] = (p_baseline[mask_10] + true_tau_10[mask_10]).clip(0.01, 0.99)
    p_conversion[mask_20] = (p_baseline[mask_20] + true_tau_20[mask_20]).clip(0.01, 0.99)

    conversion = (rng.uniform(0, 1, size=n_samples) < p_conversion).astype(int)

    # Observed net revenue (assuming base product price $100)
    base_product_price = 100.0
    net_revenue = conversion * (base_product_price - discount_offered)

    df = pd.DataFrame({
        "customer_id": customer_id,
        "income": np.round(income, 0),
        "browsing_minutes": np.round(browsing_minutes, 1),
        "loyalty_score": np.round(loyalty_score, 2),
        "days_since_last_purchase": np.round(days_since_last_purchase, 1),
        "cart_value_history": np.round(cart_value_history, 2),
        "seasonality_index": np.round(seasonality_index, 2),
        "discount_offered": discount_offered,
        "treatment_binary": treatment_binary,
        "conversion": conversion,
        "net_revenue": np.round(net_revenue, 2),
        "true_baseline_prob": np.round(p_baseline, 4),
        "true_tau_10": np.round(true_tau_10, 4),
        "true_tau_20": np.round(true_tau_20, 4),
        "true_archetype": archetype
    })

    return df
