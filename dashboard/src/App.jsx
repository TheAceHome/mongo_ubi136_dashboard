import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import QuickHealthCheck from './pages/QuickHealthCheck';
import ProtectionDemo from './pages/ProtectionDemo';
import ReplicationTests from './pages/ReplicationTests';
import AuditTests from './pages/AuditTests';
import RecoveryTests from './pages/RecoveryTests';
import ValidationTests from './pages/ValidationTests';
import AttackSimulation from './pages/AttackSimulation';
import TestingCenter from './pages/TestingCenter';

function App() {
  return (
    <Router>
      <div className="bg-gray-900 min-h-screen text-white">
        {/* Navigation */}
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg hover:text-purple-400 transition">
              <span className="text-2xl">🛡️</span>
              UBI.136 Protection
            </Link>
            
            <div className="flex items-center gap-6">
              <Link to="/" className="hover:text-purple-400 transition">Dashboard</Link>
              <Link to="/testing" className="hover:text-blue-400 transition">Testing Center</Link>
              <a 
                href="http://localhost:8001/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-purple-400 transition"
              >
                API Docs
              </a>
            </div>
          </div>
        </nav>

        {/* Routes */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/testing" element={<TestingCenter />} />
            <Route path="/testing/health-check" element={<QuickHealthCheck />} />
            <Route path="/testing/protection" element={<ProtectionDemo />} />
            <Route path="/testing/replication" element={<ReplicationTests />} />
            <Route path="/testing/audit" element={<AuditTests />} />
            <Route path="/testing/recovery" element={<RecoveryTests />} />
            <Route path="/testing/validation" element={<ValidationTests />} />
            <Route path="/testing/attack" element={<AttackSimulation />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;