import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import { Beaker, TrendingDown, TrendingUp, Zap, BarChart3, RefreshCw, Play, AlertTriangle, Sparkles, Plus, Sliders, X, Check } from 'lucide-react';

export default function ScenarioPlannerView({ apiBase, currentBudget }) {
  const [presets, setPresets] = useState([]);
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [budget, setBudget] = useState(currentBudget || 5000);

  // Custom Scenario Builder State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSliders, setCustomSliders] = useState({
    income: 1.0,
    browsing_minutes: 1.0,
    loyalty_score: 1.0,
    days_since_last_purchase: 1.0,
    cart_value_history: 1.0,
    seasonality_index: 1.0,
  });

  const handleSliderChange = (feat, val) => {
    setCustomSliders((prev) => ({ ...prev, [feat]: parseFloat(val) }));
  };

  const handleAddCustomScenario = () => {
    if (!customName.trim()) return;
    const descParts = [];
    if (customSliders.income !== 1.0) descParts.push(`Income ${customSliders.income > 1 ? '+' : ''}${Math.round((customSliders.income - 1) * 100)}%`);
    if (customSliders.browsing_minutes !== 1.0) descParts.push(`Browsing ${customSliders.browsing_minutes > 1 ? '+' : ''}${Math.round((customSliders.browsing_minutes - 1) * 100)}%`);
    if (customSliders.loyalty_score !== 1.0) descParts.push(`Loyalty ${customSliders.loyalty_score > 1 ? '+' : ''}${Math.round((customSliders.loyalty_score - 1) * 100)}%`);
    if (customSliders.days_since_last_purchase !== 1.0) descParts.push(`Recency ${customSliders.days_since_last_purchase > 1 ? '+' : ''}${Math.round((customSliders.days_since_last_purchase - 1) * 100)}%`);
    if (customSliders.cart_value_history !== 1.0) descParts.push(`Cart ${customSliders.cart_value_history > 1 ? '+' : ''}${Math.round((customSliders.cart_value_history - 1) * 100)}%`);
    if (customSliders.seasonality_index !== 1.0) descParts.push(`Seasonality ${customSliders.seasonality_index > 1 ? '+' : ''}${Math.round((customSliders.seasonality_index - 1) * 100)}%`);

    const newCustom = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      description: descParts.length > 0 ? descParts.join(', ') : 'Custom shock baseline',
      adjustments: { ...customSliders },
      icon: '⚙️',
      severity: 'custom',
    };

    setPresets((prev) => [newCustom, ...prev]);
    setSelectedScenarios((prev) => [newCustom, ...prev]);
    setCustomName('');
    setShowCustomModal(false);
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${apiBase}/api/scenario-presets`);
      const data = await res.json();
      setPresets(data.presets || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };

  const toggleScenario = (preset) => {
    setSelectedScenarios((prev) => {
      const exists = prev.find((s) => s.id === preset.id);
      if (exists) return prev.filter((s) => s.id !== preset.id);
      return [...prev, preset];
    });
  };

  const runAnalysis = async () => {
    if (selectedScenarios.length === 0) return;
    setIsRunning(true);
    try {
      const res = await fetch(`${apiBase}/api/scenario-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: selectedScenarios.map((s) => ({
            name: s.name,
            id: s.id,
            adjustments: s.adjustments,
          })),
          budget,
        }),
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Scenario analysis failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const selectAll = () => setSelectedScenarios([...presets]);
  const clearAll = () => {
    setSelectedScenarios([]);
    setResults(null);
  };

  const tornado = results?.tornado_sensitivity || [];
  const scenarios = results?.scenarios || [];
  const baselineProfit = results?.baseline_profit || 0;

  // Tornado Chart Plotly Data
  const tornadoChartData = tornado.length > 0 ? [
    {
      type: 'bar',
      orientation: 'h',
      y: tornado.map((t) => t.label),
      x: tornado.map((t) => t.decrease_delta),
      name: '−25% Perturbation',
      marker: { color: '#f43f5e', opacity: 0.85 },
      hovertemplate: '%{y}: %{x:+$,.0f}<extra>−25%</extra>',
    },
    {
      type: 'bar',
      orientation: 'h',
      y: tornado.map((t) => t.label),
      x: tornado.map((t) => t.increase_delta),
      name: '+25% Perturbation',
      marker: { color: '#10b981', opacity: 0.85 },
      hovertemplate: '%{y}: %{x:+$,.0f}<extra>+25%</extra>',
    },
  ] : [];

  // Scenario comparison bar chart
  const scenarioChartData = scenarios.length > 1 ? [
    {
      x: scenarios.map((s) => s.scenario_name),
      y: scenarios.map((s) => s.incremental_profit),
      type: 'bar',
      name: 'Incremental Profit ($)',
      marker: {
        color: scenarios.map((s) =>
          s.scenario_id === 'baseline' ? '#38bdf8' :
          (s.incremental_profit >= baselineProfit ? '#10b981' : '#f43f5e')
        ),
        opacity: 0.9,
      },
    },
  ] : [];

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">WHAT-IF SIMULATOR • MACROECONOMIC SCENARIO PLANNER</span>
          <h2 className="section-title">Scenario Stress Testing & Sensitivity Analysis</h2>
          <p className="section-desc">
            Simulate macroeconomic shocks — recessions, competitor pressure, seasonal surges — and instantly see
            how the causal optimization adapts profit allocation, archetype distribution, and ROI across all scenarios.
          </p>
        </div>
      </div>

      {/* Scenario Selector Grid */}
      <div className="scenario-selector-card glass-panel">
        <div className="scenario-selector-header">
          <div className="flex-row items-center gap-2">
            <Beaker size={18} className="text-violet" />
            <h3 className="card-heading">Select Macroeconomic Scenarios</h3>
          </div>
          <div className="flex-row items-center gap-2">
            <button
              onClick={() => setShowCustomModal(!showCustomModal)}
              className="btn btn-primary btn-sm flex-row items-center gap-1"
            >
              <Plus size={14} />
              <span>{showCustomModal ? 'Close Builder' : 'Custom Scenario'}</span>
            </button>
            <button onClick={selectAll} className="btn btn-secondary btn-sm">Select All</button>
            <button onClick={clearAll} className="btn btn-secondary btn-sm">Clear</button>
          </div>
        </div>

        {/* Custom Scenario Builder Drawer */}
        {showCustomModal && (
          <div className="custom-scenario-builder glass-panel p-4 mb-4">
            <div className="flex-row justify-between items-center mb-3">
              <div className="flex-row items-center gap-2">
                <Sliders size={16} className="text-cyan" />
                <h4 className="font-bold text-white text-sm">Design Custom Shock Scenario</h4>
              </div>
              <span className="text-xs text-muted">Adjust perturbation multipliers relative to baseline (1.0x)</span>
            </div>

            <div className="form-group mb-4">
              <span className="form-label">Scenario Name:</span>
              <input
                type="text"
                placeholder="e.g. Q4 Hyper-Inflation + Supply Chain Shock"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="search-input"
                style={{ width: '100%', maxWidth: 450 }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { key: 'income', label: 'Customer Income', min: 0.4, max: 1.8, step: 0.05 },
                { key: 'browsing_minutes', label: 'Browsing Minutes', min: 0.3, max: 2.5, step: 0.05 },
                { key: 'loyalty_score', label: 'Loyalty Tier', min: 0.4, max: 1.8, step: 0.05 },
                { key: 'days_since_last_purchase', label: 'Purchase Recency', min: 0.4, max: 2.5, step: 0.05 },
                { key: 'cart_value_history', label: 'Cart Value History', min: 0.4, max: 2.2, step: 0.05 },
                { key: 'seasonality_index', label: 'Seasonality Index', min: 0.4, max: 2.5, step: 0.05 },
              ].map(({ key, label, min, max, step }) => {
                const val = customSliders[key];
                const pct = Math.round((val - 1) * 100);
                const isPositive = pct > 0;
                const isNegative = pct < 0;
                return (
                  <div key={key} className="slider-control-card glass-panel p-3">
                    <div className="flex-row justify-between text-xs mb-1">
                      <span className="text-muted font-medium">{label}</span>
                      <span className={`font-mono font-bold ${isPositive ? 'text-emerald' : isNegative ? 'text-rose' : 'text-cyan'}`}>
                        {val.toFixed(2)}x ({isPositive ? '+' : ''}{pct}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => handleSliderChange(key, e.target.value)}
                      className="w-full accent-cyan cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex-row justify-end gap-2">
              <button
                onClick={() => {
                  setCustomSliders({
                    income: 1.0,
                    browsing_minutes: 1.0,
                    loyalty_score: 1.0,
                    days_since_last_purchase: 1.0,
                    cart_value_history: 1.0,
                    seasonality_index: 1.0,
                  });
                }}
                className="btn btn-secondary btn-sm"
              >
                Reset Multipliers
              </button>
              <button
                onClick={handleAddCustomScenario}
                disabled={!customName.trim()}
                className="btn btn-primary btn-sm flex-row items-center gap-1"
              >
                <Check size={14} />
                <span>Add & Select Scenario</span>
              </button>
            </div>
          </div>
        )}

        <div className="scenario-presets-grid">
          {presets.map((preset) => {
            const isSelected = selectedScenarios.some((s) => s.id === preset.id);
            return (
              <button
                key={preset.id}
                onClick={() => toggleScenario(preset)}
                className={`scenario-preset-card glass-panel ${isSelected ? 'scenario-selected' : ''}`}
              >
                <div className="scenario-preset-icon">{preset.icon}</div>
                <div className="scenario-preset-name">{preset.name}</div>
                <div className="scenario-preset-desc">{preset.description}</div>
                <div className={`scenario-severity-badge severity-${preset.severity}`}>
                  {preset.severity.toUpperCase()} IMPACT
                </div>
                {isSelected && (
                  <div className="scenario-check-mark">✓</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="scenario-run-bar">
          <div className="flex-row items-center gap-3">
            <div className="form-group">
              <span className="form-label">Budget:</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="search-input"
                style={{ width: 140 }}
                min={500}
                max={100000}
                step={500}
              />
            </div>
            <span className="text-muted text-sm">
              {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <button
            onClick={runAnalysis}
            disabled={isRunning || selectedScenarios.length === 0}
            className="btn btn-primary"
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className="spin-anim" />
                Computing Scenarios...
              </>
            ) : (
              <>
                <Play size={15} />
                Run Scenario Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Scenario Comparison Cards */}
          <h3 className="section-subheading mt-6">
            <Sparkles size={18} className="text-cyan" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Scenario Impact Comparison
          </h3>
          <div className="scenario-results-grid">
            {scenarios.map((sc, idx) => {
              const isBaseline = sc.scenario_id === 'baseline';
              const profitUp = (sc.profit_delta_vs_baseline || 0) > 0;
              return (
                <div
                  key={idx}
                  className={`scenario-result-card glass-panel ${isBaseline ? 'scenario-baseline-card' : ''}`}
                >
                  <div className="scenario-result-header">
                    <h4 className="scenario-result-name">{sc.scenario_name}</h4>
                    {isBaseline ? (
                      <span className="badge-pill bg-cyan-subtle text-cyan font-bold">BASELINE</span>
                    ) : profitUp ? (
                      <span className="badge-pill bg-emerald-subtle text-emerald font-bold">
                        <TrendingUp size={12} /> +${sc.profit_delta_vs_baseline?.toLocaleString() || 0}
                      </span>
                    ) : (
                      <span className="badge-pill" style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185' }}>
                        <TrendingDown size={12} /> ${sc.profit_delta_vs_baseline?.toLocaleString() || 0}
                      </span>
                    )}
                  </div>

                  <div className="scenario-metric-row">
                    <span className="text-muted">Incremental Profit:</span>
                    <span className={`font-mono font-bold ${isBaseline ? 'text-cyan' : (profitUp ? 'text-emerald' : 'text-rose')}`}>
                      ${sc.incremental_profit?.toLocaleString() || '---'}
                    </span>
                  </div>
                  <div className="scenario-metric-row">
                    <span className="text-muted">ROI:</span>
                    <span className="font-mono text-main">{sc.roi_percentage}%</span>
                  </div>
                  <div className="scenario-metric-row">
                    <span className="text-muted">Wasted Spend:</span>
                    <span className="font-mono text-rose">${sc.wasted_budget?.toLocaleString() || 0}</span>
                  </div>
                  <div className="scenario-metric-row">
                    <span className="text-muted">Targeted Customers:</span>
                    <span className="font-mono text-main">{sc.targeted_customers}</span>
                  </div>
                  <div className="scenario-metric-row">
                    <span className="text-muted">Persuadables %:</span>
                    <span className="font-mono text-emerald">{sc.persuadables_pct}%</span>
                  </div>

                  {!isBaseline && sc.adjustments && (
                    <div className="scenario-adjustments-box">
                      {Object.entries(sc.adjustments).map(([feat, mult]) => (
                        <span key={feat} className="scenario-adj-pill">
                          {feat}: ×{mult}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scenario Comparison Chart */}
          {scenarioChartData.length > 0 && (
            <div className="chart-panel glass-panel mt-6">
              <h4 className="chart-title">
                <BarChart3 size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                Scenario Profit Comparison
              </h4>
              <Plot
                data={scenarioChartData}
                layout={{
                  autosize: true,
                  height: 350,
                  margin: { l: 50, r: 30, t: 20, b: 80 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
                  xaxis: {
                    gridcolor: 'rgba(255,255,255,0.05)',
                    tickfont: { color: '#f8fafc', size: 11 },
                    tickangle: -20,
                  },
                  yaxis: {
                    title: { text: 'Incremental Profit ($)', font: { size: 12, color: '#94a3b8' } },
                    gridcolor: 'rgba(255,255,255,0.06)',
                    zerolinecolor: 'rgba(255,255,255,0.1)',
                  },
                }}
                useResizeHandler={true}
                style={{ width: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          )}

          {/* Tornado Sensitivity Chart */}
          {tornadoChartData.length > 0 && (
            <div className="chart-panel glass-panel mt-6">
              <div className="tornado-chart-header">
                <div>
                  <h4 className="chart-title">
                    <AlertTriangle size={16} className="text-amber" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                    Tornado Sensitivity Analysis (±25% Perturbation)
                  </h4>
                  <p className="text-muted text-sm mt-1">
                    Shows which features cause the largest swing in incremental profit when perturbed independently.
                  </p>
                </div>
                <span className="font-mono text-dim text-sm">Baseline: ${baselineProfit.toLocaleString()}</span>
              </div>
              <Plot
                data={tornadoChartData}
                layout={{
                  barmode: 'relative',
                  autosize: true,
                  height: 340,
                  margin: { l: 160, r: 40, t: 10, b: 40 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
                  xaxis: {
                    title: { text: 'Δ Profit vs Baseline ($)', font: { size: 12, color: '#94a3b8' } },
                    gridcolor: 'rgba(255,255,255,0.06)',
                    zerolinecolor: 'rgba(255,255,255,0.2)',
                    zerolinewidth: 2,
                  },
                  yaxis: {
                    autorange: 'reversed',
                    tickfont: { color: '#f8fafc', size: 12 },
                  },
                  legend: {
                    orientation: 'h',
                    y: 1.12,
                    x: 0.3,
                    font: { color: '#f8fafc' },
                  },
                }}
                useResizeHandler={true}
                style={{ width: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />

              {/* Sensitivity summary table */}
              <div className="table-responsive mt-4">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>−25% Impact</th>
                      <th>+25% Impact</th>
                      <th>Total Swing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tornado.map((t, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold">{t.label}</td>
                        <td className={`font-mono ${t.decrease_delta >= 0 ? 'text-emerald' : 'text-rose'}`}>
                          {t.decrease_delta >= 0 ? '+' : ''}${t.decrease_delta.toLocaleString()}
                        </td>
                        <td className={`font-mono ${t.increase_delta >= 0 ? 'text-emerald' : 'text-rose'}`}>
                          {t.increase_delta >= 0 ? '+' : ''}${t.increase_delta.toLocaleString()}
                        </td>
                        <td className="font-mono text-amber font-bold">${t.total_swing.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
