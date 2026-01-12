import React, { useState, useEffect } from 'react';
import { getRecentLogs, getLogStats, API_ENDPOINTS, apiCall } from '../utils/api';

const AuditTests = () => {
  // State for all tests
  const [recentLogs, setRecentLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [failedOps, setFailedOps] = useState([]);
  const [oplogTail, setOplogTail] = useState([]);

  // UI State
  const [activeTab, setActiveTab] = useState('logs');
  const [logsLimit, setLogsLimit] = useState(10);
  const [timelinePeriod, setTimelinePeriod] = useState(24);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [filterCollection, setFilterCollection] = useState('all');

  // Loading states
  const [loading, setLoading] = useState({
    logs: false,
    stats: false,
    timeline: false,
    failed: false,
    oplog: false,
  });

  // Live monitoring for oplog
  const [liveOplog, setLiveOplog] = useState(false);
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalToday: 0,
    successRate: 0,
    avgTime: 0,
    failedCount: 0,
  });

  // Test 1: Load Recent Logs
  const testRecentLogs = async () => {
    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const result = await getRecentLogs(logsLimit);
      if (result.success) {
        setRecentLogs(result.data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

  // Test 2: Get Statistics
  const testStatistics = async () => {
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const result = await getLogStats();
      if (result.success) {
        setStatistics(result.data);
        // Update summary metrics
        setSummaryMetrics(prev => ({
          ...prev,
          totalToday: result.data.total_operations,
          successRate: calculateSuccessRate(result.data.operations_by_result),
          failedCount: result.data.operations_by_result?.find(r => r._id === 'failed')?.count || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  };

  // Test 3: Get Timeline
  const testTimeline = async () => {
    setLoading(prev => ({ ...prev, timeline: true }));
    try {
      const result = await apiCall(`${API_ENDPOINTS.logs.timeline}?hours=${timelinePeriod}`);
      if (result.success) {
        setTimeline(result.data.timeline || []);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(prev => ({ ...prev, timeline: false }));
    }
  };

  // Test 4: Get Failed Operations
  const testFailedOperations = async () => {
    setLoading(prev => ({ ...prev, failed: true }));
    try {
      const result = await apiCall(API_ENDPOINTS.logs.failed);
      if (result.success) {
        setFailedOps(result.data.operations || []);
      }
    } catch (error) {
      console.error('Error fetching failed operations:', error);
    } finally {
      setLoading(prev => ({ ...prev, failed: false }));
    }
  };

  // Test 5: Get Oplog Tail
  const testOplogTail = async () => {
    setLoading(prev => ({ ...prev, oplog: true }));
    try {
      const result = await apiCall(`${API_ENDPOINTS.logs.oplogTail}?limit=10`);
      if (result.success) {
        setOplogTail(result.data.entries || []);
      }
    } catch (error) {
      console.error('Error fetching oplog tail:', error);
    } finally {
      setLoading(prev => ({ ...prev, oplog: false }));
    }
  };

  // Live oplog monitoring
  useEffect(() => {
    if (!liveOplog) return;

    const interval = setInterval(async () => {
      await testOplogTail();
    }, 2000);

    return () => clearInterval(interval);
  }, [liveOplog]);

  // Helper functions
  const calculateSuccessRate = (operations) => {
    if (!operations || operations.length === 0) return 0;
    const total = operations.reduce((sum, op) => sum + op.count, 0);
    const success = operations.find(op => op._id === 'success')?.count || 0;
    return Math.round((success / total) * 100);
  };

  const getOperationIcon = (type) => {
    if (type === 'insert') return '➕';
    if (type === 'update') return '✏️';
    if (type === 'delete') return '🗑️';
    return '📝';
  };

  const getOperationOp = (op) => {
    if (op === 'i') return '➕ insert';
    if (op === 'u') return '✏️ update';
    if (op === 'd') return '🗑️ delete';
    return '📝 ' + op;
  };

  // Filter and search logs
  const filteredLogs = recentLogs.filter(log => {
    const matchesSearch = log.target_collection?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.operation_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || log.operation_type === filterType;
    const matchesResult = filterResult === 'all' || log.result === filterResult;
    const matchesCollection = filterCollection === 'all' || log.target_collection === filterCollection;
    
    return matchesSearch && matchesType && matchesResult && matchesCollection;
  });

  // Export to JSON
  const exportToJSON = () => {
    const dataToExport = {
      exportDate: new Date().toISOString(),
      recentLogs: recentLogs,
      statistics: statistics,
      failedOperations: failedOps,
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ubi136-audit-export-${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const tabs = [
    { id: 'logs', label: 'Recent Logs', icon: '📝' },
    { id: 'stats', label: 'Statistics', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '⏰' },
    { id: 'failed', label: 'Failed Operations', icon: '❌' },
    { id: 'oplog', label: 'Oplog Tail', icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-2">📝 Transaction Audit Tests</h1>
        <p className="text-lg text-indigo-100">
          Логирование и аудит всех операций с данными
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Operations Today"
          value={summaryMetrics.totalToday}
          icon="📊"
          color="from-blue-600 to-cyan-600"
        />
        <SummaryCard
          title="Success Rate"
          value={`${summaryMetrics.successRate}%`}
          icon="✅"
          color="from-green-600 to-emerald-600"
        />
        <SummaryCard
          title="Avg Response Time"
          value={`${summaryMetrics.avgTime}ms`}
          icon="⏱️"
          color="from-yellow-600 to-orange-600"
        />
        <SummaryCard
          title="Failed Operations"
          value={summaryMetrics.failedCount}
          icon="❌"
          color="from-red-600 to-pink-600"
        />
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search by collection, operation type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={exportToJSON}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
          >
            <span className="mr-2">📥</span>
            Export JSON
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All</option>
              <option value="insert">Insert</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-400">Result:</label>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-700 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-500 bg-indigo-900/20 text-indigo-400'
                  : 'border-transparent bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* Tab 1: Recent Logs */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={testRecentLogs}
                  disabled={loading.logs}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
                >
                  {loading.logs ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">📝</span>
                      Load Recent Logs
                    </>
                  )}
                </button>

                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-400">Limit:</label>
                  <select
                    value={logsLimit}
                    onChange={(e) => setLogsLimit(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="ml-auto text-sm text-gray-400">
                  Total: {filteredLogs.length} logs
                </div>
              </div>

              {/* Logs Table */}
              {filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-3">Timestamp</th>
                        <th className="text-left py-3 px-3">Operation</th>
                        <th className="text-left py-3 px-3">Collection</th>
                        <th className="text-left py-3 px-3">Write Concern</th>
                        <th className="text-left py-3 px-3">Result</th>
                        <th className="text-left py-3 px-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, idx) => (
                        <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                          <td className="py-3 px-3 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="flex items-center">
                              {getOperationIcon(log.operation_type)}
                              <span className="ml-2">{log.operation_type}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">{log.target_collection}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.write_concern === 'majority' ? 'bg-green-700' : 'bg-yellow-700'
                            }`}>
                              {log.write_concern}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.result === 'success' ? 'bg-green-700' : 'bg-red-700'
                            }`}>
                              {log.result}
                            </span>
                          </td>
                          <td className="py-3 px-3">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No logs found. Click "Load Recent Logs" to fetch data.
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Statistics */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <button
                onClick={testStatistics}
                disabled={loading.stats}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
              >
                {loading.stats ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📊</span>
                    Get Statistics
                  </>
                )}
              </button>

              {statistics && (
                <div className="space-y-6">
                  {/* Total Operations */}
                  <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
                    <div className="text-3xl font-bold text-indigo-400">
                      {statistics.total_operations}
                    </div>
                    <div className="text-sm text-gray-400 mt-2">Total Operations</div>
                  </div>

                  {/* Operations by Type */}
                  {statistics.operations_by_type && statistics.operations_by_type.length > 0 && (
                    <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
                      <h3 className="font-bold text-lg mb-4">Operations by Type</h3>
                      <div className="space-y-3">
                        {statistics.operations_by_type.map((op, idx) => {
                          const total = statistics.total_operations;
                          const percentage = Math.round((op.count / total) * 100);
                          return (
                            <div key={idx}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center">
                                  <span className="mr-2">{getOperationIcon(op._id)}</span>
                                  <span className="font-semibold capitalize">{op._id}</span>
                                </div>
                                <div className="text-sm">
                                  {op.count} ({percentage}%)
                                </div>
                              </div>
                              <div className="w-full bg-gray-600 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-indigo-500"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Write Concern Stats */}
                  {statistics.operations_by_write_concern && statistics.operations_by_write_concern.length > 0 && (
                    <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
                      <h3 className="font-bold text-lg mb-4">Write Concern Distribution</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {statistics.operations_by_write_concern.map((wc, idx) => (
                          <div key={idx} className="bg-gray-800 p-4 rounded">
                            <div className="font-semibold capitalize mb-2">{wc._id}</div>
                            <div className="text-2xl font-bold text-green-400">{wc.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Result Stats */}
                  {statistics.operations_by_result && statistics.operations_by_result.length > 0 && (
                    <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600">
                      <h3 className="font-bold text-lg mb-4">Result Distribution</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {statistics.operations_by_result.map((result, idx) => {
                          const isSuccess = result._id === 'success';
                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded ${isSuccess ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}
                            >
                              <div className={`font-semibold capitalize mb-2 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                                {result._id}
                              </div>
                              <div className={`text-2xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                                {result.count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={testTimeline}
                  disabled={loading.timeline}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
                >
                  {loading.timeline ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">⏰</span>
                      View Timeline
                    </>
                  )}
                </button>

                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-400">Period:</label>
                  <select
                    value={timelinePeriod}
                    onChange={(e) => setTimelinePeriod(parseInt(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1">1 hour</option>
                    <option value="6">6 hours</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                  </select>
                </div>
              </div>

              {/* Timeline List */}
              {timeline.length > 0 ? (
                <div className="space-y-2">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="bg-gray-700/50 p-3 rounded border border-gray-600">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-mono text-xs text-gray-400">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-sm">{getOperationIcon(entry.operation)}</span>
                            <span className="font-semibold">{entry.operation}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {entry.collection}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          entry.write_concern === 'majority' ? 'bg-green-700' : 'bg-yellow-700'
                        }`}>
                          {entry.write_concern}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No timeline data. Click "View Timeline" to fetch data.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Failed Operations */}
          {activeTab === 'failed' && (
            <div className="space-y-4">
              <button
                onClick={testFailedOperations}
                disabled={loading.failed}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
              >
                {loading.failed ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <span className="mr-2">❌</span>
                    Show Failed Operations
                  </>
                )}
              </button>

              {failedOps.length > 0 ? (
                <div className="space-y-3">
                  {failedOps.map((op, idx) => (
                    <div key={idx} className="bg-red-900/20 border-2 border-red-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-bold text-red-400">
                          {op.operation_type || 'Unknown Operation'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(op.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-sm text-gray-300 mb-2">
                        Collection: <span className="font-mono">{op.target_collection}</span>
                      </div>

                      {op.error && (
                        <div className="text-xs bg-red-900/50 p-2 rounded mb-2 text-red-200">
                          Error: {op.error}
                        </div>
                      )}

                      {op.threat_assessment && (
                        <div className="text-xs text-red-300 font-semibold">
                          {op.threat_assessment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  {loading.failed ? 'Loading...' : 'No failed operations. All operations are successful!'}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Oplog Tail */}
          {activeTab === 'oplog' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={testOplogTail}
                  disabled={loading.oplog}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-semibold transition-colors flex items-center"
                >
                  {loading.oplog ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">📋</span>
                      Tail Oplog
                    </>
                  )}
                </button>

                <button
                  onClick={() => setLiveOplog(!liveOplog)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    liveOplog ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      liveOplog ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>

                {liveOplog && (
                  <div className="flex items-center space-x-1 text-green-400 font-bold">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    LIVE
                  </div>
                )}
              </div>

              {/* Oplog Entries */}
              {oplogTail.length > 0 ? (
                <div className="space-y-2">
                  {oplogTail.map((entry, idx) => (
                    <div key={idx} className="bg-gray-700/50 p-3 rounded border border-gray-600">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-sm font-semibold">
                            {getOperationOp(entry.operation)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 mb-2">
                        <span className="font-mono">{entry.namespace}</span>
                      </div>

                      {entry.details && (
                        <div className="text-xs bg-gray-800 p-2 rounded text-gray-300 font-mono">
                          {entry.details.substring(0, 100)}
                          {entry.details.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No oplog entries. Click "Tail Oplog" to fetch data.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-2xl mr-3">ℹ️</div>
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">Audit Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Recent Logs</strong> shows all operation from protected_db</li>
              <li>• <strong>Statistics</strong> provides insights on write concerns and success rates</li>
              <li>• <strong>Timeline</strong> shows operations over time for trend analysis</li>
              <li>• <strong>Failed Operations</strong> helps identify issues and threats</li>
              <li>• <strong>Oplog Tail</strong> displays MongoDB operation log in real-time</li>
              <li>• Use <strong>Export JSON</strong> to save audit logs for compliance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
function SummaryCard({ title, value, icon, color }) {
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

export default AuditTests;
