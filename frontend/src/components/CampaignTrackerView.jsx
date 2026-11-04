import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import {
  Clock, GitBranch, Play, Trash2, DollarSign, RefreshCw,
  ArrowUpRight, ArrowDownRight, Beaker, Sliders, Zap, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';

const EVENT_ICONS = {
  system_init: Zap,
  budget_change: DollarSign,
  dml_retrain: RefreshCw,
  scenario_analysis: Beaker,
  ab_test: GitBranch,
};

const EVENT_COLORS = {
  system_init: '#38bdf8',
  budget_change: '#f59e0b',
  dml_retrain: '#818cf8',
  scenario_analysis: '#10b981',
  ab_test: '#f43f5e',
};

export default function CampaignTrackerView({ apiBase, currentBudget }) {
  const [history, setHistory] = useState(null);
  const [abResult, setAbResult] = useState(null);
  const [isRunningAB, setIsRunningAB] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [abBudget, setAbBudget] = useState(currentBudget || 5000);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/campaign-history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch campaign history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(`${apiBase}/api/campaign-clear`, { method: 'POST' });
      fetchHistory();
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const runABTest = async () => {
    setIsRunningAB(true);
    try {
      const res = await fetch(`${apiBase}/api/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_ratio: splitRatio,
          budget: abBudget,
        }),
      });
      const data = await res.json();
      setAbResult(data);
      // Refresh history to include the new AB test event
      fetchHistory();
    } catch (err) {
      console.error('A/B test failed:', err);
    } finally {
      setIsRunningAB(false);
    }
  };

  const events = history?.events || [];
  const eventCounts = history?.event_type_counts || {};
  const timeline = history?.profit_timeline || [];

  // Profit timeline chart
  const timelineChartData = timeline.length > 1 ? [
    {
      x: timeline.map((t) => t.timestamp),
      y: timeline.map((t) => t.profit),
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Incremental Profit',
      line: { color: '#38bdf8', width: 2, shape: 'spline' },
      marker: {
        color: timeline.map((t) => EVENT_COLORS[t.event_type] || '#38bdf8'),
        size: 8,
        line: { color: '#0f172a', width: 2 },
      },
      fill: 'tozeroy',
      fillcolor: 'rgba(56, 189, 248, 0.08)',
    },
  ] : [];

  const ab = abResult;
  const testResults = ab?.test_results || {};

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">CAMPAIGN OPERATIONS • A/B TEST TRACKER</span>
          <h2 className="section-title">Campaign History & A/B Test Designer</h2>
          <p className="section-desc">
            Track every optimization run, budget change, and DML retrain event. Run built-in A/B tests
            comparing Causal DML vs Predictive ML targeting with statistical significance testing.
          </p>
        </div>
        <div className="flex-row items-center gap-2">
          <button onClick={fetchHistory} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={clearHistory} className="btn btn-secondary btn-sm" style={{ color: '#fb7185' }}>
            <Trash2 size={14} />
            Clear Log
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Total Events</span>
            <div className="kpi-icon-wrap bg-cyan-dim">
              <Clock size={18} className="text-cyan" />
            </div>
          </div>
          <div className="kpi-value text-cyan">{history?.total_events || 0}</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Budget Changes</span>
            <div className="kpi-icon-wrap bg-amber-dim">
              <DollarSign size={18} className="text-amber" />
            </div>
          </div>
          <div className="kpi-value text-amber">{eventCounts.budget_change || 0}</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">Model Retrains</span>
            <div className="kpi-icon-wrap bg-violet-dim">
              <RefreshCw size={18} className="text-violet" />
            </div>
          </div>
          <div className="kpi-value text-violet">{eventCounts.dml_retrain || 0}</div>
        </div>
        <div className="kpi-card glass-panel">
          <div className="kpi-top">
            <span className="kpi-label">A/B Tests Run</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(244,63,94,0.12)' }}>
              <GitBranch size={18} className="text-rose" />
            </div>
          </div>
          <div className="kpi-value text-rose">{eventCounts.ab_test || 0}</div>
        </div>
      </div>

      <div className="campaign-layout">
        {/* Timeline */}
        <div className="campaign-timeline-panel">
          {/* Profit Timeline Chart */}
          {timelineChartData.length > 0 && (
            <div className="chart-panel glass-panel mb-4">
              <h4 className="chart-title">
                <BarChart3 size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                Profit Over Campaign Events
              </h4>
              <Plot
                data={timelineChartData}
                layout={{
                  autosize: true,
                  height: 220,
                  margin: { l: 50, r: 20, t: 10, b: 40 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
                  xaxis: {
                    gridcolor: 'rgba(255,255,255,0.05)',
                    tickfont: { color: '#64748b', size: 9 },
                  },
                  yaxis: {
                    title: { text: 'Profit ($)', font: { size: 11, color: '#94a3b8' } },
                    gridcolor: 'rgba(255,255,255,0.06)',
                  },
                  showlegend: false,
                }}
                useResizeHandler={true}
                style={{ width: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          )}

          {/* Event Timeline */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 className="card-heading mb-3">
              <Clock size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
              Campaign Event Log
            </h4>

            <div className="campaign-events-list">
              {events.length === 0 ? (
                <div className="campaign-empty-state">
                  <Clock size={32} className="text-dim" />
                  <p className="text-muted mt-2">No campaign events recorded yet.</p>
                  <p className="text-dim text-sm">Events are automatically logged when you change budget, retrain models, or run scenarios.</p>
                </div>
              ) : (
                events.map((event) => {
                  const Icon = EVENT_ICONS[event.event_type] || Clock;
                  const color = EVENT_COLORS[event.event_type] || '#38bdf8';
                  const isExpanded = expandedEvent === event.event_id;
                  const deltas = event.deltas || {};
                  const hasDeltas = Object.keys(deltas).length > 0;

                  return (
                    <div key={event.event_id} className="campaign-event-item">
                      <div className="campaign-event-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                      <div className="campaign-event-content">
                        <div
                          className="campaign-event-header cursor-pointer"
                          onClick={() => setExpandedEvent(isExpanded ? null : event.event_id)}
                        >
                          <div className="flex-row items-center gap-2">
                            <Icon size={15} style={{ color }} />
                            <span className="campaign-event-type" style={{ color }}>
                              {event.event_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <span className="campaign-event-time">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                          {isExpanded ? <ChevronUp size={15} className="text-dim" /> : <ChevronDown size={15} className="text-dim" />}
                        </div>

                        <p className="campaign-event-desc">{event.description}</p>

                        {hasDeltas && (
                          <div className="campaign-event-deltas">
                            {Object.entries(deltas).map(([key, val]) => (
                              <span
                                key={key}
                                className={`campaign-delta-pill ${val >= 0 ? 'delta-positive' : 'delta-negative'}`}
                              >
                                {key.replace(/_/g, ' ')}: {val >= 0 ? '+' : ''}{typeof val === 'number' && Math.abs(val) > 10 ? `$${val.toLocaleString()}` : val}
                              </span>
                            ))}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="campaign-event-details">
                            {Object.keys(event.before_metrics || {}).length > 0 && (
                              <div className="campaign-detail-section">
                                <span className="text-dim text-xs font-bold">BEFORE:</span>
                                <div className="campaign-detail-metrics">
                                  {Object.entries(event.before_metrics).map(([k, v]) => (
                                    <span key={k} className="font-mono text-sm text-muted">
                                      {k.replace(/_/g, ' ')}: {typeof v === 'number' && v > 10 ? `$${v.toLocaleString()}` : v}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Object.keys(event.after_metrics || {}).length > 0 && (
                              <div className="campaign-detail-section">
                                <span className="text-dim text-xs font-bold">AFTER:</span>
                                <div className="campaign-detail-metrics">
                                  {Object.entries(event.after_metrics).map(([k, v]) => (
                                    <span key={k} className="font-mono text-sm text-main">
                                      {k.replace(/_/g, ' ')}: {typeof v === 'number' && v > 10 ? `$${v.toLocaleString()}` : String(v)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* A/B Test Designer */}
        <div className="campaign-ab-panel">
          <div className="ab-designer-card glass-panel">
            <div className="flex-row items-center gap-2 mb-3">
              <GitBranch size={18} className="text-rose" />
              <h3 className="card-heading">A/B Test Designer</h3>
            </div>
            <p className="text-muted text-sm mb-4">
              Split the customer population and compare Causal DML targeting (Group A)
              against Predictive ML targeting (Group B) with statistical significance testing.
            </p>

            <div className="ab-controls">
              <div className="form-group">
                <span className="form-label">Split Ratio (Causal %):</span>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={splitRatio * 100}
                  onChange={(e) => setSplitRatio(Number(e.target.value) / 100)}
                  className="range-slider"
                />
                <span className="font-mono text-cyan" style={{ minWidth: 65, textAlign: 'center' }}>
                  {(splitRatio * 100).toFixed(0)}% / {((1 - splitRatio) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="form-group mt-2">
                <span className="form-label">Budget:</span>
                <input
                  type="number"
                  value={abBudget}
                  onChange={(e) => setAbBudget(Number(e.target.value))}
                  className="search-input"
                  style={{ width: 130 }}
                  min={500}
                  max={100000}
                  step={500}
                />
              </div>
            </div>

            <button
              onClick={runABTest}
              disabled={isRunningAB}
              className="btn btn-primary w-full mt-4"
              style={{ justifyContent: 'center' }}
            >
              {isRunningAB ? (
                <>
                  <RefreshCw size={15} className="spin-anim" />
                  Running A/B Test...
                </>
              ) : (
                <>
                  <Play size={15} />
                  Run A/B Test
                </>
              )}
            </button>
          </div>

          {/* A/B Test Results */}
          {ab && (
            <div className="ab-results-card glass-panel mt-4">
              <div className="ab-results-header">
                <h4 className="card-heading">A/B Test Results</h4>
                <div className="flex-row items-center gap-2">
                  {testResults.is_significant ? (
                    <span className="badge-certified">
                      <CheckCircle2 size={14} />
                      SIGNIFICANT
                    </span>
                  ) : (
                    <span className="badge-warning">
                      <XCircle size={14} />
                      NOT SIGNIFICANT
                    </span>
                  )}
                </div>
              </div>

              {/* Winner Banner */}
              <div className="ab-winner-banner" style={{
                borderColor: testResults.winner === 'Causal DML' ? '#10b981' : '#f59e0b',
                background: testResults.winner === 'Causal DML'
                  ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              }}>
                <span className="font-bold text-main">Winner: {testResults.winner}</span>
                <span className="text-muted text-sm">
                  {testResults.significance_level} • z = {testResults.z_statistic}
                </span>
              </div>

              {/* Group comparison cards */}
              <div className="ab-groups-grid">
                <div className="ab-group-card" style={{ borderLeft: '3px solid #10b981' }}>
                  <div className="ab-group-label">
                    <span className="font-bold text-emerald">Group A: Causal DML</span>
                    <span className="text-dim text-xs font-mono">{ab.group_a.sample_size} customers</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">Profit:</span>
                    <span className="font-mono font-bold text-emerald">${ab.group_a.incremental_profit.toLocaleString()}</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">ROI:</span>
                    <span className="font-mono text-main">{ab.group_a.roi_percentage}%</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">Waste:</span>
                    <span className="font-mono text-rose">${ab.group_a.wasted_budget.toLocaleString()}</span>
                  </div>
                </div>

                <div className="ab-group-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                  <div className="ab-group-label">
                    <span className="font-bold text-amber">Group B: Predictive ML</span>
                    <span className="text-dim text-xs font-mono">{ab.group_b.sample_size} customers</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">Profit:</span>
                    <span className="font-mono font-bold text-amber">${ab.group_b.incremental_profit.toLocaleString()}</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">ROI:</span>
                    <span className="font-mono text-main">{ab.group_b.roi_percentage}%</span>
                  </div>
                  <div className="ab-group-metric">
                    <span className="text-muted">Waste:</span>
                    <span className="font-mono text-rose">${ab.group_b.wasted_budget.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Lift Summary */}
              <div className="ab-lift-summary">
                <div className="ab-lift-item">
                  <span className="text-muted text-sm">Profit Lift:</span>
                  <span className={`font-mono font-bold ${testResults.profit_lift >= 0 ? 'text-emerald' : 'text-rose'}`}>
                    {testResults.profit_lift >= 0 ? '+' : ''}${testResults.profit_lift?.toLocaleString()} ({testResults.profit_lift_pct}%)
                  </span>
                </div>
                <div className="ab-lift-item">
                  <span className="text-muted text-sm">ROI Lift:</span>
                  <span className={`font-mono font-bold ${testResults.roi_lift >= 0 ? 'text-emerald' : 'text-rose'}`}>
                    {testResults.roi_lift >= 0 ? '+' : ''}{testResults.roi_lift}%
                  </span>
                </div>
                <div className="ab-lift-item">
                  <span className="text-muted text-sm">Waste Reduction:</span>
                  <span className="font-mono font-bold text-cyan">
                    ${testResults.waste_reduction?.toLocaleString()}
                  </span>
                </div>
                <div className="ab-lift-item">
                  <span className="text-muted text-sm">P-value:</span>
                  <span className={`font-mono font-bold ${testResults.p_value < 0.05 ? 'text-emerald' : 'text-amber'}`}>
                    {testResults.p_value}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
