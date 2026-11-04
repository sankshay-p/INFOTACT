import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import {
  Compass, Play, RefreshCw, Sparkles, TrendingUp,
  Activity, Sliders, ShieldCheck, Zap, Layers, BarChart3
} from 'lucide-react';

export default function ContextualBanditView({ apiBase }) {
  const [algorithm, setAlgorithm] = useState('linucb');
  const [nSteps, setNSteps] = useState(500);
  const [alpha, setAlpha] = useState(1.0);
  const [banditData, setBanditData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    runSimulation();
  }, [algorithm, nSteps, alpha]);

  const runSimulation = async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`${apiBase}/api/bandit/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm,
          n_steps: nSteps,
          alpha,
        }),
      });
      const data = await res.json();
      setBanditData(data);
    } catch (err) {
      console.error('Failed to run bandit simulation:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const summary = banditData?.summary || {};
  const curves = banditData?.curves || {};
  const steps = curves.steps || [];

  // Cumulative profit chart data
  const profitCurvesData = steps.length > 0 ? [
    {
      x: steps,
      y: curves.oracle_profit,
      type: 'scatter',
      mode: 'lines',
      name: 'Causal Oracle (Theoretical Max)',
      line: { color: '#38bdf8', width: 2, dash: 'dash' },
      hovertemplate: 'Step %{x}: $%{y:,.0f}<extra>Oracle</extra>',
    },
    {
      x: steps,
      y: curves.bandit_profit,
      type: 'scatter',
      mode: 'lines',
      name: `${algorithm.toUpperCase()} (Online Learning)`,
      line: { color: '#10b981', width: 3 },
      hovertemplate: 'Step %{x}: $%{y:,.0f}<extra>Bandit</extra>',
    },
    {
      x: steps,
      y: curves.predictive_profit,
      type: 'scatter',
      mode: 'lines',
      name: 'Predictive ML (Static Cannibalization)',
      line: { color: '#f59e0b', width: 2, dash: 'dot' },
      hovertemplate: 'Step %{x}: $%{y:,.0f}<extra>Predictive ML</extra>',
    },
    {
      x: steps,
      y: curves.random_profit,
      type: 'scatter',
      mode: 'lines',
      name: 'Random Exploration',
      line: { color: '#64748b', width: 1.5, dash: 'dot' },
      hovertemplate: 'Step %{x}: $%{y:,.0f}<extra>Random</extra>',
    },
  ] : [];

  // Regret chart data
  const regretChartData = steps.length > 0 ? [
    {
      x: steps,
      y: curves.cumulative_regret,
      type: 'scatter',
      mode: 'lines',
      name: 'Cumulative Regret (vs Oracle)',
      line: { color: '#f43f5e', width: 2.5 },
      fill: 'tozeroy',
      fillcolor: 'rgba(244,63,94,0.08)',
      hovertemplate: 'Step %{x}: $%{y:,.0f} Regret<extra></extra>',
    },
  ] : [];

  // Arm history data
  const armHistory = curves.arm_history || [];
  const armEvolutionData = armHistory.length > 0 ? [
    {
      x: armHistory.map((h) => h.step),
      y: armHistory.map((h) => h.arm_0_pct),
      name: '$0 Suppress (Margin Protection)',
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'one',
      line: { width: 0.5, color: '#0284c7' },
      fillcolor: 'rgba(56, 189, 248, 0.4)',
    },
    {
      x: armHistory.map((h) => h.step),
      y: armHistory.map((h) => h.arm_10_pct),
      name: '$10 Discount Tier',
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'one',
      line: { width: 0.5, color: '#f59e0b' },
      fillcolor: 'rgba(245, 158, 11, 0.4)',
    },
    {
      x: armHistory.map((h) => h.step),
      y: armHistory.map((h) => h.arm_20_pct),
      name: '$20 Discount Tier',
      type: 'scatter',
      mode: 'lines',
      stackgroup: 'one',
      line: { width: 0.5, color: '#10b981' },
      fillcolor: 'rgba(16, 185, 129, 0.4)',
    },
  ] : [];

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">REINFORCEMENT LEARNING • REAL-TIME DYNAMIC PRICING</span>
          <h2 className="section-title">Contextual Multi-Armed Bandit Dynamic Pricing Simulator</h2>
          <p className="section-desc">
            Simulate real-time online pricing exploration using <strong>LinUCB</strong> and <strong>Thompson Sampling</strong>.
            Watch the bandit autonomously balance exploration of uncertain customer contexts against exploitation of high-yield discount allocations.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Bandit Net Profit</span>
            <TrendingUp size={16} className="text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald mb-1">
            ${summary.bandit_total_profit?.toLocaleString() || 0}
          </div>
          <span className="text-xs text-muted">Over {summary.n_steps || nSteps} Customer Interactions</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Profit Lift vs Static ML</span>
            <Sparkles size={16} className="text-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan mb-1">
            +${summary.profit_lift_vs_predictive?.toLocaleString() || 0}
          </div>
          <span className="text-xs text-muted">Outperformance vs Non-Causal Targeting</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Cumulative Regret</span>
            <Activity size={16} className="text-rose" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose mb-1">
            ${summary.total_regret?.toLocaleString() || 0}
          </div>
          <span className="text-xs text-muted">{summary.regret_percentage || 0}% of Oracle Ceiling</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Online Policy</span>
            <ShieldCheck size={16} className="text-violet" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet mb-1">
            {algorithm === 'linucb' ? 'LinUCB' : algorithm === 'thompson' ? 'Thompson Sampling' : 'ε-Greedy'}
          </div>
          <span className="text-xs text-muted">Exploration Bonus α = {alpha}</span>
        </div>
      </div>

      {/* Simulator Control Panel */}
      <div className="glass-panel p-5 mb-6">
        <div className="flex-row justify-between items-center gap-4 flex-wrap">
          {/* Algorithm selection */}
          <div className="flex-row items-center gap-3">
            <span className="text-xs font-bold text-muted uppercase">Bandit Algorithm:</span>
            <div className="flex-row gap-2">
              {[
                { id: 'linucb', label: 'LinUCB (Upper Confidence)' },
                { id: 'thompson', label: 'Thompson Sampling' },
                { id: 'epsilon_greedy', label: 'ε-Greedy' },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAlgorithm(a.id)}
                  className={`btn btn-sm ${algorithm === a.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps & Alpha Sliders */}
          <div className="flex-row items-center gap-6">
            <div className="flex-row items-center gap-2">
              <span className="text-xs text-muted">Arrivals:</span>
              <select
                value={nSteps}
                onChange={(e) => setNSteps(Number(e.target.value))}
                className="search-input text-xs"
                style={{ width: 110 }}
              >
                <option value={200}>200 Users</option>
                <option value={500}>500 Users</option>
                <option value={1000}>1,000 Users</option>
                <option value={1500}>1,500 Users</option>
              </select>
            </div>

            <div className="flex-row items-center gap-2">
              <span className="text-xs text-muted">Exploration α:</span>
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.1}
                value={alpha}
                onChange={(e) => setAlpha(Number(e.target.value))}
                className="w-32 accent-cyan cursor-pointer"
              />
              <span className="font-mono text-cyan text-xs font-bold">{alpha}</span>
            </div>

            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="btn btn-primary btn-sm flex items-center gap-1"
            >
              <RefreshCw size={13} className={isRunning ? 'spin-anim' : ''} />
              <span>{isRunning ? 'Simulating...' : 'Re-run Stream'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cumulative Profit Chart */}
        <div className="glass-panel p-5">
          <div className="flex-row justify-between items-center mb-3">
            <div className="flex-row items-center gap-2">
              <TrendingUp size={16} className="text-emerald" />
              <h3 className="card-heading">Cumulative Net Profit ($)</h3>
            </div>
            <span className="text-xs text-muted font-mono">Real-Time Trajectory</span>
          </div>

          <Plot
            data={profitCurvesData}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 60, r: 20, t: 10, b: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                title: 'Customer Arrivals (Sequential Stream)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              yaxis: {
                title: 'Cumulative Realized Profit ($)',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              legend: { orientation: 'h', y: 1.15, font: { color: '#e2e8f0', size: 10 } },
            }}
            useResizeHandler={true}
            style={{ width: '100%' }}
            config={{ responsive: true, displayModeBar: false }}
          />
        </div>

        {/* Cumulative Regret Chart */}
        <div className="glass-panel p-5">
          <div className="flex-row justify-between items-center mb-3">
            <div className="flex-row items-center gap-2">
              <Activity size={16} className="text-rose" />
              <h3 className="card-heading">Sublinear Regret Curve ($)</h3>
            </div>
            <span className="text-xs text-muted font-mono">Regret Flattens as Model Learns</span>
          </div>

          <Plot
            data={regretChartData}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 60, r: 20, t: 10, b: 50 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                title: 'Customer Arrivals',
                titlefont: { size: 11, color: '#94a3b8' },
                tickfont: { color: '#64748b' },
                gridcolor: 'rgba(255,255,255,0.05)',
              },
              yaxis: {
                title: 'Cumulative Regret vs Oracle ($)',
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

      {/* Arm Selection Distribution Evolution */}
      <div className="glass-panel p-5">
        <div className="flex-row justify-between items-center mb-3">
          <div className="flex-row items-center gap-2">
            <Layers size={16} className="text-cyan" />
            <h3 className="card-heading">Online Arm Allocation Dynamics (% Shares)</h3>
          </div>
          <span className="text-xs text-muted font-mono">Transition from Exploration to Exploitation</span>
        </div>

        <Plot
          data={armEvolutionData}
          layout={{
            autosize: true,
            height: 240,
            margin: { l: 50, r: 20, t: 10, b: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            xaxis: {
              title: 'Customer Arrivals',
              titlefont: { size: 11, color: '#94a3b8' },
              tickfont: { color: '#64748b' },
              gridcolor: 'rgba(255,255,255,0.05)',
            },
            yaxis: {
              title: 'Arm Share (%)',
              titlefont: { size: 11, color: '#94a3b8' },
              tickfont: { color: '#64748b' },
              range: [0, 100],
              gridcolor: 'rgba(255,255,255,0.05)',
            },
            legend: { orientation: 'h', y: 1.15, font: { color: '#e2e8f0', size: 10 } },
          }}
          useResizeHandler={true}
          style={{ width: '100%' }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </div>
  );
}
