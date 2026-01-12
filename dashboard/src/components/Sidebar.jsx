import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, toggle }) => {
  const location = useLocation();
  
  const menuItems = [
    { path: '/testing', label: 'Testing Overview', icon: '🎯', exact: true },
    { path: '/testing/health-check', label: 'Quick Health Check', icon: '✅' },
    { path: '/testing/protection', label: 'Protection Demo', icon: '🛡️' },
    { path: '/testing/cluster', label: 'Cluster Tests', icon: '📊' },
    { path: '/testing/replication', label: 'Replication Tests', icon: '🔄' },
    { path: '/testing/audit', label: 'Audit Tests', icon: '📝' },
    { path: '/testing/recovery', label: 'Recovery Tests', icon: '🔧' },
    { path: '/testing/validation', label: 'Validation Tests', icon: '✅' },
    { path: '/testing/simulation', label: 'Attack Simulation', icon: '⚔️' },
    { path: '/testing/history', label: 'Test History', icon: '📜' },
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname === item.path;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-[73px] left-0 h-[calc(100vh-73px)] bg-gray-800 border-r border-gray-700 transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-0 lg:w-64'
        } overflow-hidden`}
      >
        <div className="p-4 space-y-1 overflow-y-auto h-full">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            Test Suites
          </div>
          
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 1024 && toggle()}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive(item)
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
              
              {isActive(item) && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </Link>
          ))}

          {/* Divider */}
          <div className="border-t border-gray-700 my-4"></div>

          {/* Quick Actions */}
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            Quick Actions
          </div>
          
          <button
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-green-900/30 hover:text-green-400 transition-all border border-transparent hover:border-green-700"
          >
            <span className="text-xl">🚀</span>
            <span className="font-medium text-sm">Run All Tests</span>
          </button>

          <button
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-900/30 hover:text-red-400 transition-all border border-transparent hover:border-red-700"
          >
            <span className="text-xl">⚡</span>
            <span className="font-medium text-sm">Simulate Attack</span>
          </button>
        </div>
      </aside>

      {/* Toggle Button (Mobile) */}
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 lg:hidden bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all z-50"
      >
        {isOpen ? '✕' : '☰'}
      </button>
    </>
  );
};

export default Sidebar;
