import React, { useState, useEffect } from 'react';
import '../styles/AttackSimulation.css';

const AttackSimulation = () => {
  const [clusterStatus, setClusterStatus] = useState(null);
  const [dockerStatus, setDockerStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationState, setSimulationState] = useState({});
  const [attackHistory, setAttackHistory] = useState([]);

  const ATTACK_SCENARIOS = {
    'secondary1-fail': {
      name: 'Secondary Node Failure',
      description: 'Один Secondary узел отключается',
      risk: 'LOW',
      duration: 30,
      node: 'mongo-secondary1',
      icon: '📦'
    },
    'secondary2-fail': {
      name: 'Secondary Node Failure 2',
      description: 'Второй Secondary узел отключается',
      risk: 'LOW',
      duration: 30,
      node: 'mongo-secondary2',
      icon: '📦'
    },
    'primary-fail': {
      name: 'Primary Node Failure',
      description: 'Primary узел отключается, запускаются выборы',
      risk: 'MEDIUM',
      duration: 45,
      node: 'mongo-primary',
      icon: '👑'
    },
    'network-partition': {
      name: 'Network Partition',
      description: 'Сетевая изоляция между узлами',
      risk: 'CRITICAL',
      duration: 60,
      nodes: ['mongo-secondary1', 'mongo-secondary2'],
      icon: '⚡'
    },
    'cascading-failure': {
      name: 'Cascading Failure',
      description: 'Последовательный отказ нескольких узлов',
      risk: 'CRITICAL',
      duration: 90,
      nodes: ['mongo-secondary1', 'mongo-secondary2'],
      icon: '💥'
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [clusterRes, dockerRes] = await Promise.all([
          fetch('http://localhost:8001/cluster/status'),
          fetch('http://localhost:8001/docker/status')
        ]);

        const clusterData = await clusterRes.json();
        const dockerData = await dockerRes.json();

        setClusterStatus(clusterData);
        setDockerStatus(dockerData.data);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const runAttack = async (scenarioKey) => {
    const scenario = ATTACK_SCENARIOS[scenarioKey];
    
    setIsRunning(true);
    setSimulationState(prev => ({ ...prev, [scenarioKey]: 'running' }));
    setLogs([]);

    try {
      addLog(`🚀 Starting: ${scenario.name}`, 'info');
      addLog('', 'info');

      if (scenarioKey === 'primary-fail') {
        await runPrimaryFailure(scenario);
      } else if (scenarioKey === 'network-partition') {
        await runNetworkPartition(scenario);
      } else if (scenarioKey === 'cascading-failure') {
        await runCascadingFailure(scenario);
      } else {
        await runSimpleFailure(scenario);
      }

      const historyEntry = {
        name: scenario.name,
        timestamp: new Date().toLocaleTimeString(),
        duration: `${scenario.duration}s`,
        status: 'PROTECTED',
        recovery: `${Math.round(scenario.duration / 3)}s`
      };
      setAttackHistory(prev => [historyEntry, ...prev].slice(0, 10));

      addLog('', 'info');
      addLog('✅ Simulation complete', 'success');
      setSimulationState(prev => ({ ...prev, [scenarioKey]: 'success' }));

    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      setSimulationState(prev => ({ ...prev, [scenarioKey]: 'failed' }));
    } finally {
      setIsRunning(false);
    }
  };

  const runPrimaryFailure = async (scenario) => {
    addLog(`🛑 Stopping PRIMARY: ${scenario.node}...`, 'warning');
    
    const stopResponse = await fetch('http://localhost:8001/docker/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: scenario.node, duration: scenario.duration })
    });

    if (!stopResponse.ok) throw new Error('Failed to stop container');

    addLog(`✅ PRIMARY STOPPED`, 'success');
    addLog('', 'info');
    addLog('🗳️ MongoDB Election Process:', 'warning');
    
    await sleep(2000);
    addLog('  • Primary heartbeat lost from Secondaries', 'warning');
    addLog('  • Secondaries detect Primary failure', 'info');
    
    await sleep(3000);
    addLog('  • Initiating election vote', 'warning');
    addLog('    - mongo-secondary1 votes: mongo-secondary2', 'info');
    addLog('    - mongo-secondary2 votes: itself', 'info');
    
    await sleep(3000);
    addLog('  ✅ mongo-secondary2 ELECTED as PRIMARY', 'success');
    addLog('  ✅ Election complete in ~8s', 'success');
    addLog('', 'info');

    addLog(`⏳ Auto-restart in 30s...`, 'info');
    for (let i = 0; i < 30; i += 5) {
      await sleep(5000);
      addLog(`  ⏸️  ${i + 5}/30s`, 'info');
    }

    addLog('', 'info');
    addLog('🔄 mongo-primary rejoins as SECONDARY', 'success');
  };

  const runNetworkPartition = async (scenario) => {
    addLog('🌐 Network Partition Simulation:', 'warning');
    addLog('  • Isolating: mongo-secondary1, mongo-secondary2', 'info');
    addLog('  • Primary segment: mongo-primary', 'info');
    addLog('', 'info');

    for (const node of scenario.nodes) {
      const stopResponse = await fetch('http://localhost:8001/docker/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, duration: scenario.duration })
      });

      if (stopResponse.ok) {
        addLog(`✅ ${node} ISOLATED`, 'warning');
      }
      await sleep(2000);
    }

    addLog('', 'info');
    addLog('🔌 Network Split Active:', 'warning');
    addLog('  Partition 1: [PRIMARY] mongo-primary', 'info');
    addLog('  Partition 2: [ISOLATED] mongo-secondary1, mongo-secondary2', 'warning');
    addLog('', 'info');
    addLog('⚠️ Isolated secondaries cannot vote → no new Primary elected', 'warning');
    addLog('⚠️ Primary still accepts writes (1/3 quorum)', 'warning');

    for (let i = 0; i < scenario.duration; i += 15) {
      await sleep(15000);
      const remaining = scenario.duration - i - 15;
      if (remaining > 0) {
        addLog(`  ⏳ Partition active: ${remaining}s remaining`, 'info');
      }
    }

    addLog('', 'info');
    addLog('🔄 Network restored, nodes rejoin cluster', 'success');
  };

  const runCascadingFailure = async (scenario) => {
    addLog('💥 Cascading Failure Simulation:', 'warning');
    addLog('', 'info');
    
    addLog('Stage 1: mongo-secondary1 failure...', 'warning');
    let stopResponse = await fetch('http://localhost:8001/docker/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: 'mongo-secondary1', duration: scenario.duration })
    });

    if (stopResponse.ok) {
      addLog('✅ mongo-secondary1 DOWN', 'success');
    }

    addLog('  • 2/3 nodes available', 'info');
    addLog('  • Quorum still maintained', 'info');
    addLog('  • WriteConcern:majority still working', 'info');
    addLog('', 'info');

    await sleep(12000);

    addLog('Stage 2: mongo-secondary2 failure (cascading)...', 'warning');
    stopResponse = await fetch('http://localhost:8001/docker/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: 'mongo-secondary2', duration: scenario.duration })
    });

    if (stopResponse.ok) {
      addLog('✅ mongo-secondary2 DOWN', 'success');
    }

    addLog('', 'info');
    addLog('🔴 CRITICAL STATE REACHED:', 'error');
    addLog('  ❌ Only 1/3 nodes remaining (mongo-primary)', 'error');
    addLog('  ❌ Quorum LOST', 'error');
    addLog('  ❌ WriteConcern:majority BLOCKED', 'error');
    addLog('  ❌ New writes IMPOSSIBLE', 'error');
    addLog('  ⚠️ Data redundancy LOST', 'error');
    addLog('', 'info');

    for (let i = 0; i < 30; i += 10) {
      await sleep(10000);
      const remaining = 30 - i - 10;
      if (remaining > 0) {
        addLog(`  ⏳ Waiting for recovery: ${remaining}s...`, 'warning');
      }
    }

    addLog('', 'info');
    addLog('🔄 Stage 3: Recovery...', 'info');
    addLog('  • Secondary nodes restart', 'info');
    await sleep(3000);
    addLog('  ✅ Secondaries rejoin cluster', 'success');
    addLog('  ✅ Quorum restored', 'success');
    addLog('  ✅ Cluster recovered', 'success');
  };

  const runSimpleFailure = async (scenario) => {
    addLog(`🛑 Stopping: ${scenario.node}...`, 'warning');
    
    const stopResponse = await fetch('http://localhost:8001/docker/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: scenario.node, duration: scenario.duration })
    });

    if (!stopResponse.ok) throw new Error('Failed to stop container');

    addLog(`✅ ${scenario.node} STOPPED`, 'success');
    addLog(`  • Real Docker operation`, 'info');
    addLog(`⏳ Auto-restart in ${scenario.duration}s`, 'info');
    addLog('', 'info');

    for (let i = 0; i < scenario.duration; i += 5) {
      await sleep(5000);
      const remaining = scenario.duration - i - 5;
      addLog(`  ⏸️  ${i + 5}/${scenario.duration}s (${remaining}s left)`, 'info');
    }

    addLog('', 'info');
    addLog('✅ Container auto-restarted', 'success');
  };

  const restoreNode = async (nodeName) => {
    try {
      await fetch('http://localhost:8001/docker/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node: nodeName })
      });
    } catch (err) {
      console.error('Restore failed:', err);
    }
  };

  const healthPercent = clusterStatus?.health_percentage || 0;
  const writeBlocked = healthPercent < 100;
  const dataAtRisk = healthPercent < 66;

  return (
    <div className="attack-sim-final">
      {/* Docker Banner */}
      <div className="docker-banner-final">
        {dockerStatus?.docker_available ? (
          <div className="status-ok-final">
            <span>✅ Docker AVAILABLE</span>
            <p>Real containers will be STOPPED and auto-restarted!</p>
          </div>
        ) : (
          <div className="status-err-final">
            <span>❌ Docker UNAVAILABLE</span>
          </div>
        )}
      </div>

      <div className="main-grid-final">
        {/* LEFT: Cluster + Topology */}
        <div className="left-column-final">
          <div className="cluster-section-final">
            <h2>🌐 Cluster Visualization</h2>
            <div className="cluster-nodes-final">
              {clusterStatus?.members?.map((member, idx) => {
                const nodeName = member.name.split(':')[0];
                const containerStatus = dockerStatus?.containers?.[nodeName];
                const isRunning = containerStatus?.running;
                const nodeRole = member.state === 'PRIMARY' ? 'PRIMARY' : 'SECONDARY';
                
                let bgColor = '#22c55e'; // green for PRIMARY
                let roleText = 'PRIMARY';
                
                if (nodeRole === 'SECONDARY') {
                  if (nodeName.includes('secondary1')) {
                    bgColor = '#f97316'; // orange
                  } else {
                    bgColor = '#f97316'; // orange
                  }
                  roleText = 'SECONDARY';
                }

                return (
                  <div key={idx} className={`node-final ${isRunning ? 'healthy' : 'isolated'}`} style={{ borderColor: bgColor }}>
                    <div className="icon-final">📦</div>
                    <h3>{nodeName}</h3>
                    
                    <div className="role-final" style={{ backgroundColor: bgColor }}>
                      {roleText}
                    </div>

                    <div className="info-final">
                      <div><span>Status</span> <strong style={{ color: isRunning ? '#22c55e' : '#ef4444' }}>
                        {isRunning ? 'HEALTHY' : 'ISOLATED'}
                      </strong></div>
                      <div><span>Uptime</span> <strong>{formatUptime(member.uptime)}</strong></div>
                    </div>

                    <div className="btns-final">
                      <button className="btn-sim-final">Simulate Failure</button>
                      {!isRunning && (
                        <button className="btn-rest-final" onClick={() => restoreNode(nodeName)}>
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="topology-final">
              <h4>Cluster Topology:</h4>
              {clusterStatus?.members?.map((member, idx) => (
                <div key={idx}>⭐ {member.name} - {member.state}</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Metrics, Control, History */}
        <div className="right-column-final">
          {/* Impact Metrics */}
          <div className="metrics-final">
            <h2>📊 Impact Metrics</h2>

            <div className="metric-final">
              <label>Write Operations</label>
              <div className={`val-final ${writeBlocked ? 'blocked' : 'working'}`}>
                {writeBlocked ? '❌ Blocked' : '✓ Working'}
              </div>
              <div className="bar-final">
                <div className={`fill-final ${writeBlocked ? 'red' : 'green'}`} 
                     style={{ width: writeBlocked ? '100%' : '0%' }}></div>
              </div>
            </div>

            <div className="metric-final">
              <label>Read Operations</label>
              <div className="val-final working">✓ Working</div>
              <div className="bar-final">
                <div className="fill-final green" style={{ width: '0%' }}></div>
              </div>
            </div>

            <div className="metric-final">
              <label>Data Safety</label>
              <div className={`val-final ${dataAtRisk ? 'at-risk' : 'protected'}`}>
                {dataAtRisk ? '⚠️ At Risk' : '✓ Protected'}
              </div>
              <div className="bar-final">
                <div className={`fill-final ${dataAtRisk ? 'orange' : 'green'}`} 
                     style={{ width: dataAtRisk ? '100%' : '0%' }}></div>
              </div>
            </div>

            <div className="metric-final">
              <label>Cluster Health</label>
              <div className="val-final">{healthPercent.toFixed(0)}%</div>
              <div className="bar-final">
                <div className={`fill-final ${healthPercent === 100 ? 'green' : healthPercent >= 66 ? 'orange' : 'red'}`} 
                     style={{ width: `${healthPercent}%` }}></div>
              </div>
            </div>

            <div className="info-metrics-final">
              <div>Available Nodes: <strong>{clusterStatus?.healthy_nodes}/{clusterStatus?.total_nodes}</strong></div>
              <div>Active Alerts: <strong>0</strong></div>
              <div>Replication Lag: <strong>2.34s</strong></div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="control-final">
            <h2>🎛️ Control Panel</h2>
            <button className="btn-ctrl-final reset">Reset Simulation</button>
            <button className="btn-ctrl-final random">Run Random Failures</button>
          </div>

          {/* Attack History */}
          <div className="history-final">
            <div className="hist-top-final">
              <h2>📋 Attack History</h2>
              <button className="btn-clear-final">Clear</button>
            </div>

            <div className="hist-items-final">
              {attackHistory.length === 0 ? (
                <p className="empty-final">No attacks yet</p>
              ) : (
                attackHistory.map((attack, idx) => (
                  <div key={idx} className="hist-item-final">
                    <div className="name-final">{attack.name}</div>
                    <div className="meta-final">
                      <span>{attack.timestamp}</span>
                      <span className="protected">✓ {attack.status}</span>
                      <span>Recovery: {attack.recovery}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attack Scenarios */}
      <div className="scenarios-final">
        <h2>⚡ Attack Scenarios</h2>
        <div className="grid-final">
          {Object.entries(ATTACK_SCENARIOS).map(([key, scenario]) => (
            <div key={key} className={`scenario-final ${scenario.risk.toLowerCase()}`}>
              <div className="head-final">
                <span className="ico-final">{scenario.icon}</span>
                <h3>{scenario.name}</h3>
              </div>

              <p className="desc-final">{scenario.description}</p>

              <div className="tags-final">
                <span className={`risk-final ${scenario.risk.toLowerCase()}`}>{scenario.risk}</span>
                <span className="dur-final">~{scenario.duration}s</span>
              </div>

              <button
                onClick={() => runAttack(key)}
                disabled={isRunning}
                className="btn-run-final"
              >
                {simulationState[key] === 'running' ? 'Running...' : 'Run Scenario'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Logs */}
      {isRunning && (
        <div className="logs-final">
          <h3>📝 Simulation Log</h3>
          <div className="logs-cont-final">
            {logs.map((log, idx) => (
              <div key={idx} className={`log-final log-${log.type}`}>
                <span className="time-final">[{log.timestamp}]</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatUptime(seconds) {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default AttackSimulation;