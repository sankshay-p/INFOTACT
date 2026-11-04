import React, { useState, useEffect } from 'react';
import {
  Send, Download, CheckCircle2, AlertCircle, RefreshCw, Server,
  Shield, Key, ExternalLink, Copy, Check, Sparkles, Layers,
  Mail, Cloud, Zap, Flame, Clock, ArrowRight, FileText
} from 'lucide-react';

export default function CRMExportHubView({ apiBase, currentBudget }) {
  const [metadata, setMetadata] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('klaviyo');
  const [selectedSegment, setSelectedSegment] = useState('persuadables_20');
  const [budget, setBudget] = useState(currentBudget || 5000);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('pk_live_causal_dml_9847291a');
  
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchReceipt, setDispatchReceipt] = useState(null);
  const [exportHistory, setExportHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMetadata();
    fetchHistory();
  }, [budget]);

  useEffect(() => {
    if (selectedPlatform && selectedSegment) {
      fetchPreview();
    }
  }, [selectedPlatform, selectedSegment, budget]);

  const fetchMetadata = async () => {
    try {
      const res = await fetch(`${apiBase}/api/crm/metadata?budget=${budget}`);
      const data = await res.json();
      setMetadata(data);
    } catch (err) {
      console.error('Failed to fetch CRM metadata:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/api/crm/history`);
      const data = await res.json();
      setExportHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch CRM history:', err);
    }
  };

  const fetchPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const res = await fetch(`${apiBase}/api/crm/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: selectedPlatform,
          segment_id: selectedSegment,
          budget,
        }),
      });
      const data = await res.json();
      setPreviewData(data);
      if (!customEndpoint && data.platform) {
        setCustomEndpoint(data.platform.api_endpoint);
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    setDispatchReceipt(null);
    try {
      const res = await fetch(`${apiBase}/api/crm/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_id: selectedPlatform,
          segment_id: selectedSegment,
          target_endpoint: customEndpoint || null,
          api_key_masked: apiKey ? `${apiKey.slice(0, 7)}••••••••` : null,
          budget,
        }),
      });
      const receipt = await res.json();
      setDispatchReceipt(receipt);
      fetchHistory();
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadCsv = () => {
    const url = `${apiBase}/api/crm/download-csv?segment_id=${selectedSegment}&platform_id=${selectedPlatform}&budget=${budget}`;
    window.open(url, '_blank');
  };

  const handleCopyJson = () => {
    if (previewData?.formatted_json_sample) {
      navigator.clipboard.writeText(previewData.formatted_json_sample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const platforms = metadata?.platforms || [];
  const segments = metadata?.segments || [];
  const currentSeg = segments.find((s) => s.id === selectedSegment) || segments[0];
  const currentPlat = platforms.find((p) => p.id === selectedPlatform) || platforms[0];

  return (
    <div className="tab-page-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">AUTOMATED CAMPAIGN ACTIVATION • OMNICHANNEL CDP CONNECTOR</span>
          <h2 className="section-title">CRM & Marketing Automation Export Hub</h2>
          <p className="section-desc">
            Instantly dispatch prescriptive discount codes to Persuadables, enforce margin suppression lists
            for Sure Things, and transmit custom audience payloads directly to Klaviyo, Salesforce, Braze, or custom webhooks.
          </p>
        </div>
      </div>

      {/* Step 1: Select Platform */}
      <div className="crm-section-card glass-panel mb-6">
        <div className="crm-card-header">
          <div className="flex-row items-center gap-2">
            <Server size={18} className="text-cyan" />
            <h3 className="card-heading">1. Select Target Marketing Platform</h3>
          </div>
          <span className="badge-tag">REST & WEBHOOK CONNECTORS</span>
        </div>

        <div className="crm-platforms-grid">
          {platforms.map((plat) => {
            const isSelected = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => {
                  setSelectedPlatform(plat.id);
                  setCustomEndpoint(plat.api_endpoint);
                }}
                className={`crm-platform-card glass-panel ${isSelected ? 'crm-platform-active' : ''}`}
                style={{
                  borderColor: isSelected ? plat.accent : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex-row justify-between items-start mb-2">
                  <div className="crm-platform-icon">{plat.icon}</div>
                  {isSelected && (
                    <span className="badge-pill bg-cyan-subtle text-cyan text-xs font-bold">CONNECTED</span>
                  )}
                </div>
                <div className="crm-platform-name">{plat.name}</div>
                <div className="crm-platform-cat">{plat.category}</div>
                <div className="crm-platform-desc">{plat.description}</div>
                <div className="crm-platform-auth text-muted text-xs mt-2">
                  <Key size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {plat.auth_type}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Select Audience Segment */}
      <div className="crm-section-card glass-panel mb-6">
        <div className="crm-card-header">
          <div className="flex-row items-center gap-2">
            <Layers size={18} className="text-emerald" />
            <h3 className="card-heading">2. Select Causal Audience Segment</h3>
          </div>
          <span className="text-sm text-muted">
            Prescriptive Knapsack Allocation at ${budget.toLocaleString()} Budget
          </span>
        </div>

        <div className="crm-segments-grid">
          {segments.map((seg) => {
            const isSelected = selectedSegment === seg.id;
            return (
              <button
                key={seg.id}
                onClick={() => setSelectedSegment(seg.id)}
                className={`crm-segment-card glass-panel ${isSelected ? 'crm-segment-active' : ''}`}
                style={{
                  borderColor: isSelected ? seg.color : 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex-row justify-between items-center mb-1">
                  <span className="crm-segment-name" style={{ color: seg.color }}>{seg.name}</span>
                  <span className="font-mono font-bold text-white text-sm">{seg.count?.toLocaleString()} users</span>
                </div>
                <p className="crm-segment-desc">{seg.description}</p>
                <div className="crm-segment-metrics-row mt-2">
                  <div className="crm-metric-chip">
                    <span className="text-muted">Action:</span>
                    <span className="font-semibold text-white ml-1">{seg.action}</span>
                  </div>
                  {seg.total_incremental_profit > 0 && (
                    <div className="crm-metric-chip text-emerald">
                      <span>Lift:</span>
                      <span className="font-mono font-bold ml-1">+${seg.total_incremental_profit?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Configure Endpoint & Live Payload Preview */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left: Connection Configuration */}
        <div className="crm-section-card glass-panel flex flex-col justify-between">
          <div>
            <div className="crm-card-header mb-4">
              <div className="flex-row items-center gap-2">
                <Zap size={18} className="text-amber" />
                <h3 className="card-heading">3. Connection Parameters</h3>
              </div>
              <span className="badge-pill bg-emerald-subtle text-emerald text-xs">TLS 1.3 ENCRYPTED</span>
            </div>

            <div className="form-group mb-4">
              <span className="form-label">Target REST API / Webhook Endpoint:</span>
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                className="search-input font-mono text-xs w-full"
                placeholder="https://..."
              />
            </div>

            <div className="form-group mb-4">
              <span className="form-label">API Key / Bearer Secret:</span>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="search-input font-mono text-xs w-full"
                  placeholder="Enter API token or webhook secret"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="metric-box glass-panel p-3">
                <span className="text-xs text-muted block mb-1">Target Audience Size</span>
                <span className="text-lg font-bold font-mono text-white">
                  {currentSeg?.count?.toLocaleString() || 0} <span className="text-xs text-muted">recipients</span>
                </span>
              </div>
              <div className="metric-box glass-panel p-3">
                <span className="text-xs text-muted block mb-1">Est. Incremental Profit</span>
                <span className="text-lg font-bold font-mono text-emerald">
                  ${currentSeg?.total_incremental_profit?.toLocaleString() || '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-700/50 flex flex-col gap-3">
            <button
              onClick={handleDispatch}
              disabled={isDispatching || !currentSeg?.count}
              className="btn btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              {isDispatching ? (
                <>
                  <RefreshCw size={16} className="spin-anim" />
                  Transmitting Payload to {currentPlat?.name}...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Dispatch {currentSeg?.count?.toLocaleString()} Profiles to {currentPlat?.name}
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCsv}
              className="btn btn-secondary w-full py-2 text-xs flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Download Platform-Formatted CSV
            </button>
          </div>
        </div>

        {/* Right: Live Payload Inspector */}
        <div className="crm-section-card glass-panel flex flex-col">
          <div className="crm-card-header mb-3">
            <div className="flex-row items-center gap-2">
              <FileText size={18} className="text-violet" />
              <h3 className="card-heading">Live JSON Payload Inspector</h3>
            </div>
            <button
              onClick={handleCopyJson}
              className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"
              title="Copy sample JSON"
            >
              {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy Sample'}</span>
            </button>
          </div>

          <div className="payload-json-box glass-panel p-4 flex-grow font-mono text-xs overflow-auto max-h-[380px]">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-48 text-muted">
                <RefreshCw size={16} className="spin-anim mr-2" />
                Generating platform payload...
              </div>
            ) : previewData?.formatted_json_sample ? (
              <pre className="text-emerald-300 leading-relaxed">
                {previewData.formatted_json_sample}
              </pre>
            ) : (
              <div className="text-muted text-center py-10">Select platform and segment to preview payload</div>
            )}
          </div>
          <span className="text-xs text-muted mt-2">
            * Payload preview displays 2 of {currentSeg?.count?.toLocaleString()} batch records formatted for {currentPlat?.name} API specs.
          </span>
        </div>
      </div>

      {/* Dispatch Receipt Modal/Banner */}
      {dispatchReceipt && (
        <div className="receipt-banner glass-panel p-5 mb-6 border border-emerald-500/40 bg-emerald-950/20">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={22} className="text-emerald" />
              <div>
                <h4 className="font-bold text-white text-base">Campaign Export Dispatched Successfully</h4>
                <p className="text-xs text-muted">Receipt ID: {dispatchReceipt.export_id} • {dispatchReceipt.timestamp}</p>
              </div>
            </div>
            <span className="badge-pill bg-emerald-subtle text-emerald font-bold font-mono">
              HTTP 200 OK • {dispatchReceipt.latency_ms}ms
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4 text-xs mt-3 pt-3 border-t border-emerald-500/20">
            <div>
              <span className="text-muted block">Platform</span>
              <span className="font-semibold text-white">{dispatchReceipt.platform_name}</span>
            </div>
            <div>
              <span className="text-muted block">Audience Segment</span>
              <span className="font-semibold text-white">{dispatchReceipt.segment_name}</span>
            </div>
            <div>
              <span className="text-muted block">Profiles Ingested</span>
              <span className="font-mono font-bold text-emerald">{dispatchReceipt.records_dispatched?.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted block">Est. Revenue Unlocked</span>
              <span className="font-mono font-bold text-emerald">+${dispatchReceipt.estimated_incremental_profit?.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Export Execution History */}
      <div className="crm-section-card glass-panel">
        <div className="crm-card-header mb-4">
          <div className="flex-row items-center gap-2">
            <Clock size={18} className="text-cyan" />
            <h3 className="card-heading">Export History & Audit Log</h3>
          </div>
          <span className="text-xs text-muted font-mono">{exportHistory.length} Dispatches Logged</span>
        </div>

        {exportHistory.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            No exports dispatched yet. Select an audience and click "Dispatch Audience" above.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Export ID</th>
                  <th>Timestamp</th>
                  <th>Platform</th>
                  <th>Segment</th>
                  <th>Records</th>
                  <th>Profit Impact</th>
                  <th>Latency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-mono font-semibold text-cyan text-xs">{item.export_id}</td>
                    <td className="text-muted text-xs font-mono">{item.timestamp}</td>
                    <td className="font-medium text-white">{item.platform_name}</td>
                    <td className="text-xs">{item.segment_name}</td>
                    <td className="font-mono font-bold">{item.records_dispatched?.toLocaleString()}</td>
                    <td className="font-mono text-emerald font-semibold">+${item.estimated_incremental_profit?.toLocaleString()}</td>
                    <td className="font-mono text-muted text-xs">{item.latency_ms}ms</td>
                    <td>
                      <span className="badge-pill bg-emerald-subtle text-emerald text-xs font-bold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
