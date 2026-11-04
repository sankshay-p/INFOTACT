import React, { useState, useEffect } from 'react';
import Plot from './PlotComponent';
import { Search, User, Target, ShieldCheck, AlertTriangle, Crosshair, ArrowRight, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

const ARCHETYPE_STYLES = {
  'Persuadable': { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.4)', badge: 'badge-persuadable' },
  'Sure Thing': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.4)', badge: 'badge-sure-thing' },
  'Lost Cause': { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)', badge: 'badge-lost-cause' },
  'Sleeping Dog': { bg: 'rgba(244,63,94,0.15)', color: '#fb7185', border: 'rgba(251,113,133,0.4)', badge: 'badge-sleeping-dog' },
};

export default function CustomerProfilerView({ apiBase }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [archetypeFilter, setArchetypeFilter] = useState('all');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showInfluence, setShowInfluence] = useState(false);

  useEffect(() => {
    handleSearch();
  }, [archetypeFilter]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const res = await fetch(`${apiBase}/api/customer-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery || null,
          archetype_filter: archetypeFilter,
          sort_by: 'pred_ite_20',
          sort_desc: true,
          limit: 50,
        }),
      });
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const loadProfile = async (customerId) => {
    setIsLoadingProfile(true);
    try {
      const res = await fetch(`${apiBase}/api/customer-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json();
      setSelectedProfile(data);
    } catch (err) {
      console.error('Profile load failed:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const archDist = searchResults?.archetype_distribution || {};
  const profile = selectedProfile;
  const waterfall = profile?.counterfactual_waterfall || [];
  const influence = profile?.confounder_influence || [];

  // Waterfall chart data
  const waterfallChartData = waterfall.length > 0 ? [
    {
      x: waterfall.map((w) => w.stage),
      y: waterfall.map((w) => w.expected_profit),
      type: 'bar',
      marker: {
        color: waterfall.map((w) => w.is_optimal ? '#10b981' : w.color),
        opacity: waterfall.map((w) => w.is_optimal ? 1.0 : 0.65),
        line: {
          color: waterfall.map((w) => w.is_optimal ? '#34d399' : 'transparent'),
          width: waterfall.map((w) => w.is_optimal ? 2 : 0),
        },
      },
      text: waterfall.map((w) =>
        `$${w.expected_profit.toFixed(2)}${w.is_optimal ? ' ★ OPTIMAL' : ''}`
      ),
      textposition: 'outside',
      textfont: { color: '#f8fafc', size: 12 },
      hovertemplate: '%{x}<br>Expected Profit: $%{y:.2f}<br>Conversion: %{customdata}%<extra></extra>',
      customdata: waterfall.map((w) => w.conversion_prob),
    },
  ] : [];

  // Feature contribution chart
  const contributionData = influence.length > 0 ? [
    {
      type: 'bar',
      orientation: 'h',
      y: influence.map((c) => c.feature),
      x: influence.map((c) => c.contribution_to_ite),
      marker: {
        color: influence.map((c) => c.contribution_to_ite >= 0 ? '#10b981' : '#f43f5e'),
        opacity: 0.85,
      },
      hovertemplate: '%{y}: %{x:.5f}<extra></extra>',
    },
  ] : [];

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">CUSTOMER INTELLIGENCE • 360° CAUSAL PROFILER</span>
          <h2 className="section-title">Customer Deep-Dive Profiler</h2>
          <p className="section-desc">
            Search any customer to view their full causal profile: individual DAG influence path,
            counterfactual waterfall analysis, archetype classification with confidence, and personalized
            promotional recommendation.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="profiler-search-card glass-panel">
        <div className="profiler-search-bar">
          <div className="search-box" style={{ width: 280 }}>
            <Search size={15} className="search-icon text-muted" />
            <input
              type="text"
              placeholder="Search by Customer ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">Archetype:</span>
            <select
              value={archetypeFilter}
              onChange={(e) => setArchetypeFilter(e.target.value)}
              className="select-input"
            >
              <option value="all">All Archetypes</option>
              <option value="Persuadable">Persuadable</option>
              <option value="Sure Thing">Sure Thing</option>
              <option value="Lost Cause">Lost Cause</option>
              <option value="Sleeping Dog">Sleeping Dog</option>
            </select>
          </div>

          <button onClick={handleSearch} className="btn btn-primary btn-sm" disabled={isSearching}>
            <Search size={14} />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Archetype distribution pills */}
        <div className="archetype-dist-bar">
          {Object.entries(archDist).map(([arch, count]) => {
            const style = ARCHETYPE_STYLES[arch] || {};
            return (
              <button
                key={arch}
                onClick={() => setArchetypeFilter(arch)}
                className={`archetype-dist-pill ${archetypeFilter === arch ? 'active' : ''}`}
                style={{
                  background: style.bg,
                  color: style.color,
                  borderColor: archetypeFilter === arch ? style.color : 'transparent',
                }}
              >
                {arch}: {count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profiler-layout">
        {/* Customer List */}
        <div className="profiler-list-panel glass-panel">
          <div className="profiler-list-header">
            <h4 className="card-heading">Customer List</h4>
            <span className="text-dim text-sm font-mono">
              {searchResults?.total_results || 0} results
            </span>
          </div>
          <div className="profiler-list-scroll">
            {(searchResults?.results || []).map((cust) => {
              const archStyle = ARCHETYPE_STYLES[cust.archetype] || {};
              const isActive = profile?.customer_id === cust.customer_id;
              return (
                <button
                  key={cust.customer_id}
                  onClick={() => loadProfile(cust.customer_id)}
                  className={`profiler-list-item ${isActive ? 'profiler-list-active' : ''}`}
                >
                  <div className="profiler-list-item-top">
                    <span className="font-mono font-bold text-main">#{cust.customer_id}</span>
                    <span className={`badge-archetype ${archStyle.badge}`}>{cust.archetype}</span>
                  </div>
                  <div className="profiler-list-item-meta">
                    <span>Uplift: <strong className="text-emerald">{cust.uplift_20}%</strong></span>
                    <span>Base: <strong>{cust.baseline_prob}%</strong></span>
                    <span>Income: <strong>${cust.income.toLocaleString()}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile Detail Panel */}
        <div className="profiler-detail-panel">
          {isLoadingProfile ? (
            <div className="profiler-loading glass-panel">
              <div className="loading-spinner" />
              <p className="text-muted">Loading causal profile...</p>
            </div>
          ) : profile && !profile.error ? (
            <>
              {/* Profile Header Card */}
              <div className="profile-header-card glass-panel" style={{ borderLeft: `4px solid ${profile.action_color}` }}>
                <div className="profile-header-top">
                  <div>
                    <div className="flex-row items-center gap-2">
                      <User size={20} className="text-cyan" />
                      <h3 className="card-heading">Customer #{profile.customer_id}</h3>
                    </div>
                    <div className="flex-row items-center gap-2 mt-2">
                      <span className={`badge-archetype ${ARCHETYPE_STYLES[profile.archetype]?.badge}`}>
                        {profile.archetype}
                      </span>
                      <span className="profiler-confidence-badge">
                        {profile.archetype_confidence}% Confidence
                      </span>
                    </div>
                  </div>
                  <div className="profile-optimal-discount">
                    <span className="text-dim text-xs">OPTIMAL DISCOUNT</span>
                    <span className={`profile-discount-value ${profile.optimal_discount > 0 ? 'text-emerald' : 'text-muted'}`}>
                      ${profile.optimal_discount}
                    </span>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="profile-recommendation-box" style={{ borderColor: profile.action_color }}>
                  <Target size={16} style={{ color: profile.action_color, flexShrink: 0 }} />
                  <p>{profile.recommendation}</p>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="profile-metrics-grid">
                <div className="profile-metric-card glass-panel">
                  <span className="text-dim text-xs">BASELINE CONVERSION</span>
                  <span className="profile-metric-value text-amber">{profile.baseline_probability}%</span>
                  <span className="text-dim text-xs font-mono">P(Y₀)</span>
                </div>
                <div className="profile-metric-card glass-panel">
                  <span className="text-dim text-xs">CAUSAL UPLIFT ($10)</span>
                  <span className={`profile-metric-value ${profile.causal_uplift_10 >= 0 ? 'text-cyan' : 'text-rose'}`}>
                    {profile.causal_uplift_10 >= 0 ? '+' : ''}{profile.causal_uplift_10}%
                  </span>
                  <span className="text-dim text-xs font-mono">τ₁₀</span>
                </div>
                <div className="profile-metric-card glass-panel">
                  <span className="text-dim text-xs">CAUSAL UPLIFT ($20)</span>
                  <span className={`profile-metric-value ${profile.causal_uplift_20 >= 0 ? 'text-emerald' : 'text-rose'}`}>
                    {profile.causal_uplift_20 >= 0 ? '+' : ''}{profile.causal_uplift_20}%
                  </span>
                  <span className="text-dim text-xs font-mono">τ₂₀</span>
                </div>
                <div className="profile-metric-card glass-panel">
                  <span className="text-dim text-xs">PRED. ML SCORE</span>
                  <span className="profile-metric-value text-violet">{profile.predictive_ml_score}%</span>
                  <span className="text-dim text-xs font-mono">P̂(Y=1)</span>
                </div>
              </div>

              {/* Counterfactual Waterfall */}
              <div className="chart-panel glass-panel mt-4">
                <h4 className="chart-title">
                  <BarChart3 size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                  Counterfactual Waterfall: Expected Profit by Discount Tier
                </h4>
                <p className="text-muted text-sm mb-3">
                  "Would this customer buy IF AND ONLY IF we gave them the discount?"
                </p>
                {waterfallChartData.length > 0 && (
                  <Plot
                    data={waterfallChartData}
                    layout={{
                      autosize: true,
                      height: 280,
                      margin: { l: 50, r: 30, t: 30, b: 50 },
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
                      xaxis: {
                        gridcolor: 'rgba(255,255,255,0.05)',
                        tickfont: { color: '#f8fafc', size: 12 },
                      },
                      yaxis: {
                        title: { text: 'Expected Profit ($)', font: { size: 12, color: '#94a3b8' } },
                        gridcolor: 'rgba(255,255,255,0.06)',
                      },
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%' }}
                    config={{ responsive: true, displayModeBar: false }}
                  />
                )}

                {/* Waterfall detail cards */}
                <div className="cf-branches-grid">
                  {waterfall.map((w, idx) => (
                    <div key={idx} className={`cf-branch-card ${w.is_optimal ? 'optimal' : ''}`}>
                      <div className="flex-row items-center justify-between mb-2">
                        <span className="font-bold text-main">{w.stage}</span>
                        {w.is_optimal && (
                          <span className="badge-pill bg-emerald-subtle text-emerald font-bold" style={{ fontSize: '0.68rem' }}>
                            ★ OPTIMAL
                          </span>
                        )}
                      </div>
                      <div className="cf-metric-row">
                        <span className="text-muted">Conversion:</span>
                        <span className="font-mono text-main">{w.conversion_prob}%</span>
                      </div>
                      <div className="cf-metric-row">
                        <span className="text-muted">Exp. Profit:</span>
                        <span className="font-mono text-cyan">${w.expected_profit}</span>
                      </div>
                      {w.causal_uplift_pct !== undefined && (
                        <div className="cf-metric-row">
                          <span className="text-muted">Causal Uplift:</span>
                          <span className={`font-mono ${w.causal_uplift_pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                            {w.causal_uplift_pct >= 0 ? '+' : ''}{w.causal_uplift_pct}%
                          </span>
                        </div>
                      )}
                      <div className="cf-metric-row">
                        <span className="text-muted">Net Inc. Gain:</span>
                        <span className={`font-mono font-bold ${w.incremental_gain >= 0 ? 'text-emerald' : 'text-rose'}`}>
                          {w.incremental_gain >= 0 ? '+' : ''}${w.incremental_gain}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confounder Influence Analysis */}
              <div className="chart-panel glass-panel mt-4">
                <div
                  className="flex-row items-center justify-between cursor-pointer"
                  onClick={() => setShowInfluence(!showInfluence)}
                >
                  <h4 className="chart-title">
                    <Crosshair size={16} className="text-violet" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                    DAG Confounder Influence on Treatment Effect
                  </h4>
                  {showInfluence ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                </div>

                {showInfluence && (
                  <>
                    <p className="text-muted text-sm mt-1 mb-3">
                      Shows how each confounder in the DAG influenced this customer's Individual Treatment Effect (ITE).
                    </p>
                    {contributionData.length > 0 && (
                      <Plot
                        data={contributionData}
                        layout={{
                          autosize: true,
                          height: 250,
                          margin: { l: 160, r: 30, t: 10, b: 30 },
                          paper_bgcolor: 'transparent',
                          plot_bgcolor: 'transparent',
                          font: { family: 'Plus Jakarta Sans', color: '#94a3b8' },
                          xaxis: {
                            title: { text: 'Contribution to ITE', font: { size: 12, color: '#94a3b8' } },
                            gridcolor: 'rgba(255,255,255,0.06)',
                            zerolinecolor: 'rgba(255,255,255,0.15)',
                          },
                          yaxis: {
                            autorange: 'reversed',
                            tickfont: { color: '#f8fafc', size: 11 },
                          },
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%' }}
                        config={{ responsive: true, displayModeBar: false }}
                      />
                    )}

                    {/* Feature detail table */}
                    <div className="table-responsive mt-3">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Feature</th>
                            <th>Value</th>
                            <th>Percentile</th>
                            <th>DML Coef.</th>
                            <th>Contribution</th>
                            <th>Direction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {influence.map((f, idx) => (
                            <tr key={idx}>
                              <td className="font-semibold">{f.feature}</td>
                              <td className="font-mono">{f.value}</td>
                              <td className="font-mono text-dim">
                                {profile.percentile_ranks?.[f.feature] || '—'}%
                              </td>
                              <td className="font-mono text-cyan">{f.dml_coefficient}</td>
                              <td className={`font-mono font-bold ${f.contribution_to_ite >= 0 ? 'text-emerald' : 'text-rose'}`}>
                                {f.contribution_to_ite >= 0 ? '+' : ''}{f.contribution_to_ite}
                              </td>
                              <td>
                                <span className={`badge-pill ${f.contribution_to_ite >= 0 ? 'bg-emerald-subtle text-emerald' : ''}`}
                                  style={f.contribution_to_ite < 0 ? { background: 'rgba(244,63,94,0.15)', color: '#fb7185' } : {}}
                                >
                                  {f.direction}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Customer Feature Card */}
              <div className="profile-features-card glass-panel mt-4">
                <h4 className="card-heading mb-3">Customer Attributes & Percentile Ranks</h4>
                <div className="profile-features-grid">
                  {Object.entries(profile.features || {}).map(([key, val]) => {
                    const pct = profile.percentile_ranks?.[key] || 0;
                    return (
                      <div key={key} className="profile-feature-item">
                        <div className="flex-row items-center justify-between">
                          <span className="text-muted text-sm">{key}</span>
                          <span className="font-mono font-bold text-main">{typeof val === 'number' && val > 1000 ? `$${val.toLocaleString()}` : val}</span>
                        </div>
                        <div className="profile-pct-bar">
                          <div className="profile-pct-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-dim text-xs font-mono">{pct}th percentile</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="profiler-empty-state glass-panel">
              <User size={48} className="text-dim" />
              <h3 className="text-muted mt-3">Select a Customer</h3>
              <p className="text-dim text-sm mt-1">
                Click on a customer from the list to view their full 360° causal profile,
                counterfactual waterfall, and personalized recommendation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
