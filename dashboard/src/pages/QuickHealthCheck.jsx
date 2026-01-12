import React, { useState } from 'react';
import { testAllServices, checkServiceHealth, API_ENDPOINTS } from '../utils/api';

const QuickHealthCheck = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);

  const services = [
    { name: 'Consensus Service', endpoint: API_ENDPOINTS.consensus.health, port: '8001', icon: '🛡️' },
    { name: 'Replication Monitoring', endpoint: `http://localhost:8002/`, port: '8002', icon: '🔄' },
    { name: 'Health Check Service', endpoint: `http://localhost:8003/`, port: '8003', icon: '🏥' },
    { name: 'Transaction Log', endpoint: `http://localhost:8004/`, port: '8004', icon: '📝' },
    { name: 'Recovery Service', endpoint: `http://localhost:8005/`, port: '8005', icon: '🔧' },
  ];

  const runAllTests = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      const testResults = await testAllServices();
      setResults(testResults);
      
      const passed = testResults.filter(r => r.success).length;
      const failed = testResults.filter(r => !r.success).length;
      const avgTime = testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length;
      
      setSummary({
        total: testResults.length,
        passed,
        failed,
        avgTime: Math.round(avgTime),
      });
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const testSingleService = async (service) => {
    setTesting(true);
    
    try {
      const result = await checkServiceHealth(service.name, service.endpoint);
      
      setResults(prev => {
        const filtered = prev.filter(r => r.service !== service.name);
        return [...filtered, result];
      });
    } catch (error) {
      console.error(`Test failed for ${service.name}:`, error);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = (success) => {
    return success ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20';
  };

  const getResultForService = (serviceName) => {
    return results.find(r => r.service === serviceName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg p-6 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">✅ Quick Health Check</h1>
        <p className="text-green-100">
          Быстрая проверка работоспособности всех микросервисов системы
        </p>
      </div>

      {/* Test All Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={runAllTests}
          disabled={testing}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center"
        >
          {testing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Testing...
            </>
          ) : (
            <>
              <span className="mr-2">🚀</span>
              Test All Services
            </>
          )}
        </button>

        {summary && (
          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{summary.passed}</div>
              <div className="text-xs text-gray-400">Passed</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-2xl font-bold text-red-400">{summary.failed}</div>
              <div className="text-xs text-gray-400">Failed</div>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{summary.avgTime}ms</div>
              <div className="text-xs text-gray-400">Avg Time</div>
            </div>
          </div>
        )}
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => {
          const result = getResultForService(service.name);
          const hasResult = !!result;
          const isSuccess = result?.success;

          return (
            <div
              key={index}
              className={`bg-gray-800 rounded-lg border-2 transition-all ${
                hasResult ? getStatusColor(isSuccess) : 'border-gray-700'
              }`}
            >
              <div className="p-6">
                {/* Service Icon and Name */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="text-4xl mr-3">{service.icon}</div>
                    <div>
                      <h3 className="font-bold text-lg">{service.name}</h3>
                      <div className="text-xs text-gray-400">Port {service.port}</div>
                    </div>
                  </div>
                  
                  {hasResult && (
                    <div className="text-3xl">
                      {isSuccess ? '✅' : '❌'}
                    </div>
                  )}
                </div>

                {/* Result Info */}
                {hasResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Status:</span>
                      <span className={`font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                        {isSuccess ? 'HEALTHY' : 'UNHEALTHY'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Response Time:</span>
                      <span className={`font-bold ${
                        result.responseTime < 100 ? 'text-green-400' :
                        result.responseTime < 500 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {result.responseTime}ms
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Tested:</span>
                      <span className="text-gray-300">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Response Data Preview */}
                    {isSuccess && result.data && (
                      <div className="mt-3 p-3 bg-gray-900/50 rounded text-xs">
                        <div className="text-gray-400 mb-1">Response:</div>
                        <div className="text-green-400 font-mono">
                          {result.data.status || result.data.service || 'OK'}
                        </div>
                      </div>
                    )}

                    {!isSuccess && (
                      <div className="mt-3 p-3 bg-red-900/30 rounded text-xs">
                        <div className="text-red-400 mb-1">Error:</div>
                        <div className="text-red-300">{result.error}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-2xl mb-2">⏳</div>
                    <div className="text-sm">Not tested yet</div>
                  </div>
                )}

                {/* Test Button */}
                <button
                  onClick={() => testSingleService(service)}
                  disabled={testing}
                  className={`w-full mt-4 py-2 rounded-lg font-semibold transition-all ${
                    hasResult && isSuccess
                      ? 'bg-green-600 hover:bg-green-700'
                      : hasResult
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  {testing ? 'Testing...' : hasResult ? 'Test Again' : 'Test Service'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📊 Test Results Summary</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3">Service</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Response Time</th>
                  <th className="text-left py-2 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-3 px-3 font-medium">{result.service}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        result.success ? 'bg-green-700' : 'bg-red-700'
                      }`}>
                        {result.success ? '✓ PASS' : '✗ FAIL'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${
                        result.responseTime < 100 ? 'text-green-400' :
                        result.responseTime < 500 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {result.responseTime}ms
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {new Date(result.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-2xl mr-3">💡</div>
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">Tip:</p>
            <p>
              Нажмите "Test All Services" для комплексной проверки или протестируйте 
              отдельные сервисы индивидуально. Время отклика показывает производительность 
              каждого микросервиса.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickHealthCheck;
