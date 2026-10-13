import React, { useState } from 'react';
import { Download, Search, Filter, CheckCircle2, AlertCircle, ArrowUpDown, DollarSign, SlidersHorizontal } from 'lucide-react';

export default function PrescriptiveMatrixView({ optimizationData, currentBudget }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState('ALL');
  const [selectedDiscount, setSelectedDiscount] = useState('ALL');
  const [sortField, setSortField] = useState('expected_incremental_profit');
  const [sortDirection, setSortDirection] = useState('desc');

  const strats = optimizationData?.strategy_comparison || [];
  const matrix = optimizationData?.allocation_matrix || [];

  // Filtering
  const filteredData = matrix.filter((row) => {
    const matchesSearch =
      searchTerm === '' ||
      row.customer_id.toString().includes(searchTerm) ||
      row.archetype.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesArch =
      selectedArchetype === 'ALL' || row.archetype === selectedArchetype;

    const matchesDisc =
      selectedDiscount === 'ALL' ||
      (selectedDiscount === '20' && row.optimal_discount === 20.0) ||
      (selectedDiscount === '10' && row.optimal_discount === 10.0) ||
      (selectedDiscount === '0' && row.optimal_discount === 0.0);

    return matchesSearch && matchesArch && matchesDisc;
  });

  // Sorting
  filteredData.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Customer_ID',
      'Income',
      'Browsing_Minutes',
      'Loyalty_Score',
      'Baseline_Conversion_P0',
      'Uplift_ITE_10',
      'Uplift_ITE_20',
      'Archetype',
      'Prescribed_Optimal_Discount',
      'Predictive_ML_Discount',
      'Expected_Incremental_Profit',
      'Rationale'
    ];

    const rows = filteredData.map((r) => [
      r.customer_id,
      r.income,
      r.browsing_minutes,
      r.loyalty_score,
      r.baseline_prob,
      r.uplift_ite_10,
      r.uplift_ite_20,
      r.archetype,
      r.optimal_discount,
      r.predictive_ml_discount,
      r.expected_incremental_profit,
      `"${r.recommendation_rationale}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EconoCausal_Prescription_Matrix_Budget_${currentBudget}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tab-page-container">
      {/* 1. Header */}
      <div className="section-header">
        <div>
          <span className="section-eyebrow">WEEK 3 MILESTONE • PRESCRIPTIVE OPTIMIZATION</span>
          <h2 className="section-title">Mathematical Allocation Matrix ("The Prescription")</h2>
          <p className="section-desc">
            Customer-level personalized discount assignments solved via SciPy knapsack integer optimization.
            Budget is restricted to ${currentBudget?.toLocaleString() || '5,000'} to maximize incremental profit.
          </p>
        </div>

        <button onClick={handleExportCSV} className="btn btn-emerald btn-sm">
          <Download size={14} />
          <span>Export Allocation CSV</span>
        </button>
      </div>

      {/* 2. Strategy Comparison Summary Table */}
      <div className="glass-panel p-5 mb-6">
        <h3 className="card-heading mb-3">Campaign Allocation Efficiency Matrix</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Targeting Strategy</th>
                <th>Budget Allocated</th>
                <th>Incremental Revenue</th>
                <th>Net Incremental Profit</th>
                <th>Wasted Spend %</th>
                <th>Prescriptive ROI</th>
                <th>Persuadables Targeted</th>
              </tr>
            </thead>
            <tbody>
              {strats.map((strat, idx) => {
                const isCausal = strat.strategy.includes('EconoCausal');
                return (
                  <tr key={idx} className={isCausal ? 'row-highlight-emerald' : ''}>
                    <td className="font-semibold text-main">
                      {strat.strategy}
                      {isCausal && (
                        <span className="badge-tag bg-emerald-subtle text-emerald ml-2">
                          OPTIMAL
                        </span>
                      )}
                    </td>
                    <td className="font-mono">${strat.budget_spent.toLocaleString()}</td>
                    <td className="font-mono text-cyan">${strat.incremental_revenue.toLocaleString()}</td>
                    <td className={`font-mono font-bold ${isCausal ? 'text-emerald' : 'text-main'}`}>
                      ${strat.incremental_profit.toLocaleString()}
                    </td>
                    <td className={`font-mono ${strat.wasted_pct > 30 ? 'text-rose' : 'text-muted'}`}>
                      {strat.wasted_pct}% (${strat.wasted_budget.toLocaleString()})
                    </td>
                    <td className={`font-mono font-bold ${isCausal ? 'text-emerald' : 'text-main'}`}>
                      {strat.roi_percentage}%
                    </td>
                    <td>
                      <span className="font-mono text-emerald">
                        {strat.archetype_targeted.Persuadable}
                      </span>{' '}
                      / {strat.targeted_customers}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Filters and Search Bar */}
      <div className="table-controls-bar glass-panel mb-4">
        <div className="search-box">
          <Search size={16} className="text-muted search-icon" />
          <input
            type="text"
            placeholder="Search by Customer ID or Archetype..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <span className="filter-label">Archetype:</span>
            <select
              value={selectedArchetype}
              onChange={(e) => setSelectedArchetype(e.target.value)}
              className="select-input"
            >
              <option value="ALL">All Archetypes</option>
              <option value="Persuadable">Persuadables</option>
              <option value="Sure Thing">Sure Things</option>
              <option value="Lost Cause">Lost Causes</option>
              <option value="Sleeping Dog">Sleeping Dogs</option>
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-label">Prescribed Discount:</span>
            <select
              value={selectedDiscount}
              onChange={(e) => setSelectedDiscount(e.target.value)}
              className="select-input"
            >
              <option value="ALL">All Tiers</option>
              <option value="20">$20 Max Discount</option>
              <option value="10">$10 Moderate Discount</option>
              <option value="0">$0 No Discount</option>
            </select>
          </div>
        </div>

        <div className="results-count-text">
          Showing <strong>{filteredData.length}</strong> customers
        </div>
      </div>

      {/* 4. Customer-Level Prescription Table */}
      <div className="customer-matrix-table-card glass-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('customer_id')} className="cursor-pointer">
                  <div className="flex-row items-center gap-1">
                    Customer ID <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Attributes (Inc / Browse / Loy)</th>
                <th onClick={() => toggleSort('baseline_prob')} className="cursor-pointer">
                  <div className="flex-row items-center gap-1">
                    Baseline P(Y₀) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => toggleSort('uplift_ite_20')} className="cursor-pointer">
                  <div className="flex-row items-center gap-1">
                    Causal Uplift (τ₂₀) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Archetype</th>
                <th onClick={() => toggleSort('optimal_discount')} className="cursor-pointer">
                  <div className="flex-row items-center gap-1">
                    Optimal Discount <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Predictive ML Flaw</th>
                <th onClick={() => toggleSort('expected_incremental_profit')} className="cursor-pointer">
                  <div className="flex-row items-center gap-1">
                    Exp. Net Margin <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Econometric Rationale</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((row) => {
                let archBadge = 'badge-persuadable';
                if (row.archetype === 'Sure Thing') archBadge = 'badge-sure-thing';
                if (row.archetype === 'Lost Cause') archBadge = 'badge-lost-cause';
                if (row.archetype === 'Sleeping Dog') archBadge = 'badge-sleeping-dog';

                const isMistakeAvoided =
                  row.optimal_discount === 0 && row.predictive_ml_discount > 0;

                return (
                  <tr key={row.customer_id}>
                    <td className="font-mono font-semibold text-cyan">
                      #{row.customer_id}
                    </td>
                    <td className="text-xs text-muted font-mono">
                      ${Math.round(row.income / 1000)}k | {row.browsing_minutes}m | {row.loyalty_score}★
                    </td>
                    <td className="font-mono">
                      {(row.baseline_prob * 100).toFixed(1)}%
                    </td>
                    <td className={`font-mono font-bold ${row.uplift_ite_20 > 0.15 ? 'text-emerald' : row.uplift_ite_20 < 0 ? 'text-rose' : 'text-muted'}`}>
                      {row.uplift_ite_20 > 0 ? `+${(row.uplift_ite_20 * 100).toFixed(1)}%` : `${(row.uplift_ite_20 * 100).toFixed(1)}%`}
                    </td>
                    <td>
                      <span className={`badge-archetype ${archBadge}`}>
                        {row.archetype}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`discount-tier-badge ${
                          row.optimal_discount === 20
                            ? 'discount-tier-20'
                            : row.optimal_discount === 10
                            ? 'discount-tier-10'
                            : 'discount-tier-0'
                        }`}
                      >
                        ${row.optimal_discount}
                      </span>
                    </td>
                    <td>
                      {isMistakeAvoided ? (
                        <span className="text-rose text-xs font-semibold" title="Predictive ML would give this Sure Thing a discount!">
                          ML offered ${row.predictive_ml_discount} (Wasted!)
                        </span>
                      ) : (
                        <span className="text-dim text-xs font-mono">
                          ${row.predictive_ml_discount}
                        </span>
                      )}
                    </td>
                    <td className={`font-mono font-bold ${row.expected_incremental_profit > 0 ? 'text-emerald' : 'text-dim'}`}>
                      {row.expected_incremental_profit > 0
                        ? `+$${row.expected_incremental_profit}`
                        : '$0.00'}
                    </td>
                    <td className="text-xs text-muted max-w-xs">
                      {row.recommendation_rationale}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredData.length > 100 && (
          <div className="table-footer-note">
            Displaying first 100 of {filteredData.length} records. Click <strong>Export Allocation CSV</strong> above to download all customer records.
          </div>
        )}
      </div>
    </div>
  );
}
