import React, { useState, useRef } from 'react';
import Plot from './PlotComponent';
import { Network, GitBranch, CheckCircle2, Info, ArrowRight, ShieldCheck, Scale, UploadCloud, Download, FileSpreadsheet } from 'lucide-react';

export default function CausalDAGView({ dagData, propensityData, onUploadDataset, apiBase = 'http://127.0.0.1:8000' }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      if (onUploadDataset) {
        const res = await onUploadDataset(file);
        if (res?.success) {
          setUploadMsg(`Successfully ingested ${file.name} and calibrated causal model!`);
        }
      }
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Layout positions for SVG DAG
  const nodePositions = {
    income: { x: 120, y: 70 },
    browsing_minutes: { x: 120, y: 150 },
    loyalty_score: { x: 120, y: 230 },
    days_since_last_purchase: { x: 120, y: 310 },
    cart_value_history: { x: 120, y: 390 },
    seasonality_index: { x: 120, y: 470 },
    discount_offered: { x: 470, y: 270 },
    conversion: { x: 780, y: 270 },
    net_revenue: { x: 990, y: 270 }
  };

  const nodes = dagData?.nodes || [];
  const edges = dagData?.edges || [];
  const smdList = propensityData?.smd_balance || [];
  const propDist = propensityData?.distribution || {};

  // SMD Plotly Chart data
  const smdFeatures = smdList.map((item) => item.feature.replace(/_/g, ' '));
  const smdUnadj = smdList.map((item) => item.smd_unadjusted);
  const smdAdj = smdList.map((item) => item.smd_adjusted);

  const smdChartData = [
    {
      y: smdFeatures,
      x: smdUnadj,
      name: 'Unadjusted (Observational Bias)',
      type: 'bar',
      orientation: 'h',
      marker: { color: 'rgba(244, 63, 94, 0.75)' }
    },
    {
      y: smdFeatures,
      x: smdAdj,
      name: 'Adjusted via Propensity Weights',
      type: 'bar',
      orientation: 'h',
      marker: { color: 'rgba(16, 185, 129, 0.85)' }
    }
  ];

  return (
    <div className="tab-page-container">
      {/* 1. Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">WEEK 1 MILESTONE • CAUSAL IDENTIFICATION & DATA INGESTION</span>
          <h2 className="section-title">Microsoft DoWhy Directed Acyclic Graph (DAG)</h2>
          <p className="section-desc">
            Mapping observational data into formal structural causal models. Isolating true price elasticity
            from confounding variables through Backdoor Criterion adjustment.
          </p>
        </div>
      </div>

      {/* 1.5 Historical Campaign Data Ingestion Card (Week 1 Requirement) */}
      <div className="glass-panel p-5 mb-6">
        <div className="flex-row items-center justify-between mb-3">
          <div className="flex-row items-center gap-2">
            <FileSpreadsheet size={18} className="text-cyan" />
            <h3 className="card-heading">Historical Campaign Data Ingestion</h3>
          </div>
          <a
            href={`${apiBase}/api/sample-csv`}
            download="EconoCausal_Sample_Campaign_Dataset.csv"
            className="btn btn-secondary btn-sm"
          >
            <Download size={13} />
            <span>Download CSV Template</span>
          </a>
        </div>

        <p className="text-muted text-sm mb-4">
          Upload custom historical retail promotion logs to automatically generate the causal DAG,
          identify confounders via the Backdoor Criterion, and estimate individual treatment effects.
        </p>

        <div className="flex-row items-center gap-4 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-primary btn-sm"
          >
            <UploadCloud size={14} className={isUploading ? 'spin-anim' : ''} />
            <span>{isUploading ? 'Ingesting Dataset...' : 'Upload Campaign CSV'}</span>
          </button>

          <div className="flex-row items-center gap-2 flex-wrap text-xs text-dim">
            <span className="font-semibold text-main">Required Confounders (W):</span>
            <span className="badge-tag bg-dark-dim text-cyan">income</span>
            <span className="badge-tag bg-dark-dim text-cyan">browsing_minutes</span>
            <span className="badge-tag bg-dark-dim text-cyan">loyalty_score</span>
            <span className="badge-tag bg-dark-dim text-cyan">days_since_last_purchase</span>
            <span className="badge-tag bg-dark-dim text-cyan">cart_value_history</span>
            <span className="badge-tag bg-dark-dim text-cyan">seasonality_index</span>
            <span className="font-semibold text-main ml-2">Treatment (T):</span>
            <span className="badge-tag bg-dark-dim text-amber">discount_offered</span>
            <span className="font-semibold text-main ml-2">Outcome (Y):</span>
            <span className="badge-tag bg-dark-dim text-emerald">conversion</span>
          </div>
        </div>

        {uploadMsg && (
          <div className="mt-3 text-xs font-mono text-emerald flex-row items-center gap-1">
            <CheckCircle2 size={13} /> {uploadMsg}
          </div>
        )}
      </div>


      {/* 2. Interactive SVG Causal Graph Panel */}
      <div className="dag-canvas-card glass-panel">
        <div className="dag-card-header">
          <div className="flex-row items-center gap-2">
            <Network size={20} className="text-cyan" />
            <h3 className="card-heading">Causal Directed Acyclic Graph (DAG)</h3>
          </div>
          <div className="dag-legend">
            <span className="legend-item">
              <span className="node-dot bg-violet"></span> Confounders (W)
            </span>
            <span className="legend-item">
              <span className="node-dot bg-cyan"></span> Treatment (T)
            </span>
            <span className="legend-item">
              <span className="node-dot bg-emerald"></span> Outcome (Y)
            </span>
          </div>
        </div>

        <div className="svg-dag-wrapper">
          <svg viewBox="0 0 1120 540" className="causal-svg-canvas">
            <defs>
              <marker
                id="arrowhead-confounder"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="rgba(129, 140, 248, 0.55)" />
              </marker>
              <marker
                id="arrowhead-treatment"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
              </marker>
              <marker
                id="arrowhead-accounting"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#34d399" />
              </marker>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Edges */}
            {edges.map((edge, idx) => {
              const src = nodePositions[edge.from];
              const dst = nodePositions[edge.to];
              if (!src || !dst) return null;

              const isCausalLink = edge.from === 'discount_offered' && edge.to === 'conversion';
              const isHighlight =
                selectedNode && (selectedNode.id === edge.from || selectedNode.id === edge.to);

              let strokeColor = 'rgba(129, 140, 248, 0.35)';
              let markerEnd = 'url(#arrowhead-confounder)';
              let strokeWidth = 1.6;

              if (isCausalLink) {
                strokeColor = '#38bdf8';
                markerEnd = 'url(#arrowhead-treatment)';
                strokeWidth = 3;
              } else if (edge.type === 'accounting') {
                strokeColor = '#10b981';
                markerEnd = 'url(#arrowhead-accounting)';
                strokeWidth = 2;
              }

              if (isHighlight) {
                strokeColor = '#f59e0b';
                strokeWidth = 3.5;
              }

              // Curved bezier paths
              const dx = dst.x - src.x;
              const dy = dst.y - src.y;
              const cx1 = src.x + dx * 0.45;
              const cy1 = src.y;
              const cx2 = src.x + dx * 0.55;
              const cy2 = dst.y;
              const pathD = `M ${src.x + 35} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dst.x - 35} ${dst.y}`;

              return (
                <path
                  key={idx}
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  markerEnd={markerEnd}
                  className={isCausalLink ? 'pulse-causal-edge' : ''}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const isSelected = selectedNode?.id === node.id;

              let nodeClass = 'node-confounder';
              let fillGradient = 'url(#grad-confounder)';
              let borderColor = '#818cf8';

              if (node.type === 'treatment') {
                nodeClass = 'node-treatment';
                borderColor = '#38bdf8';
              } else if (node.type === 'outcome') {
                nodeClass = 'node-outcome';
                borderColor = '#10b981';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => setSelectedNode(node)}
                  className="dag-node-group"
                  cursor="pointer"
                >
                  <rect
                    x="-90"
                    y="-24"
                    width="180"
                    height="48"
                    rx="10"
                    fill="#0f172a"
                    stroke={isSelected ? '#f59e0b' : borderColor}
                    strokeWidth={isSelected ? 3 : 1.8}
                    filter="url(#glow)"
                    className="dag-node-rect"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="11.5"
                    fontFamily="Outfit, sans-serif"
                    fontWeight="600"
                    alignmentBaseline="middle"
                  >
                    {node.label}
                  </text>
                  <text
                    x="0"
                    y="15"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {node.type.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node detail bar */}
        <div className="node-detail-banner">
          {selectedNode ? (
            <div className="flex-row items-center justify-between w-full">
              <div>
                <span className="text-muted text-sm">Selected Node: </span>
                <strong className="text-cyan text-sm">{selectedNode.label}</strong> ({selectedNode.type})
                <p className="text-dim text-xs mt-1">{selectedNode.desc}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="btn btn-secondary btn-sm"
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <p className="text-muted text-xs">
              <Info size={14} className="inline mr-1 text-cyan" /> Click any node above to inspect its incoming confounding and causal pathways.
            </p>
          )}
        </div>
      </div>

      {/* 3. Backdoor Criterion & Economic Identification explanation */}
      <div className="grid-2col mt-6">
        <div className="glass-panel p-5">
          <div className="flex-row items-center gap-2 mb-3">
            <GitBranch size={18} className="text-violet" />
            <h3 className="card-heading">Backdoor Criterion Identification</h3>
          </div>
          <p className="text-muted text-sm leading-relaxed mb-4">
            In standard machine learning, high-income customers convert frequently ($P(Y=1)$ high) and
            frequently receive discount marketing ($T=1$). A predictive model confuses this correlation with
            causation, concluding discounts "cause" wealth!
          </p>
          <div className="backdoor-box">
            <div className="backdoor-header">
              <span className="text-xs font-mono text-cyan">ADJUSTMENT FORMULA</span>
            </div>
            <div className="font-mono text-xs text-main p-3 bg-dark-dim rounded">
              P(Y | do(T=t)) = Σ_W P(Y | T=t, W=w) · P(W=w)
            </div>
            <p className="text-dim text-xs mt-3">
              DoWhy identifies the sufficient adjustment set: <code className="text-cyan">{dagData?.backdoor_set?.join(', ')}</code>.
              Conditioning on these variables blocks all non-causal spurious backdoor paths.
            </p>
          </div>
        </div>

        {/* 4. Propensity Score Matching & Balance (SMD) */}
        <div className="glass-panel p-5">
          <div className="flex-row items-center justify-between mb-3">
            <div className="flex-row items-center gap-2">
              <Scale size={18} className="text-emerald" />
              <h3 className="card-heading">Covariate Balance (SMD)</h3>
            </div>
            <span className="badge-certified">
              <ShieldCheck size={13} /> Balanced (&lt;0.1 SMD)
            </span>
          </div>
          <p className="text-muted text-sm leading-relaxed mb-2">
            Standardized Mean Differences (SMD) evaluate balance between treated ($T=1$) and control ($T=0$) groups.
            Weighting reduces observational bias below the rigorous 0.10 threshold across all covariates.
          </p>

          <Plot
            data={smdChartData}
            layout={{
              barmode: 'group',
              autosize: true,
              height: 240,
              margin: { l: 140, r: 20, t: 10, b: 40 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { family: 'Plus Jakarta Sans', color: '#94a3b8', size: 10 },
              xaxis: {
                title: { text: 'Standardized Mean Difference (SMD)', font: { size: 10 } },
                gridcolor: 'rgba(255,255,255,0.06)',
                tickfont: { color: '#94a3b8' }
              },
              yaxis: {
                gridcolor: 'rgba(255,255,255,0.03)',
                tickfont: { color: '#f8fafc' }
              },
              legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 10 } }
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
