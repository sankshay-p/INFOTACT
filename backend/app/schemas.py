from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class OptimizeRequest(BaseModel):
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Total promotional budget in USD")
    product_price: float = Field(default=100.0, ge=10.0, le=1000.0, description="Base product price in USD")
    unit_cost: float = Field(default=40.0, ge=0.0, le=500.0, description="Unit cost in USD")
    discount_tiers: List[float] = Field(default=[0.0, 10.0, 20.0], description="Available discount tiers in USD")
    strategy: Optional[str] = Field(default="causal_dml", description="Strategy to optimize: causal_dml, predictive_ml, blanket, random")

class RetrainRequest(BaseModel):
    n_samples: int = Field(default=2500, ge=500, le=10000, description="Number of customer observations")
    confounding_strength: float = Field(default=0.75, ge=0.0, le=1.0, description="Severity of selection bias / confounding")
    base_learner: str = Field(default="random_forest", description="Base learner for DML: random_forest or lightgbm")

class DriftSimulationRequest(BaseModel):
    feature_to_shift: str = Field(default="income", description="Feature to introduce drift into")
    shift_magnitude: float = Field(default=1.5, ge=0.1, le=3.0, description="Shift factor multiplier or addition")

class SimulateCustomerRequest(BaseModel):
    customer_id: Optional[int] = Field(default=None, description="Customer ID to simulate counterfactuals for")
    income: Optional[float] = Field(default=65000.0, description="Annual income ($)")
    browsing_minutes: Optional[float] = Field(default=25.0, description="Browsing time (mins)")
    loyalty_score: Optional[float] = Field(default=5.0, description="Loyalty tier (1-10)")
    days_since_last_purchase: Optional[float] = Field(default=14.0, description="Days since last order")
    cart_value_history: Optional[float] = Field(default=75.0, description="Historical average basket size ($)")
    seasonality_index: Optional[float] = Field(default=1.0, description="Seasonality demand index (0.5 - 2.0)")

class CopilotQuestionRequest(BaseModel):
    question: str = Field(..., description="Strategic marketing or econometrics question")

class ScenarioAdjustment(BaseModel):
    name: str = Field(..., description="Scenario name")
    id: Optional[str] = Field(default=None, description="Scenario identifier")
    adjustments: Dict[str, float] = Field(default={}, description="Feature multiplier adjustments e.g. {'income': 0.7}")

class ScenarioRequest(BaseModel):
    scenarios: List[ScenarioAdjustment] = Field(default=[], description="List of scenario adjustments to evaluate")
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Budget for each scenario")
    product_price: float = Field(default=100.0, ge=10.0, le=1000.0)
    unit_cost: float = Field(default=40.0, ge=0.0, le=500.0)

class CustomerProfileRequest(BaseModel):
    customer_id: int = Field(..., description="Customer ID to retrieve full causal profile for")

class CustomerSearchRequest(BaseModel):
    query: Optional[str] = Field(default=None, description="Search query (customer ID)")
    archetype_filter: Optional[str] = Field(default="all", description="Filter by archetype")
    sort_by: str = Field(default="pred_ite_20", description="Column to sort results by")
    sort_desc: bool = Field(default=True, description="Sort descending")
    limit: int = Field(default=50, ge=1, le=500, description="Max results to return")

class ABTestRequest(BaseModel):
    split_ratio: float = Field(default=0.5, ge=0.1, le=0.9, description="Fraction of population in Group A (Causal)")
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Total budget to split")
    product_price: float = Field(default=100.0, ge=10.0, le=1000.0)
    unit_cost: float = Field(default=40.0, ge=0.0, le=500.0)

class CRMPreviewRequest(BaseModel):
    platform_id: str = Field(default="klaviyo", description="CRM platform id: klaviyo, salesforce, braze, webhook")
    segment_id: str = Field(default="persuadables_20", description="Audience segment identifier")
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Target marketing budget")

class CRMDispatchRequest(BaseModel):
    platform_id: str = Field(default="klaviyo", description="CRM platform id")
    segment_id: str = Field(default="persuadables_20", description="Audience segment identifier")
    target_endpoint: Optional[str] = Field(default=None, description="Custom target webhook / API endpoint")
    api_key_masked: Optional[str] = Field(default=None, description="Masked or full API key / token")
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Target marketing budget")

class PolicyTreeRequest(BaseModel):
    max_depth: int = Field(default=3, ge=2, le=5, description="Maximum tree depth: 2 for simple rules, 3-4 for nuanced rules")
    budget: float = Field(default=5000.0, ge=500.0, le=100000.0, description="Target marketing budget")
    product_price: float = Field(default=100.0, ge=10.0, le=1000.0)
    unit_cost: float = Field(default=40.0, ge=0.0, le=500.0)


