import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className="text-3xl">🛡️</div>
          <div>
            <h1 className="text-xl font-bold text-white">UBI.136 Protection System</h1>
            <p className="text-xs text-gray-400">MongoDB Consistency Monitoring</p>
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex items-center space-x-1">
          <Link
            to="/"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              location.pathname === '/'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            📊 Dashboard
          </Link>
          
          <Link
            to="/testing"
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive('/testing')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            🧪 Testing Center
          </Link>

          {/* Status Indicator */}
          <div className="ml-4 flex items-center space-x-2 px-3 py-2 bg-green-900/30 rounded-lg border border-green-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400 font-medium">System Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
