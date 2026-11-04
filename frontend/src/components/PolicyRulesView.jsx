import React, { useState, useEffect } from 'react';
import {
  GitFork, Code2, Download, Copy, Check, Sliders, ShieldCheck,
  Sparkles, Layers, ArrowRight, CornerDownRight, CheckCircle2,
  FileCode, Terminal, FileJson, RefreshCw, Zap
} from 'lucide-react';

export default function PolicyRulesView({ apiBase, currentBudget }) {
  const [maxDepth, setMaxDepth] = useState(3);
  const [budget, setBudget] = useState(currentBudget || 5000);
  const [policyData, setPolicyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('sql');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPolicyTree();
  }, [maxDepth, budget]);

  const fetchPolicyTree = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/policy-tree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_depth: maxDepth,
          budget,
        }),
      });
      const data = await res.json();
      setPolicyData(data);
    } catch (err) {
      console.error('Failed to fetch policy tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const code = policyData?.code_exports?.[activeCodeTab] || '';
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const url = `${apiBase}/api/policy-tree/download?format=${activeCodeTab}&max_depth=${maxDepth}&budget=${budget}`;
    window.open(url, '_blank');
  };

  const flatRules = policyData?.flat_rules || [];
  const codeExports = policyData?.code_exports || {};
  const currentCode = codeExports[activeCodeTab] || '';

  // Helper to render tree node recursively
  const renderTreeNode = (node, path = '') => {
    if (!node) return null;

    if (node.type === 'leaf') {
      const isDiscount = node.discount > 0;
      return (
        <div className={`tree-leaf-card glass-panel ${isDiscount ? 'tree-leaf-target' : 'tree-leaf-suppress'}`}>
          <div className="flex-row justify-between items-center mb-2">
            <span
              className="badge-pill font-mono font-bold text-xs"
              style={{
                background: node.discount === 20 ? 'rgba(16,185,129,0.2)' : node.discount === 10 ? 'rgba(56,189,248,0.2)' : 'rgba(244,63,94,0.15)',
                color: node.color,
                border: `1px solid ${node.color}50`,
              }}
            >
              {node.discount > 0 ? `🎯 Offer $${node.discount} Discount` : '🛡️ Suppress Discount ($0)'}
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {node.samples?.toLocaleString()} users ({node.samples_pct}%)
            </span>
          </div>

          <div className="text-xs text-muted mb-2 font-medium">
            Dominant Archetype: <strong style={{ color: node.color }}>{node.dominant_archetype}</strong>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            {node.rationale}
          </p>

          <div className="tree-leaf-metrics-grid">
            <div className="tree-metric-mini">
              <span className="text-muted">Avg CATE Uplift:</span>
              <span className="font-mono font-bold text-emerald">{node.avg_uplift > 0 ? `+${(node.avg_uplift * 100).toFixed(1)}%` : '0.0%'}</span>
            </div>
            {node.incremental_profit > 0 && (
              <div className="tree-metric-mini">
                <span className="text-muted">Est. Profit Lift:</span>
                <span className="font-mono font-bold text-emerald">+${node.incremental_profit?.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Split Node
    return (
      <div className="tree-branch-container">
        <div className="tree-split-badge glass-panel">
          <div className="flex-row items-center gap-2">
            <GitFork size={14} className="text-cyan" />
            <span className="font-bold text-white text-xs">{node.feature_label}</span>
          </div>
          <span className="font-mono font-bold text-cyan text-xs">
            ≤ {node.threshold?.toLocaleString()}
          </span>
          <span className="text-muted text-[10px]">({node.samples?.toLocaleString()} users)</span>
        </div>

        <div className="tree-children-grid">
          {/* Left Branch (TRUE: <= threshold) */}
          <div className="tree-branch-arm">
            <div className="tree-arm-label text-emerald">
              <CornerDownRight size={12} style={{ display: 'inline', marginRight: 4 }} />
              TRUE (≤ {node.threshold})
            </div>
            {renderTreeNode(node.left, `${path}L`)}
          </div>

          {/* Right Branch (FALSE: > threshold) */}
          <div className="tree-branch-arm">
            <div className="tree-arm-label text-rose">
              <CornerDownRight size={12} style={{ display: 'inline', marginRight: 4 }} />
              FALSE (&gt; {node.threshold})
            </div>
            {renderTreeNode(node.right, `${path}R`)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">EXPLAINABLE CAUSAL AI • WHITE-BOX BUSINESS RULES</span>
          <h2 className="section-title">Causal Policy Trees & Rule Exporter Studio</h2>
          <p className="section-desc">
            Translate complex continuous Double ML counterfactual estimations into transparent, human-auditable
            IF-THEN-ELSE decision trees. Instantly export executable business logic in SQL, Python, or JSON for CRM and data warehouse deployment.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Tree Complexity</span>
            <Sliders size={15} className="text-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mb-1">Depth {maxDepth}</div>
          <span className="text-xs text-muted">{policyData?.total_rules || 0} Distinct Decision Leaves</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Policy Agreement</span>
            <CheckCircle2 size={15} className="text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald mb-1">
            {policyData?.policy_agreement_pct || 0}%
          </div>
          <span className="text-xs text-muted">Fidelity with Full Continuous DML</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Profit Capture</span>
            <Sparkles size={15} className="text-amber" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber mb-1">
            {policyData?.profit_capture_pct || 0}%
          </div>
          <span className="text-xs text-muted">Incremental Margin vs Unconstrained Solver</span>
        </div>

        <div className="metric-box glass-panel p-4">
          <div className="flex-row justify-between items-center mb-1">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Explainability Audit</span>
            <ShieldCheck size={15} className="text-violet" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet mb-1">100% White-Box</div>
          <span className="text-xs text-muted">Zero Black-Box Dependency</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="glass-panel p-4 mb-6 flex-row justify-between items-center">
        <div className="flex-row items-center gap-4">
          <span className="text-xs font-bold text-muted uppercase">Select Model Complexity:</span>
          <div className="flex-row gap-2">
            {[2, 3, 4].map((d) => (
              <button
                key={d}
                onClick={() => setMaxDepth(d)}
                className={`btn btn-sm ${maxDepth === d ? 'btn-primary' : 'btn-secondary'}`}
              >
                Depth {d} ({Math.pow(2, d)} Rules)
              </button>
            ))}
          </div>
        </div>

        <div className="flex-row items-center gap-3">
          <span className="text-xs text-muted">Optimization Budget:</span>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="search-input text-xs"
            style={{ width: 120 }}
            step={500}
            min={500}
            max={100000}
          />
        </div>
      </div>

      {/* Visual Policy Tree Flowchart */}
      <div className="policy-tree-container glass-panel p-6 mb-6">
        <div className="flex-row justify-between items-center mb-5 pb-3 border-b border-slate-700/50">
          <div className="flex-row items-center gap-2">
            <GitFork size={18} className="text-cyan" />
            <h3 className="card-heading">Visual Causal Policy Hierarchy</h3>
          </div>
          <span className="badge-pill bg-cyan-subtle text-cyan text-xs font-bold">
            {policyData?.total_rules || 0} AUDITABLE BRANCHES
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted">
            <RefreshCw size={20} className="spin-anim mr-2" />
            Fitting Causal Policy Tree on DML Counterfactuals...
          </div>
        ) : (
          <div className="tree-scroll-wrapper">
            {renderTreeNode(policyData?.tree_hierarchy)}
          </div>
        )}
      </div>

      {/* Flat Rules Summary Table */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex-row justify-between items-center mb-4">
          <div className="flex-row items-center gap-2">
            <Layers size={18} className="text-emerald" />
            <h3 className="card-heading">Extracted Human-Auditable Decision Rules</h3>
          </div>
          <span className="text-xs text-muted font-mono">{flatRules.length} Executable Rules</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Logical Criteria (IF)</th>
                <th>Prescribed Action (THEN)</th>
                <th>Audience Share</th>
                <th>Dominant Archetype</th>
                <th>Expected Profit Lift</th>
              </tr>
            </thead>
            <tbody>
              {flatRules.map((r, idx) => (
                <tr key={idx}>
                  <td className="font-mono font-bold text-cyan text-xs">{r.rule_id}</td>
                  <td className="font-mono text-xs text-slate-300">
                    {r.conditions.length > 0 ? r.conditions.join(' AND ') : 'ALL CUSTOMERS'}
                  </td>
                  <td>
                    <span
                      className="badge-pill font-mono font-bold text-xs"
                      style={{
                        background: r.discount === 20 ? 'rgba(16,185,129,0.18)' : r.discount === 10 ? 'rgba(56,189,248,0.18)' : 'rgba(244,63,94,0.15)',
                        color: r.color,
                      }}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="font-mono font-semibold text-xs">
                    {r.samples?.toLocaleString()} <span className="text-muted">({r.samples_pct}%)</span>
                  </td>
                  <td className="font-semibold text-xs" style={{ color: r.color }}>
                    {r.dominant_archetype}
                  </td>
                  <td className="font-mono font-bold text-emerald text-xs">
                    {r.incremental_profit > 0 ? `+$${r.incremental_profit?.toLocaleString()}` : '$0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Rule Exporter Studio */}
      <div className="glass-panel p-6">
        <div className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-700/50">
          <div className="flex-row items-center gap-2">
            <Code2 size={18} className="text-violet" />
            <h3 className="card-heading">Production Rule Exporter Studio</h3>
          </div>

          <div className="flex-row items-center gap-3">
            {/* Tabs */}
            <div className="flex-row bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
              <button
                onClick={() => setActiveCodeTab('sql')}
                className={`tab-toggle-btn ${activeCodeTab === 'sql' ? 'active' : ''}`}
              >
                <Terminal size={13} />
                <span>SQL (Snowflake / BigQuery)</span>
              </button>
              <button
                onClick={() => setActiveCodeTab('python')}
                className={`tab-toggle-btn ${activeCodeTab === 'python' ? 'active' : ''}`}
              >
                <FileCode size={13} />
                <span>Python Function</span>
              </button>
              <button
                onClick={() => setActiveCodeTab('json')}
                className={`tab-toggle-btn ${activeCodeTab === 'json' ? 'active' : ''}`}
              >
                <FileJson size={13} />
                <span>JSONLogic</span>
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={handleCopy}
              className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
            >
              {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="btn btn-primary btn-sm flex items-center gap-1 text-xs"
            >
              <Download size={13} />
              <span>Download File</span>
            </button>
          </div>
        </div>

        <div className="code-viewer-container glass-panel p-4 font-mono text-xs overflow-auto max-h-[450px]">
          <pre className="text-cyan-300 leading-relaxed">
            {currentCode || 'Compiling executable rule output...'}
          </pre>
        </div>
        <p className="text-xs text-muted mt-3">
          * This code evaluates raw customer covariates in zero-dependency native SQL / Python without needing the original ML model or DML weights in production.
        </p>
      </div>
    </div>
  );
}
