import React, { useState, useEffect } from 'react';
import { getReplicationLag, getAlerts, API_ENDPOINTS, apiCall } from '../utils/api';

const ReplicationTests = () => {
  // State for all tests
  const [replicationStatus, setReplicationStatus] = useState(null);
  const [oplogLagData, setOplogLagData] = useState(null);
  const [oplogInfo, setOplogInfo] = useState(null);
  const [alerts, setAlerts] = useState([]);
  
  // State for metrics
  const [metrics, setMetrics] = useState({
    maxLag: 0,
    avgLag: 0,
    healthyNodes: 0,
    alertCount: 0,
  });

  // Loading states
  const [loading, setLoading] = useState({
    status: false,
    lag: false,
    oplog: false,
    alerts: false,
  });

  // Live monitoring
  const [liveMonitoring, setLiveMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Test 1: Check Replication Status
  const testReplicationStatus = async () => {
    setLoading(prev => ({ ...prev, status: true }));
    try {
      const result = await getReplicationLag();
      if (result.success) {
        setReplicationStatus(result.data);
        updateMetrics(result.data);
      }
    } catch (error) {
      console.error('Error fetching replication status:', error);
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };

  // Test 2: Analyze Oplog Lag
  const testOplogLag = async () => {
    setLoading(prev => ({ ...prev, lag: true }));
    try {
      const result = await getReplicationLag();
      if (result.success) {
        setOplogLagData(result.data);
      }
    } catch (error) {
      console.error('Error fetching oplog lag:', error);
    } finally {
      setLoading(prev => ({ ...prev, lag: false }));
    }
  };

  // Test 3: Get Oplog Info
  const testOplogInfo = async () => {
    setLoading(prev => ({ ...prev, oplog: true }));
    try {
      const result = await apiCall(API_ENDPOINTS.replication.oplogInfo);
      if (result.success) {
        setOplogInfo(result.data);
      }
    } catch (error) {
      console.error('Error fetching oplog info:', error);
    } finally {
      setLoading(prev => ({ ...prev, oplog: false }));
    }
  };

  // Test 4: Check Replication Alerts
  const testReplicationAlerts = async () => {
    setLoading(prev => ({ ...prev, alerts: true }));
    try {
      const result = await getAlerts();
      if (result.success) {
        setAlerts(result.data.alerts || []);
        setMetrics(prev => ({
          ...prev,
          alertCount: result.data.alerts ? result.data.alerts.length : 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(prev => ({ ...prev, alerts: false }));
    }
  };

  // Update metrics from replication data
  const updateMetrics = (data) => {
    if (!data.lag_details) return;

    const lags = data.lag_details.map(d => d.lag_seconds);
    const maxLag = Math.max(...lags);
    const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length;
    const healthyNodes = (data.secondary_nodes_count || 0) + 1; // +1 for primary

    setMetrics(prev => ({
      ...prev,
      maxLag: maxLag.toFixed(2),
      avgLag: avgLag.toFixed(2),
      healthyNodes,
    }));
  };

  // Live monitoring effect
  useEffect(() => {
    if (!liveMonitoring) return;

    const interval = setInterval(async () => {
      await testReplicationStatus();
      await testReplicationAlerts();
      setLastUpdate(new Date().toLocaleTimeString());
    }, 5000);

    return () => clearInterval(interval);
  }, [liveMonitoring]);

  // Get lag status color
  const getLagStatusColor = (lag) => {
    if (lag < 5) return { bg: 'bg-green-700', text: 'text-green-400', status: 'EXCELLENT' };
    if (lag < 10) return { bg: 'bg-blue-700', text: 'text-blue-400', status: 'GOOD' };
    if (lag < 30) return { bg: 'bg-yellow-700', text: 'text-yellow-400', status: 'WARNING' };
    return { bg: 'bg-red-700', text: 'text-red-400', status: 'CRITICAL' };
  };

  // Get alert color
  const getAlertColor = (level) => {
    if (level === 'CRITICAL') return 'border-red-500 bg-red-900/20';
    if (level === 'WARNING') return 'border-yellow-500 bg-yellow-900/20';
    return 'border-blue-500 bg-blue-900/20';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-2">🔄 Replication Tests</h1>
        <p className="text-lg text-yellow-100">
          Мониторинг и анализ репликации данных между узлами MongoDB
        </p>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Max Lag" 
          value={`${metrics.maxLag}s`}
          icon="⏱️"
          color="from-red-600 to-orange-600"
        />
        <MetricCard 
          title="Avg Lag" 
          value={`${metrics.avgLag}s`}
          icon="📊"
          color="from-blue-600 to-cyan-600"
        />
        <MetricCard 
          title="Healthy Nodes" 
          value={metrics.healthyNodes}
          icon="🏥"
          color="from-green-600 to-emerald-600"
        />
        <MetricCard 
          title="Active Alerts" 
          value={metrics.alertCount}
          icon="🚨"
          color="from-red-600 to-pink-600"
        />
      </div>

      {/* Live Monitoring Toggle */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">📡</div>
            <div>
              <h2 className="text-xl font-bold">Live Monitoring</h2>
              <p className="text-sm text-gray-400">Auto-refresh every 5 seconds</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {lastUpdate && (
              <div className="text-sm text-gray-400">
                Last update: {lastUpdate}
              </div>
            )}
            
            <button
              onClick={() => setLiveMonitoring(!liveMonitoring)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                liveMonitoring ? 'bg-green-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  liveMonitoring ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            
            {liveMonitoring && (
              <div className="flex items-center space-x-1 text-green-400 font-bold">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                LIVE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Node Diagram */}
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">🔗 Replication Topology</h2>
        
        <div className="flex items-center justify-between relative h-40">
          {/* Secondary 1 Node */}
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gray-900 border-2 border-blue-500 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">📦</div>
                <div className="font-bold text-sm mb-1">Secondary 1</div>
                <div className="text-xs text-gray-400">mongo-secondary1</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400 text-center hidden group-hover:block">
              Replica Node
            </div>
          </div>

          {/* Replication Arrow 1 */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent">
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <div className="text-yellow-400 text-lg animate-pulse">→</div>
              </div>
            </div>
          </div>

          {/* Primary Node (Center) */}
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"></div>
              <div className="relative bg-gray-900 border-2 border-green-500 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">👑</div>
                <div className="font-bold text-sm mb-1">Primary</div>
                <div className="text-xs text-gray-400">mongo-primary</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-green-400 font-bold text-center">
              Leader (Writes)
            </div>
          </div>

          {/* Replication Arrow 2 */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent">
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
                <div className="text-yellow-400 text-lg animate-pulse">←</div>
              </div>
            </div>
          </div>

          {/* Secondary 2 Node */}
          <div className="flex flex-col items-center group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gray-900 border-2 border-blue-500 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">📦</div>
                <div className="font-bold text-sm mb-1">Secondary 2</div>
                <div className="text-xs text-gray-400">mongo-secondary2</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400 text-center hidden group-hover:block">
              Replica Node
            </div>
          </div>
        </div>

        {/* Topology Legend */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-700/50 p-3 rounded border-l-4 border-green-500">
            <div className="font-semibold text-green-400 mb-1">👑 Primary</div>
            <div className="text-gray-400">Accepts all writes</div>
          </div>
          <div className="bg-gray-700/50 p-3 rounded border-l-4 border-blue-500">
            <div className="font-semibold text-blue-400 mb-1">📦 Secondary</div>
            <div className="text-gray-400">Read-only replicas</div>
          </div>
          <div className="bg-gray-700/50 p-3 rounded border-l-4 border-yellow-500">
            <div className="font-semibold text-yellow-400 mb-1">→ Replication</div>
            <div className="text-gray-400">Oplog stream</div>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TestButton
          title="Check Replication Status"
          icon="🔄"
          loading={loading.status}
          onClick={testReplicationStatus}
          color="from-blue-600 to-blue-800"
        />
        <TestButton
          title="Analyze Oplog Lag"
          icon="📊"
          loading={loading.lag}
          onClick={testOplogLag}
          color="from-purple-600 to-purple-800"
        />
        <TestButton
          title="Get Oplog Info"
          icon="📋"
          loading={loading.oplog}
          onClick={testOplogInfo}
          color="from-cyan-600 to-cyan-800"
        />
        <TestButton
          title="Check Replication Alerts"
          icon="🚨"
          loading={loading.alerts}
          onClick={testReplicationAlerts}
          color="from-red-600 to-red-800"
        />
      </div>

      {/* Test 1: Replication Status */}
      {replicationStatus && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">🔄 Replication Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400 mb-1">Primary Node</div>
              <div className="text-lg font-bold">{replicationStatus.primary_node?.split(':')[0]}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400 mb-1">Secondary Nodes</div>
              <div className="text-lg font-bold">{replicationStatus.secondary_nodes_count}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400 mb-1">Max Lag</div>
              <div className="text-lg font-bold">{replicationStatus.max_lag_seconds}s</div>
            </div>
            <div className={`p-4 rounded ${
              replicationStatus.overall_status === 'GOOD' ? 'bg-green-700' :
              replicationStatus.overall_status === 'WARNING' ? 'bg-yellow-700' :
              'bg-red-700'
            }`}>
              <div className="text-sm text-gray-200 mb-1">Overall Status</div>
              <div className="text-lg font-bold">{replicationStatus.overall_status}</div>
            </div>
          </div>

          {/* Lag Details Table */}
          {replicationStatus.lag_details && replicationStatus.lag_details.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3">Secondary Node</th>
                    <th className="text-left py-2 px-3">Lag (seconds)</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Last Optime</th>
                    <th className="text-left py-2 px-3">Threat Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {replicationStatus.lag_details.map((detail, idx) => {
                    const lagColor = getLagStatusColor(detail.lag_seconds);
                    return (
                      <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-2 px-3 font-medium">{detail.node.split(':')[0]}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-2">
                            <div className="text-lg font-bold">{detail.lag_seconds}s</div>
                            <div className="w-24 bg-gray-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${lagColor.bg}`}
                                style={{ 
                                  width: `${Math.min((detail.lag_seconds / 60) * 100, 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${lagColor.bg} ${lagColor.text}`}>
                            {lagColor.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400">
                          {new Date(detail.last_optime).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {detail.threat_assessment}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Test 2: Oplog Lag Analysis */}
      {oplogLagData && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">📊 Oplog Lag Analysis</h2>
          
          <div className="space-y-4">
            {oplogLagData.lag_details && oplogLagData.lag_details.map((detail, idx) => (
              <div key={idx} className="bg-gray-700/50 p-4 rounded border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg">{detail.node}</div>
                    <div className="text-sm text-gray-400">{detail.threat_assessment}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{detail.lag_seconds}s</div>
                    <div className={`text-xs px-2 py-1 rounded mt-1 font-bold ${
                      detail.status === 'EXCELLENT' ? 'bg-green-600 text-green-100' :
                      detail.status === 'GOOD' ? 'bg-blue-600 text-blue-100' :
                      detail.status === 'WARNING' ? 'bg-yellow-600 text-yellow-100' :
                      'bg-red-600 text-red-100'
                    }`}>
                      {detail.status}
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-600 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      detail.status === 'EXCELLENT' ? 'bg-green-500' :
                      detail.status === 'GOOD' ? 'bg-blue-500' :
                      detail.status === 'WARNING' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((detail.lag_seconds / 60) * 100, 100)}%` }}
                  ></div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  Last optime: {new Date(detail.last_optime).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <div className="text-sm">
              <div className="font-semibold text-blue-300 mb-2">💡 Recommendations:</div>
              {oplogLagData.recommendations && oplogLagData.recommendations.map((rec, idx) => (
                <div key={idx} className="text-blue-200 text-xs mb-1">
                  • {rec}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test 3: Oplog Info */}
      {oplogInfo && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">📋 Oplog Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard 
              title="Oplog Size"
              value={`${oplogInfo.oplog_size_mb} MB`}
              icon="💾"
            />
            <InfoCard 
              title="Max Size"
              value={`${oplogInfo.oplog_max_size_mb} MB`}
              icon="📊"
            />
            <InfoCard 
              title="Documents"
              value={oplogInfo.document_count}
              icon="📝"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700/50 p-4 rounded border border-gray-600">
              <div className="text-sm text-gray-400 mb-2">Oplog Time Window</div>
              <div className="text-2xl font-bold text-cyan-400">
                {oplogInfo.oplog_window_hours} hours
              </div>
              <div className="text-xs text-gray-400 mt-2">
                ({oplogInfo.oplog_window})
              </div>
            </div>

            <div className="bg-gray-700/50 p-4 rounded border border-gray-600">
              <div className="text-sm text-gray-400 mb-2">Oplog Coverage</div>
              <div className="text-2xl font-bold text-green-400">
                {oplogInfo.oplog_window_hours >= 24 ? '✓ Good' : '⚠️ Low'}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {oplogInfo.oplog_window_hours >= 24 
                  ? 'Sufficient for recovery' 
                  : 'May be insufficient for recovery'}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm bg-gray-700/50 p-3 rounded">
              <span className="text-gray-400">First Timestamp:</span>
              <span className="font-mono text-gray-300">{new Date(oplogInfo.first_timestamp).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm bg-gray-700/50 p-3 rounded">
              <span className="text-gray-400">Last Timestamp:</span>
              <span className="font-mono text-gray-300">{new Date(oplogInfo.last_timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Test 4: Replication Alerts */}
      {alerts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">🚨 Active Replication Alerts</h2>
          
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${getAlertColor(alert.level)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-lg">{alert.type || alert.level}</div>
                  <div className={`text-xs px-3 py-1 rounded font-bold ${
                    alert.level === 'CRITICAL' ? 'bg-red-700 text-red-100' :
                    alert.level === 'WARNING' ? 'bg-yellow-700 text-yellow-100' :
                    'bg-blue-700 text-blue-100'
                  }`}>
                    {alert.level}
                  </div>
                </div>
                
                <div className="text-sm mb-3">{alert.message}</div>
                
                {alert.threat && (
                  <div className="text-xs text-gray-300 mb-2">
                    <span className="font-semibold">Threat: </span>{alert.threat}
                  </div>
                )}
                
                {alert.action && (
                  <div className="text-xs text-gray-300">
                    <span className="font-semibold">Action: </span>{alert.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts State */}
      {alerts.length === 0 && alerts !== null && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-lg font-bold text-green-400">No Active Alerts</div>
          <div className="text-sm text-gray-400 mt-1">
            Replication is working normally
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-2xl mr-3">ℹ️</div>
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">Replication Monitoring Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Oplog Lag</strong> shows delay between Primary and Secondary nodes</li>
              <li>• <strong>EXCELLENT (&lt;5s)</strong> lag indicates good network conditions</li>
              <li>• <strong>CRITICAL (&gt;30s)</strong> lag suggests performance issues</li>
              <li>• Regular monitoring helps prevent data loss from UBI.136 threat</li>
              <li>• Use Live Monitoring for continuous tracking during operations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
function TestButton({ title, icon, loading, onClick, color }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`bg-gradient-to-br ${color} hover:shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed p-6 rounded-lg transition-all shadow-md`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-bold text-sm mb-1">{title}</div>
      {loading && (
        <div className="flex items-center justify-center mt-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        </div>
      )}
    </button>
  );
}

function MetricCard({ title, value, icon, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-lg p-6 shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-200 opacity-80">{title}</div>
          <div className="text-3xl font-bold mt-1">{value}</div>
        </div>
        <div className="text-4xl opacity-30">{icon}</div>
      </div>
    </div>
  );
}

function InfoCard({ title, value, icon }) {
  return (
    <div className="bg-gray-700/50 p-4 rounded border border-gray-600">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-400 mb-2">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

export default ReplicationTests;
