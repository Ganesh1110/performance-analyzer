class NetworkAnalyzer {
  constructor() {
    this.requests = [];
  }

  // Expects standard HAR or Chrome DevTools network log format
  parseNetworkLog(networkLog = []) {
    this.requests = networkLog.map(req => ({
      timestamp: req.startTime || req.timestamp,
      duration: (req.endTime || req.timestamp + (req.duration || 0)) - (req.startTime || req.timestamp),
      url: req.url,
      method: req.method,
      size: (req.responseSize || 0) / 1024, // KB
      status: req.status
    }));
  }

  correlateWithBottlenecks(bottlenecks) {
    if (!this.requests.length) return bottlenecks;

    return bottlenecks.map(bottleneck => {
      // Find requests active during the bottleneck window (±100ms)
      const concurrentRequests = this.requests.filter(req =>
        req.timestamp >= bottleneck.timestamp - 100 &&
        req.timestamp <= bottleneck.timestamp + 100
      );

      const slowRequests = concurrentRequests.filter(req => req.duration > 200);

      return {
        ...bottleneck,
        networkActivity: {
          concurrentCount: concurrentRequests.length,
          slowCount: slowRequests.length,
          totalDuration: concurrentRequests.reduce((sum, r) => sum + r.duration, 0).toFixed(0),
          likelyBlocked: slowRequests.length > 0 && bottleneck.cpuJS < 40,
          details: slowRequests.map(r => `${r.method} ${r.url.substring(0, 30)}... (${r.duration.toFixed(0)}ms)`)
        }
      };
    });
  }
}

module.exports = { NetworkAnalyzer };
