// API utilities for UBI.136 Dashboard

const API_BASE = 'http://localhost';

export const API_ENDPOINTS = {
  // Consensus Service (8001)
  consensus: {
    health: `${API_BASE}:8001/health`,
    clusterStatus: `${API_BASE}:8001/cluster/status`,
    writeSafe: `${API_BASE}:8001/write/safe`,
    writeUnsafe: `${API_BASE}:8001/write/unsafe`,
    readSafe: `${API_BASE}:8001/read/safe`,
    validateOperation: `${API_BASE}:8001/validate/operation`,
  },
  
  // Replication Monitoring (8002)
  replication: {
    status: `${API_BASE}:8002/replication/status`,
    lag: `${API_BASE}:8002/replication/lag`,
    oplogInfo: `${API_BASE}:8002/replication/oplog/info`,
    alerts: `${API_BASE}:8002/monitoring/alerts`,
  },
  
  // Health Check (8003)
  health: {
    all: `${API_BASE}:8003/health/all`,
    primary: `${API_BASE}:8003/health/primary`,
    secondaries: `${API_BASE}:8003/health/secondaries`,
    network: `${API_BASE}:8003/health/network`,
    summary: `${API_BASE}:8003/health/summary`,
  },
  
  // Transaction Log (8004)
  logs: {
    recent: `${API_BASE}:8004/logs/recent`,
    byCollection: `${API_BASE}:8004/logs/by-collection`,
    stats: `${API_BASE}:8004/logs/stats`,
    timeline: `${API_BASE}:8004/audit/timeline`,
    failed: `${API_BASE}:8004/audit/failed-operations`,
    oplogTail: `${API_BASE}:8004/oplog/tail`,
  },
  
  // Recovery Service (8005)
  recovery: {
    status: `${API_BASE}:8005/recovery/status`,
    syncStatus: `${API_BASE}:8005/recovery/sync-status`,
    autoHeal: `${API_BASE}:8005/recovery/auto-heal`,
    recommendations: `${API_BASE}:8005/recovery/recommendations`,
  },
  
  // Docker Container Management (8001)
  docker: {
    status: `${API_BASE}:8001/docker/status`,
    stop: `${API_BASE}:8001/docker/stop`,
    start: `${API_BASE}:8001/docker/start`,
    restart: `${API_BASE}:8001/docker/restart`,
  },
};

// Generic API call function with error handling
export const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('API call failed:', error);
    return { success: false, error: error.message };
  }
};

// Service health check
export const checkServiceHealth = async (serviceName, endpoint) => {
  const startTime = Date.now();
  const result = await apiCall(endpoint);
  const responseTime = Date.now() - startTime;
  
  return {
    service: serviceName,
    ...result,
    responseTime,
    timestamp: new Date().toISOString(),
  };
};

// Test all services
export const testAllServices = async () => {
  const services = [
    { name: 'Consensus Service', endpoint: API_ENDPOINTS.consensus.health },
    { name: 'Replication Monitoring', endpoint: `${API_BASE}:8002/` },
    { name: 'Health Check Service', endpoint: `${API_BASE}:8003/` },
    { name: 'Transaction Log Service', endpoint: `${API_BASE}:8004/` },
    { name: 'Recovery Service', endpoint: `${API_BASE}:8005/` },
  ];

  const results = await Promise.all(
    services.map(({ name, endpoint }) => checkServiceHealth(name, endpoint))
  );

  return results;
};

// Safe write operation
export const performSafeWrite = async (collection, document, writeConcern = 'majority') => {
  return await apiCall(API_ENDPOINTS.consensus.writeSafe, {
    method: 'POST',
    body: JSON.stringify({ collection, document, write_concern: writeConcern }),
  });
};

// Unsafe write operation
export const performUnsafeWrite = async (collection, document) => {
  return await apiCall(API_ENDPOINTS.consensus.writeUnsafe, {
    method: 'POST',
    body: JSON.stringify({ collection, document }),
  });
};

// Safe read operation
export const performSafeRead = async (collection, filter = {}) => {
  const params = new URLSearchParams({
    collection,
    filter: JSON.stringify(filter),
  });
  return await apiCall(`${API_ENDPOINTS.consensus.readSafe}?${params}`);
};

// Validate operation
export const validateOperation = async (collection, document, writeConcern = 'majority') => {
  return await apiCall(API_ENDPOINTS.consensus.validateOperation, {
    method: 'POST',
    body: JSON.stringify({ collection, document, write_concern: writeConcern }),
  });
};

// Get cluster status
export const getClusterStatus = async () => {
  return await apiCall(API_ENDPOINTS.health.all);
};

// Get replication lag
export const getReplicationLag = async () => {
  return await apiCall(API_ENDPOINTS.replication.lag);
};

// Get alerts
export const getAlerts = async () => {
  const result = await apiCall(API_ENDPOINTS.replication.alerts);
  if (!result.success) {
    // Fallback if replication alerts fail
    return await apiCall(`${API_BASE}:8001/alerts`);
  }
  return result;
};

// Get recent logs
export const getRecentLogs = async (limit = 10) => {
  return await apiCall(`${API_ENDPOINTS.logs.recent}?limit=${limit}`);
};

// Get log statistics
export const getLogStats = async () => {
  return await apiCall(API_ENDPOINTS.logs.stats);
};

// Get recovery status
export const getRecoveryStatus = async () => {
  return await apiCall(API_ENDPOINTS.recovery.status);
};

// Get recovery recommendations
export const getRecoveryRecommendations = async () => {
  return await apiCall(API_ENDPOINTS.recovery.recommendations);
};

// Trigger auto-heal
export const triggerAutoHeal = async () => {
  return await apiCall(API_ENDPOINTS.recovery.autoHeal, { method: 'POST' });
};

// ============= DOCKER OPERATIONS =============

// Get Docker status
export const getDockerStatus = async () => {
  return await apiCall(API_ENDPOINTS.docker.status);
};

// Stop a container (with auto-restart after duration)
export const stopContainer = async (nodeName, duration = 30) => {
  return await apiCall(API_ENDPOINTS.docker.stop, {
    method: 'POST',
    body: JSON.stringify({ 
      node: nodeName, 
      duration: duration
    }),
  });
};

// Start a container
export const startContainer = async (nodeName) => {
  return await apiCall(API_ENDPOINTS.docker.start, {
    method: 'POST',
    body: JSON.stringify({ node: nodeName }),
  });
};

// Restart a container
export const restartContainer = async (nodeName) => {
  return await apiCall(API_ENDPOINTS.docker.restart, {
    method: 'POST',
    body: JSON.stringify({ node: nodeName }),
  });
};

export default {
  API_ENDPOINTS,
  apiCall,
  checkServiceHealth,
  testAllServices,
  performSafeWrite,
  performUnsafeWrite,
  performSafeRead,
  validateOperation,
  getClusterStatus,
  getReplicationLag,
  getAlerts,
  getRecentLogs,
  getLogStats,
  getRecoveryStatus,
  getRecoveryRecommendations,
  triggerAutoHeal,
  getDockerStatus,
  stopContainer,
  startContainer,
  restartContainer,
};
