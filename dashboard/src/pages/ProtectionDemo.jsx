import React, { useState } from 'react';
import { performSafeWrite, performUnsafeWrite, performSafeRead } from '../utils/api';

const ProtectionDemo = () => {
  const [testData, setTestData] = useState({
    key: `test_${Date.now()}`,
    value: 'Sample data for protection demo'
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result) => {
    setResults(prev => [result, ...prev].slice(0, 10)); // Keep last 10 results
  };

  const handleSafeWrite = async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const result = await performSafeWrite('protected_data', {
        key: testData.key,
        value: testData.value,
        timestamp: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      
      addResult({
        type: 'safe_write',
        success: result.success,
        data: result.data,
        duration,
        timestamp: new Date().toISOString()
      });

      if (result.success) {
        alert(`✅ Безопасная запись выполнена!\n\n` +
              `Записано на: ${result.data?.nodes_written || 'majority'} узлов\n` +
              `Время: ${result.data?.write_time_ms || duration}ms\n` +
              `Write Concern: majority\n\n` +
              `Данные защищены от потери!`);
      }
    } catch (error) {
      addResult({
        type: 'safe_write',
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsafeWrite = async () => {
    const confirmed = window.confirm(
      '⚠️ ВНИМАНИЕ!\n\n' +
      'Вы собираетесь выполнить НЕБЕЗОПАСНУЮ запись БЕЗ writeConcern:majority.\n' +
      'Это демонстрация УГРОЗЫ УБИ.136!\n\n' +
      'Данные могут быть потеряны при отказе узлов.\n\n' +
      'Продолжить?'
    );

    if (!confirmed) return;

    setLoading(true);
    const startTime = Date.now();
    
    try {
      const result = await performUnsafeWrite('unprotected_data', {
        key: testData.key,
        value: testData.value,
        warning: 'UNSAFE - No write concern!',
        timestamp: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      
      addResult({
        type: 'unsafe_write',
        success: result.success,
        data: result.data,
        duration,
        timestamp: new Date().toISOString()
      });

      if (result.success) {
        alert(`⚠️ Небезопасная запись выполнена!\n\n` +
              `Записано на: 1 узел (Primary)\n` +
              `Время: ${duration}ms\n` +
              `Write Concern: NONE\n\n` +
              `❌ РИСК: Данные могут быть потеряны при отказе Primary узла!\n` +
              `❌ УЯЗВИМОСТЬ: УБИ.136`);
      }
    } catch (error) {
      addResult({
        type: 'unsafe_write',
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSafeRead = async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const result = await performSafeRead('protected_data', {});

      const duration = Date.now() - startTime;
      
      addResult({
        type: 'safe_read',
        success: result.success,
        data: result.data,
        duration,
        timestamp: new Date().toISOString()
      });

      if (result.success) {
        const docs = result.data?.documents || [];
        alert(`✅ Безопасное чтение выполнено!\n\n` +
              `Прочитано документов: ${docs.length}\n` +
              `Read Concern: majority\n` +
              `Время: ${duration}ms\n\n` +
              `Данные читаются только с подтверждением большинства узлов!`);
      }
    } catch (error) {
      addResult({
        type: 'safe_read',
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (type) => {
    if (type === 'safe_write') return '🛡️';
    if (type === 'unsafe_write') return '⚠️';
    if (type === 'safe_read') return '📖';
    return '🔧';
  };

  const getResultColor = (type, success) => {
    if (!success) return 'border-red-500 bg-red-900/20';
    if (type === 'unsafe_write') return 'border-yellow-500 bg-yellow-900/20';
    return 'border-green-500 bg-green-900/20';
  };

  const getResultTitle = (type) => {
    if (type === 'safe_write') return 'Safe Write (majority)';
    if (type === 'unsafe_write') return 'Unsafe Write (NO guarantee)';
    if (type === 'safe_read') return 'Safe Read (majority)';
    return type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">🛡️ Protection Demo</h1>
        <p className="text-blue-100">
          Демонстрация защитных механизмов от угрозы УБИ.136
        </p>
      </div>

      {/* Test Data Input */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">📝 Тестовые данные</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ключ (Key):
            </label>
            <input
              type="text"
              value={testData.key}
              onChange={(e) => setTestData({ ...testData, key: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="test_key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Значение (Value):
            </label>
            <textarea
              value={testData.value}
              onChange={(e) => setTestData({ ...testData, value: e.target.value })}
              rows="3"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="Your data here..."
            />
          </div>

          <button
            onClick={() => setTestData({ key: `test_${Date.now()}`, value: 'Sample data' })}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            🔄 Сгенерировать новый ключ
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Safe Write */}
        <button
          onClick={handleSafeWrite}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          <div className="text-4xl mb-3">🛡️</div>
          <div className="font-bold text-lg mb-2">Safe Write</div>
          <div className="text-sm text-green-100">
            writeConcern: majority
          </div>
          <div className="text-xs text-green-200 mt-2">
            ✓ Защищено от УБИ.136
          </div>
        </button>

        {/* Unsafe Write */}
        <button
          onClick={handleUnsafeWrite}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 p-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed border-2 border-red-400"
        >
          <div className="text-4xl mb-3">⚠️</div>
          <div className="font-bold text-lg mb-2">Unsafe Write</div>
          <div className="text-sm text-red-100">
            NO write concern
          </div>
          <div className="text-xs text-red-200 mt-2">
            ✗ Уязвимо к УБИ.136!
          </div>
        </button>

        {/* Safe Read */}
        <button
          onClick={handleSafeRead}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 p-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          <div className="text-4xl mb-3">📖</div>
          <div className="font-bold text-lg mb-2">Safe Read</div>
          <div className="text-sm text-blue-100">
            readConcern: majority
          </div>
          <div className="text-xs text-blue-200 mt-2">
            ✓ Читает только согласованные данные
          </div>
        </button>
      </div>

      {/* Comparison Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">⚖️ Сравнение методов</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4">Характеристика</th>
                <th className="text-left py-3 px-4">Safe Write</th>
                <th className="text-left py-3 px-4">Unsafe Write</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700">
                <td className="py-3 px-4 font-medium">Write Concern</td>
                <td className="py-3 px-4 text-green-400">✓ majority</td>
                <td className="py-3 px-4 text-red-400">✗ none / default</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-3 px-4 font-medium">Узлов для записи</td>
                <td className="py-3 px-4 text-green-400">2+ из 3</td>
                <td className="py-3 px-4 text-red-400">1 (только Primary)</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-3 px-4 font-medium">Защита от отказа узла</td>
                <td className="py-3 px-4 text-green-400">✓ Да</td>
                <td className="py-3 px-4 text-red-400">✗ Нет</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-3 px-4 font-medium">Риск потери данных</td>
                <td className="py-3 px-4 text-green-400">Минимальный</td>
                <td className="py-3 px-4 text-red-400">ВЫСОКИЙ</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-3 px-4 font-medium">Защита от УБИ.136</td>
                <td className="py-3 px-4 text-green-400">✓ Защищено</td>
                <td className="py-3 px-4 text-red-400">✗ Уязвимо</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">Производительность</td>
                <td className="py-3 px-4 text-yellow-400">Немного медленнее</td>
                <td className="py-3 px-4 text-green-400">Быстрее</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Results History */}
      {results.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📊 История операций</h2>
          
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 ${getResultColor(result.type, result.success)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="text-3xl mr-3">{getResultIcon(result.type)}</div>
                    <div>
                      <div className="font-bold">{getResultTitle(result.type)}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(result.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                      {result.success ? '✓ SUCCESS' : '✗ FAILED'}
                    </div>
                    <div className="text-sm text-gray-400">{result.duration}ms</div>
                  </div>
                </div>

                {result.error && (
                  <div className="mt-3 p-2 bg-red-900/30 rounded text-xs text-red-300">
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
        <div className="flex items-start">
          <div className="text-2xl mr-3">⚠️</div>
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">Важно:</p>
            <p>
              <strong>Safe Write</strong> с writeConcern:majority гарантирует, что данные записаны 
              на большинство узлов (2 из 3). Это защищает от потери данных при отказе одного узла.
              <br/><br/>
              <strong>Unsafe Write</strong> записывает данные только на Primary узел без ожидания 
              репликации. Если Primary узел откажет до репликации - данные будут потеряны!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtectionDemo;
