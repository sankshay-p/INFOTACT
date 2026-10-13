import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import { DollarSign, TrendingUp, ShieldAlert, Users, Sparkles, CheckCircle2, ArrowUpRight, Sliders, AlertTriangle } from 'lucide-react';

export default function ExecutiveDashboard({
  briefing,
  optimizationData,
  onBudgetChange,
  currentBudget,
  isOptimizing
}) {
  const [sliderVal, setSliderVal] = useState(currentBudget || 5000);

  useEffect(() => {
    if (currentBudget) setSliderVal(currentBudget);
  }, [currentBudget]);

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    setSliderVal(val);
  };

  const handleSliderRelease = () => {
    if (sliderVal !== currentBudget) {
      onBudgetChange(sliderVal);
    }
  };

  const strats = optimizationData?.strategy_comparison || [];
  const causalStrat = strats.find((s) => s.strategy.includes('EconoCausal')) || {};
  const predStrat = strats.find((s) => s.strategy.includes('Predictive ML')) || {};
  const blanketStrat = strats.find((s) => s.strategy.includes('Blanket')) || {};

  const roiMetrics = optimizationData?.executive_roi || {};

  // Plotly chart data: Comparing Strategies
  const strategyNames = strats.map((s) => s.strategy.replace(' ($10 Uniform)', ''));
  const incProfits = strats.map((s) => s.incremental_profit);
  const wastedSpends = strats.map((s) => s.wasted_budget);

  const comparisonChartData = [
    {
      x: strategyNames,
      y: incProfits,
      type: 'bar',
      name: 'Net Incremental Profit ($)',
      marker: {
        color: ['#10b981', '#f59e0b', '#64748b', '#475569'],
        opacity: 0.9
      }
    },
    {
      x: strategyNames,
      y: wastedSpends,
      type: 'bar',
      name: 'Wasted Spend on Non-Persuadables ($)',
      marker: {
        color: ['rgba(244, 63, 94, 0.35)', 'rgba(244, 63, 94, 0.85)', 'rgba(244, 63, 94, 0.7)', 'rgba(244, 63, 94, 0.7)'],
        line: { color: '#f43f5e', width: 1.5 }
      }
    }
  ];

  return (
    <div className="tab-page-container">
      {/* 1. Header & Hero Value Proposition */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">EXECUTIVE INTELLIGENCE • CAUSAL ROI COPILOT</span>
          <h2 className="section-title">Dynamic Pricing Strategy & Revenue Allocation</h2>
          <p className="section-desc">
            Moving beyond correlation-based predictive AI: Estimating Individual Treatment Effects (ITE)
            with EconML Double Machine Learning to allocate marketing dollars exclusively to Persuadables.
          </p>
        </div>
      </div>

      {/* 2. Primary KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card glass-panel border-glow">
          <div className="kpi-top">
            <span className="kpi-label">Causal Incremental Profit</span>
            <div className="kpi-icon-wrap bg-emerald-dim">
              <DollarSign size={18} className="text-emerald" />
            </div>
          </div>
          <div className="kpi-value text-emerald">
            ${causalStrat.incremental_profit ? causalStrat.incremental_profit.toLocaleString() : '---'}
          </div>
          <div className="kpi-subtext">
            <span className="badge-pill bg-emerald-subtle text-emerald">
              <ArrowUpRight size={13} /> {causalStrat.roi_percentage || 0}% ROI
            </span>
            <span className="text-muted ml-2">on ${sliderVal.toLocaleString()} spend</span>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Wasted Spend Prevented</span>
            <div className="kpi-icon-wrap bg-cyan-dim">
              <TrendingUp size={18} className="text-cyan" />
            </div>
          </div>
          <div className="kpi-value text-cyan">
            ${roiMetrics.wasted_dollars_prevented ? roiMetrics.wasted_dollars_prevented.toLocaleString() : '---'}
          </div>
          <div className="kpi-subtext text-muted">
            Cannibalized spend stopped vs predictive ML
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Profit Lift vs Blanket Promo</span>
            <div className="kpi-icon-wrap bg-violet-dim">
              <Sparkles size={18} className="text-violet" />
            </div>
          </div>
          <div className="kpi-value text-violet">
            +${roiMetrics.profit_lift_vs_blanket ? roiMetrics.profit_lift_vs_blanket.toLocaleString() : '---'}
          </div>
          <div className="kpi-subtext text-muted">
            Net excess margin generated
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Persuadables Concentration</span>
            <div className="kpi-icon-wrap bg-amber-dim">
              <Users size={18} className="text-amber" />
            </div>
          </div>
          <div className="kpi-value text-amber">
            {roiMetrics.persuadables_targeted_pct ? `${roiMetrics.persuadables_targeted_pct}%` : '---'}
          </div>
          <div className="kpi-subtext text-muted">
            Zero budget given to 'Lost Causes'
          </div>
        </div>
      </div>

      {/* 3. Executive AI Copilot Briefing Box */}
      <div className="executive-briefing-card glass-panel">
        <div className="briefing-header">
          <div className="briefing-icon-badge">
            <Sparkles size={18} className="text-cyan" />
          </div>
          <div>
            <span className="briefing-tag">ECONOMETRIC AI COPILOT • NATURAL LANGUAGE SUMMARY</span>
            <h3 className="briefing-headline">{briefing?.headline || 'Loading Strategic Briefing...'}</h3>
          </div>
        </div>

        <p className="briefing-narrative">
          {briefing?.narrative || 'Analyzing causal impact across customer segments...'}
        </p>

        {briefing?.takeaways && (
          <div className="takeaways-grid">
            {briefing.takeaways.map((item, idx) => (
              <div key={idx} className="takeaway-item">
                <div className="takeaway-stat">{item.stat}</div>
                <div className="takeaway-category">{item.category}</div>
                <p className="takeaway-detail">{item.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Interactive Budget Optimizer Simulation Slider */}
      <div className="budget-simulator-card glass-panel">
        <div className="simulator-header">
          <div>
            <div className="flex-row items-center gap-2">
              <Sliders size={18} className="text-cyan" />
              <h3 className="card-heading">Prescriptive Budget Optimization Solver</h3>
            </div>
            <p className="card-subheading">
              Drag slider to re-solve SciPy knapsack discount assignment under real-time budget limits.
            </p>
          </div>
          <div className="budget-display-badge">
            <span className="budget-label">Target Budget:</span>
            <span className="budget-value">${sliderVal.toLocaleString()}</span>
          </div>
        </div>

        <div className="slider-wrapper">
          <input
            type="range"
            min="1000"
            max="25000"
            step="500"
            value={sliderVal}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            className="range-slider"
          />
          <div className="slider-ticks">
            <span>$1,000</span>
            <span>$5,000 (Recommended)</span>
            <span>$10,000</span>
            <span>$15,000</span>
            <span>$25,000</span>
          </div>
        </div>

        <div className="quick-budget-buttons">
          <span className="quick-label">Presets:</span>
          {[2500, 5000, 7500, 10000, 15000, 20000].map((b) => (
            <button
              key={b}
              onClick={() => {
                setSliderVal(b);
                onBudgetChange(b);
              }}
              className={`btn btn-sm ${sliderVal === b ? 'btn-primary' : 'btn-secondary'}`}
            >
              ${b.toLocaleString()}
            </button>
          ))}
          {isOptimizing && <span className="optimizing-spinner">Solving optimization...</span>}
        </div>
      </div>

      {/* 5. Strategy Benchmark Cards & Comparative Chart */}
      <div className="benchmark-section">
        <h3 className="section-subheading">Why Causal AI Outperforms Predictive ML</h3>
        <div className="strats-grid">
          {strats.map((strat, idx) => {
            const isCausal = strat.strategy.includes('EconoCausal');
            return (
              <div
                key={idx}
                className={`strat-card glass-panel ${isCausal ? 'strat-causal-highlight' : ''}`}
              >
                <div className="strat-card-header">
                  <div>
                    <h4 className="strat-title">{strat.strategy}</h4>
                    <span className="strat-targeted-pill">
                      {strat.targeted_customers} customers targeted
                    </span>
                  </div>
                  {isCausal && (
                    <span className="badge-pill bg-emerald-subtle text-emerald font-bold">
                      BEST ROI
                    </span>
                  )}
                </div>

                <div className="strat-metric-row">
                  <span className="text-muted">Net Incremental Profit:</span>
                  <span className={`font-mono font-bold ${isCausal ? 'text-emerald' : 'text-main'}`}>
                    ${strat.incremental_profit.toLocaleString()}
                  </span>
                </div>

                <div className="strat-metric-row">
                  <span className="text-muted">Incremental Revenue:</span>
                  <span className="font-mono text-cyan">
                    ${strat.incremental_revenue.toLocaleString()}
                  </span>
                </div>

                <div className="strat-metric-row">
                  <span className="text-muted">Wasted Spend:</span>
                  <span className="font-mono text-rose">
                    ${strat.wasted_budget.toLocaleString()} ({strat.wasted_pct}%)
                  </span>
                </div>

                <div className="strat-metric-row border-top-subtle pt-2 mt-2">
                  <span className="text-muted">Prescriptive ROI:</span>
                  <span className={`font-mono font-bold ${isCausal ? 'text-emerald' : 'text-main'}`}>
                    {strat.roi_percentage}%
                  </span>
                </div>

                <div className="strat-archetypes-mini">
                  <div className="mini-arch-bar">
                    <div
                      className="mini-bar-persuadable"
                      style={{
                        width: `${(strat.archetype_targeted.Persuadable / Math.max(1, strat.targeted_customers)) * 100}%`
                      }}
                      title="Persuadables"
                    />
                    <div
                      className="mini-bar-surething"
                      style={{
                        width: `${(strat.archetype_targeted['Sure Thing'] / Math.max(1, strat.targeted_customers)) * 100}%`
                      }}
                      title="Sure Things (Wasted)"
                    />
                  </div>
                  <div className="mini-arch-legend">
                    <span>
                      <span className="dot dot-emerald"></span> {strat.archetype_targeted.Persuadable} Persuadables
                    </span>
                    <span>
                      <span className="dot dot-amber"></span> {strat.archetype_targeted['Sure Thing']} Sure Things
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Plotly Comparative Chart */}
      <div className="chart-panel glass-panel mt-6">
        <h4 className="chart-title">Strategy Comparison: Net Profit vs. Wasted Marketing Spend</h4>
        <Plot
          data={comparisonChartData}
          layout={{
            barmode: 'group',
            autosize: true,
            height: 380,
            margin: { l: 50, r: 30, t: 30, b: 60 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
            xaxis: {
              gridcolor: 'rgba(255,255,255,0.05)',
              tickfont: { color: '#f8fafc', size: 12 }
            },
            yaxis: {
              title: { text: 'Amount in USD ($)', font: { size: 12, color: '#94a3b8' } },
              gridcolor: 'rgba(255,255,255,0.06)',
              zerolinecolor: 'rgba(255,255,255,0.1)'
            },
            legend: {
              orientation: 'h',
              y: 1.15,
              x: 0,
              font: { color: '#f8fafc' }
            }
          }}
          useResizeHandler={true}
          style={{ width: '100%' }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </div>
  );
}
