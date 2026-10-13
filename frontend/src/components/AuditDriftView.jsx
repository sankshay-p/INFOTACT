import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Activity, RefreshCw, Zap, CheckCircle2, XCircle, Info } from 'lucide-react';

export default function AuditDriftView({
  auditData,
  driftData,
  onSimulateDrift,
  onResetDrift,
  isDriftLoading
}) {
  const [selectedFeature, setSelectedFeature] = useState('income');
  const [shiftMagnitude, setShiftMagnitude] = useState(1.4);

  const refutations = auditData?.refutation_tests || [];
  const overallPassed = auditData?.overall_audit_passed;
  const originalEffect = auditData?.dowhy_original_effect;

  const driftFeatures = driftData?.feature_metrics || [];
  const driftOverall = driftData?.overall_status || 'STABLE';
  const maxPsi = driftData?.max_psi || 0;

  const handleSimulate = (e) => {
    e.preventDefault();
    onSimulateDrift({
      feature_to_shift: selectedFeature,
      shift_magnitude: Number(shiftMagnitude)
    });
  };

  return (
    <div className="tab-page-container">
      {/* 1. Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">MID-PROJECT & WEEK 4 • MATHEMATICAL AUDIT & MONITORING</span>
          <h2 className="section-title">DoWhy Causal Audit & Data Drift Detector</h2>
          <p className="section-desc">
            Empirical refutation tests mathematically certify unconfoundedness.
            Continuous covariate drift detection (KS-test & PSI) monitors shifts in customer behavior to trigger model recalibration.
          </p>
        </div>

        <div className="flex-row items-center gap-2">
          <span className={overallPassed ? 'badge-certified' : 'badge-warning'}>
            <ShieldCheck size={14} />
            {overallPassed ? 'DOWHY CERTIFIED CAUSAL' : 'AUDIT WARNING'}
          </span>
        </div>
      </div>

      {/* 2. DoWhy Refutation Tests Scorecard */}
      <div className="glass-panel p-5 mb-6">
        <div className="flex-row items-center justify-between mb-4">
          <div className="flex-row items-center gap-2">
            <ShieldCheck size={20} className="text-emerald" />
            <h3 className="card-heading">Microsoft DoWhy Refutation Audit Scorecard</h3>
          </div>
          <span className="font-mono text-xs text-muted">
            Original Backdoor CATE: <strong className="text-cyan">+{originalEffect}</strong> / $1 discount
          </span>
        </div>

        <div className="refutation-cards-grid">
          {refutations.map((test, idx) => (
            <div key={idx} className="refutation-card glass-panel">
              <div className="flex-row items-center justify-between mb-2">
                <h4 className="ref-test-title">{test.test_name}</h4>
                <span className={test.passed ? 'badge-certified' : 'badge-critical'}>
                  {test.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {test.status}
                </span>
              </div>

              <p className="ref-test-desc">{test.description}</p>

              <div className="ref-metric-comparison">
                <div className="ref-metric-box">
                  <span className="text-dim text-xs">Original Effect:</span>
                  <span className="font-mono text-sm text-main">+{test.original_effect}</span>
                </div>
                <div className="ref-metric-arrow">→</div>
                <div className="ref-metric-box">
                  <span className="text-dim text-xs">Refuted Effect:</span>
                  <span className="font-mono text-sm text-cyan">
                    {test.new_effect > 0 ? `+${test.new_effect}` : test.new_effect}
                  </span>
                </div>
              </div>

              <div className="ref-verdict-box">
                <span className="text-xs text-emerald font-semibold">Verification: </span>
                <span className="text-xs text-muted">{test.verdict}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Automated Data Drift Detector */}
      <div className="glass-panel p-5 mb-6">
        <div className="flex-row items-center justify-between mb-3">
          <div className="flex-row items-center gap-2">
            <Activity size={20} className="text-cyan" />
            <h3 className="card-heading">Continuous Covariate Drift Detector</h3>
          </div>

          <div className="flex-row items-center gap-2">
            <span
              className={
                driftOverall === 'CRITICAL_DRIFT'
                  ? 'badge-critical'
                  : driftOverall === 'MODERATE_SHIFT'
                  ? 'badge-warning'
                  : 'badge-certified'
              }
            >
              STATUS: {driftOverall}
            </span>
            <span className="badge-tag font-mono text-xs">
              MAX PSI: {maxPsi}
            </span>
          </div>
        </div>

        <div className="drift-recommendation-alert">
          <Info size={16} className="text-cyan" />
          <span className="text-xs text-main">{driftData?.recommendation}</span>
        </div>

        <div className="table-responsive mt-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>Confounder / Feature</th>
                <th>Baseline Mean</th>
                <th>Current Mean</th>
                <th>Shift %</th>
                <th>KS-Statistic</th>
                <th>KS p-value</th>
                <th>PSI Score</th>
                <th>Drift Verdict</th>
              </tr>
            </thead>
            <tbody>
              {driftFeatures.map((m, idx) => {
                const isCritical = m.status === 'CRITICAL DRIFT';
                const isMod = m.status === 'MODERATE SHIFT';

                return (
                  <tr key={idx} className={isCritical ? 'row-highlight-rose' : ''}>
                    <td className="font-semibold text-main">{m.feature.replace(/_/g, ' ')}</td>
                    <td className="font-mono text-muted">{m.baseline_mean.toLocaleString()}</td>
                    <td className="font-mono text-main">{m.current_mean.toLocaleString()}</td>
                    <td className={`font-mono ${Math.abs(m.mean_shift_pct) > 15 ? 'text-rose' : 'text-muted'}`}>
                      {m.mean_shift_pct > 0 ? `+${m.mean_shift_pct}%` : `${m.mean_shift_pct}%`}
                    </td>
                    <td className="font-mono text-dim">{m.ks_statistic}</td>
                    <td className={`font-mono ${m.p_value < 0.05 ? 'text-rose' : 'text-dim'}`}>
                      {m.p_value}
                    </td>
                    <td className={`font-mono font-bold ${m.psi_score >= 0.25 ? 'text-rose' : m.psi_score >= 0.1 ? 'text-amber' : 'text-emerald'}`}>
                      {m.psi_score}
                    </td>
                    <td>
                      <span
                        className={
                          isCritical
                            ? 'badge-critical'
                            : isMod
                            ? 'badge-warning'
                            : 'badge-certified'
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Interactive Drift Simulation Sandbox */}
      <div className="glass-panel p-5">
        <div className="flex-row items-center gap-2 mb-2">
          <Zap size={18} className="text-amber" />
          <h3 className="card-heading">Drift Stress-Test Sandbox</h3>
        </div>
        <p className="text-muted text-sm mb-4">
          Simulate macro-economic shocks (e.g. inflation spike shifting customer income, competitor price cut shifting loyalty)
          to observe automated drift alerts and recalibration triggers.
        </p>

        <form onSubmit={handleSimulate} className="drift-simulation-form">
          <div className="form-group">
            <label className="form-label">Feature to Shock:</label>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="select-input"
            >
              <option value="income">Customer Income ($)</option>
              <option value="browsing_minutes">Browsing Time (mins)</option>
              <option value="loyalty_score">Loyalty Score</option>
              <option value="days_since_last_purchase">Purchase Recency (days)</option>
              <option value="seasonality_index">Seasonality Index</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Shock Magnitude:</label>
            <select
              value={shiftMagnitude}
              onChange={(e) => setShiftMagnitude(e.target.value)}
              className="select-input"
            >
              <option value="1.5">1.5x Multiplier (Severe Shock)</option>
              <option value="1.25">1.25x Multiplier (Moderate Shift)</option>
              <option value="0.7">0.7x Multiplier (Contraction)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isDriftLoading}
            className="btn btn-primary btn-sm"
          >
            <Zap size={14} />
            <span>{isDriftLoading ? 'Injecting Shift...' : 'Inject Market Shock'}</span>
          </button>

          <button
            type="button"
            onClick={onResetDrift}
            disabled={isDriftLoading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} />
            <span>Reset Baseline</span>
          </button>
        </form>
      </div>
    </div>
  );
}
