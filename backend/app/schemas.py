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
