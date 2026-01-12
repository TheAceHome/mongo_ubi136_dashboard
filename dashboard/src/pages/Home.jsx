import React, { useState, useEffect } from 'react';
import { getClusterStatus, getReplicationLag, getAlerts, getRecentLogs, performSafeWrite } from '../utils/api';

const API_BASE = 'http://localhost';

const Home = () => {
  const [clusterStatus, setClusterStatus] = useState(null);
  const [replicationLag, setReplicationLag] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Fetch all data
  const fetchAllData = async () => {
    try {
      const [clusterRes, lagRes, alertsRes, logsRes] = await Promise.all([
        getClusterStatus(),
        getReplicationLag(),
        getAlerts(),
        getRecentLogs(5)
      ]);

      if (clusterRes.success) setClusterStatus(clusterRes.data);
      if (lagRes.success) setReplicationLag(lagRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data.alerts || []);
      if (logsRes.success) setLogs(logsRes.data.logs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  const simulateNodeFailure = async (nodeName) => {
    setSimulationRunning(true);
    alert(`Симуляция: Узел ${nodeName} отключается...\n\nВ продакшене это вызовет: docker stop ${nodeName}`);
    
    setTimeout(() => {
      fetchAllData();
      setSimulationRunning(false);
    }, 2000);
  };

  const testSafeWrite = async () => {
    const result = await performSafeWrite('demo_data', {
      message: 'Test write from dashboard',
      timestamp: new Date().toISOString()
    });

    if (result.success) {
      alert(`Безопасная запись выполнена!\n\n${JSON.stringify(result.data, null, 2)}`);
      fetchAllData();
    } else {
      alert(`Ошибка: ${result.error}`);
    }
  };

  const getNodeColor = (state, health) => {
    if (health === 'unhealthy') return 'bg-red-500';
    if (state === 'PRIMARY') return 'bg-green-500';
    if (state === 'SECONDARY') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getNodeIcon = (state) => {
    if (state === 'PRIMARY') return '👑';
    if (state === 'SECONDARY') return '📦';
    return '❓';
  };

  return (
    <div className="space-y-6">
      {/* Cluster Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">🔗 Состояние кластера</h2>
          
          {clusterStatus && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">Статус:</span>
                  <span className={`px-4 py-2 rounded-full font-bold ${
                    clusterStatus.cluster_status === 'HEALTHY' ? 'bg-green-600' :
                    clusterStatus.cluster_status === 'DEGRADED' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}>
                    {clusterStatus.cluster_status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-2xl font-bold">{clusterStatus.total_nodes}</div>
                    <div className="text-sm text-gray-400">Всего узлов</div>
                  </div>
                  <div className="bg-green-700 p-3 rounded">
                    <div className="text-2xl font-bold">{clusterStatus.healthy_nodes}</div>
                    <div className="text-sm text-gray-400">Здоровых</div>
                  </div>
                  <div className="bg-red-700 p-3 rounded">
                    <div className="text-2xl font-bold">{clusterStatus.unhealthy_nodes}</div>
                    <div className="text-sm text-gray-400">Проблемных</div>
                  </div>
                </div>
              </div>

              {/* Nodes Visualization */}
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Узлы MongoDB:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {clusterStatus.nodes?.map((node, index) => (
                    <div 
                      key={index}
                      className={`relative border-2 rounded-lg p-4 transition-all ${
                        node.health === 'healthy' ? 'border-green-500' : 'border-red-500'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-2">{getNodeIcon(node.state)}</div>
                        <div className="font-bold text-lg">{node.name.split(':')[0]}</div>
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${getNodeColor(node.state, node.health)}`}>
                          {node.state}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          Uptime: {node.uptime_formatted}
                        </div>
                        {node.ping_ms !== 'N/A' && (
                          <div className="text-xs text-gray-400">
                            Ping: {node.ping_ms}ms
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => simulateNodeFailure(node.name.split(':')[0])}
                        disabled={simulationRunning || node.health === 'unhealthy'}
                        className="w-full mt-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-2 rounded text-sm font-semibold transition-colors"
                      >
                        {node.health === 'unhealthy' ? '❌ Недоступен' : '🔌 Отключить узел'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Threat Assessment */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">⚠️ Оценка угрозы</h2>
          
          {clusterStatus?.threat_assessment && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                clusterStatus.threat_assessment.UBI['136_risk'] === 'LOW' ? 'bg-green-900' :
                clusterStatus.threat_assessment.UBI['136_risk'] === 'MEDIUM' ? 'bg-yellow-900' :
                'bg-red-900'
              }`}>
                <div className="text-sm text-gray-300 mb-1">Уровень угрозы UBI.136:</div>
                <div className="text-2xl font-bold">
                  {clusterStatus.threat_assessment.UBI['136_risk']}
                </div>
              </div>
              
              <div className="text-sm text-gray-300">
                {clusterStatus.threat_assessment.description}
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="text-sm font-semibold mb-2">Здоровье кластера:</div>
                <div className="w-full bg-gray-700 rounded-full h-6">
                  <div 
                    className={`h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      clusterStatus.health_percentage >= 80 ? 'bg-green-500' :
                      clusterStatus.health_percentage >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${clusterStatus.health_percentage}%` }}
                  >
                    {clusterStatus.health_percentage}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replication Lag */}
      {replicationLag && (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">🔄 Репликация и Oplog Lag</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400">Primary узел</div>
              <div className="text-lg font-bold">{replicationLag.primary_node?.split(':')[0]}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400">Secondary узлов</div>
              <div className="text-lg font-bold">{replicationLag.secondary_nodes_count}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-sm text-gray-400">Макс. задержка</div>
              <div className="text-lg font-bold">{replicationLag.max_lag_seconds}s</div>
            </div>
            <div className={`p-4 rounded ${
              replicationLag.overall_status === 'GOOD' ? 'bg-green-700' :
              replicationLag.overall_status === 'WARNING' ? 'bg-yellow-700' :
              'bg-red-700'
            }`}>
              <div className="text-sm text-gray-200">Общий статус</div>
              <div className="text-lg font-bold">{replicationLag.overall_status}</div>
            </div>
          </div>

          {replicationLag.lag_details && replicationLag.lag_details.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">Детальная информация:</h3>
              {replicationLag.lag_details.map((detail, index) => (
                <div key={index} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{detail.node.split(':')[0]}</div>
                    <div className="text-xs text-gray-400">{detail.threat_assessment}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{detail.lag_seconds}s</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      detail.status === 'EXCELLENT' ? 'bg-green-600' :
                      detail.status === 'GOOD' ? 'bg-blue-600' :
                      detail.status === 'WARNING' ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}>
                      {detail.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">🚨 Активные алерты</h2>
          
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">✅</div>
              <div>Нет активных алертов</div>
              <div className="text-sm mt-2">Все системы работают нормально</div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.level === 'CRITICAL' ? 'bg-red-900 border-red-500' :
                    alert.level === 'WARNING' ? 'bg-yellow-900 border-yellow-500' :
                    'bg-blue-900 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold">{alert.type || alert.level}</div>
                    <div className="text-xs px-2 py-1 bg-gray-800 rounded">{alert.level}</div>
                  </div>
                  <div className="text-sm mb-2">{alert.message}</div>
                  {alert.threat && (
                    <div className="text-xs text-gray-300 mb-1">
                      <span className="font-semibold">Угроза:</span> {alert.threat}
                    </div>
                  )}
                  {alert.action && (
                    <div className="text-xs text-gray-300">
                      <span className="font-semibold">Действие:</span> {alert.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">🎮 Действия и тесты</h2>
          
          <div className="space-y-3">
            <button
              onClick={testSafeWrite}
              className="w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <span className="mr-2">✍️</span>
              Тест безопасной записи (writeConcern:majority)
            </button>

            <button
              onClick={() => window.open(`${API_BASE}:8001/cluster/status`, '_blank')}
              className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <span className="mr-2">📊</span>
              Просмотреть детальный статус кластера
            </button>

            <button
              onClick={fetchAllData}
              className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🔄</span>
              Обновить данные вручную
            </button>

            <div className="border-t border-gray-700 pt-3 mt-3">
              <div className="text-sm text-gray-400 mb-2">Быстрый доступ к сервисам:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <a href={`${API_BASE}:8001`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-center transition-colors">
                  Consensus :8001
                </a>
                <a href={`${API_BASE}:8002`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-center transition-colors">
                  Monitoring :8002
                </a>
                <a href={`${API_BASE}:8003`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-center transition-colors">
                  Health :8003
                </a>
                <a href={`${API_BASE}:8004`} target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-center transition-colors">
                  Logs :8004
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transaction Logs */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4">📝 Последние операции</h2>
        
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Нет записанных операций
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3">Время</th>
                  <th className="text-left py-2 px-3">Операция</th>
                  <th className="text-left py-2 px-3">Коллекция</th>
                  <th className="text-left py-2 px-3">Write Concern</th>
                  <th className="text-left py-2 px-3">Результат</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-2 px-3 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3">{log.operation_type}</td>
                    <td className="py-2 px-3">{log.target_collection}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.write_concern === 'majority' ? 'bg-green-700' : 'bg-yellow-700'
                      }`}>
                        {log.write_concern}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.result === 'success' ? 'bg-green-700' : 'bg-red-700'
                      }`}>
                        {log.result}
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
};

export default Home;
