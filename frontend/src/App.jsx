import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import CausalDAGView from './components/CausalDAGView';
import DoubleMLView from './components/DoubleMLView';
import PrescriptiveMatrixView from './components/PrescriptiveMatrixView';
import OffPolicyFrontierView from './components/OffPolicyFrontierView';
import ScenarioPlannerView from './components/ScenarioPlannerView';
import CustomerProfilerView from './components/CustomerProfilerView';
import CampaignTrackerView from './components/CampaignTrackerView';
import CRMExportHubView from './components/CRMExportHubView';
import PolicyRulesView from './components/PolicyRulesView';
import AuditDriftView from './components/AuditDriftView';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('executive');
  const [currentBudget, setCurrentBudget] = useState(5000);

  // Data states
  const [dagData, setDagData] = useState(null);
  const [causalSummary, setCausalSummary] = useState(null);
  const [propensityData, setPropensityData] = useState(null);
  const [refutationAudit, setRefutationAudit] = useState(null);
  const [optimizationData, setOptimizationData] = useState(null);
  const [driftData, setDriftData] = useState(null);
  const [executiveBriefing, setExecutiveBriefing] = useState(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isDriftLoading, setIsDriftLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const apiRequest = async (path, options = {}) => {
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (res.ok) {
      return await res.json();
    }
  } catch (directErr) {
    console.warn(`Direct fetch to ${API_BASE}${path} failed, attempting relative fallback:`, directErr);
  }

  // Fallback to relative path (via dev proxy or relative route)
  const fallbackRes = await fetch(path, options);
  if (!fallbackRes.ok) {
    throw new Error(`API request to ${path} failed with HTTP ${fallbackRes.status}`);
  }
  return await fallbackRes.json();
};

  const fetchAllData = async () => {
    try {
      setErrorMessage(null);
      const [
        dagRes,
        causalRes,
        propRes,
        auditRes,
        optRes,
        driftRes,
        briefRes
      ] = await Promise.all([
        apiRequest('/api/dag'),
        apiRequest('/api/causal-summary'),
        apiRequest('/api/propensity'),
        apiRequest('/api/refutation-audit'),
        apiRequest('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget: currentBudget })
        }),
        apiRequest('/api/drift'),
        apiRequest('/api/executive-briefing')
      ]);

      setDagData(dagRes);
      setCausalSummary(causalRes);
      setPropensityData(propRes);
      setRefutationAudit(auditRes);
      setOptimizationData(optRes);
      setDriftData(driftRes);
      setExecutiveBriefing(briefRes);
    } catch (err) {
      console.error('Error fetching data:', err);
      setErrorMessage('Failed to connect to EconoCausal backend service at http://127.0.0.1:8000');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleBudgetChange = async (newBudget) => {
    setCurrentBudget(newBudget);
    setIsOptimizing(true);
    try {
      const optRes = await apiRequest('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget: newBudget })
      });
      setOptimizationData(optRes);

      // Refresh executive briefing with new budget ROI
      const briefRes = await apiRequest('/api/executive-briefing');
      setExecutiveBriefing(briefRes);
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRetrainDML = async (params) => {
    setIsRetraining(true);
    try {
      const res = await apiRequest('/api/train-dml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (res.status === 'success') {
        setCausalSummary(res.summary);
        // Refresh subsequent data
        await fetchAllData();
      }
    } catch (err) {
      console.error('Retrain error:', err);
    } finally {
      setIsRetraining(false);
    }
  };

  const handleSimulateDrift = async (params) => {
    setIsDriftLoading(true);
    try {
      const res = await apiRequest('/api/simulate-drift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      setDriftData(res);
    } catch (err) {
      console.error('Drift simulation error:', err);
    } finally {
      setIsDriftLoading(false);
    }
  };

  const handleResetDrift = async () => {
    setIsDriftLoading(true);
    try {
      const res = await apiRequest('/api/reset-drift', { method: 'POST' });
      setDriftData(res);
    } catch (err) {
      console.error('Reset drift error:', err);
    } finally {
      setIsDriftLoading(false);
    }
  };

  const handleUploadDataset = async (file) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/upload-dataset`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || 'Upload failed');
      }
      await fetchAllData();
      return { success: true };
    } catch (err) {
      console.error('Upload dataset error:', err);
      alert(`Upload error: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskCopilot = async (question) => {
    try {
      const res = await apiRequest('/api/executive-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      return res;
    } catch (err) {
      console.error('Copilot error:', err);
      return { answer: 'Could not fetch copilot answer.', category: 'Error' };
    }
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <h2 className="loading-title">Initializing EconoCausal Engine...</h2>
        <p className="loading-subtitle">
          Calibrating EconML Double Machine Learning & DoWhy Directed Acyclic Graphs
        </p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        auditStatus={refutationAudit?.overall_status}
        onRefresh={() => {
          setIsRefreshing(true);
          fetchAllData();
        }}
        isRefreshing={isRefreshing}
      />

      {errorMessage && (
        <div className="error-banner">
          <span>{errorMessage}</span>
          <button onClick={fetchAllData} className="btn btn-secondary btn-sm">
            Retry Connection
          </button>
        </div>
      )}

      <main className="main-content">
        {activeTab === 'executive' && (
          <ExecutiveDashboard
            briefing={executiveBriefing}
            optimizationData={optimizationData}
            onBudgetChange={handleBudgetChange}
            currentBudget={currentBudget}
            isOptimizing={isOptimizing}
            onAskCopilot={handleAskCopilot}
          />
        )}

        {activeTab === 'dag' && (
          <CausalDAGView
            dagData={dagData}
            propensityData={propensityData}
            onUploadDataset={handleUploadDataset}
            apiBase={API_BASE}
          />
        )}

        {activeTab === 'doubleml' && (
          <DoubleMLView
            causalSummary={causalSummary}
            onRetrain={handleRetrainDML}
            isRetraining={isRetraining}
          />
        )}

        {activeTab === 'optimization' && (
          <PrescriptiveMatrixView
            optimizationData={optimizationData}
            currentBudget={currentBudget}
            onBudgetChange={handleBudgetChange}
            apiBase={API_BASE}
          />
        )}

        {activeTab === 'ope' && (
          <OffPolicyFrontierView
            apiBase={API_BASE}
            currentBudget={currentBudget}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioPlannerView
            apiBase={API_BASE}
            currentBudget={currentBudget}
          />
        )}

        {activeTab === 'profiler' && (
          <CustomerProfilerView
            apiBase={API_BASE}
          />
        )}

        {activeTab === 'rules' && (
          <PolicyRulesView
            apiBase={API_BASE}
            currentBudget={currentBudget}
          />
        )}

        {activeTab === 'campaigns' && (
          <CampaignTrackerView
            apiBase={API_BASE}
            currentBudget={currentBudget}
          />
        )}

        {activeTab === 'crm' && (
          <CRMExportHubView
            apiBase={API_BASE}
            currentBudget={currentBudget}
          />
        )}

        {activeTab === 'audit' && (
          <AuditDriftView
            auditData={refutationAudit}
            driftData={driftData}
            onSimulateDrift={handleSimulateDrift}
            onResetDrift={handleResetDrift}
            isDriftLoading={isDriftLoading}
          />
        )}
      </main>
    </div>
  );
}
