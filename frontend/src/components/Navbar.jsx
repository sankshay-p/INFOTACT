import React from 'react';
import { Network, TrendingUp, Cpu, Sliders, ShieldCheck, RefreshCw, Beaker, Users, GitBranch, Send, GitFork } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, auditStatus, onRefresh, isRefreshing }) {
  const navItems = [
    { id: 'executive', label: 'Executive AI Briefing', icon: TrendingUp },
    { id: 'dag', label: 'Causal Graph (DoWhy DAG)', icon: Network },
    { id: 'doubleml', label: 'Double ML & Uplift Curves', icon: Cpu },
    { id: 'optimization', label: 'Prescriptive Allocation', icon: Sliders },
    { id: 'scenarios', label: 'Scenario Planner', icon: Beaker },
    { id: 'profiler', label: 'Customer 360° Profiler', icon: Users },
    { id: 'rules', label: 'Policy Trees & Rules', icon: GitFork },
    { id: 'campaigns', label: 'Campaigns & A/B Testing', icon: GitBranch },
    { id: 'crm', label: 'CRM Export Hub', icon: Send },
    { id: 'audit', label: 'Refutation & Data Drift', icon: ShieldCheck }
  ];

  return (
    <header className="navbar-container">
      <div className="navbar-brand">
        <div className="brand-logo-glow">
          <Network size={22} className="brand-icon text-cyan" />
        </div>
        <div>
          <div className="brand-title-wrap">
            <h1 className="brand-title">EconoCausal</h1>
            <span className="badge-tag">ENTERPRISE DML</span>
          </div>
          <p className="brand-subtitle">Dynamic Pricing & Causal Uplift Engine</p>
        </div>
      </div>

      <nav className="navbar-links">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {isActive && <div className="nav-tab-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="navbar-actions">
        <div className="audit-status-pill">
          <span className="status-dot"></span>
          <span className="status-text">{auditStatus || 'DoWhy Certified'}</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary btn-sm"
          title="Refresh Causal Models"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
          <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
        </button>
      </div>
    </header>
  );
}
