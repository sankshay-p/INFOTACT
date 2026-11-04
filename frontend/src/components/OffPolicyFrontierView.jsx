import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import {
  TrendingUp, Activity, ShieldCheck, DollarSign, RefreshCw,
  Sparkles, Sliders, ArrowUpRight, BarChart3, AlertTriangle, Layers
} from 'lucide-react';

export default function OffPolicyFrontierView({ apiBase, currentBudget }) {
  const [budget, setBudget] = useState(currentBudget || 5000);
  const [opeData, setOpeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchOpe();
  }, [budget]);

  const fetchOpe = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/ope/evaluation?budget=${budget}`);
      const data = await res.json();
      setOpeData(data);
    } catch (err) {
      console.error('Failed to fetch OPE data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const policies = opeData?.policy_evaluations || [];
  const frontier = opeData?.continuous_frontier || [];
  const satBudget = opeData?.saturation_budget || 12000;
  const advVsPred = opeData?.incremental_advantage_vs_predictive || 0;

  // Frontier chart data
  const frontierChartData = frontier.length > 0 ? [
    {
      x: frontier.map((f) => f.budget),
      y: frontier.map((f) => f.causal_profit),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Causal DML Policy (DR Value)',
      line: { color: '#10b981', width: 3 },
      marker: { size: 6, color: '#10b981' },
      hovertemplate: 'Budget: $%{x:,.0f}<br>Causal Profit: $%{y:,.0f}<extra></extra>',
    },
    {
      x: frontier.map((f) => f.budget),
      y: frontier.map((f) => f.predictive_profit),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Predictive ML Targeting',
      line: { color: '#f59e0b', width: 2, dash: 'dot' },
      marker: { size: 5, color: '#f59e0b' },
      hovertemplate: 'Budget: $%{x:,.0f}<br>Predictive Profit: $%{y:,.0f}<extra></extra>',
    },
  ] : [];

  const marginalRoiData = frontier.length > 0 ? [
    {
      x: frontier.map((f) => f.budget),
      y: frontier.map((f) => f.marginal_roi_pct),
      type: 'bar',
      name: 'Marginal ROI % (dProfit/dBudget)',
      marker: {
        color: frontier.map((f) => f.marginal_roi_pct >= 20 ? '#38bdf8' : (f.marginal_roi_pct >= 0 ? '#10b981' : '#f43f5e')),
        opacity: 0.8,
      },
      hovertemplate: 'Budget: $%{x:,.0f}<br>Marginal ROI: %{y:.1f}%<extra></extra>',
    },
  ] : [];

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">COUNTERFACTUAL ECONOMETRICS • CONTINUOUS EFFICIENCY FRONTIER</span>
          <h2 className="section-title">Off-Policy Evaluation (OPE) & Budget Pareto Frontier</h2>
          <p className="section-desc">
            Statistically evaluate candidate pricing policies using <strong>Doubly Robust (DR) estimation</strong>.
            Trace the continuous Efficient Frontier of incremental margin across $1k–$25k budgets to identify the exact point of diminishing returns.
          </p>
        </div>
      </div>

      {/* Top Highlight Cards */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="metric-box glass-panel p-5">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Causal Advantage vs ML</span>
            <Sparkles size={16} className="text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald mb-1">
            +${advVsPred.toLocaleString()}
          </div>
          <span className="text-xs text-muted">Statistically Significant Doubly Robust Uplift</span>
        </div>

        <div className="metric-box glass-panel p-5">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Profit Saturation Budget</span>
            <Activity size={16} className="text-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan mb-1">
            ${satBudget.toLocaleString()}
          </div>
          <span className="text-xs text-muted">Optimal Capital Limit Before Marginal ROI Decays</span>
        </div>

        <div className="metric-box glass-panel p-5">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Evaluator Methodology</span>
            <ShieldCheck size={16} className="text-violet" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mb-1">Doubly Robust (AIPW)</div>
          <span className="text-xs text-muted">Robust to Either Model or Propensity Misspecification</span>
        </div>
      </div>

      {/* Budget Slider Bar */}
      <div className="glass-panel p-4 mb-6 flex-row justify-between items-center">
        <div className="flex-row items-center gap-3">
          <Sliders size={16} className="text-cyan" />
          <span className="text-xs font-bold text-white uppercase">Simulate Evaluation Budget:</span>
          <span className="font-mono font-bold text-cyan text-sm">${budget.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={1000}
          max={25000}
          step={500}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-96 accent-cyan cursor-pointer"
        />
      </div>

      {/* Policy Evaluation Scorecard Grid */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex-row justify-between items-center mb-4">
          <div className="flex-row items-center gap-2">
            <Layers size={18} className="text-emerald" />
            <h3 className="card-heading">Doubly Robust Policy Value Scorecard</h3>
          </div>
          <span className="badge-pill bg-emerald-subtle text-emerald text-xs font-bold">
            95% ASYMPTOTIC NORMAL CONFIDENCE INTERVALS
          </span>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {policies.map((p, idx) => (
            <div
              key={idx}
              className="glass-panel p-4 flex flex-col justify-between"
              style={{
                borderLeft: `4px solid ${p.color}`,
                background: p.is_optimal ? 'rgba(16,185,129,0.06)' : 'rgba(15,23,42,0.6)',
              }}
            >
              <div>
                <div className="flex-row justify-between items-start mb-2">
                  <h4 className="font-bold text-white text-xs">{p.policy}</h4>
                  {p.is_optimal && (
                    <span className="badge-pill bg-emerald-subtle text-emerald text-[10px] font-bold">OPTIMAL</span>
                  )}
                </div>

                <div className="text-xl font-bold font-mono mb-1" style={{ color: p.color }}>
                  ${p.doubly_robust_value?.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted mb-3 font-mono">
                  95% CI: [${p.ci_lower?.toLocaleString()} – ${p.ci_upper?.toLocaleString()}]
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/50 flex flex-col gap-1 text-[11px]">
                <div className="flex-row justify-between text-muted">
                  <span>Direct Method (DM):</span>
                  <span className="font-mono text-white">${p.direct_method_value?.toLocaleString()}</span>
                </div>
                <div className="flex-row justify-between text-muted">
                  <span>IPW Estimator:</span>
                  <span className="font-mono text-white">${p.ipw_value?.toLocaleString()}</span>
                </div>
                <div className="flex-row justify-between text-muted">
                  <span>Total Capital Spent:</span>
                  <span className="font-mono text-amber">${p.total_cost?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Continuous Pareto Frontier Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-panel p-5">
          <div className="flex-row justify-between items-center mb-3">
            <div className="flex-row items-center gap-2">
              <TrendingUp size={16} className="text-emerald" />
              <h3 className="card-heading">Continuous Budget Pareto Frontier</h3>
            </div>
            <span className="text-xs text-muted font-mono">Causal vs. Predictive ML</span>
          </div>

          <Plot
            data={frontierChartData}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 60, r: 20, t: 10, b: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                title: 'Marketing Budget Limit ($)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              yaxis: {
                title: 'Incremental Net Profit ($)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              shapes: [
                {
                  type: 'line',
                  x0: satBudget,
                  x1: satBudget,
                  y0: 0,
                  y1: Math.max(...frontier.map((f) => f.causal_profit || 0), 1000),
                  line: { color: '#38bdf8', width: 2, dash: 'dash' },
                },
              ],
              annotations: [
                {
                  x: satBudget,
                  y: Math.max(...frontier.map((f) => f.causal_profit || 0), 1000) * 0.9,
                  text: 'Saturation Point',
                  showarrow: true,
                  arrowhead: 2,
                  font: { color: '#38bdf8', size: 10 },
                },
              ],
              legend: { orientation: 'h', y: 1.15, font: { color: '#e2e8f0', size: 10 } },
            }}
            useResizeHandler={true}
            style={{ width: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>

        <div className="glass-panel p-5">
          <div className="flex-row justify-between items-center mb-3">
            <div className="flex-row items-center gap-2">
              <BarChart3 size={16} className="text-cyan" />
              <h3 className="card-heading">Marginal ROI Derivative (dProfit / dBudget)</h3>
            </div>
            <span className="text-xs text-muted font-mono">% Yield Per Incremental Dollar</span>
          </div>

          <Plot
            data={marginalRoiData}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 60, r: 20, t: 10, b: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                title: 'Budget Steps ($)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              yaxis: {
                title: 'Marginal Return on Capital (%)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
            }}
            useResizeHandler={true}
            style={{ width: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>
      </div>
    </div>
  );
}
