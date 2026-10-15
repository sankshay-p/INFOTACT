# EconoCausal: Dynamic Pricing & Uplift via Double Machine Learning

**EconoCausal** is an enterprise-grade Causal AI and Prescriptive Optimization platform designed for marketing directors, financial planners, and econometrics teams. 

Standard machine learning predicts **correlation, not causation**. A predictive churn or purchase model often awards promotional discounts to customers with high purchase probabilities who were going to buy anyway ("Sure Things"), wasting millions in margin. Traditional ML cannot answer:
> *"Would this specific customer have bought IF AND ONLY IF we gave them the discount?"*

EconoCausal uses **Double Machine Learning (DML)** and **Microsoft DoWhy** to isolate the **Individual Treatment Effect (ITE)** from observational confounders, allocating promotional budgets exclusively to **Persuadables** to maximize net incremental revenue.

---

## 🏗️ System Architecture & Week-by-Week Milestones

### Week 1: Causal Graphing & Identification (Microsoft DoWhy)
- **Directed Acyclic Graph (DAG)**: Formulated in DoWhy identifying Confounders ($W$: Customer Income, Browsing Minutes, Loyalty Tier, Purchase Recency, Cart Value History, Seasonality Index), Treatments ($T$: Promotional Discount $0, $10, $20), and Outcomes ($Y$: Conversion, Net Realized Revenue).
- **Backdoor Criterion Identification**: Identifies the sufficient adjustment set blocking spurious non-causal confounding paths.
- **Propensity Score Matching & Weighting**: Computes inverse probability weights (IPW) and evaluates Standardized Mean Differences (SMD), reducing observational bias strictly below the $0.10$ threshold.

### Week 2: Double Machine Learning & Uplift Curves (EconML)
- **Double/Debiased Machine Learning (DML)**: Implements EconML's `LinearDML` with cross-fitting (Neyman orthogonality) to eliminate regularization bias. Employs Random Forests and LightGBM as base learners for outcome model $Y$ and treatment model $T$.
- **Causal Uplift Analytics**: Generates **Qini Curves** (cumulative incremental gains over population targeted) and **Uplift by Deciles**, proving empirical outperformance over predictive ML and random rollouts.
- **Customer Uplift Archetypes**: Classifies users into 4 categories:
  1. **Persuadables**: High price elasticity ($\tau \ge 0.12$). Target exclusively!
  2. **Sure Things**: High baseline conversion ($P(Y_0) \ge 0.60$). Suppress discounts to avoid margin cannibalization.
  3. **Lost Causes**: Inelastic response ($\tau < 0.08$). Withhold budget.
  4. **Sleeping Dogs**: Negative uplift ($\tau < 0$). Do not disturb.

### Mid-Project Review: Causal Audit (DoWhy Refutations)
- **Placebo Treatment Refuter**: Replaces treatment with random permutation; verified estimated effect drops to near zero ($\sim 0.00022$).
- **Random Common Cause Refuter**: Injects independent Gaussian confounders; verified causal estimate remains invariant ($0.01118 \to 0.01117$).
- **Data Subset Refuter**: 80% bootstrap subsets prove statistical invariance ($0.01118 \to 0.01051$).
- **Audit Verdict**: Formally certified as **DOWHY CERTIFIED CAUSAL**.

### Week 3: Prescriptive Optimization Solver (SciPy)
- **Constrained Optimization**: Solves knapsack / integer linear programming maximizing total incremental profit subject to fixed marketing budget constraints ($\sum_i d_i \le B$).
- **Allocation Matrix ("The Prescription")**: Generates individualized discount recommendations ($0, $10, $20) with customer attributes, baseline conversion, causal uplift, expected incremental profit, and economic rationale. Includes CSV export for CRM deployment.
- **Strategic Benchmarks**: Benchmarks EconoCausal Prescriptive targeting against Predictive ML Targeting, Blanket $10 Promotions, and Random Rollouts.

### Week 4: REST API, Packaging & Automated Drift Detection
- **FastAPI REST API**: Serves DAG definitions, DML estimation, optimization solvers, and refutation audits.
- **Automated Data Drift Detector**: Continuously evaluates Kolmogorov-Smirnov (KS) test statistics and Population Stability Index (PSI) to detect covariate distribution shifts and flag model recalibration triggers.
- **Econometric AI Copilot**: Natural language executive briefing generating quantitative ROI summaries (e.g., *"EconoCausal achieves $2,760 incremental profit, saving $3,200 in cannibalized margin vs predictive ML"*).

---

## 🚀 Running the Project

### Prerequisites
- Python 3.12+
- Node.js v20+ / v22+ & npm

### 1. Backend Service
```bash
# Navigate to workspace
cd /Users/sankshay/Downloads/INFOTACT

# Activate virtual environment
source backend/venv/bin/activate

# Launch FastAPI server on port 8000
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000
```
API Documentation is available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Frontend Dashboard
```bash
# In a separate terminal
cd /Users/sankshay/Downloads/INFOTACT/frontend

# Launch Vite development server
npm run dev -- --host 127.0.0.1 --port 5173
```
Dashboard is live at: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and causal model status |
| `GET` | `/api/dag` | DoWhy DAG nodes, directed edges, and backdoor adjustment set |
| `GET` | `/api/dataset` | Summary statistics and confounding correlation matrix |
| `GET` | `/api/causal-summary` | Double ML results, CATE distribution, Qini curve, and uplift deciles |
| `POST` | `/api/train-dml` | Retrain DML with custom sample size, learner (Random Forest / LightGBM) |
| `GET` | `/api/refutation-audit` | DoWhy Placebo, Random Common Cause, and Data Subset refutation tests |
| `GET` | `/api/propensity` | Propensity scores and Standardized Mean Differences (SMD) |
| `POST` | `/api/optimize` | SciPy prescriptive budget optimization with custom budget limits |
| `GET` | `/api/drift` | Automated covariate drift report (KS-test, PSI scores) |
| `POST` | `/api/simulate-drift` | Simulate macroeconomic market shocks and observe live drift alerts |
| `GET` | `/api/executive-briefing`| Natural language executive summary & strategic ROI brief |
