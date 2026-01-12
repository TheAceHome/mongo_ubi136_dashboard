import React from 'react';
import { Link } from 'react-router-dom';

const TestingCenter = () => {
  const testSuites = [
    {
      path: '/testing/health-check',
      title: 'Quick Health Check',
      icon: '✅',
      description: 'Быстрая проверка всех микросервисов',
      color: 'from-green-600 to-green-800',
      features: ['5 сервисов', 'Время отклика', 'Статус кластера'],
      isReady: true
    },
    {
      path: '/testing/protection',
      title: 'Protection Demo',
      icon: '🛡️',
      description: 'Демонстрация защитных механизмов',
      color: 'from-blue-600 to-blue-800',
      features: ['Safe Write', 'Unsafe Write', 'Read Concern'],
      isReady: true
    },
    {
      path: '/testing/cluster',
      title: 'Cluster Tests',
      icon: '📊',
      description: 'Тесты мониторинга кластера',
      color: 'from-purple-600 to-purple-800',
      features: ['Все узлы', 'Primary узел', 'Secondary узлы'],
      isReady: true
    },
    {
      path: '/testing/replication',
      title: 'Replication Tests',
      icon: '🔄',
      description: 'Тесты репликации и oplog lag',
      color: 'from-yellow-600 to-orange-800',
      features: ['Oplog Lag', 'Алерты', 'Статус репликации'],
      isReady: true // Этот компонент готов!
    },
    {
      path: '/testing/audit',
      title: 'Audit Tests',
      icon: '📝',
      description: 'Логирование и аудит транзакций',
      color: 'from-indigo-600 to-indigo-800',
      features: ['Логи', 'Статистика', 'Timeline'],
      isReady: true // Этот компонент готов!
    },
    {
      path: '/testing/recovery',
      title: 'Recovery Tests',
      icon: '🔧',
      description: 'Тесты восстановления узлов',
      color: 'from-pink-600 to-pink-800',
      features: ['Статус', 'Auto-heal', 'Рекомендации'],
      isReady: true
    },
    {
      path: '/testing/validation',
      title: 'Validation Tests',
      icon: '✅',
      description: 'Валидация операций перед выполнением',
      color: 'from-teal-600 to-teal-800',
      features: ['Проверка кластера', 'Кворум', 'Write Concern'],
      isReady: true
    },
    {
      path: '/testing/attack',
      title: 'Attack Simulation',
      icon: '⚔️',
      description: 'Симуляция атак и отказов узлов',
      color: 'from-red-600 to-red-800',
      features: ['Отказ узлов', 'Split-Brain', 'Recovery'],
      isReady: true
    },
    {
      path: '/testing/history',
      title: 'Test History',
      icon: '📜',
      description: 'История выполнения тестов',
      color: 'from-gray-600 to-gray-800',
      features: ['Прошлые запуски', 'Результаты', 'Экспорт']
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 shadow-lg">
        <h1 className="text-4xl font-bold mb-2">🧪 Testing Center</h1>
        <p className="text-lg text-blue-100">
          Комплексное тестирование системы защиты от угрозы UBI.136
        </p>
        <div className="mt-4 flex items-center space-x-4">
          <div className="bg-white/20 px-4 py-2 rounded-lg">
            <div className="text-2xl font-bold">{testSuites.length}</div>
            <div className="text-sm">Test Suites</div>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-lg">
            <div className="text-2xl font-bold">~35</div>
            <div className="text-sm">API Endpoints</div>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-lg">
            <div className="text-2xl font-bold">5</div>
            <div className="text-sm">Microservices</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="bg-green-600 hover:bg-green-700 p-4 rounded-lg transition-all shadow-lg hover:shadow-xl">
          <div className="text-3xl mb-2">🚀</div>
          <div className="font-bold text-lg">Run All Tests</div>
          <div className="text-sm text-green-100">Запустить все тест-сюиты</div>
        </button>
        
        <button className="bg-red-600 hover:bg-red-700 p-4 rounded-lg transition-all shadow-lg hover:shadow-xl">
          <div className="text-3xl mb-2">⚡</div>
          <div className="font-bold text-lg">Simulate Attack</div>
          <div className="text-sm text-red-100">Симулировать атаку на систему</div>
        </button>
        
        <button className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg transition-all shadow-lg hover:shadow-xl">
          <div className="text-3xl mb-2">📊</div>
          <div className="font-bold text-lg">View Reports</div>
          <div className="text-sm text-purple-100">Посмотреть отчеты тестов</div>
        </button>
      </div>

      {/* Test Suites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testSuites.map((suite, index) => (
          <Link
            key={index}
            to={suite.path}
            className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1"
          >
            <div className={`bg-gradient-to-r ${suite.color} p-6`}>
              <div className="text-5xl mb-2">{suite.icon}</div>
              <h3 className="text-2xl font-bold">{suite.title}</h3>
            </div>
            
            <div className="p-6">
              <p className="text-gray-300 mb-4">{suite.description}</p>
              
              <div className="space-y-2">
                {suite.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-gray-400">{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Статус:</span>
                  <span className={`font-semibold ${suite.isReady ? 'text-green-400' : 'text-yellow-400'}`}>
                    {suite.isReady ? '✓ Ready' : '⏳ Coming Soon'}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6">
        <div className="flex items-start">
          <div className="text-3xl mr-4">ℹ️</div>
          <div>
            <h3 className="font-bold text-lg mb-2">О Testing Center</h3>
            <p className="text-sm text-gray-300 mb-2">
              Testing Center предоставляет комплексные инструменты для тестирования и валидации 
              системы защиты от угрозы УБИ.136. Все тесты выполняются в реальном времени на 
              работающем MongoDB кластере.
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-400 mt-3">
              <span>🔄 Auto-refresh: 3s</span>
              <span>📡 Real-time monitoring</span>
              <span>💾 Test history tracking</span>
            </div>
            <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded">
              <span className="text-green-400 font-semibold">✅ Реализовано:</span>
              <div className="text-xs text-green-200 mt-1">
                • Quick Health Check - Проверка всех сервисов ✓
              </div>
              <div className="text-xs text-green-200">• Audit Tests - Логи, статистика, timeline ✓</div>
              <div className="text-xs text-green-200">• Recovery Tests - Auto-heal, рекомендации ✓</div>
              <div className="text-xs text-green-200">• Validation Tests - Проверка операций ✓</div>
              <div className="text-xs text-green-200">• Attack Simulation - Симуляция отказов ✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingCenter;
