import os
import sys
import copy
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, PlainTextResponse
from typing import Dict, Any, Optional
import io

from app.schemas import (
    OptimizeRequest, RetrainRequest, DriftSimulationRequest,
    SimulateCustomerRequest, CopilotQuestionRequest,
    ScenarioRequest, CustomerProfileRequest, CustomerSearchRequest, ABTestRequest,
    CRMPreviewRequest, CRMDispatchRequest
)
from app.data_generator import generate_retail_dataset
from app.causal_engine import CausalEngine, get_causal_dag_definition, FEATURE_COLS
from app.propensity import compute_propensity_scores
from app.optimization import solve_discount_optimization, simulate_customer_counterfactual
from app.drift_detector import analyze_covariate_drift
from app.executive_ai import generate_executive_briefing, answer_copilot_question
from app.scenario_planner import run_scenario_analysis, get_preset_scenarios
from app.customer_profiler import get_customer_deep_profile, search_customers
from app.campaign_tracker import record_campaign_event, get_campaign_history, clear_campaign_history, run_ab_test
from app.crm_export_hub import (
    get_crm_metadata, preview_crm_export, dispatch_crm_export,
    get_export_history, generate_segment_csv_content
)


app = FastAPI(
    title="EconoCausal API",
    description="Dynamic Pricing & Uplift Optimization via Double Machine Learning and DoWhy",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State & In-Memory Cache for fast UI responsiveness
state: Dict[str, Any] = {
    "baseline_df": None,
    "current_df": None,
    "causal_engine": None,
    "causal_summary": None,
    "propensity_data": None,
    "refutation_audit": None,
    "last_optimization": None
}

def initialize_causal_system():
    print("Initializing EconoCausal Engine...")
    df = generate_retail_dataset(n_samples=2500, seed=42, confounding_strength=0.75)
    state["baseline_df"] = df.copy()
    state["current_df"] = df.copy()

    engine = CausalEngine()
    summary = engine.train(df, base_learner="random_forest")
    state["causal_engine"] = engine
    state["causal_summary"] = summary

    # Propensity balance
    prop_data = compute_propensity_scores(df, FEATURE_COLS)
    state["propensity_data"] = prop_data

    # DoWhy refutation audit
    audit = engine.run_dowhy_audit(df)
    state["refutation_audit"] = audit

    # Initial baseline optimization ($5,000 budget)
    opt = solve_discount_optimization(engine.trained_df, budget=5000.0)
    state["last_optimization"] = opt

    # Record initial system event
    opt = state["last_optimization"]
    causal_strat = next((s for s in opt["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})
    record_campaign_event(
        event_type="system_init",
        description="EconoCausal Engine initialized with 2,500 observations, Random Forest DML base learner.",
        after_metrics={
            "incremental_profit": causal_strat.get("incremental_profit", 0),
            "roi_percentage": causal_strat.get("roi_percentage", 0),
            "budget": 5000.0,
            "targeted_customers": causal_strat.get("targeted_customers", 0),
        },
        metadata={"n_samples": 2500, "base_learner": "random_forest"},
    )

    print("EconoCausal Engine Initialized Successfully!")

@app.on_event("startup")
def startup_event():
    initialize_causal_system()

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EconoCausal Backend",
        "version": "1.0.0",
        "is_trained": state["causal_engine"] is not None
    }

@app.get("/api/dag")
def get_dag():
    return get_causal_dag_definition()

@app.get("/api/dataset")
def get_dataset(limit: int = 50):
    df = state["baseline_df"]
    if df is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    
    # Correlation matrix of confounders with treatment and conversion
    corr_cols = FEATURE_COLS + ["discount_offered", "conversion"]
    corr_matrix = df[corr_cols].corr().round(3).to_dict()

    summary_stats = {}
    for col in FEATURE_COLS + ["discount_offered", "conversion", "net_revenue"]:
        summary_stats[col] = {
            "mean": round(float(df[col].mean()), 2),
            "std": round(float(df[col].std()), 2),
            "min": round(float(df[col].min()), 2),
            "max": round(float(df[col].max()), 2)
        }

    sample_records = df.head(limit).to_dict(orient="records")

    return {
        "total_records": len(df),
        "columns": list(df.columns),
        "confounders": FEATURE_COLS,
        "sample_data": sample_records,
        "summary_statistics": summary_stats,
        "correlation_matrix": corr_matrix
    }

@app.get("/api/causal-summary")
def get_causal_summary():
    if state["causal_summary"] is None:
        raise HTTPException(status_code=500, detail="Causal model not trained yet")
    return state["causal_summary"]

@app.post("/api/train-dml")
def train_dml_endpoint(req: RetrainRequest):
    # Capture before metrics for campaign log
    old_opt = state["last_optimization"]
    old_causal = next((s for s in old_opt["strategy_comparison"] if "EconoCausal" in s["strategy"]), {}) if old_opt else {}
    before_metrics = {
        "incremental_profit": old_causal.get("incremental_profit", 0),
        "roi_percentage": old_causal.get("roi_percentage", 0),
    }
    df = generate_retail_dataset(
        n_samples=req.n_samples,
        seed=42,
        confounding_strength=req.confounding_strength
    )
    state["baseline_df"] = df.copy()
    state["current_df"] = df.copy()

    engine = CausalEngine()
    summary = engine.train(df, base_learner=req.base_learner)
    state["causal_engine"] = engine
    state["causal_summary"] = summary

    # Update propensity
    state["propensity_data"] = compute_propensity_scores(df, FEATURE_COLS)
    
    # Update refutation audit
    state["refutation_audit"] = engine.run_dowhy_audit(df)

    # Re-run default optimization
    state["last_optimization"] = solve_discount_optimization(engine.trained_df, budget=5000.0)

    # Record retrain event in campaign tracker
    new_opt = state["last_optimization"]
    new_causal = next((s for s in new_opt["strategy_comparison"] if "EconoCausal" in s["strategy"]), {}) if new_opt else {}
    record_campaign_event(
        event_type="dml_retrain",
        description=f"DML retrained on {req.n_samples} samples using {req.base_learner} (confounding={req.confounding_strength})",
        before_metrics=before_metrics,
        after_metrics={
            "incremental_profit": new_causal.get("incremental_profit", 0),
            "roi_percentage": new_causal.get("roi_percentage", 0),
        },
        metadata={"n_samples": req.n_samples, "base_learner": req.base_learner},
    )

    return {
        "status": "success",
        "message": f"Double ML trained successfully on {req.n_samples} records using {req.base_learner}.",
        "summary": summary
    }

@app.get("/api/refutation-audit")
def get_refutation_audit():
    if state["refutation_audit"] is None:
        raise HTTPException(status_code=500, detail="Audit not computed")
    return state["refutation_audit"]

@app.get("/api/propensity")
def get_propensity():
    if state["propensity_data"] is None:
        raise HTTPException(status_code=500, detail="Propensity data not computed")
    return state["propensity_data"]

@app.post("/api/optimize")
def optimize_discounts(req: OptimizeRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not ready")

    # Before metrics for campaign log
    old_opt = state["last_optimization"]
    old_causal = next((s for s in old_opt["strategy_comparison"] if "EconoCausal" in s["strategy"]), {}) if old_opt else {}

    results = solve_discount_optimization(
        df=engine.trained_df,
        budget=req.budget,
        product_price=req.product_price,
        unit_cost=req.unit_cost,
        discount_tiers=req.discount_tiers
    )
    state["last_optimization"] = results

    # Record budget change event
    new_causal = next((s for s in results["strategy_comparison"] if "EconoCausal" in s["strategy"]), {})
    record_campaign_event(
        event_type="budget_change",
        description=f"Budget optimization re-solved at ${req.budget:,.0f}",
        before_metrics={
            "incremental_profit": old_causal.get("incremental_profit", 0),
            "roi_percentage": old_causal.get("roi_percentage", 0),
            "budget": old_opt.get("budget_limit", 5000) if old_opt else 5000,
        },
        after_metrics={
            "incremental_profit": new_causal.get("incremental_profit", 0),
            "roi_percentage": new_causal.get("roi_percentage", 0),
            "budget": req.budget,
            "targeted_customers": new_causal.get("targeted_customers", 0),
        },
        metadata={"budget": req.budget},
    )

    return results

@app.get("/api/drift")
def get_drift_analysis():
    base_df = state["baseline_df"]
    curr_df = state["current_df"]
    if base_df is None or curr_df is None:
        raise HTTPException(status_code=500, detail="Data not available")
    return analyze_covariate_drift(base_df, curr_df, FEATURE_COLS)

@app.post("/api/simulate-drift")
def simulate_drift(req: DriftSimulationRequest):
    base_df = state["baseline_df"]
    if base_df is None:
        raise HTTPException(status_code=500, detail="Baseline data not available")

    curr_df = base_df.copy()
    feature = req.feature_to_shift
    if feature not in curr_df.columns:
        raise HTTPException(status_code=400, detail=f"Feature {feature} not found")

    # Inject realistic distribution shift
    rng = np.random.RandomState(99)
    if feature == "income":
        curr_df["income"] = curr_df["income"] * req.shift_magnitude + rng.normal(0, 5000, len(curr_df))
    elif feature == "browsing_minutes":
        curr_df["browsing_minutes"] = curr_df["browsing_minutes"] * req.shift_magnitude
    elif feature == "loyalty_score":
        curr_df["loyalty_score"] = np.clip(curr_df["loyalty_score"] * req.shift_magnitude, 1.0, 10.0)
    elif feature == "days_since_last_purchase":
        curr_df["days_since_last_purchase"] = curr_df["days_since_last_purchase"] * req.shift_magnitude
    elif feature == "seasonality_index":
        curr_df["seasonality_index"] = curr_df["seasonality_index"] * req.shift_magnitude

    state["current_df"] = curr_df
    return analyze_covariate_drift(base_df, curr_df, FEATURE_COLS)

@app.post("/api/reset-drift")
def reset_drift():
    state["current_df"] = state["baseline_df"].copy()
    return analyze_covariate_drift(state["baseline_df"], state["current_df"], FEATURE_COLS)

@app.get("/api/executive-briefing")
def get_executive_briefing():
    opt = state["last_optimization"]
    causal_sum = state["causal_summary"]
    if opt is None or causal_sum is None:
        raise HTTPException(status_code=500, detail="Data not available")
    return generate_executive_briefing(opt, causal_sum)

@app.post("/api/simulate-customer")
def simulate_customer(req: SimulateCustomerRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")

    df = engine.trained_df
    customer_info = {}

    if req.customer_id is not None:
        row = df[df["customer_id"] == req.customer_id]
        if not row.empty:
            customer_info = row.iloc[0].to_dict()

    if not customer_info:
        # Synthesize based on requested features
        customer_info = {
            "customer_id": req.customer_id or 9999,
            "income": req.income or 65000.0,
            "browsing_minutes": req.browsing_minutes or 25.0,
            "loyalty_score": req.loyalty_score or 5.0,
            "days_since_last_purchase": req.days_since_last_purchase or 14.0,
            "cart_value_history": req.cart_value_history or 75.0,
            "seasonality_index": req.seasonality_index or 1.0,
            "baseline_prob": 0.35,
            "uplift_ite_10": 0.14,
            "uplift_ite_20": 0.24
        }
        # Estimate personalized uplift dynamically based on price sensitivity features
        sensitivity = (customer_info["browsing_minutes"] / 40.0) * (customer_info["loyalty_score"] / 7.0) * (60000.0 / max(20000.0, customer_info["income"]))
        customer_info["uplift_ite_10"] = round(float(np.clip(0.12 * sensitivity, -0.05, 0.40)), 3)
        customer_info["uplift_ite_20"] = round(float(np.clip(0.22 * sensitivity, -0.08, 0.55)), 3)
        customer_info["baseline_prob"] = round(float(np.clip(0.25 + (customer_info["loyalty_score"] * 0.05) - (customer_info["days_since_last_purchase"] * 0.005), 0.05, 0.90)), 3)

    return simulate_customer_counterfactual(customer_info)

@app.post("/api/executive-chat")
def executive_chat(req: CopilotQuestionRequest):
    opt = state["last_optimization"]
    causal_sum = state["causal_summary"]
    if opt is None or causal_sum is None:
        raise HTTPException(status_code=500, detail="Causal model data not available")
    return answer_copilot_question(req.question, opt, causal_sum)

@app.post("/api/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # Check required columns
    required = FEATURE_COLS + ["discount_offered", "conversion"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV missing required columns: {missing}")

    if "customer_id" not in df.columns:
        df["customer_id"] = np.arange(1, len(df) + 1)
    if "net_revenue" not in df.columns:
        df["net_revenue"] = df["conversion"] * (100.0 - df["discount_offered"])

    state["baseline_df"] = df.copy()
    state["current_df"] = df.copy()

    engine = CausalEngine()
    summary = engine.train(df, base_learner="random_forest")
    state["causal_engine"] = engine
    state["causal_summary"] = summary
    state["propensity_data"] = compute_propensity_scores(df, FEATURE_COLS)
    state["refutation_audit"] = engine.run_dowhy_audit(df)
    state["last_optimization"] = solve_discount_optimization(engine.trained_df, budget=5000.0)

    return {
        "status": "success",
        "message": f"Successfully ingested {len(df)} campaign records and retrained Causal Double ML model.",
        "total_records": len(df),
        "columns": list(df.columns),
        "causal_summary": summary
    }

@app.get("/api/sample-csv")
def get_sample_csv():
    df = state["baseline_df"]
    if df is None:
        df = generate_retail_dataset(n_samples=50, seed=42)
    sample = df.head(50).copy()
    csv_str = sample.to_csv(index=False)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=EconoCausal_Sample_Campaign_Dataset.csv"}
    )

# =============================================================================
# FEATURE 1: SCENARIO PLANNER (What-If Simulator)
# =============================================================================

@app.get("/api/scenario-presets")
def get_scenario_presets():
    return {"presets": get_preset_scenarios()}

@app.post("/api/scenario-analysis")
def run_scenarios(req: ScenarioRequest):
    engine = state["causal_engine"]
    base_df = state["baseline_df"]
    if engine is None or base_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")

    scenarios = [s.dict() for s in req.scenarios]
    results = run_scenario_analysis(
        engine=engine,
        baseline_df=base_df,
        scenarios=scenarios,
        budget=req.budget,
        product_price=req.product_price,
        unit_cost=req.unit_cost,
    )

    record_campaign_event(
        event_type="scenario_analysis",
        description=f"Ran {len(scenarios)} what-if scenarios at ${req.budget:,.0f} budget",
        after_metrics={"scenarios_evaluated": len(scenarios) + 1},
        metadata={"scenario_names": [s["name"] for s in scenarios]},
    )

    return results

# =============================================================================
# FEATURE 2: CUSTOMER DEEP-DIVE PROFILER
# =============================================================================

@app.post("/api/customer-profile")
def get_profile(req: CustomerProfileRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return get_customer_deep_profile(engine, engine.trained_df, req.customer_id)

@app.post("/api/customer-search")
def search_customer_list(req: CustomerSearchRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return search_customers(
        df=engine.trained_df,
        query=req.query,
        archetype_filter=req.archetype_filter,
        sort_by=req.sort_by,
        sort_desc=req.sort_desc,
        limit=req.limit,
    )

# =============================================================================
# FEATURE 3: CAMPAIGN HISTORY & A/B TEST TRACKER
# =============================================================================

@app.get("/api/campaign-history")
def get_history(limit: int = 100):
    return get_campaign_history(limit=limit)

@app.post("/api/campaign-clear")
def clear_history():
    return clear_campaign_history()

@app.post("/api/ab-test")
def run_ab_test_endpoint(req: ABTestRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return run_ab_test(
        engine=engine,
        df=engine.trained_df,
        split_ratio=req.split_ratio,
        budget=req.budget,
        product_price=req.product_price,
        unit_cost=req.unit_cost,
    )

# =============================================================================
# FEATURE 4: CRM & MARKETING AUTOMATION EXPORT HUB
# =============================================================================

@app.get("/api/crm/metadata")
def get_crm_meta(budget: float = 5000.0):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return get_crm_metadata(engine, budget=budget)

@app.post("/api/crm/preview")
def preview_crm(req: CRMPreviewRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return preview_crm_export(
        engine=engine,
        platform_id=req.platform_id,
        segment_id=req.segment_id,
        budget=req.budget,
    )

@app.post("/api/crm/dispatch")
def dispatch_crm(req: CRMDispatchRequest):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    return dispatch_crm_export(
        engine=engine,
        platform_id=req.platform_id,
        segment_id=req.segment_id,
        target_endpoint=req.target_endpoint,
        api_key_masked=req.api_key_masked,
        budget=req.budget,
    )

@app.get("/api/crm/history")
def get_crm_history_endpoint():
    return {"history": get_export_history()}

@app.get("/api/crm/download-csv")
def download_crm_csv(segment_id: str = "persuadables_20", platform_id: str = "klaviyo", budget: float = 5000.0):
    engine = state["causal_engine"]
    if engine is None or engine.trained_df is None:
        raise HTTPException(status_code=500, detail="Causal model not initialized")
    csv_str = generate_segment_csv_content(
        engine=engine,
        segment_id=segment_id,
        platform_id=platform_id,
        budget=budget,
    )
    filename = f"econocausal_{platform_id}_{segment_id}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


