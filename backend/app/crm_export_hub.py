import time
import uuid
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd
from app.optimization import solve_discount_optimization
from app.campaign_tracker import record_campaign_event


# In-memory export history log
_export_history: List[Dict[str, Any]] = []


PLATFORMS = {
    "klaviyo": {
        "id": "klaviyo",
        "name": "Klaviyo",
        "category": "Email & SMS Marketing",
        "icon": "✉️",
        "accent": "#10b981",
        "api_endpoint": "https://a.klaviyo.com/api/profile-import/",
        "auth_type": "Bearer API Key",
        "description": "Sync customer profiles, custom attributes, and targeted discount coupon triggers directly to Klaviyo lists and automated flows.",
        "payload_spec": {
            "root": "data",
            "type": "profile",
            "attributes_prefix": "$",
            "custom_properties": ["causal_archetype", "recommended_discount", "predicted_uplift", "cannibalization_risk"],
        },
    },
    "salesforce": {
        "id": "salesforce",
        "name": "Salesforce Marketing Cloud",
        "category": "Enterprise CRM & Journey Builder",
        "icon": "☁️",
        "accent": "#0ea5e9",
        "api_endpoint": "https://mc.salesforce.com/data/v1/async/dataextension/key:EconoCausal_Uplift/rows",
        "auth_type": "OAuth 2.0 Bearer Token",
        "description": "Push prescriptive discount assignments and margin suppression flags into SFMC Data Extensions to trigger Journey Builder email sequences.",
        "payload_spec": {
            "root": "items",
            "key_field": "SubscriberKey",
            "custom_properties": ["DiscountTier", "CausalArchetype", "ExpectedMarginGain", "SuppressPromoFlag"],
        },
    },
    "braze": {
        "id": "braze",
        "name": "Braze",
        "category": "Mobile & Omnichannel Engagement",
        "icon": "🔥",
        "accent": "#f97316",
        "api_endpoint": "https://rest.iad-01.braze.com/users/track",
        "auth_type": "Bearer App-Group-Token",
        "description": "Send user attributes and custom event triggers to Braze Canvas to dynamically alter push, in-app messaging, and promo codes.",
        "payload_spec": {
            "root": "attributes",
            "key_field": "external_id",
            "custom_properties": ["causal_segment", "promo_offer", "cate_score", "margin_protection"],
        },
    },
    "webhook": {
        "id": "webhook",
        "name": "Custom Webhook / Segment.io",
        "category": "Generic Customer Data Platform (CDP)",
        "icon": "⚡",
        "accent": "#a855f7",
        "api_endpoint": "https://api.your-cdp.com/v1/batch/prescriptions",
        "auth_type": "Custom Authorization Header / Secret",
        "description": "POST raw or customized JSON batches to internal microservices, AWS EventBridge, Segment Personas, or Zapier webhooks.",
        "payload_spec": {
            "root": "records",
            "key_field": "customer_id",
            "custom_properties": ["archetype", "discount", "uplift", "baseline_prob", "incremental_profit"],
        },
    },
}

SEGMENT_DEFINITIONS = [
    {
        "id": "persuadables_20",
        "name": "Persuadables - Tier $20 (High Elasticity)",
        "archetype": "Persuadable",
        "discount_filter": 20.0,
        "action": "Target with $20 Promo Code",
        "color": "#10b981",
        "description": "Customers with high causal uplift (tau >= 0.12) where a $20 discount yields maximum incremental revenue.",
    },
    {
        "id": "persuadables_10",
        "name": "Persuadables - Tier $10 (Optimal Lift)",
        "archetype": "Persuadable",
        "discount_filter": 10.0,
        "action": "Target with $10 Promo Code",
        "color": "#38bdf8",
        "description": "Cost-conscious customers where a $10 discount produces positive ROI without requiring a larger margin concession.",
    },
    {
        "id": "all_persuadables",
        "name": "All Persuadables Combined",
        "archetype": "Persuadable",
        "discount_filter": None,
        "action": "Target with Recommended Causal Discount ($10 or $20)",
        "color": "#06b6d4",
        "description": "Full cohort of persuadable buyers who convert strictly because of an economic incentive.",
    },
    {
        "id": "sure_things_suppress",
        "name": "Sure Things - Margin Suppression List",
        "archetype": "Sure Thing",
        "discount_filter": 0.0,
        "action": "Suppress Discounts Strictly (Protect Margin)",
        "color": "#f59e0b",
        "description": "Customers with high organic conversion (P0 >= 0.60). Blacklist from discount distributions to prevent margin cannibalization.",
    },
    {
        "id": "sleeping_dogs_exclude",
        "name": "Sleeping Dogs - Negative Uplift Blacklist",
        "archetype": "Sleeping Dog",
        "discount_filter": 0.0,
        "action": "Do Not Disturb (Exclude from Campaigns)",
        "color": "#f43f5e",
        "description": "Subscribers where promotional contact produces negative incremental yield or triggers unsubscribe/churn behavior.",
    },
    {
        "id": "all_prescriptions",
        "name": "Full Prescriptive Matrix (All Customers)",
        "archetype": None,
        "discount_filter": None,
        "action": "Export 100% Causal Prescriptions",
        "color": "#818cf8",
        "description": "The complete dataset with individualized discount recommendations ($0, $10, $20) and full causal metrics.",
    },
]


def _filter_segment_df(df: pd.DataFrame, opt_df: pd.DataFrame, segment_id: str) -> pd.DataFrame:
    """Filters dataset according to selected segment criteria."""
    seg = next((s for s in SEGMENT_DEFINITIONS if s["id"] == segment_id), SEGMENT_DEFINITIONS[0])
    merged = opt_df.copy()

    if seg["id"] == "persuadables_20":
        return merged[(merged["archetype"] == "Persuadable") & (merged["optimal_discount"] == 20.0)]
    elif seg["id"] == "persuadables_10":
        return merged[(merged["archetype"] == "Persuadable") & (merged["optimal_discount"] == 10.0)]
    elif seg["id"] == "all_persuadables":
        return merged[merged["archetype"] == "Persuadable"]
    elif seg["id"] == "sure_things_suppress":
        return merged[merged["archetype"] == "Sure Thing"]
    elif seg["id"] == "sleeping_dogs_exclude":
        return merged[merged["archetype"] == "Sleeping Dog"]
    else:
        return merged


def get_crm_metadata(engine, budget: float = 5000.0) -> Dict[str, Any]:
    """Returns platform metadata, available segments, and current audience counts."""
    df = engine.trained_df
    opt_res = solve_discount_optimization(df, budget=budget)
    opt_df = pd.DataFrame(opt_res["allocation_matrix"])

    segments_with_counts = []
    for s in SEGMENT_DEFINITIONS:
        filtered = _filter_segment_df(df, opt_df, s["id"])
        total_profit = float(filtered["expected_incremental_profit"].sum()) if "expected_incremental_profit" in filtered.columns else 0.0
        total_budget = float(filtered["optimal_discount"].sum()) if "optimal_discount" in filtered.columns else 0.0
        
        segments_with_counts.append({
            **s,
            "count": len(filtered),
            "percentage": round(float(len(filtered) / max(1, len(opt_df)) * 100), 1),
            "total_incremental_profit": round(total_profit, 2),
            "budget_required": round(total_budget, 2),
        })

    return {
        "platforms": list(PLATFORMS.values()),
        "segments": segments_with_counts,
        "total_audience": len(opt_df),
        "total_budget": budget,
    }


def preview_crm_export(
    engine,
    platform_id: str,
    segment_id: str,
    budget: float = 5000.0,
    sample_limit: int = 4
) -> Dict[str, Any]:
    """Generates preview payload and summary stats for a platform export."""
    platform = PLATFORMS.get(platform_id, PLATFORMS["klaviyo"])
    df = engine.trained_df
    opt_res = solve_discount_optimization(df, budget=budget)
    opt_df = pd.DataFrame(opt_res["allocation_matrix"])

    segment_df = _filter_segment_df(df, opt_df, segment_id)
    seg_info = next((s for s in SEGMENT_DEFINITIONS if s["id"] == segment_id), SEGMENT_DEFINITIONS[0])

    # Build simulated records
    preview_items = []
    for _, row in segment_df.head(sample_limit).iterrows():
        cid = int(row["customer_id"])
        email = f"user_{cid}@example-customer.com"
        tier = float(row.get("optimal_discount", 0.0))
        arch = str(row.get("archetype", "Unknown"))
        tau = float(row.get("uplift_ite_20", row.get("uplift_ite_10", 0.0)))
        delta_prof = float(row.get("expected_incremental_profit", 0.0))
        p0 = float(row.get("baseline_prob", 0.0))

        if platform_id == "klaviyo":
            preview_items.append({
                "type": "profile",
                "attributes": {
                    "email": email,
                    "external_id": str(cid),
                    "properties": {
                        "$causal_archetype": arch,
                        "$optimal_discount_tier": f"${tier:.0f}",
                        "$predicted_uplift_pct": f"{tau * 100:+.1f}%",
                        "$baseline_conversion_prob": f"{p0 * 100:.1f}%",
                        "$expected_profit_lift": round(delta_prof, 2),
                        "$margin_cannibalization_risk": "HIGH" if arch == "Sure Thing" else "MINIMAL",
                        "$campaign_tag": f"EconoCausal_{seg_info['name'].replace(' ', '_')}",
                    }
                }
            })
        elif platform_id == "salesforce":
            preview_items.append({
                "keys": {"SubscriberKey": email},
                "values": {
                    "CustomerID": cid,
                    "CausalArchetype": arch,
                    "DiscountRecommendation": int(tier),
                    "PredictedUplift": round(tau, 4),
                    "ExpectedMarginGain": round(delta_prof, 2),
                    "SuppressPromoFlag": (arch == "Sure Thing" or arch == "Sleeping Dog"),
                    "TargetStatus": "ACTIVE_TARGET" if tier > 0 else "ORGANIC_ONLY",
                }
            })
        elif platform_id == "braze":
            preview_items.append({
                "external_id": f"usr_{cid}",
                "email": email,
                "causal_segment": arch,
                "promo_tier": f"${tier:.0f}",
                "cate_score": round(tau, 4),
                "margin_protection": (arch == "Sure Thing"),
                "_update_existing_only": False,
            })
        else:  # Custom webhook
            preview_items.append({
                "customer_id": cid,
                "email": email,
                "archetype": arch,
                "prescribed_discount": tier,
                "cate_uplift": round(tau, 4),
                "baseline_prob": round(p0, 4),
                "expected_incremental_profit": round(delta_prof, 2),
                "action_prescribed": seg_info["action"],
            })

    total_incremental_profit = float(segment_df["expected_incremental_profit"].sum()) if "expected_incremental_profit" in segment_df.columns else 0.0
    budget_allocated = float(segment_df["optimal_discount"].sum()) if "optimal_discount" in segment_df.columns else 0.0

    return {
        "platform": platform,
        "segment": {
            **seg_info,
            "total_records": len(segment_df),
            "total_incremental_profit": round(total_incremental_profit, 2),
            "budget_allocated": round(budget_allocated, 2),
        },
        "preview_records": preview_items,
        "formatted_json_sample": json.dumps(preview_items[:2], indent=2),
    }


def dispatch_crm_export(
    engine,
    platform_id: str,
    segment_id: str,
    target_endpoint: Optional[str] = None,
    api_key_masked: Optional[str] = None,
    budget: float = 5000.0,
) -> Dict[str, Any]:
    """
    Executes a simulated live dispatch of causal prescriptions to the selected CRM platform.
    Computes performance metrics, generates a receipt, and logs the action into campaign tracker.
    """
    start_time = time.time()
    platform = PLATFORMS.get(platform_id, PLATFORMS["klaviyo"])
    df = engine.trained_df
    opt_res = solve_discount_optimization(df, budget=budget)
    opt_df = pd.DataFrame(opt_res["allocation_matrix"])

    segment_df = _filter_segment_df(df, opt_df, segment_id)
    seg_info = next((s for s in SEGMENT_DEFINITIONS if s["id"] == segment_id), SEGMENT_DEFINITIONS[0])

    record_count = len(segment_df)
    total_incremental_profit = float(segment_df["expected_incremental_profit"].sum()) if "expected_incremental_profit" in segment_df.columns else 0.0
    budget_allocated = float(segment_df["optimal_discount"].sum()) if "optimal_discount" in segment_df.columns else 0.0

    # Simulated network latency (100ms - 250ms)
    time.sleep(0.12)
    latency_ms = round((time.time() - start_time) * 1000 + 45.0, 1)

    export_id = f"EXP-{platform_id.upper()[:3]}-{uuid.uuid4().hex[:6].upper()}"
    endpoint = target_endpoint or platform["api_endpoint"]
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    result_receipt = {
        "export_id": export_id,
        "status": "DELIVERED",
        "http_status": 200,
        "platform_id": platform_id,
        "platform_name": platform["name"],
        "endpoint": endpoint,
        "segment_id": segment_id,
        "segment_name": seg_info["name"],
        "records_dispatched": record_count,
        "estimated_incremental_profit": round(total_incremental_profit, 2),
        "budget_allocated": round(budget_allocated, 2),
        "latency_ms": latency_ms,
        "timestamp": now_str,
        "auth_used": f"Bearer {api_key_masked or '••••••••••••••••'}",
        "message": f"Successfully exported {record_count:,} audience profiles to {platform['name']}.",
    }

    # Append to global export history
    _export_history.insert(0, result_receipt)
    if len(_export_history) > 50:
        _export_history.pop()

    # Log to campaign tracker
    record_campaign_event(
        event_type="crm_export",
        description=f"Dispatched {record_count:,} records of '{seg_info['name']}' to {platform['name']}",
        before_metrics={},
        after_metrics={
            "records_dispatched": record_count,
            "incremental_profit": round(total_incremental_profit, 2),
            "export_id": export_id,
        },
        metadata={
            "platform": platform["name"],
            "segment_id": segment_id,
            "endpoint": endpoint,
        }
    )

    return result_receipt


def get_export_history() -> List[Dict[str, Any]]:
    """Returns past CRM export receipts."""
    return _export_history


def generate_segment_csv_content(engine, segment_id: str, platform_id: str = "klaviyo", budget: float = 5000.0) -> str:
    """Generates ready-to-import CSV string for the chosen CRM platform."""
    df = engine.trained_df
    opt_res = solve_discount_optimization(df, budget=budget)
    opt_df = pd.DataFrame(opt_res["allocation_matrix"])
    segment_df = _filter_segment_df(df, opt_df, segment_id)

    rows = []
    for _, row in segment_df.iterrows():
        cid = int(row["customer_id"])
        email = f"user_{cid}@example-customer.com"
        tier = float(row.get("optimal_discount", 0.0))
        arch = str(row.get("archetype", "Unknown"))
        tau = float(row.get("uplift_ite_20", row.get("uplift_ite_10", 0.0)))
        delta_prof = float(row.get("expected_incremental_profit", 0.0))
        p0 = float(row.get("baseline_prob", 0.0))

        if platform_id == "klaviyo":
            rows.append({
                "Email": email,
                "External ID": cid,
                "$causal_archetype": arch,
                "$recommended_discount": f"${tier:.0f}",
                "$predicted_uplift": round(tau, 4),
                "$baseline_prob": round(p0, 4),
                "$expected_profit_lift": round(delta_prof, 2),
                "$margin_cannibalization_risk": "HIGH" if arch == "Sure Thing" else "MINIMAL",
            })
        elif platform_id == "salesforce":
            rows.append({
                "SubscriberKey": email,
                "CustomerID": cid,
                "CausalArchetype": arch,
                "DiscountTier": int(tier),
                "UpliftScore": round(tau, 4),
                "ExpectedMarginGain": round(delta_prof, 2),
                "SuppressPromoFlag": 1 if arch in ["Sure Thing", "Sleeping Dog"] else 0,
            })
        else:
            rows.append({
                "customer_id": cid,
                "email": email,
                "causal_archetype": arch,
                "prescribed_discount": tier,
                "individual_treatment_effect": round(tau, 4),
                "baseline_prob": round(p0, 4),
                "expected_incremental_profit": round(delta_prof, 2),
            })

    out_df = pd.DataFrame(rows)
    return out_df.to_csv(index=False)

