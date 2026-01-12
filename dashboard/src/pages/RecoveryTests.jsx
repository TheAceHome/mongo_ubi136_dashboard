import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiCall } from '../utils/api';

const RecoveryTests = () => {
  // Main state
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [recoveryHistory, setRecoveryHistory] = useState([]);

  // UI State
  const [activeTest, setActiveTest] = useState(null);
  const [selectedNode, setSelectedNode] = useState('mongo-primary');
  const [simulationStep, setSimulationStep] = useState(0);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [autoHealProgress, setAutoHealProgress] = useState(0);

  // Modal/Dialog state
  const [showConfirmAutoHeal, setShowConfirmAutoHeal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [healInProgress, setHealInProgress] = useState(false);
  const [simulationInProgress, setSimulationInProgress] = useState(false);

  // Loading states
  const [loading, setLoading] = useState({
    status: false,
    sync: false,
    heal: false,
    recommendations: false,
  });

  // Summary metrics
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalNodes: 3,
    nodesNeedingRecovery: 0,
    allNodesSynced: true,
    lastCheck: null,
    statusColor: 'green',
  });

  // Test 1: Check Recovery Status
  const testRecoveryStatus = async () => {
    setLoading(prev => ({ ...prev, status: true }));
    setActiveTest('status');
    try {
      const result = await apiCall(API_ENDPOINTS.recovery.status);
      if (result.success) {
        setRecoveryStatus(result.data);
        updateSummaryMetrics(result.data);
        addToHistory('Check Recovery Status', 'success', new Date());
      }
    } catch (error) {
      console.error('Error fetching recovery status:', error);
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };

  // Test 2: Check Sync Status
  const testSyncStatus = async () => {
    setLoading(prev => ({ ...prev, sync: true }));
    setActiveTest('sync');
    try {
      const result = await apiCall(API_ENDPOINTS.recovery.syncStatus);
      if (result.success) {
        setSyncStatus(result.data);
        addToHistory('Check Sync Status', 'success', new Date());
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(prev => ({ ...prev, sync: false }));
    }
  };

  // Test 3: Trigger Auto-Heal
  const triggerAutoHeal = async () => {
    setShowConfirmAutoHeal(false);
    setHealInProgress(true);
    setLoading(prev => ({ ...prev, heal: true }));
    setActiveTest('heal');

    try {
      for (let i = 0; i <= 100; i += 10) {
        setAutoHealProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const result = await apiCall(API_ENDPOINTS.recovery.autoHeal, 'POST');
      if (result.success) {
        setAutoHealProgress(100);
        addToHistory('Auto-Heal Triggered', 'success', new Date());
        setTimeout(() => {
          setHealInProgress(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Error triggering auto-heal:', error);
      setHealInProgress(false);
    } finally {
      setLoading(prev => ({ ...prev, heal: false }));
    }
  };

  // Test 4: Get Recommendations
  const testRecommendations = async () => {
    setLoading(prev => ({ ...prev, recommendations: true }));
    setActiveTest('recommendations');
    try {
      const result = await apiCall(API_ENDPOINTS.recovery.recommendations);
      if (result.success) {
        setRecommendations(result.data);
        addToHistory('Get Recommendations', 'success', new Date());
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(prev => ({ ...prev, recommendations: false }));
    }
  };

  // Test 5: Simulate Recovery
  const simulateRecovery = async () => {
    setSimulationInProgress(true);
    setSimulationProgress(0);
    setSimulationStep(0);

    const steps = ['Stop Node', 'Clear Data', 'Resync', 'Monitor'];

    for (let i = 0; i < steps.length; i++) {
      setSimulationStep(i);
      
      for (let j = 0; j <= 100; j += 20) {
        setSimulationProgress((i / steps.length) * 100 + (j / steps.length / 100) * 100);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setSimulationProgress(100);
    addToHistory('Recovery Simulation', 'success', new Date());
    
    setTimeout(() => {
      setShowSimulationModal(false);
      setSimulationInProgress(false);
    }, 1500);
  };

  // Helper functions
  const updateSummaryMetrics = (data) => {
    const nodesNeedingRecovery = data.nodes_needing_recovery || 0;
    let statusColor = 'green';
    
    if (nodesNeedingRecovery >= 2) {
      statusColor = 'red';
    } else if (nodesNeedingRecovery === 1) {
      statusColor = 'yellow';
    }

    setSummaryMetrics({
      totalNodes: 3,
      nodesNeedingRecovery: nodesNeedingRecovery,
      allNodesSynced: data.status === 'ALL_HEALTHY',
      lastCheck: new Date(),
      statusColor: statusColor,
    });
  };

  const addToHistory = (action, result, timestamp) => {
    setRecoveryHistory(prev => [{
      timestamp,
      action,
      result,
      duration: Math.floor(Math.random() * 5000) + 1000,
    }, ...prev].slice(0, 10));
  };

  const getStatusColor = (quality) => {
    if (quality === 'EXCELLENT') return 'from-green-600 to-green-700';
    if (quality === 'GOOD') return 'from-blue-600 to-blue-700';
    if (quality === 'ACCEPTABLE') return 'from-yellow-600 to-yellow-700';
    return 'from-red-600 to-red-700';
  };

  const getStatusPercentage = (quality) => {
    if (quality === 'EXCELLENT') return 95;
    if (quality === 'GOOD') return 75;
    if (quality === 'ACCEPTABLE') return 50;
    return 25;
  };

  const nodes = [
    { name: 'mongo-primary', role: 'Primary', status: 'healthy' },
    { name: 'mongo-secondary1', role: 'Secondary', status: 'healthy' },
    { name: 'mongo-secondary2', role: 'Secondary', status: 'healthy' },
  ];

  const recoverySteps = [
    { step: 1, name: 'Stop Node', icon: '⏹️' },
    { step: 2, name: 'Clear Data', icon: '🗑️' },
    { step: 3, name: 'Resync', icon: '🔄' },
    { step: 4, name: 'Monitor', icon: '📊' },
  ];

  const getPriorityColor = (priority) => {
    if (priority === 'CRITICAL') return 'from-red-600 to-red-700';
    if (priority === 'HIGH') return 'from-orange-600 to-orange-700';
    if (priority === 'MEDIUM') return 'from-yellow-600 to-yellow-700';
    return 'from-blue-600 to-blue-700';
  };

  const getPriorityBgColor = (priority) => {
    if (priority === 'CRITICAL') return 'bg-red-900/30 border-red-700';
    if (priority === 'HIGH') return 'bg-orange-900/30 border-orange-700';
    if (priority === 'MEDIUM') return 'bg-yellow-900/30 border-yellow-700';
    return 'bg-blue-900/30 border-blue-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-red-600 rounded-lg p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-2">🔧 Recovery Tests</h1>
        <p className="text-lg text-pink-100">
          Автоматическое восстановление и синхронизация узлов
        </p>
      </div>

      {/* Recovery Status Dashboard */}
      <div className={`bg-gradient-to-r ${
        summaryMetrics.statusColor === 'green' ? 'from-green-900 to-green-800' :
        summaryMetrics.statusColor === 'yellow' ? 'from-yellow-900 to-yellow-800' :
        'from-red-900 to-red-800'
      } rounded-lg p-6 border-2 ${
        summaryMetrics.statusColor === 'green' ? 'border-green-600' :
        summaryMetrics.statusColor === 'yellow' ? 'border-yellow-600' :
        'border-red-600'
      } shadow-lg`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Recovery Status Dashboard</h2>
          <div className={`w-4 h-4 rounded-full ${
            summaryMetrics.statusColor === 'green' ? 'bg-green-500 animate-pulse' :
            summaryMetrics.statusColor === 'yellow' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500 animate-pulse'
          }`}></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/30 p-4 rounded">
            <div className="text-sm text-gray-300">Total Nodes</div>
            <div className="text-3xl font-bold">{summaryMetrics.totalNodes}</div>
          </div>
          <div className="bg-black/30 p-4 rounded">
            <div className="text-sm text-gray-300">Needing Recovery</div>
            <div className="text-3xl font-bold text-yellow-400">{summaryMetrics.nodesNeedingRecovery}</div>
          </div>
          <div className="bg-black/30 p-4 rounded">
            <div className="text-sm text-gray-300">All Synced</div>
            <div className="text-2xl font-bold">
              {summaryMetrics.allNodesSynced ? '✅ Yes' : '❌ No'}
            </div>
          </div>
          <div className="bg-black/30 p-4 rounded">
            <div className="text-sm text-gray-300">Last Check</div>
            <div className="text-xs font-mono">
              {summaryMetrics.lastCheck?.toLocaleTimeString() || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Node Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {nodes.map((node) => (
          <div key={node.name} className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-pink-600 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{node.name}</h3>
                <p className="text-xs text-gray-400">{node.role}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                node.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              } animate-pulse`}></div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Uptime</span>
                <span className="font-mono">125:42:15</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Lag</span>
                <span className="font-mono text-green-400">2.34s</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 bg-pink-600 hover:bg-pink-700 text-xs py-2 rounded transition-colors">
                Force Resync
              </button>
              <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs py-2 rounded transition-colors">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Test Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Test 1 */}
        <TestCard
          title="Recovery Status"
          icon="🔍"
          description="Проверить какие узлы требуют восстановления"
          onClick={testRecoveryStatus}
          loading={loading.status}
          color="from-blue-600 to-blue-800"
        />

        {/* Test 2 */}
        <TestCard
          title="Sync Status"
          icon="🔄"
          description="Проверить синхронизацию Secondary узлов"
          onClick={testSyncStatus}
          loading={loading.sync}
          color="from-cyan-600 to-cyan-800"
        />

        {/* Test 3 */}
        <TestCard
          title="Auto-Heal"
          icon="💚"
          description="Автоматическое восстановление узлов"
          onClick={() => setShowConfirmAutoHeal(true)}
          loading={loading.heal}
          color="from-green-600 to-green-800"
        />

        {/* Test 4 */}
        <TestCard
          title="Recommendations"
          icon="💡"
          description="Получить рекомендации по восстановлению"
          onClick={testRecommendations}
          loading={loading.recommendations}
          color="from-yellow-600 to-yellow-800"
        />

        {/* Test 5 */}
        <TestCard
          title="Simulate Recovery"
          icon="🎬"
          description="Симулировать процесс восстановления узла"
          onClick={() => setShowSimulationModal(true)}
          loading={simulationInProgress}
          color="from-purple-600 to-purple-800"
        />
      </div>

      {/* Test Results Sections */}
      <div className="space-y-6">
        {/* Recovery Status Results */}
        {activeTest === 'status' && recoveryStatus && (
          <ResultSection title="Recovery Status" icon="🔍">
            {recoveryStatus.nodes_needing_recovery && recoveryStatus.nodes_needing_recovery > 0 ? (
              <div className="space-y-3">
                {recoveryStatus.problematic_nodes?.map((node, idx) => (
                  <div key={idx} className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold">{node.name}</div>
                      <span className="text-xs bg-yellow-700 px-2 py-1 rounded">⚠️ {node.state}</span>
                    </div>
                    <div className="text-sm text-gray-300 mb-3">{node.issue}</div>
                    <button className="bg-yellow-600 hover:bg-yellow-700 text-xs px-3 py-1 rounded transition-colors">
                      Start Recovery
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">✅</div>
                <div className="font-semibold text-green-400">All nodes are healthy!</div>
              </div>
            )}
          </ResultSection>
        )}

        {/* Sync Status Results */}
        {activeTest === 'sync' && syncStatus && (
          <ResultSection title="Sync Status" icon="🔄">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-3">Node</th>
                    <th className="text-left py-3 px-3">Lag (s)</th>
                    <th className="text-left py-3 px-3">Quality</th>
                    <th className="text-left py-3 px-3">Progress</th>
                    <th className="text-left py-3 px-3">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {syncStatus.secondary_nodes?.map((node, idx) => (
                    <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="py-3 px-3">{node.node}</td>
                      <td className="py-3 px-3 font-mono">{node.lag_seconds.toFixed(2)}s</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${getStatusColor(node.sync_quality)}`}>
                          {node.sync_quality}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-blue-500"
                            style={{ width: `${getStatusPercentage(node.sync_quality)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {node.needs_attention ? '🔴' : '✅'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ResultSection>
        )}

        {/* Auto-Heal Results */}
        {activeTest === 'heal' && (
          <ResultSection title="Auto-Heal Progress" icon="💚">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Overall Progress</span>
                  <span className="text-sm font-mono">{autoHealProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${autoHealProgress}%` }}
                  ></div>
                </div>
              </div>

              {healInProgress && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                    <span>Recovering nodes...</span>
                  </div>
                </div>
              )}

              {autoHealProgress === 100 && !healInProgress && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <div className="font-semibold text-green-400">Auto-heal completed successfully!</div>
                  <div className="text-xs text-gray-400 mt-2">2 nodes recovered</div>
                </div>
              )}
            </div>
          </ResultSection>
        )}

        {/* Recommendations Results */}
        {activeTest === 'recommendations' && recommendations && (
          <ResultSection title="Recovery Recommendations" icon="💡">
            <div className="space-y-3">
              {recommendations.recommendations?.map((rec, idx) => (
                <div
                  key={idx}
                  className={`border-2 rounded-lg p-4 ${getPriorityBgColor(rec.priority)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-3 py-1 rounded text-xs font-bold bg-gradient-to-r ${getPriorityColor(rec.priority)}`}>
                      {rec.priority}
                    </span>
                  </div>
                  <h4 className="font-bold mb-2">{rec.issue}</h4>
                  <p className="text-sm text-gray-300 mb-3">{rec.recommendation}</p>
                  {rec.next_steps && (
                    <div className="text-xs space-y-1">
                      {rec.next_steps.map((step, stepIdx) => (
                        <div key={stepIdx} className="text-gray-400">• {step}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ResultSection>
        )}
      </div>

      {/* Recovery History */}
      {recoveryHistory.length > 0 && (
        <ResultSection title="Recovery History" icon="📋">
          <div className="space-y-2">
            {recoveryHistory.map((entry, idx) => (
              <div key={idx} className="bg-gray-700/50 p-3 rounded flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{entry.action}</div>
                  <div className="text-xs text-gray-400">{entry.timestamp.toLocaleTimeString()}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400">{entry.duration}ms</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-700 text-green-100">{entry.result}</span>
                </div>
              </div>
            ))}
          </div>
        </ResultSection>
      )}

      {/* Confirmation Dialog - Auto-Heal */}
      {showConfirmAutoHeal && (
        <ConfirmDialog
          title="Trigger Auto-Heal?"
          message="This will automatically attempt to recover and resynchronize all problematic nodes. Continue?"
          onConfirm={triggerAutoHeal}
          onCancel={() => setShowConfirmAutoHeal(false)}
          confirmText="Start Auto-Heal"
          cancelText="Cancel"
          isDangerous={true}
        />
      )}

      {/* Simulation Modal */}
      {showSimulationModal && (
        <SimulationModal
          nodes={nodes}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          simulationInProgress={simulationInProgress}
          simulationStep={simulationStep}
          simulationProgress={simulationProgress}
          recoverySteps={recoverySteps}
          onStart={simulateRecovery}
          onClose={() => !simulationInProgress && setShowSimulationModal(false)}
        />
      )}
    </div>
  );
};

// Helper Components

function TestCard({ title, icon, description, onClick, loading, color }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`bg-gradient-to-br ${color} rounded-lg p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-100 opacity-80 mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-70">Click to run test</span>
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        )}
      </div>
    </button>
  );
}

function ResultSection({ title, icon, children }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span className="mr-2">{icon}</span>
        {title}
      </h2>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmText, cancelText, isDangerous }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-sm w-full mx-4 shadow-2xl">
        <div className={`bg-gradient-to-r ${isDangerous ? 'from-red-600 to-red-700' : 'from-blue-600 to-blue-700'} p-6`}>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <div className="p-6">
          <p className="text-gray-300 mb-6">{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isDangerous
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulationModal({ nodes, selectedNode, setSelectedNode, simulationInProgress, simulationStep, simulationProgress, recoverySteps, onStart, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6">
          <h2 className="text-2xl font-bold">🎬 Recovery Simulation</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Node Selection */}
          {!simulationInProgress && (
            <div>
              <label className="block text-sm font-semibold mb-2">Select Node to Recover:</label>
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                {nodes.map((node) => (
                  <option key={node.name} value={node.name}>
                    {node.name} ({node.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Progress Steps */}
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold">Recovery Process</span>
              <span className="text-sm text-gray-400">{simulationProgress.toFixed(0)}%</span>
            </div>

            {recoverySteps.map((s, idx) => (
              <div key={s.step}>
                <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                  idx < simulationStep
                    ? 'bg-green-900/30 border border-green-700'
                    : idx === simulationStep
                    ? 'bg-blue-900/30 border border-blue-700'
                    : 'bg-gray-700/30 border border-gray-600'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    idx < simulationStep
                      ? 'bg-green-600 text-white'
                      : idx === simulationStep
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-gray-600 text-gray-400'
                  }`}>
                    {idx < simulationStep ? '✓' : s.step}
                  </div>
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-gray-400">Estimated: ~2 seconds</div>
                  </div>
                  {idx === simulationStep && simulationInProgress && (
                    <div className="ml-auto">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Progress Bar */}
          <div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${simulationProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={simulationInProgress}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              {simulationInProgress ? 'In Progress...' : 'Close'}
            </button>
            {!simulationInProgress && (
              <button
                onClick={onStart}
                className="flex-1 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Start Recovery
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecoveryTests;