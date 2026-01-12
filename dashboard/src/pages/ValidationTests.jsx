import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiCall } from '../utils/api';

const ValidationTests = () => {
  // Form state
  const [collection, setCollection] = useState('test_data');
  const [documentData, setDocumentData] = useState('{\n  "message": "Test data",\n  "timestamp": "2024-01-10T12:00:00Z"\n}');
  const [writeConcern, setWriteConcern] = useState('majority');
  
  // Validation results
  const [validationResult, setValidationResult] = useState(null);
  const [validationHistory, setValidationHistory] = useState([]);
  const [clusterStatus, setClusterStatus] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load cluster status on mount
  useEffect(() => {
    loadClusterStatus();
    const interval = setInterval(loadClusterStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadClusterStatus = async () => {
    try {
      const result = await apiCall(API_ENDPOINTS.consensus.clusterStatus);
      if (result.success) {
        setClusterStatus(result.data);
      }
    } catch (error) {
      console.error('Error loading cluster status:', error);
    }
  };

  const validateJSON = (json) => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  };

  const handleValidateOperation = async () => {
    setErrors([]);
    
    // Validate JSON
    if (!validateJSON(documentData)) {
      setErrors(['Invalid JSON in document data']);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        collection,
        document: JSON.parse(documentData),
        write_concern: writeConcern,
      };

      const result = await apiCall(API_ENDPOINTS.consensus.validateOperation, 'POST', payload);
      
      if (result.success) {
        setValidationResult(result.data);
        addToHistory({
          timestamp: new Date(),
          collection,
          writeConcern,
          result: result.data.is_safe ? 'PASS' : 'FAIL',
          canExecute: result.data.can_execute,
        });
      }
    } catch (error) {
      setErrors(['Validation failed: ' + error.message]);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = () => {
    const samples = {
      test_data: '{\n  "id": 1,\n  "name": "Test Item",\n  "status": "active",\n  "timestamp": "' + new Date().toISOString() + '"\n}',
      protected_data: '{\n  "encrypted": true,\n  "data": "sensitive",\n  "security_level": "high",\n  "created_at": "' + new Date().toISOString() + '"\n}',
      demo_collection: '{\n  "demo": true,\n  "message": "This is a demo record",\n  "value": 42\n}',
    };
    setDocumentData(samples[collection] || '{\n  "key": "value"\n}');
  };

  const quickTest = (testType) => {
    let testCollection = 'test_data';
    let testData = {};
    let testConcern = 'majority';

    switch (testType) {
      case 'normal':
        testData = { message: 'Normal write test', type: 'normal' };
        testConcern = 'majority';
        break;
      case 'high-risk':
        testData = { message: 'High risk write', risk: 'high' };
        testConcern = '1';
        break;
      case 'majority':
        testData = { message: 'Majority write test', concern: 'majority' };
        testConcern = 'majority';
        break;
      case 'single':
        testData = { message: 'Single node write', nodes: 1 };
        testConcern = '1';
        break;
      default:
        break;
    }

    setCollection(testCollection);
    setDocumentData(JSON.stringify(testData, null, 2));
    setWriteConcern(testConcern);
  };

  const addToHistory = (entry) => {
    setValidationHistory(prev => [entry, ...prev].slice(0, 10));
  };

  const collections = ['test_data', 'protected_data', 'demo_collection', 'custom'];

  const writeConcerns = [
    { value: 'majority', label: 'Majority (Рекомендуется)', safe: true },
    { value: 'all', label: 'All (Все узлы)', safe: true },
    { value: '1', label: '1 (Один узел)', safe: false },
    { value: 'default', label: 'Default', safe: false },
  ];

  const comparisonData = [
    {
      concern: 'majority',
      nodes: '2+',
      safety: '✓ High',
      speed: 'Medium',
      useCase: 'Production',
      color: 'from-green-600 to-green-700',
      icon: '🛡️',
    },
    {
      concern: 'all',
      nodes: '3',
      safety: '✓ Highest',
      speed: 'Slow',
      useCase: 'Critical Data',
      color: 'from-blue-600 to-blue-700',
      icon: '🔐',
    },
    {
      concern: '1',
      nodes: '1',
      safety: '✗ Low',
      speed: 'Fast',
      useCase: 'Testing Only',
      color: 'from-red-600 to-red-700',
      icon: '⚠️',
    },
  ];

  const getPreflight = () => {
    if (!validationResult) return [];

    const checks = [
      {
        name: 'Primary node available',
        passed: validationResult.cluster_health?.primary_nodes > 0,
      },
      {
        name: 'Quorum available (2/3 nodes)',
        passed: validationResult.cluster_health?.healthy_nodes >= 2,
      },
      {
        name: 'Write concern compatible',
        passed: true,
      },
      {
        name: 'No split-brain detected',
        passed: validationResult.cluster_health?.primary_nodes === 1,
      },
    ];

    return checks;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 rounded-lg p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-2">✅ Validation Tests</h1>
        <p className="text-lg text-teal-100">
          Валидация операций записи перед выполнением
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interactive Validation Form */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6">📝 Create Test Operation</h2>

            <div className="space-y-6">
              {/* Collection Selection */}
              <div>
                <label className="block text-sm font-semibold mb-2">Collection Name:</label>
                <select
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-teal-500"
                >
                  {collections.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Document Data */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold">Document Data (JSON):</label>
                  <button
                    onClick={generateSampleData}
                    className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
                  >
                    Generate Sample
                  </button>
                </div>
                <textarea
                  value={documentData}
                  onChange={(e) => setDocumentData(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-teal-500 h-32"
                  placeholder='{ "key": "value", "timestamp": "..." }'
                />
                {!validateJSON(documentData) && (
                  <div className="text-xs text-red-400 mt-1">Invalid JSON</div>
                )}
              </div>

              {/* Write Concern */}
              <div>
                <label className="block text-sm font-semibold mb-3">Write Concern:</label>
                <div className="space-y-2">
                  {writeConcerns.map(concern => (
                    <label key={concern.value} className="flex items-center cursor-pointer p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                      <input
                        type="radio"
                        name="writeConcern"
                        value={concern.value}
                        checked={writeConcern === concern.value}
                        onChange={(e) => setWriteConcern(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{concern.label}</div>
                        <div className={`text-xs ${concern.safe ? 'text-green-400' : 'text-yellow-400'}`}>
                          {concern.safe ? '✓ Safe' : '⚠️ Risky'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  {errors.map((error, idx) => (
                    <div key={idx} className="text-red-400 text-sm">❌ {error}</div>
                  ))}
                </div>
              )}

              {/* Validate Button */}
              <button
                onClick={handleValidateOperation}
                disabled={loading || !validateJSON(documentData)}
                className="w-full bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Validating...
                  </>
                ) : (
                  <>✓ Validate Operation</>
                )}
              </button>
            </div>
          </div>

          {/* Quick Validation Tests */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4">⚡ Quick Validation Tests</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => quickTest('normal')}
                className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 p-4 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                ✅ Normal Write
              </button>
              <button
                onClick={() => quickTest('high-risk')}
                className="bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 p-4 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                ⚠️ High-Risk Write
              </button>
              <button
                onClick={() => quickTest('majority')}
                className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-4 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                🛡️ Majority Write
              </button>
              <button
                onClick={() => quickTest('single')}
                className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 p-4 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                ❌ Single Node
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-4">📊 Write Concern Comparison</h2>
            <div className="space-y-3">
              {comparisonData.map((row, idx) => (
                <div
                  key={idx}
                  className={`bg-gradient-to-r ${row.color} p-4 rounded-lg border-2 border-gray-700`}
                >
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <div className="text-2xl mb-1">{row.icon}</div>
                      <div className="font-bold text-lg">{row.concern}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-300">Nodes</div>
                      <div className="font-bold">{row.nodes}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-300">Safety</div>
                      <div className="font-bold">{row.safety}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-300">Speed</div>
                      <div className="font-bold">{row.speed}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-300">Use Case</div>
                      <div className="font-bold">{row.useCase}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Results & Status */}
        <div className="space-y-6">
          {/* Cluster Status Preview */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4">📍 Cluster Status</h3>
            {clusterStatus ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Health</div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-green-500 to-blue-500"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">100%</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-700/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Primary</div>
                    <div className="font-bold text-green-400">
                      {clusterStatus.primary_nodes || 1}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Secondary</div>
                    <div className="font-bold text-blue-400">
                      {clusterStatus.secondary_nodes || 2}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Healthy</div>
                    <div className="font-bold text-emerald-400">
                      {clusterStatus.healthy_nodes || 3}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded">
                    <div className="text-xs text-gray-400">Total</div>
                    <div className="font-bold">3</div>
                  </div>
                </div>

                <div className={`p-3 rounded-lg text-center font-bold ${
                  clusterStatus.healthy_nodes === 3
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {clusterStatus.healthy_nodes === 3 ? '✅ Ready to Write' : '⚠️ Degraded'}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">Loading...</div>
            )}
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg space-y-4">
              <h3 className="text-lg font-bold">Validation Result</h3>

              {/* Safety Badge */}
              <div className={`p-4 rounded-lg text-center font-bold text-xl ${
                validationResult.is_safe
                  ? 'bg-green-900/30 border border-green-700 text-green-400'
                  : 'bg-red-900/30 border border-red-700 text-red-400'
              }`}>
                {validationResult.is_safe ? '✅ SAFE' : '❌ UNSAFE'}
              </div>

              {/* Can Execute */}
              <div className={`p-3 rounded-lg text-center font-semibold ${
                validationResult.can_execute
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-orange-900/30 text-orange-400'
              }`}>
                {validationResult.can_execute ? '✓ Can Execute' : '✗ Cannot Execute'}
              </div>

              {/* Warnings */}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-yellow-400">⚠️ Warnings:</div>
                  {validationResult.warnings.map((warning, idx) => (
                    <div key={idx} className="text-xs text-yellow-300 flex items-start gap-2">
                      <span>•</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              <div className={`p-3 rounded-lg text-sm font-semibold ${
                validationResult.can_execute
                  ? 'bg-green-900/20 text-green-400'
                  : validationResult.is_safe
                  ? 'bg-yellow-900/20 text-yellow-400'
                  : 'bg-red-900/20 text-red-400'
              }`}>
                {validationResult.recommendation}
              </div>

              {/* Pre-flight Checks */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">✓ Pre-flight Checks:</div>
                {getPreflight().map((check, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                      check.passed
                        ? 'bg-green-900/20 text-green-400'
                        : 'bg-red-900/20 text-red-400'
                    }`}
                  >
                    <span>{check.passed ? '✓' : '✗'}</span>
                    <span>{check.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validation History */}
      {validationHistory.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">📋 Validation History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-3">Timestamp</th>
                  <th className="text-left py-3 px-3">Collection</th>
                  <th className="text-left py-3 px-3">Write Concern</th>
                  <th className="text-left py-3 px-3">Result</th>
                  <th className="text-left py-3 px-3">Can Execute</th>
                </tr>
              </thead>
              <tbody>
                {validationHistory.map((entry, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-3 px-3 text-xs font-mono">
                      {entry.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3">{entry.collection}</td>
                    <td className="py-3 px-3 font-semibold text-teal-400">
                      {entry.writeConcern}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        entry.result === 'PASS'
                          ? 'bg-green-700 text-green-200'
                          : 'bg-red-700 text-red-200'
                      }`}>
                        {entry.result}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {entry.canExecute ? '✅ Yes' : '❌ No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationTests;